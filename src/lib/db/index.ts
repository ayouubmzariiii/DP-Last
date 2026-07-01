// Drizzle client over Neon's stateless HTTP driver — ideal for Vercel functions
// (one HTTP round-trip per query, no pooling to manage). NODE-ONLY: never import
// this from middleware.ts (edge runtime).
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from './schema'

if (!process.env.DATABASE_URL) {
    // Fail loud & early with an actionable message rather than a cryptic driver error.
    throw new Error('DATABASE_URL is not set. Add it to .env.local (or Vercel env).')
}

export const db = drizzle(neon(process.env.DATABASE_URL), { schema })
export * from './schema'
