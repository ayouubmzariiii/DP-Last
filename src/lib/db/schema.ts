// ─────────────────────────────────────────────────────────────────────────────
// Drizzle schema — accounts & per-user dossiers.
//
// A dossier is stored as ONE jsonb column (`data`) holding the app's DPFormData,
// with every image field replaced by a Vercel Blob https URL (never base64) so
// rows stay small and PUT payloads stay well under Vercel's 4.5 MB request cap.
// ─────────────────────────────────────────────────────────────────────────────
import { pgTable, pgEnum, uuid, text, integer, jsonb, timestamp, index } from 'drizzle-orm/pg-core'
import type { DPFormData } from '@/lib/models'

export const dossierStatus = pgEnum('dossier_status', ['draft', 'complete'])

export const users = pgTable('users', {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull().unique(),          // always stored lowercased
    passwordHash: text('password_hash').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const dossiers = pgTable('dossiers', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull().default('Nouveau dossier'),
    status: dossierStatus('status').notNull().default('draft'),
    lastStep: integer('last_step').notNull().default(1),
    // DPFormData with Blob URLs in place of base64 images.
    data: jsonb('data').$type<DPFormData>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
    userIdx: index('dossiers_user_id_idx').on(t.userId),
    userUpdatedIdx: index('dossiers_user_updated_idx').on(t.userId, t.updatedAt),
}))

export type UserRow = typeof users.$inferSelect
export type DossierRow = typeof dossiers.$inferSelect
export type NewDossierRow = typeof dossiers.$inferInsert
