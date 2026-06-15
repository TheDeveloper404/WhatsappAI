import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { authenticate } from '../../middleware/authenticate.js'
import { requireActiveSubscription } from '../../middleware/requireSubscription.js'
import { productsRepository } from './products.repository.js'
import { userTier, productLimit } from '../billing/entitlement.js'
import { Errors } from '../../utils/errors.js'

// Prețul vine de la owner în lei (ex: 49.99) și se stochează în bani (4999).
// Niciodată float în DB — convertim la integer aici.
const leiToBani = (lei: number) => Math.round(lei * 100)

// stock: null = nelimitat, întreg >= 0 = cantitate. Plafon larg ca să nu abuzeze nimeni.
const stockSchema = z.number().int().min(0).max(1_000_000).nullable()

const createSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional().default(''),
  priceLei: z.number().nonnegative().max(1_000_000),
  category: z.string().max(60).optional().default(''),
  isAvailable: z.boolean().optional().default(true),
  // Preț estimativ („începând de la"): pentru aceste produse agentul nu propune total fix.
  isEstimate: z.boolean().optional().default(false),
  // Serviciu rezervabil (programare): agentul face programare cu handoff la owner, nu comandă.
  isBookable: z.boolean().optional().default(false),
  // Serviciu pe bază de deviz (0.5.1): fără preț, deschide cerere de deviz (handoff), nu comandă/programare.
  isQuote: z.boolean().optional().default(false),
  stock: stockSchema.optional().default(null),
})

const updateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(500).optional(),
  priceLei: z.number().nonnegative().max(1_000_000).optional(),
  category: z.string().max(60).optional(),
  isAvailable: z.boolean().optional(),
  isEstimate: z.boolean().optional(),
  isBookable: z.boolean().optional(),
  isQuote: z.boolean().optional(),
  stock: stockSchema.optional(),
})

// Modurile de serviciu sunt mutual exclusive (0.5.1): un serviciu e SAU pe deviz, SAU rezervabil,
// SAU estimativ, SAU preț-fix. Deviz are prioritate (n-are sens cu preț/oră). Normalizăm defensiv aici
// — UI trimite radio, dar importul CSV vine din date externe și poate avea combinații.
function normalizeServiceMode<T extends { isQuote?: boolean; isBookable?: boolean; isEstimate?: boolean }>(d: T): T {
  return d.isQuote ? { ...d, isBookable: false, isEstimate: false } : d
}

// Import în masă din CSV (parsat în browser, trimis ca JSON).
// Limităm la 1000 de rânduri per import ca să nu abuzeze nimeni payload-ul.
const importSchema = z.object({
  items: z.array(z.object({
    name: z.string().min(1).max(120),
    description: z.string().max(500).optional().default(''),
    priceLei: z.number().nonnegative().max(1_000_000),
    category: z.string().max(60).optional().default(''),
    isAvailable: z.boolean().optional().default(true),
    isEstimate: z.boolean().optional().default(false),
    isBookable: z.boolean().optional().default(false),
    isQuote: z.boolean().optional().default(false),
    stock: stockSchema.optional().default(null),
  })).min(1).max(1000),
})

export async function productsRoutes(app: FastifyInstance) {
  app.get('/', { preHandler: [authenticate, requireActiveSubscription] }, async (req, reply) => {
    const items = await productsRepository.list(req.user!.id)
    return reply.send({ products: items })
  })

  app.post('/', { preHandler: [authenticate, requireActiveSubscription] }, async (req, reply) => {
    const result = createSchema.safeParse(req.body)
    if (!result.success) throw Errors.validation(result.error.issues.map(e => ({ field: String(e.path[0]), message: e.message })))
    // Plafon produse pe tier (Etapa 2.2a, pas 3). Fail-closed: legacy/null → limita Pro.
    const limit = productLimit(await userTier(req.user!.id))
    if (await productsRepository.countForUser(req.user!.id) >= limit) {
      throw Errors.tierRequired(`Ai atins plafonul de ${limit} produse al planului tău. Treci pe Max pentru mai multe.`)
    }
    const { name, description, priceLei, category, isAvailable, isEstimate, isBookable, isQuote, stock } = normalizeServiceMode(result.data)
    const product = await productsRepository.create(req.user!.id, {
      name, description, priceBani: leiToBani(priceLei), category, isAvailable, isEstimate, isBookable, isQuote, stock,
    })
    return reply.status(201).send({ product })
  })

  app.patch('/:id', { preHandler: [authenticate, requireActiveSubscription] }, async (req, reply) => {
    const id = (req.params as { id: string }).id
    const result = updateSchema.safeParse(req.body)
    if (!result.success) throw Errors.validation(result.error.issues.map(e => ({ field: String(e.path[0]), message: e.message })))

    const existing = await productsRepository.findById(req.user!.id, id)
    if (!existing) throw Errors.notFound('Product')

    const { priceLei, ...rest } = normalizeServiceMode(result.data)
    await productsRepository.update(req.user!.id, id, {
      ...rest,
      ...(priceLei !== undefined ? { priceBani: leiToBani(priceLei) } : {}),
    })
    return reply.send({ ok: true })
  })

  app.post('/import', { preHandler: [authenticate, requireActiveSubscription] }, async (req, reply) => {
    const result = importSchema.safeParse(req.body)
    if (!result.success) throw Errors.validation(result.error.issues.map(e => ({ field: e.path.join('.'), message: e.message })))

    // Plafon produse pe tier (Etapa 2.2a, pas 3): importul nu poate depăși limita totală.
    const limit = productLimit(await userTier(req.user!.id))
    const existing = await productsRepository.countForUser(req.user!.id)
    if (existing + result.data.items.length > limit) {
      throw Errors.tierRequired(`Importul ar depăși plafonul de ${limit} produse al planului tău (ai deja ${existing}). Treci pe Max pentru mai multe.`)
    }

    const count = await productsRepository.createMany(req.user!.id, result.data.items.map(it => {
      const m = normalizeServiceMode(it)
      return {
        name: m.name,
        description: m.description,
        priceBani: leiToBani(m.priceLei),
        category: m.category,
        isAvailable: m.isAvailable,
        isEstimate: m.isEstimate,
        isBookable: m.isBookable,
        isQuote: m.isQuote,
        stock: m.stock,
      }
    }))
    return reply.status(201).send({ imported: count })
  })

  app.delete('/:id', { preHandler: [authenticate, requireActiveSubscription] }, async (req, reply) => {
    const id = (req.params as { id: string }).id
    // 404 când nu s-a șters nimic (inexistent / al altui user) — semantică REST corectă
    // și împiedică un atacator să confirme existența resurselor altui owner prin 204.
    const deleted = await productsRepository.remove(req.user!.id, id)
    if (!deleted) throw Errors.notFound('Product')
    return reply.status(204).send()
  })
}
