import { config } from 'dotenv'
import { defineConfig } from 'drizzle-kit'

// Load DATABASE_URL for the CLI. Next.js reads .env.local at runtime; drizzle-kit
// does not, so we load it here — falling back to the `env` reference file the
// project ships the Neon credentials in.
config({ path: '.env.local' })
if (!process.env.DATABASE_URL) config({ path: 'env' })

export default defineConfig({
    schema: './src/lib/db/schema.ts',
    out: './drizzle',
    dialect: 'postgresql',
    dbCredentials: { url: process.env.DATABASE_URL! },
})
