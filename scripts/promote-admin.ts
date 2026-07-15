// Promote (or demote) an account by email.
//   npx tsx -r dotenv/config scripts/promote-admin.ts user@mail.com [--demote] dotenv_config_path=.env.local
import { eq } from 'drizzle-orm'
import { db, users } from '../src/lib/db'

const email = (process.argv[2] || '').toLowerCase().trim()
const demote = process.argv.includes('--demote')
if (!email || !email.includes('@')) {
    console.error('Usage: npx tsx -r dotenv/config scripts/promote-admin.ts <email> [--demote]')
    process.exit(1)
}

const role = demote ? 'user' : 'admin'
async function main() {
    const [row] = await db.update(users).set({ role, updatedAt: new Date() }).where(eq(users.email, email)).returning({ id: users.id, email: users.email, role: users.role })
    if (!row) { console.error(`No account found for ${email}`); process.exit(1) }
    console.log(`${row.email} → role '${row.role}'`)
}
main()
