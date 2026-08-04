// ─────────────────────────────────────────────────────────────────────────────
// Contenu éditorial des pages SEO /dp/[travaux] (et de leur déclinaison par
// commune). Un objet par type de travaux, aligné sur TRAVAUX_REGISTRY : le CTA
// peut donc pré-sélectionner le bon type dans l'assistant.
//
// Règle rédactionnelle : tout ce qui relève du Code de l'urbanisme est affirmé
// (seuils, délais, pièces) ; tout ce qui relève du PLU local est présenté comme
// « à vérifier dans le PLU », jamais comme une certitude. Voir DISCLAIMER.
// ─────────────────────────────────────────────────────────────────────────────
import type { TravauxId } from '@/lib/travauxRegistry'

export interface Seuil {
    formalite: 'aucune' | 'dp' | 'pc'
    condition: string
}
export interface Faq { q: string; a: string }
export interface Erreur { titre: string; texte: string }

export interface SeoTravaux {
    slug: string
    travauxId: TravauxId
    /** Libellé court, capitalisé — titres, fils d'Ariane, cartes. */
    nom: string
    /** Groupe nominal avec article, s'insère dans une phrase : « pour {…} ». */
    article: string
    metaTitle: string
    metaDescription: string
    /** Longue traîne — rendue en bas de page et dans les mots-clés. */
    aliases: string[]
    intro: string[]
    seuils: Seuil[]
    /** Codes des pièces jointes obligatoires (voir PIECES). */
    pieces: PieceCode[]
    piecesNote?: string
    /** Ce que le PLU encadre typiquement pour ce type de travaux. */
    pluPoints: string[]
    /** Les motifs réels de pièces complémentaires / refus. Le cœur de la valeur. */
    erreurs: Erreur[]
    faq: Faq[]
    related: string[]
}

export type PieceCode = 'DP1' | 'DP2' | 'DP3' | 'DP4' | 'DP5' | 'DP6' | 'DP7' | 'DP8'

export const PIECES: Record<PieceCode, { titre: string; desc: string }> = {
    DP1: { titre: 'Plan de situation du terrain', desc: 'Situe la parcelle dans la commune. Extrait cadastral à petite échelle, orientation et repères visibles.' },
    DP2: { titre: 'Plan de masse des constructions', desc: 'Vue de dessus côtée de la parcelle : existant, projet, distances aux limites séparatives, échelle et orientation.' },
    DP3: { titre: 'Plan en coupe du terrain et de la construction', desc: 'Coupe verticale montrant le profil du terrain avant/après et l’implantation du projet par rapport au sol naturel.' },
    DP4: { titre: 'Plan des façades et des toitures', desc: 'Élévations côtées de chaque façade modifiée, état actuel et état projeté, avec matériaux et teintes.' },
    DP5: { titre: 'Représentation de l’aspect extérieur', desc: 'Vue en trois dimensions ou perspective du projet lorsque le plan de façades ne suffit pas à le comprendre.' },
    DP6: { titre: 'Document graphique d’insertion', desc: 'Montage du projet sur une photographie du terrain : l’instructeur juge l’impact visuel réel.' },
    DP7: { titre: 'Photographie de l’environnement proche', desc: 'Le terrain vu depuis la rue ou les parcelles voisines, avec le point de vue reporté sur le plan de masse.' },
    DP8: { titre: 'Photographie du paysage lointain', desc: 'Le terrain replacé dans son paysage, pour apprécier l’insertion à l’échelle du quartier ou du site.' },
}

// ─── Secteurs protégés ────────────────────────────────────────────────
// Les seuils publiés ne valent PAS partout. Le chapeau de l’article R. 421-2
// réserve les dispenses « sauf lorsqu’ils sont implantés dans le périmètre d’un
// site patrimonial remarquable, dans les abords des monuments historiques ou
// dans un site classé ou en instance de classement », et l’article R. 421-9
// s’ouvre symétriquement par « En dehors du périmètre … ». Dans ces périmètres,
// c’est R. 421-11 qui s’applique : une déclaration préalable y est due sans
// plancher de 5 m², voire un permis. Ne jamais présenter les seuils comme
// nationaux sans cette réserve.
export const SECTEURS_PROTEGES = [
    'périmètre d’un site patrimonial remarquable',
    'abords d’un monument historique',
    'site classé ou en instance de classement',
    'site inscrit',
    'réserve naturelle ou cœur de parc national',
    'espace remarquable du littoral',
]

/** Formulation courte de la réserve, affichée sous chaque tableau de seuils. */
export const RESERVE_SECTEUR_PROTEGE =
    'Ces seuils sont ceux du Code de l’urbanisme, mais ils ne s’appliquent pas partout : les articles qui les posent écartent expressément '
    + 'les secteurs protégés. Dans le périmètre d’un site patrimonial remarquable, aux abords d’un monument historique, en site classé, '
    + 'inscrit ou en instance de classement, en réserve naturelle, en cœur de parc national ou en espace remarquable du littoral, une '
    + 'déclaration préalable est due même en deçà des seuils — sans plancher de 5 m² — et certains projets y relèvent du permis de '
    + 'construire. Vérifiez d’abord si votre parcelle est concernée : c’est ce qui détermine tout le reste.'

export const DISCLAIMER =
    'Information générale. Les seuils cités sont ceux du Code de l’urbanisme ; les règles de hauteur, d’implantation, de teinte et de matériaux dépendent du PLU de votre commune et, en secteur protégé, de l’avis de l’Architecte des Bâtiments de France. Cette page ne remplace pas une consultation du service urbanisme de votre mairie.'

/** Date de la dernière vérification des seuils contre les sources officielles.
 *  À remettre à jour à chaque passage de contrôle — le droit bouge (le seuil
 *  photovoltaïque au sol est passé de 250 kWc à 1 MWc puis 3 MWc en deux ans). */
export const VERIFIE_LE = 'août 2026'

/** Articles sur lesquels reposent les seuils publiés. Affichés en pied de guide :
 *  ils rendent l’information vérifiable par le lecteur, et re-vérifiable par nous. */
export const SOURCES: { ref: string; objet: string }[] = [
    { ref: 'R. 421-2', objet: 'constructions dispensées de formalité (5 m², 12 m de hauteur, bassin de 10 m²)' },
    { ref: 'R. 421-9', objet: 'constructions nouvelles soumises à déclaration préalable (5 à 20 m², bassin jusqu’à 100 m²)' },
    { ref: 'R. 421-11', objet: 'rétablissement de la déclaration préalable en secteur protégé, sans plancher de 5 m²' },
    { ref: 'R. 421-12', objet: 'clôtures soumises à déclaration par délibération ou en secteur protégé' },
    { ref: 'R. 421-14 et R. 421-17', objet: 'travaux sur construction existante, extensions de 20 et 40 m²' },
    { ref: 'R. 421-17-1', objet: 'ravalement soumis à déclaration préalable' },
    { ref: 'R. 421-9 e', objet: 'murs d’une hauteur au-dessus du sol égale ou supérieure à 2 m' },
    { ref: 'R. 421-23 f', objet: 'affouillements et exhaussements (100 m² et 2 m)' },
    { ref: 'R. 431-2', objet: 'recours obligatoire à un architecte au-delà de 150 m²' },
    { ref: 'L. 152-5 et R. 152-5 à R. 152-9', objet: 'dérogation de 30 cm pour l’isolation par l’extérieur' },
    { ref: 'R. 423-23 et R. 424-17', objet: 'délai d’instruction d’un mois, validité de trois ans' },
]

/** Rappels transverses réutilisés par toutes les pages (délais, dépôt, suites). */
export const PROCEDURE = {
    delai: 'Le délai d’instruction de droit commun d’une déclaration préalable est de un mois à compter du dépôt.',
    delaiMajore: 'Il passe à deux mois aux abords d’un monument historique ou dans un site patrimonial remarquable : le délai est alors majoré d’un mois (art. R. 423-24) et l’Architecte des Bâtiments de France doit donner son accord. Un site classé relève, lui, d’une autorisation spéciale distincte, au titre du Code de l’environnement, qui allonge également le délai.',
    tacite: 'À l’expiration du délai, l’absence de réponse vaut décision de non-opposition. Vous pouvez demander en mairie un certificat attestant cette décision tacite.',
    incomplet: 'Si le dossier est incomplet, la mairie vous notifie une demande de pièces complémentaires dans le premier mois. Le délai est alors suspendu et vous disposez de trois mois pour compléter, sous peine de rejet tacite.',
    cerfa: 'Pour des travaux portant sur une maison individuelle et/ou ses annexes — le cas le plus courant — le formulaire est le Cerfa n°13703 (version 13703*12, en vigueur). Le Cerfa n°16702 vise les constructions et travaux qui ne portent PAS sur une maison individuelle : les deux coexistent, l’un ne remplace pas l’autre.',
    depot: 'Le dossier se dépose en mairie, ou par voie dématérialisée : depuis 2022, les communes de plus de 3 500 habitants doivent proposer un guichet numérique (GNAU / AD’AU).',
    affichage: 'Dès la décision obtenue, un panneau réglementaire doit être affiché sur le terrain, visible de la voie publique, pendant toute la durée des travaux. Il fait courir le délai de recours des tiers de deux mois.',
    validite: 'La décision est valable trois ans, prorogeable deux fois un an sur demande faite deux mois avant l’échéance.',
    daact: 'Les travaux achevés, vous déposez une déclaration attestant l’achèvement et la conformité des travaux (DAACT).',
    cout: 'Le dépôt d’une déclaration préalable est gratuit. Seule une taxe d’aménagement peut être due, sur les surfaces closes et couvertes de plus de 5 m² d’une hauteur au moins égale à 1,80 m, et forfaitairement sur les piscines.',
}

const T = (t: SeoTravaux) => t

export const SEO_TRAVAUX: SeoTravaux[] = [
    T({
        slug: 'abri-de-jardin',
        travauxId: 'abri',
        nom: 'Abri de jardin',
        article: 'un abri de jardin',
        metaTitle: 'Déclaration préalable abri de jardin : seuils, pièces et dossier complet',
        metaDescription: 'Abri de jardin, garage ou carport : quand une déclaration préalable est obligatoire, les 8 pièces à joindre, les erreurs qui font refuser le dossier, et comment le constituer.',
        aliases: ['déclaration préalable abri de jardin', 'abri de jardin 20m2 déclaration', 'cerfa abri de jardin', 'déclaration préalable garage', 'déclaration préalable carport', 'abri de jardin sans autorisation'],
        intro: [
            'Un abri de jardin est une annexe : une construction isolée, non accolée à la maison. C’est cette qualification qui fixe le seuil applicable, et c’est là que la plupart des dossiers se trompent. Le seuil de 40 m² dont on entend souvent parler concerne les extensions d’un bâtiment existant en zone urbaine, pas une annexe posée au fond du jardin.',
            'Pour un abri isolé, la règle est simple : au-delà de 5 m² d’emprise au sol ou de surface de plancher, et jusqu’à 20 m², une déclaration préalable est obligatoire. Au-delà de 20 m², il faut un permis de construire. Le calcul se fait sur l’emprise au sol, débords de toit compris — un abri annoncé « 19,8 m² » par le fabricant dépasse fréquemment 20 m² une fois l’avancée de toiture mesurée.',
            'Attention également au cumul : si la surface de plancher totale de votre propriété dépasse 150 m² après travaux, le recours à un architecte devient obligatoire et le projet basculerait de toute façon en permis de construire.',
        ],
        seuils: [
            { formalite: 'aucune', condition: 'Emprise au sol et surface de plancher inférieures ou égales à 5 m², et hauteur au plus égale à 12 m — hors secteur protégé.' },
            { formalite: 'dp', condition: 'Emprise au sol ou surface de plancher supérieure à 5 m² et inférieure ou égale à 20 m².' },
            { formalite: 'pc', condition: 'Emprise au sol ou surface de plancher supérieure à 20 m².' },
            { formalite: 'dp', condition: 'Toute surface, y compris moins de 5 m², dès lors que le terrain est situé aux abords d’un monument historique, dans un site patrimonial remarquable ou un site classé.' },
        ],
        pieces: ['DP1', 'DP2', 'DP3', 'DP4', 'DP5', 'DP6', 'DP7', 'DP8'],
        piecesNote: 'Un abri crée un volume bâti : le plan en coupe (DP3) et le document d’insertion (DP6) sont attendus, contrairement à de simples travaux de façade.',
        pluPoints: [
            'Distance minimale aux limites séparatives — souvent 3 m, parfois l’implantation en limite est admise sous condition de hauteur.',
            'Hauteur maximale des annexes, mesurée au faîtage ou à l’acrotère selon le règlement.',
            'Emprise au sol cumulée autorisée sur la parcelle, et pourcentage minimal d’espaces verts ou de pleine terre.',
            'Matériaux et teintes de couverture et de bardage : le bois brut, la tôle et le blanc pur sont fréquemment proscrits.',
            'Nombre maximal d’annexes par unité foncière dans certaines communes.',
        ],
        erreurs: [
            { titre: 'La surface est calculée hors débords de toit', texte: 'L’emprise au sol se mesure au nu extérieur, avancées et débords de toiture inclus. C’est le premier motif de requalification en permis de construire, et il est détecté par l’instructeur sur votre propre plan de masse.' },
            { titre: 'Le plan de masse n’est pas côté aux limites séparatives', texte: 'Sans distance chiffrée entre l’abri et chaque limite de parcelle, l’instructeur ne peut pas vérifier le règlement : c’est une demande de pièces complémentaires quasi systématique.' },
            { titre: 'Le plan de coupe est absent ou décoratif', texte: 'La coupe doit montrer le terrain naturel avant travaux et le niveau fini, avec la hauteur de l’abri reportée. Une coupe sans altimétrie ne remplit pas la fonction de la pièce DP3.' },
            { titre: 'Aucune couleur ni matériau précisé', texte: 'La notice et le plan de façades doivent nommer les matériaux et les teintes, idéalement avec une référence RAL. Un dossier muet sur ce point est bloqué en secteur soumis à l’ABF.' },
            { titre: 'L’abri est posé sur une dalle non déclarée', texte: 'Si le projet inclut une dalle, une plateforme ou un décaissement, cela modifie le profil du terrain et doit apparaître sur la coupe et le plan de masse.' },
        ],
        faq: [
            { q: 'Quelle surface d’abri de jardin sans déclaration ?', a: 'Jusqu’à 5 m² d’emprise au sol et de surface de plancher inclus, avec une hauteur inférieure à 12 m, aucune formalité n’est exigée — sauf si le terrain se trouve en secteur protégé, où la déclaration préalable redevient obligatoire dès le premier mètre carré.' },
            { q: 'Un abri démontable ou sans fondation doit-il être déclaré ?', a: 'Oui. Le Code de l’urbanisme raisonne sur l’emprise au sol et la durée d’implantation, pas sur le mode de fixation. Un abri simplement posé, installé pour plus de trois mois, relève des mêmes seuils qu’une construction fondée.' },
            { q: 'Faut-il une déclaration préalable pour un carport ?', a: 'Un carport crée de l’emprise au sol même s’il est ouvert sur ses côtés. Entre 5 et 20 m², il relève de la déclaration préalable ; au-delà, du permis de construire.' },
            { q: 'L’abri de jardin est-il taxé ?', a: 'La taxe d’aménagement est due dès lors que la surface est close et couverte et que la hauteur sous plafond atteint 1,80 m. Un carport ouvert n’y est pas soumis, un abri fermé l’est. Les collectivités peuvent en outre exonérer, en tout ou partie, les abris de jardin soumis à déclaration préalable dont la surface n’excède pas 20 m² — c’est une délibération locale, à vérifier en mairie.' },
            { q: 'Que se passe-t-il si l’abri est déjà construit ?', a: 'Une déclaration de régularisation peut être déposée pour la construction existante. C’est la voie normale, et elle est très largement préférable à l’attente : l’infraction reste constatable pendant plusieurs années et bloque toute vente sereine du bien.' },
        ],
        related: ['extension-maison', 'terrassement', 'cloture'],
    }),

    T({
        slug: 'piscine',
        travauxId: 'piscine',
        nom: 'Piscine',
        article: 'une piscine',
        metaTitle: 'Déclaration préalable piscine : seuils 10 et 100 m², pièces et dossier',
        metaDescription: 'Piscine enterrée, semi-enterrée ou hors-sol : quand déposer une déclaration préalable, ce que le PLU impose, les pièces obligatoires et les erreurs qui font refuser le dossier.',
        aliases: ['déclaration préalable piscine', 'piscine 10m2 déclaration', 'autorisation piscine enterrée', 'déclaration piscine hors sol', 'piscine sans déclaration'],
        intro: [
            'Deux seuils commandent toute la démarche : 10 m² et 100 m² de bassin. En dessous de 10 m², aucune formalité n’est requise hors secteur protégé. Entre 10 et 100 m², une déclaration préalable est obligatoire. Au-delà de 100 m², ou dès que la couverture atteint 1,80 m de hauteur, le projet relève du permis de construire.',
            'La surface prise en compte est celle du bassin, mesurée au miroir d’eau. Les plages, margelles et locaux techniques n’entrent pas dans ce calcul — mais ils comptent, eux, pour l’emprise au sol de la parcelle et pour les règles du PLU. Une piscine de 32 m² accompagnée d’une terrasse de 40 m² reste une déclaration préalable, tout en pouvant se heurter au coefficient d’emprise au sol de la zone.',
            'Le point le plus souvent négligé est le plan de coupe. Une piscine enterrée modifie le profil du terrain : c’est précisément l’objet de la pièce DP3, et un dossier qui l’élude est renvoyé.',
        ],
        seuils: [
            { formalite: 'aucune', condition: 'Bassin d’une superficie au plus égale à 10 m², non couvert — hors secteur protégé.' },
            { formalite: 'dp', condition: 'Bassin de plus de 10 m² et au plus 100 m², non couvert ou dont la couverture a une hauteur inférieure à 1,80 m.' },
            { formalite: 'pc', condition: 'Bassin de plus de 100 m², ou couverture (fixe ou mobile) d’une hauteur égale ou supérieure à 1,80 m quelle que soit la surface du bassin — la déclaration préalable suppose une couverture strictement inférieure à 1,80 m.' },
            { formalite: 'dp', condition: 'Tout bassin, même de moins de 10 m², en site patrimonial remarquable, site classé ou aux abords d’un monument historique.' },
        ],
        pieces: ['DP1', 'DP2', 'DP3', 'DP4', 'DP6', 'DP7', 'DP8'],
        piecesNote: 'Le plan en coupe (DP3) est la pièce décisive : il doit faire apparaître le terrain naturel, le niveau des margelles et la profondeur du bassin.',
        pluPoints: [
            'Recul minimal du bassin par rapport aux limites séparatives — fréquemment 2 ou 3 m, mesurés depuis le bord du bassin ou depuis la margelle selon le règlement.',
            'Coefficient d’emprise au sol et surface minimale d’espaces de pleine terre, que les plages et terrasses viennent consommer.',
            'Teinte du revêtement intérieur : plusieurs communes littorales ou patrimoniales imposent des teintes claires ou sable et interdisent le bleu vif.',
            'Implantation, hauteur et bardage du local technique, souvent traité comme une annexe à part entière.',
            'Règles d’imperméabilisation et gestion des eaux de vidange.',
        ],
        erreurs: [
            { titre: 'Absence de plan de coupe altimétrique', texte: 'Une piscine enterrée est un décaissement. La coupe doit montrer le profil du terrain avant travaux, le fond du bassin et le niveau fini des margelles, cotés. C’est le motif numéro un de pièces complémentaires sur ce type de dossier.' },
            { titre: 'Le local technique est oublié', texte: 'Pompe, filtration, coffret : s’il y a un édicule, il doit figurer sur le plan de masse avec ses dimensions, et il peut lui-même déclencher des règles d’implantation.' },
            { titre: 'La distance aux limites est mesurée depuis la margelle au lieu du bassin', texte: 'Le règlement précise le point de mesure. Se tromper de référence de quelques dizaines de centimètres suffit à rendre le projet non conforme sur le papier.' },
            { titre: 'La surface est calculée hors margelles… mais la notice dit le contraire', texte: 'Les incohérences entre le Cerfa, la notice et les plans sont relevées systématiquement. Une seule surface de bassin doit apparaître, identique partout.' },
            { titre: 'Aucune mention du dispositif de sécurité', texte: 'La sécurité des piscines enterrées non closes relève du Code de la construction, mais préciser le dispositif prévu (barrière, alarme, abri, couverture) évite une question de l’instructeur.' },
        ],
        faq: [
            { q: 'Une piscine hors-sol nécessite-t-elle une déclaration préalable ?', a: 'Si elle est installée moins de trois mois par an, elle est dispensée de formalité. Au-delà de cette durée, elle est traitée comme une piscine ordinaire : déclaration préalable dès que le bassin dépasse 10 m².' },
            { q: 'Une piscine de 32 m² relève-t-elle du permis de construire ?', a: 'Non. Entre 10 et 100 m² de bassin, la déclaration préalable suffit, à condition que la piscine ne soit pas couverte par un abri de plus de 1,80 m de haut.' },
            { q: 'Faut-il une autorisation pour couvrir une piscine existante ?', a: 'Oui. Un abri de piscine de moins de 1,80 m de hauteur relève de la déclaration préalable. À partir de 1,80 m, il faut un permis de construire, y compris si le bassin est petit.' },
            { q: 'Quelle taxe pour une piscine ?', a: 'La taxe d’aménagement s’applique aux piscines sur une base forfaitaire au mètre carré de bassin, revalorisée chaque année, à laquelle s’ajoutent les taux communal et départemental. La piscine augmente également la valeur locative retenue pour la taxe foncière.' },
            { q: 'Combien de temps pour obtenir la réponse ?', a: 'Un mois en règle générale. Deux mois si le terrain est aux abords d’un monument historique, en site patrimonial remarquable ou en site classé, l’Architecte des Bâtiments de France devant être consulté.' },
        ],
        related: ['terrassement', 'abri-de-jardin', 'cloture'],
    }),

    T({
        slug: 'panneaux-solaires',
        travauxId: 'photovoltaique',
        nom: 'Panneaux solaires',
        article: 'des panneaux photovoltaïques',
        metaTitle: 'Déclaration préalable panneaux solaires : obligation, pièces, délais',
        metaDescription: 'Panneaux photovoltaïques en toiture ou au sol : la déclaration préalable est-elle obligatoire, quelles pièces joindre, quel rôle de l’ABF, et comment monter le dossier.',
        aliases: ['déclaration préalable panneaux solaires', 'déclaration préalable photovoltaïque', 'autorisation panneaux solaires toiture', 'panneaux solaires ABF', 'déclaration préalable panneaux au sol'],
        intro: [
            'Poser des panneaux photovoltaïques sur une toiture modifie l’aspect extérieur d’une construction existante : une déclaration préalable est donc obligatoire, quelle que soit la puissance installée. C’est la règle que les particuliers découvrent souvent après la signature du devis, et que les installateurs traitent parfois en fin de chantier.',
            'Deux configurations changent la nature du dossier. En surimposition, les modules sont posés au-dessus de la couverture existante : le relief créé est visible et l’instructeur y est attentif. En intégration au bâti, ils remplacent la couverture. En secteur patrimonial, cette distinction pèse lourd dans l’avis de l’Architecte des Bâtiments de France.',
            'Pour une installation au sol, le raisonnement est différent : il s’agit d’une construction nouvelle, et ce sont la puissance et la hauteur qui déterminent la formalité.',
        ],
        seuils: [
            { formalite: 'dp', condition: 'Pose de panneaux sur une toiture existante, en surimposition ou en intégration — modification de l’aspect extérieur.' },
            { formalite: 'aucune', condition: 'Installation au sol d’une puissance crête strictement inférieure à 3 kWc et d’une hauteur au-dessus du sol ne dépassant pas 1,80 m, hors secteur protégé.' },
            { formalite: 'dp', condition: 'Installation au sol — ou ombrière intégrant un procédé de production d’énergies renouvelables — d’une puissance crête égale ou supérieure à 3 kWc et inférieure à 3 MWc, quelle que soit la hauteur ; ou de moins de 3 kWc mais dépassant 1,80 m de hauteur.' },
            { formalite: 'pc', condition: 'Installation au sol d’une puissance égale ou supérieure à 3 MWc — seuil porté de 250 kWc à 1 MWc fin 2022, puis à 3 MWc au 1er décembre 2024.' },
        ],
        pieces: ['DP1', 'DP2', 'DP4', 'DP7', 'DP8'],
        piecesNote: 'Le plan des façades et toitures (DP4) doit montrer l’implantation exacte des modules sur le pan de toit, avec leur nombre et leurs dimensions. Un montage photographique du rendu est très fortement recommandé, et exigé en secteur protégé.',
        pluPoints: [
            'Obligation fréquente d’implanter les modules dans le plan de la toiture, sans débord ni surélévation visible.',
            'Interdiction possible en toiture visible depuis la voie publique en site patrimonial remarquable.',
            'Teinte imposée des modules et des cadres : le noir uniforme est souvent exigé, le cadre aluminium clair refusé.',
            'Alignement demandé sur les rives, faîtage et ouvertures existantes — les calepinages en escalier sont régulièrement retoqués.',
            'Règles particulières sur les toitures en tuile canal ou en ardoise des secteurs sauvegardés.',
        ],
        erreurs: [
            { titre: 'Le calepinage n’est pas dessiné', texte: 'Indiquer « 12 panneaux en toiture sud » ne suffit pas. L’instructeur attend un plan de toiture avec l’emprise réelle du champ photovoltaïque, cotée, et sa position par rapport aux rives et au faîtage.' },
            { titre: 'Le dossier ne dit pas s’il s’agit de surimposition ou d’intégration', texte: 'C’est la première information que cherche l’ABF. Son absence entraîne mécaniquement une demande de pièces complémentaires, et deux mois de délai supplémentaires perdus.' },
            { titre: 'Aucun montage d’insertion en secteur protégé', texte: 'Aux abords d’un monument historique, un dossier sans représentation visuelle du rendu final est presque toujours renvoyé. La photo-montage n’est pas décorative : elle est la pièce sur laquelle se fonde l’avis.' },
            { titre: 'Les travaux commencent avant la décision', texte: 'Très fréquent lorsque l’installateur planifie la pose à l’avance. Poser avant la non-opposition expose à une remise en état, et complique le raccordement, le gestionnaire de réseau pouvant demander l’autorisation d’urbanisme.' },
            { titre: 'La teinte du cadre et du bac n’est pas précisée', texte: 'Modules noirs, cadres noirs, bacs de raccordement invisibles : ces précisions figurent au devis mais jamais dans la notice. Les reporter fait gagner un aller-retour.' },
        ],
        faq: [
            { q: 'Faut-il une déclaration préalable pour des panneaux solaires en toiture ?', a: 'Oui, systématiquement. La pose modifie l’aspect extérieur du bâtiment, ce qui suffit à déclencher la déclaration préalable, indépendamment de la puissance installée ou du fait que vous consommiez ou revendiez l’électricité.' },
            { q: 'Combien de temps faut-il compter ?', a: 'Un mois d’instruction en zone ordinaire. Deux mois si l’Architecte des Bâtiments de France doit être consulté, ce qui est le cas aux abords d’un monument historique, en site patrimonial remarquable ou en site classé.' },
            { q: 'L’ABF peut-il refuser des panneaux solaires ?', a: 'Il émet un avis que la mairie doit suivre lorsqu’il est défavorable en abords de monument. En pratique, il oriente plus souvent qu’il refuse : implantation sur un pan non visible depuis la rue, intégration au lieu de la surimposition, modules et cadres noirs.' },
            { q: 'Mon installateur peut-il déposer la déclaration pour moi ?', a: 'Le déclarant reste le propriétaire ou son mandataire. Un installateur peut monter et déposer le dossier en votre nom, mais c’est vous qui signez la déclaration et qui restez responsable de son contenu.' },
            { q: 'Et pour un ombrière ou un carport photovoltaïque ?', a: 'Il crée de l’emprise au sol : ce sont alors les seuils des annexes qui s’appliquent, déclaration préalable entre 5 et 20 m², permis de construire au-delà.' },
        ],
        related: ['refection-de-toiture', 'isolation-exterieure', 'abri-de-jardin'],
    }),

    T({
        slug: 'cloture',
        travauxId: 'cloture',
        nom: 'Clôture',
        article: 'une clôture',
        metaTitle: 'Déclaration préalable clôture : obligation, hauteur, pièces du dossier',
        metaDescription: 'Mur, grillage, panneaux rigides : quand une clôture exige une déclaration préalable, quelle hauteur le PLU autorise, quelles pièces joindre et comment éviter le refus.',
        aliases: ['déclaration préalable clôture', 'autorisation mur de clôture', 'hauteur clôture PLU', 'déclaration préalable portail', 'clôture limite séparative'],
        intro: [
            'Contrairement à une idée répandue, l’édification d’une clôture n’est pas partout soumise à déclaration préalable. Elle l’est lorsque le conseil municipal a délibéré pour l’imposer sur son territoire — ce qu’ont fait la grande majorité des communes — et elle l’est de plein droit dans les secteurs protégés.',
            'En pratique, il faut donc partir du principe qu’une déclaration est nécessaire et le vérifier auprès du service urbanisme. Le risque d’omission est concret : une clôture non conforme est une infraction visible depuis la rue, et c’est le type de dossier qui remonte le plus souvent par plainte de voisinage.',
            'Un point de vocabulaire compte : une clôture sépare une propriété de l’extérieur ou de ses voisins. Un mur de soutènement qui reprend des terres n’est pas une clôture et relève d’un régime distinct, souvent d’une déclaration au titre des affouillements.',
        ],
        seuils: [
            { formalite: 'dp', condition: 'Édification d’une clôture dans une commune ayant délibéré pour soumettre les clôtures à déclaration préalable.' },
            { formalite: 'dp', condition: 'Édification d’une clôture en site patrimonial remarquable, en site classé ou en instance de classement, ou aux abords d’un monument historique — sans condition de délibération.' },
            { formalite: 'aucune', condition: 'Clôture agricole ou forestière, et clôture dans une commune n’ayant pas délibéré et hors secteur protégé.' },
            { formalite: 'pc', condition: 'Aucun cas : une clôture ne relève jamais du permis de construire, mais un mur de soutènement de grande hauteur peut appeler d’autres formalités.' },
        ],
        pieces: ['DP1', 'DP2', 'DP4', 'DP7', 'DP8'],
        piecesNote: 'Le plan de masse doit tracer le linéaire exact de clôture et les portails, et le DP4 fournir une élévation cotée avec les hauteurs de mur-bahut et de grille.',
        pluPoints: [
            'Hauteur totale maximale, très souvent différenciée entre la limite sur voie publique et les limites séparatives.',
            'Hauteur maximale de la partie pleine (mur-bahut), fréquemment plafonnée à 0,60 ou 0,80 m avec grille ou claire-voie au-dessus.',
            'Matériaux et teintes imposés, et interdictions expresses : plaques de béton apparentes, brise-vue synthétiques, tôles.',
            'Obligation de doubler la clôture d’une haie d’essences locales dans certaines zones.',
            'Recul imposé à l’angle des carrefours pour la visibilité, et interdiction de clore dans les marges de recul.',
        ],
        erreurs: [
            { titre: 'Le linéaire n’est pas repéré sur le plan de masse', texte: 'La clôture doit être tracée limite par limite, avec les longueurs et l’emplacement des portails et portillons. Un plan de masse sans tracé ne permet pas d’instruire.' },
            { titre: 'Une seule hauteur est annoncée pour tout le pourtour', texte: 'Le PLU distingue presque toujours la clôture sur rue et celle entre voisins. Déclarer une hauteur unique conduit à un refus partiel sur les linéaires concernés.' },
            { titre: 'L’élévation manque', texte: 'Il faut dessiner la clôture de face, avec la hauteur du soubassement, celle de la grille, le rythme des poteaux. C’est la pièce que l’instructeur compare directement au règlement.' },
            { titre: 'Le mur de soutènement est déclaré comme clôture', texte: 'Reprendre des terres et clore ne sont pas la même chose. Un soutènement doublé d’une clôture doit apparaître comme tel sur la coupe, avec la hauteur de terre reprise.' },
            { titre: 'La teinte n’est pas donnée', texte: 'Un « gris anthracite » sans référence RAL laisse place à l’interprétation. Indiquer RAL 7016 ferme le sujet.' },
        ],
        faq: [
            { q: 'Quelle hauteur de clôture sans autorisation ?', a: 'Il n’existe pas de hauteur nationale libre. La hauteur maximale est fixée par le PLU, généralement entre 1,60 m et 2 m, et la formalité dépend de la délibération de la commune, non de la hauteur. Une clôture de 1 m peut exiger une déclaration là où le conseil municipal l’a décidé.' },
            { q: 'Faut-il l’accord du voisin ?', a: 'Non pour l’urbanisme. Mais si la clôture est édifiée en limite séparative ou si vous souhaitez une clôture mitoyenne partagée, les règles civiles du Code civil sur la mitoyenneté s’appliquent en parallèle de l’autorisation d’urbanisme.' },
            { q: 'Un portail seul doit-il être déclaré ?', a: 'Le portail fait partie de la clôture. Remplacer un portail en modifiant son aspect, sa hauteur ou ses matériaux relève de la même déclaration préalable que la clôture elle-même.' },
            { q: 'Remplacer une clôture existante à l’identique ?', a: 'Un remplacement strictement à l’identique, mêmes matériaux, mêmes teintes, mêmes dimensions, constitue un entretien et échappe en principe à la formalité. Dès que l’aspect change, la déclaration redevient nécessaire.' },
            { q: 'Combien coûte la déclaration ?', a: 'Rien. Le dépôt est gratuit et une clôture ne génère pas de taxe d’aménagement, puisqu’elle ne crée pas de surface close et couverte.' },
        ],
        related: ['terrassement', 'abri-de-jardin', 'ravalement-de-facade'],
    }),

    T({
        slug: 'ravalement-de-facade',
        travauxId: 'ravalement',
        nom: 'Ravalement de façade',
        article: 'un ravalement de façade',
        metaTitle: 'Déclaration préalable ravalement de façade : quand est-elle obligatoire ?',
        metaDescription: 'Ravalement, peinture ou enduit de façade : dans quels cas une déclaration préalable est exigée, le rôle du nuancier communal et de l’ABF, et les pièces à joindre.',
        aliases: ['déclaration préalable ravalement', 'autorisation peinture façade', 'ravalement façade nuancier communal', 'déclaration préalable enduit', 'changer couleur maison autorisation'],
        intro: [
            'Le ravalement occupe une place particulière. Depuis la réforme de 2014, un ravalement qui ne change pas l’aspect de la façade n’est plus soumis à déclaration préalable dans le cas général. Mais deux séries d’exceptions couvrent une large part du territoire habité.',
            'La déclaration redevient obligatoire dès que le terrain est en site patrimonial remarquable, en site classé ou aux abords d’un monument historique, ainsi que dans toute commune dont le conseil municipal a délibéré pour soumettre les ravalements à déclaration. Et surtout : dès que la teinte ou le matériau change, il ne s’agit plus d’un simple ravalement mais d’une modification de l’aspect extérieur, qui exige une déclaration partout.',
            'En clair : refaire le même enduit dans la même teinte est de l’entretien ; passer du crépi beige au gris clair est un projet à déclarer.',
        ],
        seuils: [
            { formalite: 'aucune', condition: 'Ravalement à l’identique, sans changement de teinte ni de matériau, hors secteur protégé et hors commune ayant délibéré.' },
            { formalite: 'dp', condition: 'Changement de teinte, de matériau ou de finition — il ne s’agit plus d’un simple ravalement mais d’une modification de l’aspect extérieur, soumise à déclaration au titre de l’article R. 421-17 a).' },
            { formalite: 'dp', condition: 'Tout ravalement, même à l’identique, en site patrimonial remarquable, site classé ou aux abords d’un monument historique.' },
            { formalite: 'dp', condition: 'Tout ravalement dans une commune — ou un périmètre de commune — dont le conseil municipal, ou l’EPCI compétent en matière de PLU, l’a décidé par délibération motivée (R. 421-17-1 e).' },
        ],
        pieces: ['DP1', 'DP4', 'DP7', 'DP8'],
        piecesNote: 'Le plan des façades (DP4) doit être fourni en deux états, actuel et projeté. Joindre les photos couleur de chaque façade traitée et la référence exacte de la teinte retenue.',
        pluPoints: [
            'Nuancier communal : de nombreuses communes annexent au PLU une palette de teintes admises, et toute référence hors palette est refusée.',
            'Interdiction fréquente du blanc pur et des teintes vives, obligation de teintes rompues ou de tons pierre locale.',
            'Finition imposée : gratté fin, taloché, badigeon à la chaux selon le caractère du bâti.',
            'Obligation de conserver les modénatures, encadrements, bandeaux et chaînages d’angle apparents.',
            'Traitement homogène exigé sur l’ensemble d’un même bâtiment, y compris en copropriété.',
        ],
        erreurs: [
            { titre: 'La teinte est décrite en mots, pas en référence', texte: '« Beige clair » ne veut rien dire pour un instructeur qui doit vérifier un nuancier. Une référence RAL, ou mieux la référence du nuancier communal, rend la vérification immédiate.' },
            { titre: 'Une seule façade est documentée', texte: 'Le dossier doit couvrir toutes les façades concernées, avec l’état actuel et l’état projeté de chacune. Les façades arrière et pignons sont régulièrement oubliés.' },
            { titre: 'La teinte choisie est hors nuancier communal', texte: 'C’est un motif de refus net, et une pure perte de temps : le nuancier est consultable en mairie ou annexé au PLU avant de choisir la couleur.' },
            { titre: 'Le dossier ignore une isolation par l’extérieur', texte: 'Si le ravalement s’accompagne d’un doublage isolant, l’épaisseur ajoutée modifie l’emprise et les débords : le projet change de nature et exige des pièces supplémentaires.' },
            { titre: 'Les menuiseries sont repeintes sans être déclarées', texte: 'Volets, encadrements et menuiseries traités dans la même opération font partie de l’aspect extérieur et doivent figurer dans la notice, avec leurs teintes.' },
        ],
        faq: [
            { q: 'Faut-il une autorisation pour repeindre sa façade ?', a: 'Si la couleur change, oui : c’est une modification de l’aspect extérieur, soumise à déclaration préalable sur tout le territoire. Si vous repeignez strictement dans la même teinte, la formalité n’est en principe pas exigée, sauf en secteur protégé ou si la commune a délibéré.' },
            { q: 'Comment savoir si ma commune a délibéré ?', a: 'Le service urbanisme de la mairie répond immédiatement à cette question, et la délibération est publique. C’est le premier appel à passer avant de lancer un ravalement.' },
            { q: 'Quel délai pour un ravalement en secteur protégé ?', a: 'Deux mois, l’Architecte des Bâtiments de France devant rendre un avis. Prévoir cette durée dans le calendrier de l’entreprise évite de devoir décaler l’échafaudage.' },
            { q: 'Le ravalement est-il obligatoire ?', a: 'Dans certaines communes, une injonction de ravalement peut être prise et impose des travaux périodiques. C’est une obligation distincte de l’autorisation d’urbanisme, qui reste requise pour les réaliser.' },
            { q: 'Et en copropriété ?', a: 'La façade est une partie commune : la décision relève de l’assemblée générale, et c’est le syndicat des copropriétaires qui est déclarant. La déclaration préalable ne dispense pas du vote.' },
        ],
        related: ['isolation-exterieure', 'changement-de-fenetres', 'refection-de-toiture'],
    }),

    T({
        slug: 'isolation-exterieure',
        travauxId: 'isolation',
        nom: 'Isolation par l’extérieur',
        article: 'une isolation thermique par l’extérieur',
        metaTitle: 'Déclaration préalable isolation extérieure (ITE) : dossier et règles',
        metaDescription: 'Isolation thermique par l’extérieur : la déclaration préalable est obligatoire. Pièces à joindre, dépassement sur le domaine public, contraintes PLU et ABF, erreurs à éviter.',
        aliases: ['déclaration préalable isolation extérieure', 'ITE déclaration préalable', 'autorisation bardage extérieur', 'isolation extérieure PLU', 'ITE ABF'],
        intro: [
            'Une isolation thermique par l’extérieur modifie l’aspect de la façade et son épaisseur : elle est soumise à déclaration préalable, sans exception. C’est le point de départ que les dossiers d’aide à la rénovation énergétique mentionnent rarement, alors que l’autorisation conditionne le chantier.',
            'La particularité de l’ITE est géométrique. Ajouter 16 à 20 cm sur chaque façade déplace le nu extérieur du bâtiment, donc l’emprise au sol, donc les distances aux limites séparatives et aux voies. Un bâtiment déjà implanté à la limite, ou en retrait de trois mètres exactement, devient non conforme après isolation — et la loi prévoit précisément des dérogations pour cela, qu’il faut solliciter explicitement.',
            'Si la façade donne directement sur la rue, le débord empiète sur le domaine public : une autorisation de voirie s’ajoute alors à l’autorisation d’urbanisme.',
        ],
        seuils: [
            { formalite: 'dp', condition: 'Isolation par l’extérieur d’une construction existante — modification de l’aspect extérieur.' },
            { formalite: 'dp', condition: 'Isolation entraînant un dépassement des règles d’implantation du PLU, dans la limite de 30 cm, au titre de la dérogation pour isolation.' },
            { formalite: 'pc', condition: 'Lorsque l’opération s’accompagne d’une création de surface de plancher supérieure aux seuils de la déclaration préalable.' },
            { formalite: 'aucune', condition: 'Isolation intérieure ne modifiant pas l’aspect extérieur — aucune formalité d’urbanisme.' },
        ],
        pieces: ['DP1', 'DP2', 'DP4', 'DP7', 'DP8'],
        piecesNote: 'Le plan de masse doit faire apparaître l’épaisseur ajoutée et la nouvelle distance aux limites. Le DP4 doit montrer le traitement des tableaux, appuis de fenêtre, débords de toit et descentes d’eau.',
        pluPoints: [
            'Distances d’implantation aux limites séparatives et à l’alignement, que l’épaisseur d’isolant vient réduire.',
            'Aspect et teinte de la finition, enduit ou bardage, souvent encadrés par un nuancier communal.',
            'Interdiction possible de recouvrir des façades en pierre apparente, brique ou pan de bois présentant un intérêt patrimonial.',
            'Obligation de conserver ou de reconstituer les modénatures et encadrements d’ouverture.',
            'Traitement imposé des soubassements et de la jonction avec la toiture.',
        ],
        erreurs: [
            { titre: 'L’épaisseur ajoutée n’est pas reportée sur le plan de masse', texte: 'C’est l’erreur structurante de l’ITE. Sans le nouveau nu extérieur coté, l’instructeur ne peut vérifier ni les reculs ni l’emprise, et le dossier revient.' },
            { titre: 'La dérogation pour isolation n’est pas demandée', texte: 'Lorsque l’épaisseur fait dépasser une règle d’implantation, la dérogation existe mais doit être sollicitée dans la notice, avec le motif énergétique. L’oublier transforme un dossier acceptable en dossier non conforme.' },
            { titre: 'Le débord sur le domaine public est ignoré', texte: 'Isoler une façade à l’alignement de la rue empiète sur la voie. Il faut une autorisation du gestionnaire de voirie en plus de la déclaration préalable ; la mairie le signalera, au prix d’un aller-retour.' },
            { titre: 'Le traitement des ouvertures n’est pas dessiné', texte: 'Les tableaux de fenêtres se creusent de 16 à 20 cm. Le rendu final dépend de leur traitement, et l’ABF juge d’abord cela en secteur protégé.' },
            { titre: 'Le bardage est décrit sans essence ni teinte', texte: 'Bardage bois : quelle essence, quel sens de pose, quelle finition, grisera-t-il naturellement ? Ces précisions figurent au devis et doivent passer dans la notice.' },
        ],
        faq: [
            { q: 'L’isolation extérieure nécessite-t-elle une déclaration préalable ?', a: 'Oui, systématiquement, puisqu’elle modifie l’aspect extérieur de la construction. L’absence d’autorisation peut par ailleurs être opposée lors du versement des aides à la rénovation énergétique.' },
            { q: 'Peut-on isoler par l’extérieur si la maison est en limite de propriété ?', a: 'La loi prévoit une dérogation permettant de dépasser les règles d’implantation du PLU dans la limite de 30 cm pour isoler un bâtiment existant. Elle doit être expressément demandée dans le dossier, et elle ne s’applique pas au débord sur le domaine public, qui relève d’une autorisation de voirie.' },
            { q: 'L’ABF peut-il refuser une ITE ?', a: 'Oui, notamment sur un bâti ancien dont la façade présente un intérêt patrimonial, ou lorsque l’isolant ferait disparaître des modénatures. Une isolation intérieure est alors souvent la seule voie.' },
            { q: 'Faut-il déclarer une isolation par l’intérieur ?', a: 'Non, tant que l’aspect extérieur n’est pas modifié. Si l’opération touche aux menuiseries ou aux tableaux visibles depuis l’extérieur, la déclaration redevient nécessaire pour cette partie.' },
            { q: 'Combien de temps avant de commencer les travaux ?', a: 'Un mois d’instruction, deux en secteur protégé. Comptez le délai dans la planification de l’entreprise : commencer avant la décision est une infraction, et l’échafaudage rend le chantier parfaitement visible.' },
        ],
        related: ['ravalement-de-facade', 'changement-de-fenetres', 'refection-de-toiture'],
    }),

    T({
        slug: 'changement-de-fenetres',
        travauxId: 'menuiseries',
        nom: 'Changement de fenêtres',
        article: 'un remplacement de menuiseries',
        metaTitle: 'Déclaration préalable changement de fenêtres : est-elle obligatoire ?',
        metaDescription: 'Remplacer fenêtres, portes ou volets : quand une déclaration préalable est exigée, ce que le PLU et l’ABF imposent sur les matériaux et teintes, et les pièces du dossier.',
        aliases: ['déclaration préalable changement de fenêtres', 'autorisation remplacement fenêtres', 'changer fenêtres bois par PVC autorisation', 'déclaration préalable volets', 'menuiseries ABF'],
        intro: [
            'Remplacer des menuiseries extérieures relève de la déclaration préalable dès lors que l’aspect extérieur change : matériau, teinte, dimensions, partition des vitrages, type de volet. C’est presque toujours le cas lors d’une rénovation énergétique, où l’on passe du bois simple vitrage à du PVC ou de l’aluminium double vitrage.',
            'Le remplacement strictement à l’identique, mêmes dimensions, même matériau, même teinte, même dessin, constitue en revanche un entretien et échappe à la formalité. La frontière est fine : un PVC blanc à la place d’un bois peint en blanc n’est pas identique, car le matériau et le profil changent.',
            'C’est un dossier léger sur le fond mais exigeant sur le détail : ce qui se joue est le dessin des façades, et l’instructeur compare pièce par pièce l’existant et le projeté.',
        ],
        seuils: [
            { formalite: 'dp', condition: 'Remplacement modifiant le matériau, la teinte, les dimensions ou le dessin des menuiseries — modification de l’aspect extérieur.' },
            { formalite: 'aucune', condition: 'Remplacement strictement à l’identique : mêmes dimensions, matériau, teinte et partition.' },
            { formalite: 'dp', condition: 'Tout remplacement, même à l’identique, en site patrimonial remarquable, site classé ou aux abords d’un monument historique.' },
            { formalite: 'dp', condition: 'Création, agrandissement ou suppression d’une baie — voir la création d’ouverture.' },
        ],
        pieces: ['DP1', 'DP4', 'DP7', 'DP8'],
        piecesNote: 'Le plan des façades (DP4) doit présenter l’état actuel et l’état projeté côte à côte, avec le dessin des ouvrants et des petits bois. Joindre une photo de chaque façade concernée.',
        pluPoints: [
            'Matériaux admis ou proscrits : le PVC est interdit sur le bâti ancien de nombreux secteurs patrimoniaux.',
            'Teintes imposées par un nuancier communal, y compris pour les volets et les portes.',
            'Obligation de conserver la partition d’origine des vitrages et les petits bois sur le bâti ancien.',
            'Type de volet admis : battants conservés, roulants avec coffre extérieur souvent interdits en façade sur rue.',
            'Conservation exigée des appuis, linteaux et encadrements en pierre.',
        ],
        erreurs: [
            { titre: 'Seul l’état projeté est fourni', texte: 'Le DP4 doit montrer l’avant et l’après. Sans l’état actuel, l’instructeur ne peut pas mesurer la modification, et c’est une demande de pièces immédiate.' },
            { titre: 'Le coffre de volet roulant est oublié', texte: 'Un coffre en applique extérieure change la façade et est souvent réglementé. Il doit apparaître sur l’élévation, avec sa saillie et sa teinte.' },
            { titre: 'La teinte est donnée sans RAL', texte: '« Gris anthracite » couvre une dizaine de nuances. RAL 7016 est vérifiable, et c’est ce que le nuancier communal utilise.' },
            { titre: 'La partition des vitrages est simplifiée', texte: 'Remplacer une fenêtre à six carreaux par un vitrage plein est une modification lourde sur du bâti ancien. La dessiner honnêtement évite un refus ; la masquer garantit une visite de contrôle.' },
            { titre: 'Le dossier ne couvre pas toutes les façades', texte: 'Les menuiseries remplacées sur les pignons ou la façade arrière font partie du même projet et doivent être documentées, même si elles sont peu visibles.' },
        ],
        faq: [
            { q: 'Faut-il une déclaration préalable pour changer ses fenêtres ?', a: 'Oui dès que l’aspect change — matériau, couleur, dimensions ou dessin. Un remplacement rigoureusement à l’identique en est dispensé, mais cette hypothèse est rare en rénovation énergétique.' },
            { q: 'Puis-je passer du bois au PVC ?', a: 'En zone ordinaire, généralement oui, sous réserve de la teinte imposée. En secteur patrimonial ou aux abords d’un monument historique, le PVC est fréquemment refusé au profit du bois ou de l’aluminium à profils fins.' },
            { q: 'Les volets doivent-ils être déclarés ?', a: 'Oui, ils font partie de l’aspect extérieur. Le passage de volets battants à des volets roulants avec coffre visible est un point de vigilance courant des services urbanisme.' },
            { q: 'Une véranda ou une fenêtre de toit relèvent-elles du même dossier ?', a: 'Une fenêtre de toit est une création d’ouverture. Une véranda crée de la surface de plancher et relève des seuils d’extension : déclaration préalable jusqu’à 20 ou 40 m² selon la zone, permis au-delà.' },
            { q: 'Les aides à la rénovation exigent-elles l’autorisation ?', a: 'Le financeur peut demander l’autorisation d’urbanisme comme pièce justificative, et la conformité des travaux peut être contrôlée. Déposer la déclaration sécurise le versement.' },
        ],
        related: ['creation-ouverture', 'ravalement-de-facade', 'isolation-exterieure'],
    }),

    T({
        slug: 'creation-ouverture',
        travauxId: 'ouverture',
        nom: 'Création d’ouverture',
        article: 'la création d’une ouverture',
        metaTitle: 'Déclaration préalable création d’ouverture : fenêtre, porte, velux',
        metaDescription: 'Percer une fenêtre, une porte ou poser un velux : la déclaration préalable est obligatoire. Pièces à joindre, règles de vues sur le voisin, contraintes PLU et erreurs fréquentes.',
        aliases: ['déclaration préalable création ouverture', 'percer une fenêtre autorisation', 'déclaration préalable velux', 'déclaration préalable fenêtre de toit', 'ouverture mur porteur autorisation'],
        intro: [
            'Créer, agrandir ou supprimer une baie modifie l’aspect extérieur d’une construction : la déclaration préalable est obligatoire. Cela vaut pour une fenêtre, une porte, une porte-fenêtre comme pour une fenêtre de toit, y compris lorsque l’ouverture donne sur une cour intérieure ou une façade non visible de la rue.',
            'Deux corps de règles se superposent ici, et c’est ce qui rend le sujet piégeux. L’urbanisme encadre le dessin de la façade : rythme, proportions, alignement des baies, type de menuiserie. Le Code civil, indépendamment de toute autorisation, encadre les vues sur le fonds voisin — 1,90 m de recul pour une vue droite, 0,60 m pour une vue oblique. Une déclaration accordée ne vous protège pas d’une action civile du voisin si ces distances ne sont pas respectées.',
            'La mairie ne vérifie pas les règles de vues. C’est à vous de les intégrer avant de dessiner le projet.',
        ],
        seuils: [
            { formalite: 'dp', condition: 'Création, agrandissement ou suppression d’une ouverture en façade ou en toiture.' },
            { formalite: 'dp', condition: 'Pose d’une fenêtre de toit ou d’un châssis de désenfumage visible depuis l’extérieur.' },
            { formalite: 'aucune', condition: 'Travaux intérieurs sans aucune incidence sur l’aspect extérieur.' },
            { formalite: 'pc', condition: 'Lorsque l’ouverture accompagne une création de surface de plancher au-delà des seuils de la déclaration préalable.' },
        ],
        pieces: ['DP1', 'DP4', 'DP7', 'DP8'],
        piecesNote: 'Le DP4 doit montrer la façade avant et après, avec la baie cotée en largeur, hauteur et allège, et son alignement par rapport aux ouvertures existantes.',
        pluPoints: [
            'Rythme et proportions des baies : de nombreux règlements imposent des ouvertures plus hautes que larges sur le bâti traditionnel.',
            'Alignement vertical des baies sur les niveaux inférieurs, et interdiction des percements aléatoires.',
            'Nombre et implantation des fenêtres de toit, parfois plafonnés ou interdits sur les pans visibles depuis la voie.',
            'Encadrements, linteaux et appuis imposés, en pierre ou en enduit contrasté.',
            'Interdiction possible de percer un pignon aveugle en secteur patrimonial.',
        ],
        erreurs: [
            { titre: 'La baie n’est pas cotée', texte: 'Largeur, hauteur, hauteur d’allège, distance aux angles : sans ces cotes, l’instructeur ne peut pas apprécier la proportion, et le dossier revient.' },
            { titre: 'Les règles de vues du Code civil sont ignorées', texte: 'Une ouverture à moins de 1,90 m de la limite en vue droite est contestable par le voisin devant le juge civil, même avec une non-opposition en main. C’est le contentieux le plus fréquent après ce type de travaux.' },
            { titre: 'Le nouveau percement casse l’ordonnancement de la façade', texte: 'Une baie non alignée sur les ouvertures existantes est un motif de refus classique sur le bâti ancien. Aligner le projet coûte moins cher que de le redéposer.' },
            { titre: 'Le velux est traité comme un détail', texte: 'Une fenêtre de toit est une modification de la toiture, souvent la plus visible du quartier. Elle doit figurer sur le plan de toiture avec sa position et ses dimensions.' },
            { titre: 'La suppression d’une baie n’est pas déclarée', texte: 'Boucher une ouverture modifie aussi l’aspect extérieur, et le raccord d’enduit sera visible. La suppression relève de la même déclaration que la création.' },
        ],
        faq: [
            { q: 'Faut-il une autorisation pour percer une fenêtre ?', a: 'Oui, une déclaration préalable est obligatoire, y compris pour une ouverture sur une façade arrière ou une cour. La modification de l’aspect extérieur suffit à déclencher la formalité.' },
            { q: 'Quelle distance respecter par rapport au voisin ?', a: 'Le Code civil impose 1,90 m entre le nu du mur et la limite séparative pour une vue droite, et 0,60 m pour une vue oblique. Ces règles sont indépendantes de l’urbanisme : la mairie ne les contrôle pas, mais le voisin peut les invoquer en justice.' },
            { q: 'Un velux nécessite-t-il une déclaration préalable ?', a: 'Oui. C’est une modification de la toiture, et certains PLU limitent le nombre de fenêtres de toit ou les interdisent sur les pans visibles depuis la voie publique.' },
            { q: 'Et pour une porte de garage ?', a: 'Remplacer ou créer une porte de garage modifie la façade et relève de la déclaration préalable. Si l’accès implique un abaissement de bordure de trottoir, une autorisation de voirie s’y ajoute.' },
            { q: 'Puis-je transformer une fenêtre en porte-fenêtre ?', a: 'Oui, avec une déclaration préalable. L’agrandissement de la baie doit être coté et le dossier doit montrer le traitement du seuil et de l’allège supprimée.' },
        ],
        related: ['changement-de-fenetres', 'refection-de-toiture', 'extension-maison'],
    }),

    T({
        slug: 'refection-de-toiture',
        travauxId: 'toiture',
        nom: 'Réfection de toiture',
        article: 'une réfection de toiture',
        metaTitle: 'Déclaration préalable toiture : réfection, changement de tuiles, matériaux',
        metaDescription: 'Refaire sa toiture : quand la déclaration préalable est obligatoire, ce que le PLU impose sur les matériaux et teintes, les pièces à joindre et les erreurs à éviter.',
        aliases: ['déclaration préalable toiture', 'changement de tuiles autorisation', 'réfection toiture déclaration', 'déclaration préalable couverture', 'changer couleur toiture'],
        intro: [
            'Refaire une couverture à l’identique, mêmes tuiles, même teinte, même pente, est un entretien : aucune formalité n’est exigée hors secteur protégé. Dès que le matériau, la teinte, le galbe ou la pente changent, il s’agit d’une modification de l’aspect extérieur et la déclaration préalable devient obligatoire.',
            'La toiture est l’élément le plus réglementé du bâti dans la plupart des PLU, parce qu’elle constitue la cinquième façade, visible de loin et déterminante pour l’identité d’un quartier. Les règlements imposent couramment un matériau, une plage de teintes, une pente minimale et un nombre de tuiles au mètre carré pour le bâti traditionnel.',
            'Si l’opération s’accompagne d’une surélévation, d’une modification de pente ou de la création de lucarnes, on quitte la réfection : le volume bâti change, un plan de coupe devient nécessaire et le projet peut basculer vers le permis de construire.',
        ],
        seuils: [
            { formalite: 'aucune', condition: 'Réfection à l’identique : même matériau, même teinte, même pente, hors secteur protégé.' },
            { formalite: 'dp', condition: 'Changement de matériau, de teinte, de galbe ou de pente de la couverture.' },
            { formalite: 'dp', condition: 'Toute réfection, même à l’identique, en site patrimonial remarquable, site classé ou aux abords d’un monument historique.' },
            { formalite: 'pc', condition: 'Surélévation créant de la surface de plancher au-delà des seuils de la déclaration préalable, ou portant le total au-delà de 150 m².' },
        ],
        pieces: ['DP1', 'DP4', 'DP7', 'DP8'],
        piecesNote: 'Ajoutez le plan en coupe (DP3) dès que la pente, la hauteur au faîtage ou le volume changent. Le DP4 doit inclure un plan de toiture avec les pentes, les rives et les éléments en saillie.',
        pluPoints: [
            'Matériau de couverture imposé : tuile canal, tuile plate à fort galbe, ardoise, zinc selon le caractère local.',
            'Nombre de tuiles au mètre carré exigé sur le bâti ancien, pour préserver la texture de la toiture.',
            'Plage de teintes admises, généralement des tons rouge vieilli, brun ou terre naturelle ; les teintes uniformes très foncées sont souvent refusées.',
            'Pente minimale et maximale, et interdiction fréquente des toitures-terrasses en zone pavillonnaire traditionnelle.',
            'Traitement des rives, débords, souches de cheminée et éléments en zinc.',
        ],
        erreurs: [
            { titre: 'Aucun plan de toiture', texte: 'Une élévation de façade ne montre pas les pans, les noues et les éléments en saillie. Le plan de toiture est la pièce que l’instructeur cherche en premier sur ce type de dossier.' },
            { titre: 'La référence de tuile n’est pas donnée', texte: 'Modèle, fabricant, teinte, nombre au mètre carré : ces informations figurent au devis du couvreur et permettent une vérification immédiate au regard du règlement.' },
            { titre: 'Une surélévation est présentée comme une réfection', texte: 'Modifier la pente ou rehausser le faîtage change le volume bâti. Le dossier doit alors comporter une coupe et peut relever du permis de construire.' },
            { titre: 'Les fenêtres de toit ajoutées ne sont pas déclarées', texte: 'Les velux posés à l’occasion de la réfection sont des créations d’ouverture, à intégrer au dossier avec leur position et leurs dimensions.' },
            { titre: 'Les panneaux solaires posés dans la même opération sont omis', texte: 'La pose de photovoltaïque relève de sa propre déclaration. Traiter les deux dans un dossier unique et cohérent évite un second cycle d’instruction.' },
        ],
        faq: [
            { q: 'Faut-il une déclaration préalable pour refaire sa toiture ?', a: 'Non si la réfection est strictement à l’identique et que vous n’êtes pas en secteur protégé. Oui dès que le matériau, la teinte, le galbe ou la pente changent.' },
            { q: 'Puis-je changer la couleur de mes tuiles ?', a: 'Cela nécessite une déclaration préalable, et le PLU impose très souvent une plage de teintes. Vérifier le règlement avant de commander le matériau évite un refus et une commande inutilisable.' },
            { q: 'Une isolation de toiture par l’extérieur (sarking) est-elle concernée ?', a: 'Oui. Elle rehausse le plan de couverture et modifie les débords et les rives : déclaration préalable, avec une coupe montrant la nouvelle épaisseur.' },
            { q: 'Que faire si mon couvreur veut commencer tout de suite ?', a: 'Attendre la décision. Un mois d’instruction, deux en secteur protégé. Un chantier de toiture est parfaitement visible et une reprise imposée coûte bien davantage que le délai.' },
            { q: 'La réfection de toiture est-elle taxée ?', a: 'Non, tant qu’aucune surface de plancher n’est créée. Une surélévation aménageant des combles crée en revanche de la surface, potentiellement taxable.' },
        ],
        related: ['panneaux-solaires', 'creation-ouverture', 'isolation-exterieure'],
    }),

    T({
        slug: 'extension-maison',
        travauxId: 'extension',
        nom: 'Extension de maison',
        article: 'une extension de maison',
        metaTitle: 'Déclaration préalable extension : seuils 20 et 40 m², dossier complet',
        metaDescription: 'Extension, véranda, surélévation : déclaration préalable jusqu’à 20 ou 40 m² selon la zone, permis au-delà. Seuil des 150 m² et architecte, pièces obligatoires, erreurs à éviter.',
        aliases: ['déclaration préalable extension', 'extension 40m2 déclaration préalable', 'déclaration préalable véranda', 'extension maison 20m2', 'agrandissement maison autorisation'],
        intro: [
            'Deux seuils, et une condition qui décide lequel s’applique. Une extension d’un bâtiment existant relève de la déclaration préalable jusqu’à 40 m² de surface de plancher ou d’emprise au sol créée, mais seulement si le terrain est situé en zone urbaine d’un PLU ou d’un document d’urbanisme en tenant lieu. Ailleurs — commune au règlement national d’urbanisme, zone agricole ou naturelle — le seuil retombe à 20 m².',
            'Un troisième seuil s’ajoute par-dessus, et c’est celui qui surprend le plus : si la surface de plancher totale de la construction dépasse 150 m² après travaux, le permis de construire est exigé et le recours à un architecte devient obligatoire. Une maison de 130 m² qui s’agrandit de 25 m² basculera donc en permis, même en zone urbaine et même sous les 40 m².',
            'Enfin, l’extension doit être accolée au bâtiment existant et communiquer avec lui. Une construction isolée dans le jardin n’est pas une extension mais une annexe, et retombe sur le seuil de 20 m².',
        ],
        seuils: [
            { formalite: 'dp', condition: 'Extension créant au plus 40 m² de surface de plancher ou d’emprise au sol, en zone urbaine d’un PLU ou d’un POS.' },
            { formalite: 'dp', condition: 'Extension créant au plus 20 m², hors zone urbaine d’un PLU — communes au RNU, zones agricoles et naturelles.' },
            { formalite: 'pc', condition: 'Extension dépassant le seuil applicable de 20 ou 40 m².' },
            { formalite: 'pc', condition: 'Extension portant la surface de plancher totale de la construction au-delà de 150 m² — recours à un architecte obligatoire.' },
        ],
        pieces: ['DP1', 'DP2', 'DP3', 'DP4', 'DP5', 'DP6', 'DP7', 'DP8'],
        piecesNote: 'C’est le dossier le plus complet des déclarations préalables : l’extension crée du volume, donc coupe, insertion et représentation de l’aspect extérieur sont attendues.',
        pluPoints: [
            'Emprise au sol maximale et coefficient d’emprise de la zone, calculés sur l’ensemble des constructions de la parcelle.',
            'Recul aux limites séparatives et à l’alignement, et règles de hauteur par rapport au bâtiment principal.',
            'Obligation d’harmonie : matériaux, teintes et pente de toiture souvent imposés en cohérence avec l’existant.',
            'Surface minimale de pleine terre ou d’espaces verts à conserver après extension.',
            'Nombre de places de stationnement à créer, fréquemment déclenché par la création de surface habitable.',
        ],
        erreurs: [
            { titre: 'Confusion entre surface de plancher et emprise au sol', texte: 'Ce sont deux notions distinctes, et le seuil s’apprécie sur la plus contraignante. Une véranda crée peu de surface de plancher mais autant d’emprise au sol : c’est cette dernière qui déclenche souvent le basculement en permis.' },
            { titre: 'Le seuil des 150 m² n’est pas vérifié', texte: 'Il porte sur le total après travaux, existant compris. Beaucoup de dossiers sont déposés en déclaration préalable alors qu’ils exigeaient un permis et un architecte : le rejet est certain, et plusieurs mois sont perdus.' },
            { titre: 'Le seuil de 40 m² est appliqué hors zone urbaine', texte: 'Les 40 m² supposent une zone U d’un PLU. En commune soumise au règlement national d’urbanisme, le seuil reste 20 m². Vérifier le zonage sur le Géoportail de l’Urbanisme prend deux minutes.' },
            { titre: 'La coupe ne montre pas le raccordement à l’existant', texte: 'Le DP3 doit faire apparaître le terrain naturel, le niveau fini et la jonction de la toiture nouvelle avec le bâtiment existant. C’est là que se lisent les hauteurs réglementaires.' },
            { titre: 'Le stationnement imposé est oublié', texte: 'Créer de la surface habitable déclenche souvent l’obligation de places supplémentaires. Le plan de masse doit les figurer, sinon le dossier est incomplet.' },
        ],
        faq: [
            { q: 'Extension de 30 m² : déclaration préalable ou permis ?', a: 'Déclaration préalable si le terrain est en zone urbaine d’un PLU et que la surface totale reste sous 150 m² après travaux. Permis de construire dans tous les autres cas.' },
            { q: 'Une véranda relève-t-elle de la déclaration préalable ?', a: 'Oui jusqu’à 40 m² en zone urbaine d’un PLU, 20 m² ailleurs. Attention à l’emprise au sol, souvent supérieure à ce que l’on estime, et au seuil des 150 m² au total.' },
            { q: 'À partir de quand un architecte est-il obligatoire ?', a: 'Lorsque la surface de plancher ou l’emprise au sol totale dépasse 150 m² après travaux. En dessous, un particulier construisant pour lui-même en est dispensé.' },
            { q: 'Comment savoir si je suis en zone urbaine ?', a: 'Le Géoportail de l’Urbanisme affiche le zonage du PLU de votre commune. Le service urbanisme de la mairie confirme la zone et vous remet le règlement applicable à votre parcelle.' },
            { q: 'Une surélévation compte-t-elle comme une extension ?', a: 'Oui, elle crée de la surface de plancher et suit les mêmes seuils. Elle exige en plus une coupe précise, la hauteur au faîtage étant strictement plafonnée par le PLU.' },
        ],
        related: ['abri-de-jardin', 'creation-ouverture', 'refection-de-toiture'],
    }),

    T({
        slug: 'terrassement',
        travauxId: 'terrassement',
        nom: 'Terrassement et soutènement',
        article: 'un terrassement',
        metaTitle: 'Déclaration préalable terrassement : seuils 100 m² et 2 m, mur de soutènement',
        metaDescription: 'Affouillement, exhaussement, mur de soutènement : quand une déclaration préalable est obligatoire, quelles pièces joindre et comment traiter le profil du terrain.',
        aliases: ['déclaration préalable terrassement', 'déclaration préalable mur de soutènement', 'affouillement exhaussement déclaration', 'autorisation remblai', 'modifier niveau terrain autorisation'],
        intro: [
            'Modifier le relief d’un terrain porte un nom précis en urbanisme : affouillement quand on creuse, exhaussement quand on remblaie. La formalité tient à un double seuil cumulatif : une déclaration préalable est exigée lorsque la surface concernée atteint 100 m² et que la hauteur ou la profondeur excède 2 m. Sous l’un des deux seuils, aucune formalité n’est requise en zone ordinaire.',
            'Les murs suivent une logique distincte, et une confusion répandue mérite d’être levée : l’article sur les affouillements ne dit rien des murs. Un mur, de soutènement ou non, relève de la déclaration préalable dès que sa hauteur au-dessus du sol atteint 2 m ; en deçà, et s’il ne constitue pas une clôture, il est dispensé de formalité hors secteur protégé. Beaucoup de PLU les encadrent spécifiquement en hauteur et en matériau.',
            'Le sujet revient presque toujours accolé à un autre projet — piscine, extension, accès de garage — et c’est là qu’il se perd. Le décaissement fait partie du projet et doit apparaître sur la coupe, même quand il ne déclenche pas de formalité à lui seul.',
        ],
        seuils: [
            { formalite: 'dp', condition: 'Affouillement ou exhaussement dont la superficie est égale ou supérieure à 100 m² ET dont la hauteur (exhaussement) ou la profondeur (affouillement) excède 2 m — les deux conditions sont cumulatives.' },
            { formalite: 'aucune', condition: 'Mouvement de terre restant sous l’un des deux seuils, hors secteur protégé.' },
            { formalite: 'dp', condition: 'Mur — de soutènement ou non — dont la hauteur au-dessus du sol atteint 2 m (R. 421-9 e). En deçà de 2 m, un mur qui ne constitue pas une clôture est dispensé de formalité hors secteur protégé.' },
            { formalite: 'dp', condition: 'Tout affouillement ou exhaussement en site patrimonial remarquable, site classé ou aux abords d’un monument historique, sans condition de seuil.' },
        ],
        pieces: ['DP1', 'DP2', 'DP3', 'DP7', 'DP8'],
        piecesNote: 'Le plan en coupe (DP3) est la pièce maîtresse : profil du terrain naturel avant travaux et profil projeté superposés, avec les hauteurs de déblai et de remblai cotées.',
        pluPoints: [
            'Hauteur maximale des murs de soutènement, et obligation fréquente de les fractionner en redents ou en terrasses.',
            'Matériaux imposés : parement pierre, enduit teinté, interdiction du bloc béton brut apparent.',
            'Obligation de respecter le terrain naturel et interdiction des mouvements de terre créant des plateformes artificielles visibles.',
            'Gestion des eaux de ruissellement et de l’infiltration à la parcelle.',
            'Règles particulières en zone inondable ou de risque de mouvement de terrain, où le remblai peut être interdit.',
        ],
        erreurs: [
            { titre: 'Le terrain naturel avant travaux n’est pas tracé', texte: 'Une coupe qui ne montre que l’état projeté ne prouve rien. Il faut les deux profils superposés, avec les cotes de déblai et de remblai. C’est la seule pièce qui permet de vérifier une hauteur réglementaire.' },
            { titre: 'Le soutènement est déclaré comme une clôture', texte: 'Reprendre des terres et clore un terrain relèvent de règles différentes, souvent de hauteurs maximales différentes. La confusion aboutit à une instruction sur le mauvais fondement, donc à un refus.' },
            { titre: 'Le terrassement d’un autre projet n’est pas déclaré', texte: 'Décaisser pour une piscine, un garage en sous-sol ou une plateforme fait partie du projet. Omis, il ressort à la visite de conformité, et impose une régularisation.' },
            { titre: 'L’écoulement des eaux vers le voisin est ignoré', texte: 'Un remblai qui rejette les eaux sur la parcelle voisine engage votre responsabilité civile, indépendamment de l’autorisation d’urbanisme. Le dossier gagne à décrire le dispositif de gestion des eaux.' },
            { titre: 'Les volumes annoncés ne correspondent pas aux plans', texte: 'Surface et hauteur doivent être cohérentes entre le Cerfa, la notice et la coupe. Les écarts sont relevés et suspendent l’instruction.' },
        ],
        faq: [
            { q: 'Quand un terrassement doit-il être déclaré ?', a: 'Lorsque les deux seuils sont franchis ensemble : au moins 100 m² de superficie et plus de 2 m de hauteur ou de profondeur. En secteur protégé, la déclaration est exigée sans condition de seuil.' },
            { q: 'Un mur de soutènement nécessite-t-il une déclaration préalable ?', a: 'Dès que sa hauteur au-dessus du sol atteint 2 m, oui : c’est le régime des murs, distinct de celui des affouillements. En deçà de 2 m, et s’il ne fait pas office de clôture, il en est dispensé hors secteur protégé. Le PLU en plafonne souvent la hauteur et impose un parement.' },
            { q: 'Faut-il déclarer le décaissement d’une piscine ?', a: 'Il ne déclenche généralement pas de formalité propre, mais il doit figurer sur le plan de coupe du dossier de piscine. C’est précisément la fonction de la pièce DP3.' },
            { q: 'Puis-je remblayer librement mon terrain ?', a: 'Sous les seuils et hors secteur protégé, aucune formalité d’urbanisme n’est exigée. Mais le PLU peut imposer le respect du terrain naturel, et le remblai est fréquemment encadré ou interdit en zone inondable.' },
            { q: 'Et si le terrain est en zone de risque ?', a: 'Un plan de prévention des risques peut interdire ou conditionner les mouvements de terre. Il est annexé au PLU et opposable : il faut le consulter avant de concevoir le projet.' },
        ],
        related: ['piscine', 'cloture', 'extension-maison'],
    }),
]

// ─── Réponse courte ──────────────────────────────────────────────────────────
// Le visiteur arrive avec UNE question : « ai-je besoin d'une autorisation ? ».
// Elle est affichée en haut de page, avant toute explication. Le reste du guide
// est là pour ceux qui creusent, pas pour faire barrage à la réponse.
export const VERDICTS: Record<string, { reponse: string; seuilCle: string }> = {
    'abri-de-jardin': {
        reponse: 'Déclaration préalable dès 5 m² et jusqu’à 20 m² d’emprise au sol, débords de toit compris. Au-delà, permis de construire.',
        seuilCle: '5 – 20 m²',
    },
    'piscine': {
        reponse: 'Déclaration préalable pour un bassin de 10 à 100 m², non couvert ou sous un abri de moins de 1,80 m de haut.',
        seuilCle: '10 – 100 m²',
    },
    'panneaux-solaires': {
        reponse: 'Déclaration préalable obligatoire pour toute pose en toiture, quelle que soit la puissance installée.',
        seuilCle: 'Toujours en toiture',
    },
    'cloture': {
        reponse: 'Déclaration préalable dans la grande majorité des communes, qui ont délibéré en ce sens — et systématiquement en secteur protégé.',
        seuilCle: 'Selon délibération',
    },
    'ravalement-de-facade': {
        reponse: 'Déclaration préalable dès que la teinte ou le matériau change. À l’identique, aucune formalité hors secteur protégé.',
        seuilCle: 'Si l’aspect change',
    },
    'isolation-exterieure': {
        reponse: 'Déclaration préalable obligatoire : l’isolation extérieure modifie à la fois l’aspect et l’épaisseur de la façade.',
        seuilCle: 'Toujours',
    },
    'changement-de-fenetres': {
        reponse: 'Déclaration préalable dès que le matériau, la teinte, les dimensions ou le dessin changent. Le remplacement à l’identique en est dispensé.',
        seuilCle: 'Si l’aspect change',
    },
    'creation-ouverture': {
        reponse: 'Déclaration préalable pour toute création, tout agrandissement ou toute suppression de baie, y compris en façade arrière.',
        seuilCle: 'Toujours',
    },
    'refection-de-toiture': {
        reponse: 'Aucune formalité si la réfection est à l’identique. Déclaration préalable dès que le matériau, la teinte ou la pente change.',
        seuilCle: 'Si l’aspect change',
    },
    'extension-maison': {
        reponse: 'Déclaration préalable jusqu’à 40 m² en zone urbaine d’un PLU, 20 m² ailleurs. Permis de construire au-delà, et dès 150 m² au total après travaux.',
        seuilCle: '20 ou 40 m²',
    },
    'terrassement': {
        reponse: 'Déclaration préalable à partir de 100 m² de superficie ET au-delà de 2 m de hauteur ou de profondeur. Un mur de soutènement relève, lui, d’un autre régime : déclaration dès 2 m de hauteur.',
        seuilCle: '≥ 100 m² et > 2 m',
    },
}

const BY_SLUG = new Map(SEO_TRAVAUX.map(t => [t.slug, t]))
const BY_ID = new Map(SEO_TRAVAUX.map(t => [t.travauxId, t]))

export const findTravaux = (slug: string) => BY_SLUG.get(slug)
export const travauxBySlug = BY_SLUG
export const findTravauxByRegistryId = (id: TravauxId) => BY_ID.get(id)

export const FORMALITE_LABEL: Record<Seuil['formalite'], string> = {
    aucune: 'Aucune formalité',
    dp: 'Déclaration préalable',
    pc: 'Permis de construire',
}
