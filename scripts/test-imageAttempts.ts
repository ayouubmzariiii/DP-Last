// DB-backed test of the per-image generation cap. Creates a throwaway user+dossier,
// exercises the counter/ownership helpers, then cleans up.
// Run: npx tsx -r dotenv/config scripts/test-imageAttempts.ts dotenv_config_path=.env.local
import { db, users, dossiers } from '../src/lib/db'
import { eq } from 'drizzle-orm'
import { emptyFormData } from '../src/lib/models'
import { MAX_IMAGE_ATTEMPTS, ownsDossier, imageAttemptCount, bumpImageAttempt } from '../src/lib/imageAttempts'

let failures = 0
const check = (name: string, cond: boolean, extra?: unknown) => {
    if (cond) console.log(`  ✓ ${name}`)
    else { failures++; console.error(`  ✗ ${name}`, extra ?? '') }
}

async function main() {
    const [u] = await db.insert(users).values({ email: `imgtest+${Date.now()}@example.com`, passwordHash: 'x' }).returning({ id: users.id })
    const [d] = await db.insert(dossiers).values({ userId: u.id, data: emptyFormData }).returning({ id: dossiers.id })
    const facadeId = 'facade-principale'
    try {
        check('ownsDossier true for owner', await ownsDossier(u.id, d.id))
        check('ownsDossier false for stranger', !(await ownsDossier('00000000-0000-0000-0000-000000000000', d.id)))
        check('initial count 0', (await imageAttemptCount(d.id, facadeId)) === 0)

        for (let i = 1; i <= MAX_IMAGE_ATTEMPTS; i++) {
            const n = await bumpImageAttempt(u.id, d.id, facadeId)
            check(`bump ${i} → count ${i}`, n === i, n)
        }
        check(`count now at cap (${MAX_IMAGE_ATTEMPTS})`, (await imageAttemptCount(d.id, facadeId)) === MAX_IMAGE_ATTEMPTS)
        check('guard would block (count >= MAX)', (await imageAttemptCount(d.id, facadeId)) >= MAX_IMAGE_ATTEMPTS)

        // A different façade has its own independent counter.
        check('other façade starts at 0', (await imageAttemptCount(d.id, 'facade-laterale')) === 0)
        const other = await bumpImageAttempt(u.id, d.id, 'facade-laterale')
        check('other façade bump → 1 (independent)', other === 1)
    } finally {
        await db.delete(users).where(eq(users.id, u.id))  // cascades dossier + image_attempts
        console.log('  · cleaned up throwaway user/dossier')
    }
    console.log(failures === 0 ? '\nAll image-attempt tests passed.' : `\n${failures} test(s) FAILED.`)
    process.exit(failures === 0 ? 0 : 1)
}
main().catch((e) => { console.error(e); process.exit(1) })
