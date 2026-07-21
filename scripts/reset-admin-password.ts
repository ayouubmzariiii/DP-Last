// Reset an account's password to a known value.
//   npx tsx -r dotenv/config scripts/reset-admin-password.ts <email> <newPassword> dotenv_config_path=.env.local
import { eq } from 'drizzle-orm'
import { db, users } from '../src/lib/db'
import { hashPassword } from '../src/lib/auth'

const email = (process.argv[2] || '').toLowerCase().trim()
const newPassword = process.argv[3] || ''
if (!email.includes('@') || newPassword.length < 6) {
    console.error('Usage: npx tsx -r dotenv/config scripts/reset-admin-password.ts <email> <newPassword>')
    process.exit(1)
}

async function main() {
    const passwordHash = await hashPassword(newPassword)
    const [row] = await db.update(users)
        .set({ passwordHash, updatedAt: new Date() })
        .where(eq(users.email, email))
        .returning({ email: users.email, role: users.role })
    if (!row) { console.error(`No account found for ${email}`); process.exit(1) }
    console.log(`Password reset for ${row.email} (role '${row.role}')`)
}
main()
