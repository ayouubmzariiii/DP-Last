// ─────────────────────────────────────────────────────────────────────────────
// Accès au jeu de communes utilisé par les pages SEO /dp/[travaux]/[commune].
//
// Les données viennent de src/data/communes.json, généré hors ligne par
// `node scripts/build-communes.mjs` (source : geo.api.gouv.fr / INSEE). Rien
// n'est appelé au runtime : le fichier est committé, donc le build et le rendu
// sont déterministes et ne dépendent d'aucune API tierce.
// ─────────────────────────────────────────────────────────────────────────────
import raw from '@/data/communes.json'

export interface Commune {
    insee: string
    nom: string
    slug: string
    /** Code postal principal (le plus petit quand la commune en compte plusieurs). */
    cp: string
    /** Nombre de codes postaux — > 1 sur les grandes villes à arrondissements. */
    cps: number
    dept: string
    deptNom: string
    region: string
    population: number
    surfaceKm2: number | null
}

export const COMMUNES: Commune[] = raw as Commune[]

/** L'URL d'une commune porte le slug PUIS l'INSEE : les homonymes (Saint-Denis)
 *  restent distincts sans dégrader le slug côté mots-clés. */
export const communeParam = (c: Commune) => `${c.slug}-${c.insee}`

const BY_PARAM = new Map(COMMUNES.map(c => [communeParam(c), c]))
const BY_INSEE = new Map(COMMUNES.map(c => [c.insee, c]))

export function findCommune(param: string): Commune | undefined {
    const hit = BY_PARAM.get(param)
    if (hit) return hit
    // Tolère un slug légèrement différent (renommage, accent) tant que l'INSEE
    // en suffixe est bon — la page se rend et le canonical pointe la bonne URL.
    const insee = param.slice(-5)
    return /^\d{5}$/.test(insee) ? BY_INSEE.get(insee) : undefined
}

// ─── Prépositions françaises ─────────────────────────────────────────────────
// Sur des milliers de pages générées, « le PLU de Aix-en-Provence » ou « à Le
// Havre » discréditent instantanément le contenu — et un texte fautif se
// référence mal. Ces deux helpers produisent la forme correcte pour tous les cas
// présents dans le jeu de données : élision devant voyelle ou h muet, articles
// Le / Les / La contractés.

const VOYELLE = /^[aàâäeéèêëiîïoôöuùûüyAÀÂÄEÉÈÊËIÎÏOÔÖUÙÛÜY]/
/** Les rares « h aspiré » du jeu de données, qui refusent l'élision. */
const H_ASPIRE = /^(Hy|Hé|Ha)/

/** « de » + commune : d'Aix-en-Provence, du Havre, des Sables-d'Olonne, de Paris. */
export function deCommune(nom: string): string {
    if (nom.startsWith('Les ')) return `des ${nom.slice(4)}`
    if (nom.startsWith('Le ')) return `du ${nom.slice(3)}`
    if (nom.startsWith('La ')) return `de ${nom}`
    if (VOYELLE.test(nom)) return `d’${nom}`
    if (/^[Hh]/.test(nom) && !H_ASPIRE.test(nom)) return `d’${nom}`
    return `de ${nom}`
}

/** « à » + commune, décomposé — la préposition contractée absorbe l'article, donc
 *  le nom affiché change lui aussi (« Le Havre » → au / Havre). Utile quand seul
 *  le nom doit être mis en valeur typographiquement (H1). */
export function aCommuneParts(nom: string): { prep: string; label: string } {
    if (nom.startsWith('Les ')) return { prep: 'aux', label: nom.slice(4) }
    if (nom.startsWith('Le ')) return { prep: 'au', label: nom.slice(3) }
    return { prep: 'à', label: nom }
}

/** « à » + commune : au Havre, aux Sables-d'Olonne, à Aix-en-Provence. */
export function aCommune(nom: string): string {
    const { prep, label } = aCommuneParts(nom)
    return `${prep} ${label}`
}

/** Idem, en tête de phrase : « Au Havre, … », « À Aix-en-Provence, … ». */
export function aCommuneCap(nom: string): string {
    const s = aCommune(nom)
    return s.charAt(0).toUpperCase() + s.slice(1)
}

/** Communes voisines par département (maillage interne : profondeur de crawl). */
export function communesVoisines(c: Commune, limit = 8): Commune[] {
    const same = COMMUNES.filter(x => x.dept === c.dept && x.insee !== c.insee)
    const pool = same.length >= 3 ? same : COMMUNES.filter(x => x.region === c.region && x.insee !== c.insee)
    return pool.slice(0, limit)
}

/** Densité (hab/km²) — sert à qualifier honnêtement le tissu urbain de la commune. */
export function densite(c: Commune): number | null {
    return c.surfaceKm2 ? Math.round(c.population / c.surfaceKm2) : null
}

/** Lien profond vers le Géoportail de l'Urbanisme, filtré sur la commune.
 *  C'est LE service public où le PLU opposable est publié. */
export const geoportailUrl = (c: Commune) =>
    `https://www.geoportail-urbanisme.gouv.fr/map/#tile=1&lon=2.4&lat=46.6&zoom=6&mlon=&mlat=&insee=${c.insee}`

/** Guichet numérique des autorisations d'urbanisme — recherche de la commune. */
export const gnauUrl = () => 'https://www.service-public.fr/particuliers/vosdroits/R52221'

/** Cadastre officiel, centré sur la commune (utile pour le plan de situation). */
export const cadastreUrl = (c: Commune) => `https://www.cadastre.gouv.fr/scpc/rechercherPlan.do`

/** Le tissu urbain conditionne le seuil d'extension (20 ou 40 m²) : une commune
 *  dense est presque certainement dotée d'un PLU avec zone U. On le formule
 *  comme une probabilité, jamais comme une certitude juridique. */
export function probableZoneU(c: Commune): boolean {
    const d = densite(c)
    return d !== null && d >= 400
}
