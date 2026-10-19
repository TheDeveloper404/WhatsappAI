// Aplicația e single-user: tot ce e scopat pe `user_id` în DB aparține acestui id.
// Coloanele `user_id` rămân în schemă (compatibilitate cu datele existente), dar nu mai există
// conturi, login sau abonamente. Citit direct din process.env (nu din env.ts) ca `db:migrate`
// să nu ceară cheile LLM. OWNER_USER_ID e doar pentru migrarea unei baze SaaS existente.
export const OWNER_ID = process.env.OWNER_USER_ID?.trim() || 'owner'
