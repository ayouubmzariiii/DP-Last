// ─────────────────────────────────────────────────────────────────────────────
// Nuancier RAL Classic — code → nom français + valeur sRGB approchée.
//
// Les teintes RAL sont définies dans un espace colorimétrique physique ; les hex
// ci-dessous sont les conversions sRGB communément publiées, suffisantes pour un
// aperçu à l'écran (pastille de couleur), pas pour une reproduction exacte.
//
// Utilisé partout où un code RAL apparaît dans l'app : sélecteur de teinte à
// l'étape Travaux, détection automatique dans les champs libres, pastilles dans
// le récapitulatif et l'analyse PLU.
// ─────────────────────────────────────────────────────────────────────────────

export interface RalColor { code: string; name: string; hex: string }

// [name, hex] keyed by the 4-digit code.
const RAL: Record<string, [string, string]> = {
    // ── Jaunes / beiges (1000) ──
    '1000': ['Beige vert', '#CDBA88'], '1001': ['Beige', '#D0B084'], '1002': ['Jaune sable', '#D2AA6D'],
    '1003': ['Jaune de sécurité', '#F9A800'], '1004': ['Jaune or', '#E49E00'], '1005': ['Jaune miel', '#CB8E00'],
    '1006': ['Jaune maïs', '#E29000'], '1007': ['Jaune narcisse', '#E88C00'], '1011': ['Beige brun', '#AF804F'],
    '1012': ['Jaune citron', '#DDAF27'], '1013': ['Blanc perlé', '#E3D9C6'], '1014': ['Ivoire', '#DDC49A'],
    '1015': ['Ivoire clair', '#E6D2B5'], '1016': ['Jaune soufre', '#F1DD38'], '1017': ['Jaune safran', '#F6A950'],
    '1018': ['Jaune zinc', '#FACA30'], '1019': ['Beige gris', '#A48F7A'], '1020': ['Jaune olive', '#A08F65'],
    '1021': ['Jaune colza', '#F6B600'], '1023': ['Jaune signalisation', '#F7B500'], '1024': ['Jaune ocre', '#BA8F4C'],
    '1026': ['Jaune brillant', '#FFFF00'], '1027': ['Jaune curry', '#A77F0E'], '1028': ['Jaune melon', '#FF9B00'],
    '1032': ['Jaune genêt', '#E2A300'], '1033': ['Jaune dahlia', '#F99A1C'], '1034': ['Jaune pastel', '#EB9C52'],
    '1035': ['Beige nacré', '#908370'], '1036': ['Or nacré', '#80643F'], '1037': ['Jaune soleil', '#F09200'],
    // ── Orangés (2000) ──
    '2000': ['Orangé jaune', '#DA6E00'], '2001': ['Orangé rouge', '#BA481B'], '2002': ['Orangé sang', '#BF3922'],
    '2003': ['Orangé pastel', '#F67828'], '2004': ['Orangé pur', '#E25303'], '2005': ['Orangé fluorescent', '#FF4D06'],
    '2007': ['Orangé clair brillant', '#FFB200'], '2008': ['Orangé rouge clair', '#ED6B21'], '2009': ['Orangé signalisation', '#DE5307'],
    '2010': ['Orangé de sécurité', '#D05D28'], '2011': ['Orangé foncé', '#E26E0E'], '2012': ['Orangé saumon', '#D5654D'],
    '2013': ['Orangé nacré', '#923E25'],
    // ── Rouges (3000) ──
    '3000': ['Rouge feu', '#A72920'], '3001': ['Rouge de sécurité', '#9B2423'], '3002': ['Rouge carmin', '#9B2321'],
    '3003': ['Rouge rubis', '#861A22'], '3004': ['Rouge pourpre', '#6B1C23'], '3005': ['Rouge vin', '#59191F'],
    '3007': ['Rouge noir', '#3E2022'], '3009': ['Rouge oxyde', '#6D342D'], '3011': ['Rouge brun', '#792423'],
    '3012': ['Rouge beige', '#C6846D'], '3013': ['Rouge tomate', '#972E25'], '3014': ['Vieux rose', '#CB7375'],
    '3015': ['Rose clair', '#D8A0A6'], '3016': ['Rouge corail', '#A63D2F'], '3017': ['Rosé', '#CB555D'],
    '3018': ['Rouge fraise', '#C73F4A'], '3020': ['Rouge signalisation', '#BB1E10'], '3022': ['Rouge saumon', '#CF6955'],
    '3024': ['Rouge brillant', '#FF2D21'], '3026': ['Rouge clair brillant', '#FF2A1B'], '3027': ['Rouge framboise', '#AB273C'],
    '3028': ['Rouge puro', '#CC2C24'], '3031': ['Rouge oriental', '#A63437'], '3032': ['Rouge rubis nacré', '#701D23'],
    '3033': ['Rose nacré', '#A53A2D'],
    // ── Violets (4000) ──
    '4001': ['Lilas rouge', '#816183'], '4002': ['Violet rouge', '#8D3C4B'], '4003': ['Violet bruyère', '#C4618C'],
    '4004': ['Violet bordeaux', '#651E38'], '4005': ['Lilas bleu', '#76689A'], '4006': ['Pourpre signalisation', '#903373'],
    '4007': ['Violet pourpre', '#47243C'], '4008': ['Violet de sécurité', '#844C82'], '4009': ['Violet pastel', '#9D8692'],
    '4010': ['Telemagenta', '#BC4077'], '4011': ['Violet nacré', '#6E6387'], '4012': ['Mûre nacré', '#6B6B7F'],
    // ── Bleus (5000) ──
    '5000': ['Bleu violet', '#314F6F'], '5001': ['Bleu vert', '#0F4C64'], '5002': ['Bleu outremer', '#00387B'],
    '5003': ['Bleu saphir', '#1F3855'], '5004': ['Bleu noir', '#191E28'], '5005': ['Bleu de sécurité', '#005387'],
    '5007': ['Bleu brillant', '#376B8C'], '5008': ['Bleu gris', '#2B3A44'], '5009': ['Bleu azur', '#225F78'],
    '5010': ['Bleu gentiane', '#004F7C'], '5011': ['Bleu acier', '#1A2B3C'], '5012': ['Bleu clair', '#0089B6'],
    '5013': ['Bleu cobalt', '#193153'], '5014': ['Bleu pigeon', '#637D96'], '5015': ['Bleu ciel', '#007CB0'],
    '5017': ['Bleu signalisation', '#005B8C'], '5018': ['Bleu turquoise', '#048B8C'], '5019': ['Bleu capri', '#005E83'],
    '5020': ['Bleu océan', '#00414B'], '5021': ['Bleu d\'eau', '#007577'], '5022': ['Bleu nocturne', '#222D5A'],
    '5023': ['Bleu distant', '#42698C'], '5024': ['Bleu pastel', '#6093AC'], '5025': ['Bleu gentiane nacré', '#21697C'],
    '5026': ['Bleu nuit nacré', '#0F3052'],
    // ── Verts (6000) ──
    '6000': ['Vert patine', '#3C7460'], '6001': ['Vert émeraude', '#366735'], '6002': ['Vert feuillage', '#325928'],
    '6003': ['Vert olive', '#50533C'], '6004': ['Vert bleu', '#024442'], '6005': ['Vert mousse', '#114232'],
    '6006': ['Olive gris', '#3C392E'], '6007': ['Vert bouteille', '#2C3222'], '6008': ['Vert brun', '#37342A'],
    '6009': ['Vert sapin', '#27352A'], '6010': ['Vert herbe', '#4D6F39'], '6011': ['Vert réséda', '#6C7C59'],
    '6012': ['Vert noir', '#303D3A'], '6013': ['Vert jonc', '#7D765A'], '6014': ['Olive jaune', '#474135'],
    '6015': ['Olive noir', '#3D3D36'], '6016': ['Vert turquoise', '#026A52'], '6017': ['Vert mai', '#468641'],
    '6018': ['Vert jaune', '#48A43F'], '6019': ['Vert blanc', '#B7D9B1'], '6020': ['Vert oxyde chromique', '#354733'],
    '6021': ['Vert pâle', '#86A47C'], '6022': ['Olive brun', '#3E3C32'], '6024': ['Vert signalisation', '#008351'],
    '6025': ['Vert fougère', '#53753C'], '6026': ['Vert opale', '#005D52'], '6027': ['Vert clair', '#81C0BB'],
    '6028': ['Vert pin', '#2D5546'], '6029': ['Vert menthe', '#007243'], '6032': ['Vert de sécurité', '#237F52'],
    '6033': ['Turquoise menthe', '#46877F'], '6034': ['Turquoise pastel', '#7AACAC'], '6035': ['Vert nacré', '#194D25'],
    '6036': ['Vert opale nacré', '#04574B'], '6037': ['Vert pur', '#008B29'], '6038': ['Vert brillant', '#00B51B'],
    // ── Gris (7000) ──
    '7000': ['Gris petit-gris', '#7E8B92'], '7001': ['Gris argent', '#8F999F'], '7002': ['Gris olive', '#817F68'],
    '7003': ['Gris mousse', '#7A7B6D'], '7004': ['Gris de sécurité', '#9EA0A1'], '7005': ['Gris souris', '#6B716F'],
    '7006': ['Gris beige', '#756F61'], '7008': ['Gris kaki', '#746643'], '7009': ['Gris vert', '#5B6259'],
    '7010': ['Gris tente', '#575D57'], '7011': ['Gris fer', '#555D61'], '7012': ['Gris basalte', '#596163'],
    '7013': ['Gris brun', '#555548'], '7015': ['Gris ardoise', '#51565C'], '7016': ['Gris anthracite', '#373F43'],
    '7021': ['Gris noir', '#2E3234'], '7022': ['Gris terre d\'ombre', '#4B4D46'], '7023': ['Gris béton', '#818479'],
    '7024': ['Gris graphite', '#474A50'], '7026': ['Gris granit', '#374447'], '7030': ['Gris pierre', '#939388'],
    '7031': ['Gris bleu', '#5D6970'], '7032': ['Gris silex', '#B9B9A8'], '7033': ['Gris ciment', '#818979'],
    '7034': ['Gris jaune', '#939176'], '7035': ['Gris clair', '#CBD0CC'], '7036': ['Gris platine', '#9A9697'],
    '7037': ['Gris poussière', '#7C7F7E'], '7038': ['Gris agate', '#B4B8B0'], '7039': ['Gris quartz', '#6B695F'],
    '7040': ['Gris fenêtre', '#9DA3A6'], '7042': ['Gris signalisation A', '#8F9695'], '7043': ['Gris signalisation B', '#4E5451'],
    '7044': ['Gris soie', '#BDBDB2'], '7045': ['Telegris 1', '#91969A'], '7046': ['Telegris 2', '#82898E'],
    '7047': ['Telegris 4', '#CFD0CF'], '7048': ['Gris souris nacré', '#888175'],
    // ── Bruns (8000) ──
    '8000': ['Brun vert', '#887142'], '8001': ['Brun terre de Sienne', '#9C6B30'], '8002': ['Brun de sécurité', '#7B5141'],
    '8003': ['Brun argile', '#80542F'], '8004': ['Brun cuivré', '#8F4E35'], '8007': ['Brun fauve', '#6F4A2F'],
    '8008': ['Brun olive', '#6F4F28'], '8011': ['Brun noisette', '#5A3A29'], '8012': ['Brun rouge', '#673831'],
    '8014': ['Brun sépia', '#49392D'], '8015': ['Marron', '#633A34'], '8016': ['Brun acajou', '#4C2F26'],
    '8017': ['Brun chocolat', '#44322D'], '8019': ['Brun gris', '#3F3A3A'], '8022': ['Brun noir', '#211F20'],
    '8023': ['Brun orangé', '#A65E2F'], '8024': ['Brun beige', '#79553C'], '8025': ['Brun pâle', '#755C49'],
    '8028': ['Brun terre', '#4E3B2B'], '8029': ['Cuivre nacré', '#773C27'],
    // ── Blancs / noirs (9000) ──
    '9001': ['Blanc crème', '#EFEBDC'], '9002': ['Blanc gris', '#DDDED4'], '9003': ['Blanc de sécurité', '#F4F8F4'],
    '9004': ['Noir de sécurité', '#2E3032'], '9005': ['Noir foncé', '#0A0A0D'], '9006': ['Aluminium blanc', '#A5A8A6'],
    '9007': ['Aluminium gris', '#8F8F8C'], '9010': ['Blanc pur', '#F7F3E9'], '9011': ['Noir graphite', '#27292B'],
    '9016': ['Blanc signalisation', '#F1F0EA'], '9017': ['Noir signalisation', '#2A292A'], '9018': ['Blanc papyrus', '#C8CBC4'],
    '9022': ['Gris clair nacré', '#858583'], '9023': ['Gris foncé nacré', '#797B7A'],
}

export const RAL_CLASSIC: RalColor[] = Object.entries(RAL).map(([code, [name, hex]]) => ({ code, name, hex }))

// Teintes les plus demandées en menuiseries/façades — proposées quand le champ est vide.
export const RAL_POPULAR = ['9016', '9010', '9001', '7016', '7035', '7039', '1015', '5014', '6005', '3004', '8014', '9005']

export function ralInfo(code: string | number): RalColor | null {
    const c = String(code).trim()
    const e = RAL[c]
    return e ? { code: c, name: e[0], hex: e[1] } : null
}

// Find the first RAL reference in free text: "RAL 7016", "ral7016", "RAL-7016" —
// or a bare 4-digit code when it IS the whole value (dedicated RAL fields).
export function detectRal(text?: string | null): RalColor | null {
    if (!text) return null
    const m = /RAL\s*-?\s*(\d{4})/i.exec(text)
    if (m) return ralInfo(m[1])
    const bare = text.trim()
    if (/^\d{4}$/.test(bare)) return ralInfo(bare)
    return null
}

// Picker search: digit query matches code prefixes, text query matches names.
export function searchRal(query: string, limit = 9): RalColor[] {
    const q = query.trim().toLowerCase().replace(/^ral\s*-?\s*/i, '')
    if (!q) return RAL_POPULAR.map(ralInfo).filter((c): c is RalColor => !!c).slice(0, limit)
    const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    const nq = norm(q)
    return RAL_CLASSIC
        .filter(c => c.code.startsWith(q) || norm(c.name).includes(nq))
        .slice(0, limit)
}
