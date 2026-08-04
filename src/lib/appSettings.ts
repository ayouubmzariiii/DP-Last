// ─────────────────────────────────────────────────────────────────────────────
// App settings — les « règles de l'app » pilotées depuis le back-office /admin.
//
// Chaque réglage a une valeur en base (app_settings), avec repli sur la variable
// d'environnement correspondante puis sur un défaut codé : une base vide reproduit
// exactement le comportement historique. Un cache mémoire court (30 s) évite une
// requête DB par appel sur les routes chaudes (analyze-plu, image-gen).
//
// NODE-ONLY (Drizzle). Ne jamais importer depuis middleware.ts.
// ─────────────────────────────────────────────────────────────────────────────
import { eq } from 'drizzle-orm'
import { db, appSettings } from '@/lib/db'

export type SettingType = 'string' | 'number' | 'boolean'

export interface SettingDef {
    key: string
    type: SettingType
    label: string           // libellé UI (back-office)
    help: string            // description UI
    group: 'ai' | 'limits' | 'access'
    envVar?: string         // repli environnement
    def: string | number | boolean
    options?: string[]      // suggestions UI (datalist) pour les modèles
}

// Registre des réglages connus — LA liste blanche : l'API /api/admin/settings ne
// lit/écrit que ces clés, avec coercition de type.
export const SETTING_DEFS: SettingDef[] = [
    {
        key: 'plu_model', type: 'string', group: 'ai',
        label: 'Modèle IA — analyse PLU (texte)',
        help: 'Modèle OpenRouter qui lit le règlement (texte) et en extrait les règles. « openrouter/free » = routage auto gratuit mais variable ; épingler un modèle précis fiabilise les analyses.',
        envVar: 'OPENROUTER_PLU_MODEL', def: 'openrouter/free',
        options: ['openrouter/free', 'google/gemini-3.5-flash', 'anthropic/claude-sonnet-5', 'openai/gpt-5-mini', 'deepseek/deepseek-v3.2'],
    },
    {
        key: 'vision_model', type: 'string', group: 'ai',
        label: 'Modèle IA — règlements scannés (vision/OCR)',
        help: 'Modèle vision utilisé quand le règlement est un PDF scanné (images). Doit accepter les images.',
        envVar: 'OPENROUTER_VISION_MODEL', def: 'openrouter/free',
        options: ['openrouter/free', 'google/gemini-3.5-flash', 'anthropic/claude-sonnet-5', 'openai/gpt-5-mini'],
    },
    {
        key: 'image_model', type: 'string', group: 'ai',
        label: 'Modèle IA — visuel « après travaux »',
        help: 'Modèle OpenRouter de génération d\'images pour l\'insertion (façade après travaux).',
        envVar: 'OPENROUTER_IMAGE_MODEL', def: 'bytedance-seed/seedream-4.5',
        options: ['bytedance-seed/seedream-4.5', 'google/gemini-2.5-flash-image', 'black-forest-labs/flux-1.1-pro'],
    },
    {
        key: 'facade_audit_model', type: 'string', group: 'ai',
        label: 'Modèle IA — contrôle de fidélité du visuel',
        help: 'Modèle vision qui compare la simulation « après travaux » à la photo d\'origine et rejette les écarts non demandés (texte peint sur la façade, volets supprimés, portail effacé…). Doit accepter DEUX images.',
        envVar: 'OPENROUTER_FACADE_AUDIT_MODEL', def: 'google/gemini-3.5-flash',
        options: ['google/gemini-3.5-flash', 'anthropic/claude-sonnet-5', 'openai/gpt-5-mini', 'openrouter/free'],
    },
    {
        key: 'facade_audit_enabled', type: 'boolean', group: 'ai',
        label: 'Contrôler la fidélité du visuel « après travaux »',
        help: 'Activé : chaque simulation est comparée à la photo d\'origine et régénérée (jusqu\'à 2 fois, sans consommer le quota du client) si elle introduit une modification non demandée. Coûte un appel vision par génération.',
        def: true,
    },
    {
        key: 'image_attempts_per_facade', type: 'number', group: 'limits',
        label: 'Générations d\'image par façade',
        help: 'Nombre maximum de générations IA réussies du visuel « après travaux » par façade et par dossier (compteur durable côté serveur).',
        def: 4,
    },
    {
        key: 'plu_text_cap', type: 'number', group: 'limits',
        label: 'Taille max du règlement envoyé à l\'IA (caractères)',
        help: 'Plafond de texte du règlement transmis au modèle d\'analyse. Plus haut = plus complet mais plus lent/cher.',
        def: 18000,
    },
    {
        key: 'billing_enforced', type: 'boolean', group: 'access',
        label: 'Facturation appliquée',
        help: 'Activé : la génération du dossier final consomme quota/crédits et se bloque à zéro. Désactivé : l\'app est entièrement gratuite (la couche facturation reste dormante).',
        envVar: 'BILLING_ENFORCED', def: false,
    },
    {
        key: 'registration_open', type: 'boolean', group: 'access',
        label: 'Inscriptions ouvertes',
        help: 'Désactivé : la création de nouveaux comptes est suspendue (les comptes existants se connectent normalement).',
        def: true,
    },
]

const DEF_BY_KEY = new Map(SETTING_DEFS.map(d => [d.key, d]))

// ── Cache mémoire court ───────────────────────────────────────────────────────
let cache: { at: number; values: Map<string, unknown> } | null = null
const CACHE_TTL_MS = 30_000

async function loadAll(): Promise<Map<string, unknown>> {
    if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.values
    const rows = await db.select().from(appSettings)
    const values = new Map(rows.map(r => [r.key, r.value as unknown]))
    cache = { at: Date.now(), values }
    return values
}

/** Invalide le cache (après écriture admin) pour une prise d'effet immédiate. */
export function invalidateSettingsCache() { cache = null }

function coerce(def: SettingDef, raw: unknown): string | number | boolean | null {
    if (raw == null) return null
    if (def.type === 'string') return typeof raw === 'string' && raw.trim() ? raw.trim() : null
    if (def.type === 'number') { const n = Number(raw); return Number.isFinite(n) ? n : null }
    if (def.type === 'boolean') {
        if (typeof raw === 'boolean') return raw
        if (raw === '1' || raw === 'true') return true
        if (raw === '0' || raw === 'false') return false
        return null
    }
    return null
}

/** Valeur effective d'un réglage : base → variable d'env → défaut codé. */
export async function getSetting<T extends string | number | boolean>(key: string): Promise<T> {
    const def = DEF_BY_KEY.get(key)
    if (!def) throw new Error(`Unknown app setting: ${key}`)
    try {
        const values = await loadAll()
        const fromDb = coerce(def, values.get(key))
        if (fromDb !== null) return fromDb as T
    } catch (e) {
        console.error('[appSettings] read failed, falling back to env/default:', e)
    }
    if (def.envVar) {
        const fromEnv = coerce(def, process.env[def.envVar])
        if (fromEnv !== null) return fromEnv as T
    }
    return def.def as T
}

/** Toutes les valeurs effectives + provenance (pour l'écran back-office). */
export async function getSettingsWithMeta() {
    let values = new Map<string, unknown>()
    try { values = await loadAll() } catch { /* env/défauts seulement */ }
    return SETTING_DEFS.map(def => {
        const fromDb = coerce(def, values.get(def.key))
        const fromEnv = def.envVar ? coerce(def, process.env[def.envVar]) : null
        const effective = fromDb ?? fromEnv ?? def.def
        return {
            key: def.key, type: def.type, label: def.label, help: def.help, group: def.group,
            options: def.options || null, envVar: def.envVar || null,
            value: effective,
            source: fromDb !== null ? 'db' : (fromEnv !== null ? 'env' : 'default'),
            default: def.def,
        }
    })
}

/** Écrit un réglage (clé connue uniquement, valeur coercée). Retourne la valeur enregistrée. */
export async function setSetting(key: string, raw: unknown, updatedBy: string) {
    const def = DEF_BY_KEY.get(key)
    if (!def) throw new Error(`Unknown app setting: ${key}`)
    const value = coerce(def, raw)
    if (value === null) throw new Error(`Invalid value for ${key} (expected ${def.type})`)
    await db.insert(appSettings)
        .values({ key, value, updatedBy, updatedAt: new Date() })
        .onConflictDoUpdate({ target: appSettings.key, set: { value, updatedBy, updatedAt: new Date() } })
    invalidateSettingsCache()
    return value
}

/** Réinitialise un réglage (supprime la surcharge base → retour env/défaut). */
export async function resetSetting(key: string) {
    if (!DEF_BY_KEY.has(key)) throw new Error(`Unknown app setting: ${key}`)
    await db.delete(appSettings).where(eq(appSettings.key, key))
    invalidateSettingsCache()
}
