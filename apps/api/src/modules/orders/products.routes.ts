import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { authenticate } from '../../middleware/authenticate.js'
import { requireActiveSubscription } from '../../middleware/requireSubscription.js'
import { productsRepository } from './products.repository.js'
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
  stock: stockSchema.optional(),
})

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
    if (!result.success) throw Errors.validation(result.error.errors.map(e => ({ field: String(e.path[0]), message: e.message })))
    const { name, description, priceLei, category, isAvailable, isEstimate, isBookable, stock } = result.data
    const product = await productsRepository.create(req.user!.id, {
      name, description, priceBani: leiToBani(priceLei), category, isAvailable, isEstimate, isBookable, stock,
    })
    return reply.status(201).send({ product })
  })

  app.patch('/:id', { preHandler: [authenticate, requireActiveSubscription] }, async (req, reply) => {
    const id = (req.params as { id: string }).id
    const result = updateSchema.safeParse(req.body)
    if (!result.success) throw Errors.validation(result.error.errors.map(e => ({ field: String(e.path[0]), message: e.message })))

    const existing = await productsRepository.findById(req.user!.id, id)
    if (!existing) throw Errors.notFound('Product')

    const { priceLei, ...rest } = result.data
    await productsRepository.update(req.user!.id, id, {
      ...rest,
      ...(priceLei !== undefined ? { priceBani: leiToBani(priceLei) } : {}),
    })
    return reply.send({ ok: true })
  })

  app.post('/import', { preHandler: [authenticate, requireActiveSubscription] }, async (req, reply) => {
    const result = importSchema.safeParse(req.body)
    if (!result.success) throw Errors.validation(result.error.errors.map(e => ({ field: e.path.join('.'), message: e.message })))

    const count = await productsRepository.createMany(req.user!.id, result.data.items.map(it => ({
      name: it.name,
      description: it.description,
      priceBani: leiToBani(it.priceLei),
      category: it.category,
      isAvailable: it.isAvailable,
      isEstimate: it.isEstimate,
      isBookable: it.isBookable,
      stock: it.stock,
    })))
    return reply.status(201).send({ imported: count })
  })

  app.delete('/:id', { preHandler: [authenticate, requireActiveSubscription] }, async (req, reply) => {
    const id = (req.params as { id: string }).id
    await productsRepository.remove(req.user!.id, id)
    return reply.status(204).send()
  })
}
