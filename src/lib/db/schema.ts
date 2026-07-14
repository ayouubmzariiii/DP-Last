// ─────────────────────────────────────────────────────────────────────────────
// Drizzle schema — accounts & per-user dossiers.
//
// A dossier is stored as ONE jsonb column (`data`) holding the app's DPFormData,
// with every image field replaced by a Vercel Blob https URL (never base64) so
// rows stay small and PUT payloads stay well under Vercel's 4.5 MB request cap.
// ─────────────────────────────────────────────────────────────────────────────
import { pgTable, pgEnum, uuid, text, integer, jsonb, timestamp, index, boolean } from 'drizzle-orm/pg-core'
import type { DPFormData } from '@/lib/models'
import type { DossierSummary } from '@/lib/dossierSummary'

export const dossierStatus = pgEnum('dossier_status', ['draft', 'complete'])

// Décision de la mairie après dépôt (suivi d'instruction — indépendant du statut du dossier,
// qui ne décrit que l'avancement de la constitution du dossier dans l'app).
export const dossierDecision = pgEnum('dossier_decision', ['accepted', 'rejected'])

export const users = pgTable('users', {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull().unique(),          // always stored lowercased
    passwordHash: text('password_hash').notNull(),
    // Account settings (editable from the profil "Paramètres" tab).
    fullName: text('full_name'),
    phone: text('phone'),
    language: text('language').notNull().default('fr'),
    emailNotifications: boolean('email_notifications').notNull().default(true),
    // Réinitialisation de mot de passe : hash SHA-256 du token envoyé par email + expiration.
    resetTokenHash: text('reset_token_hash'),
    resetTokenExpires: timestamp('reset_token_expires', { withTimezone: true }),
    // Non-expiring dossier credits bought à l'usage (one-off / packs). Subscription
    // quota is tracked separately on `subscriptions`; credits are the top-up balance.
    credits: integer('credits').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// One active subscription per user. `quota` is dossiers/period (0 = illimité, Agence);
// `used` resets when the period rolls over (handled lazily in the billing service).
export const subscriptions = pgTable('subscriptions', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }).unique(),
    plan: text('plan').notNull(),                                   // 'studio' | 'cabinet' | 'agence'
    status: text('status').notNull().default('active'),             // 'active' | 'canceled'
    quota: integer('quota').notNull().default(0),                   // 0 = illimité
    used: integer('used').notNull().default(0),
    periodStart: timestamp('period_start', { withTimezone: true }).notNull().defaultNow(),
    periodEnd: timestamp('period_end', { withTimezone: true }).notNull(),
    cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),
    provider: text('provider').notNull().default('mock'),
    providerRef: text('provider_ref'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// Payment / order history (mock for now). One row per confirmed checkout line.
export const payments = pgTable('payments', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),                                   // 'subscription' | 'oneoff'
    sku: text('sku').notNull(),                                     // plan id or SKU id
    label: text('label').notNull(),
    amountCents: integer('amount_cents').notNull().default(0),
    currency: text('currency').notNull().default('eur'),
    creditsGranted: integer('credits_granted').notNull().default(0),
    status: text('status').notNull().default('paid'),
    provider: text('provider').notNull().default('mock'),
    providerRef: text('provider_ref'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
    userIdx: index('payments_user_id_idx').on(t.userId),
}))

export const dossiers = pgTable('dossiers', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull().default('Nouveau dossier'),
    status: dossierStatus('status').notNull().default('draft'),
    lastStep: integer('last_step').notNull().default(1),
    // DPFormData with Blob URLs in place of base64 images.
    data: jsonb('data').$type<DPFormData>().notNull(),
    // Denormalized card summary, recomputed server-side on every save so the dashboard
    // list never has to load the full `data` jsonb (self-healed for legacy rows).
    summary: jsonb('summary').$type<DossierSummary>(),
    // Nom du client (usage pro : architectes / MOE gérant plusieurs clients).
    clientName: text('client_name'),
    // Cycle de vie après génération : dépôt en mairie puis décision.
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    decision: dossierDecision('decision'),
    decisionAt: timestamp('decision_at', { withTimezone: true }),
    // Suivi d'instruction : n° d'enregistrement de la DP (porté sur le récépissé de dépôt) et date
    // du premier jour d'affichage du panneau sur le terrain (point de départ du recours des tiers).
    numeroDp: text('numero_dp'),
    affichageAt: timestamp('affichage_at', { withTimezone: true }),
    // Archivage doux (le dossier reste consultable/restaurable, masqué de la liste par défaut).
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    // Facturation : date de la première génération du dossier définitif. Sert de garde-fou
    // d'idempotence pour ne décompter qu'UNE fois le quota/crédit, même si l'utilisateur
    // re-télécharge le dossier. Null = jamais généré / jamais décompté.
    billedAt: timestamp('billed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
    userIdx: index('dossiers_user_id_idx').on(t.userId),
    userUpdatedIdx: index('dossiers_user_updated_idx').on(t.userId, t.updatedAt),
}))

export type UserRow = typeof users.$inferSelect
export type DossierRow = typeof dossiers.$inferSelect
export type NewDossierRow = typeof dossiers.$inferInsert
export type SubscriptionRow = typeof subscriptions.$inferSelect
export type PaymentRow = typeof payments.$inferSelect
