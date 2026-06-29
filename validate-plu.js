// Validation script

// 1. Mock evaluateProject function to test decision engine locally
function evaluateProject(travaux, rules, overlays) {
    const violations = []
    const warnings = []
    let decision = "DECLARATION_PREALABLE_OK"
    let status = "PROBABLEMENT CONFORME"

    // Evaluate surfaces (extension)
    const creeeSurface = parseFloat(travaux.surfaces?.creee || '0')
    const maxArea = rules?.extension?.max_area_m2 || 20

    if (creeeSurface > 0) {
        if (creeeSurface > maxArea) {
            decision = "PERMIS_CONSTRUIRE"
            status = "PROBABLEMENT NON-CONFORME"
            violations.push(`La surface créée (${creeeSurface} m²) dépasse le seuil maximal de la Déclaration Préalable de ${maxArea} m² pour cette zone (un Permis de Construire est requis).`)
        } else if (creeeSurface > 150) {
            decision = "PERMIS_CONSTRUIRE"
            status = "PROBABLEMENT NON-CONFORME"
            violations.push(`La surface de plancher totale après travaux dépassera 150 m², ce qui nécessite un Permis de Construire avec recours obligatoire à un architecte.`)
        }
    }

    // Evaluate materials / facade
    if (travaux.type === 'menuiseries' && travaux.menuiseries) {
        const m = travaux.menuiseries
        const material = (m.materiau || '').toLowerCase()
        
        const forbiddenMaterials = (rules?.facade?.forbidden_materials || []).map(x => x.toLowerCase())
        const allowedMaterials = (rules?.facade?.allowed_materials || []).map(x => x.toLowerCase())

        if (forbiddenMaterials.some(fm => material.includes(fm))) {
            status = "PROBABLEMENT NON-CONFORME"
            violations.push(`Le matériau proposé (${m.materiau}) est explicitement interdit pour les menuiseries dans cette zone.`)
        } else if (allowedMaterials.length > 0 && !allowedMaterials.some(am => material.includes(am))) {
            status = "CONFORMITÉ INCERTAINE"
            warnings.push(`Le matériau proposé (${m.materiau}) ne fait pas partie de la liste des matériaux recommandés ou autorisés (${rules.facade.allowed_materials.join(', ')}).`)
        }
    }

    // Evaluate colors (applicable to menuiseries & isolation)
    let proposedColor = ""
    let displayColor = ""
    if (travaux.type === 'menuiseries' && travaux.menuiseries) {
        displayColor = travaux.menuiseries.couleur + (travaux.menuiseries.couleur_ral ? ` (RAL ${travaux.menuiseries.couleur_ral})` : '')
        proposedColor = (travaux.menuiseries.couleur || '') + ' ' + (travaux.menuiseries.couleur_ral || '')
    } else if (travaux.type === 'isolation' && travaux.isolation) {
        displayColor = travaux.isolation.couleur || ''
        proposedColor = displayColor
    }

    proposedColor = proposedColor.toLowerCase().trim()

    if (proposedColor) {
        const forbiddenColors = (rules?.facade?.forbidden_colors || []).map(x => x.toLowerCase())
        const allowedColors = (rules?.facade?.allowed_colors || []).map(x => x.toLowerCase())

        if (forbiddenColors.some(fc => proposedColor.includes(fc))) {
            status = "PROBABLEMENT NON-CONFORME"
            violations.push(`La couleur proposée (${displayColor}) est explicitement interdite par le règlement de cette zone (${rules.facade.forbidden_colors.join(', ')}).`)
        } else if (allowedColors.length > 0 && !allowedColors.some(ac => proposedColor.includes(ac))) {
            status = "CONFORMITÉ INCERTAINE"
            warnings.push(`La couleur proposée (${displayColor}) ne fait pas partie de la liste des couleurs explicitement autorisées (${rules.facade.allowed_colors.join(', ')}).`)
        }

        // Evaluate general color restrictions (e.g. "teintes claires")
        if (rules?.facade?.color_restrictions) {
            const restrictions = rules.facade.color_restrictions.toLowerCase()
            if (restrictions.includes('clair') && (proposedColor.includes('fonce') || proposedColor.includes('sombre') || proposedColor.includes('noir') || proposedColor.includes('anthracite') || proposedColor.includes('ral 7016'))) {
                status = "CONFORMITÉ INCERTAINE"
                warnings.push(`Le projet propose une teinte foncée (${displayColor}) alors que le PLU préconise des teintes claires ("${rules.facade.color_restrictions}").`)
            }
        }
    }

    // Evaluate heritage override rules deterministically
    const isInHeritageZone = !!(overlays?.hasSPR || (overlays?.monumentsWithin500m && overlays.monumentsWithin500m.length > 0))
    if (isInHeritageZone) {
        // PVC check in historic zones
        if (travaux.type === 'menuiseries' && travaux.menuiseries) {
            const material = (travaux.menuiseries.materiau || '').toLowerCase()
            if (material.includes('pvc')) {
                status = "CONFORMITÉ INCERTAINE"
                warnings.push(`Le PVC (${travaux.menuiseries.materiau}) est généralement interdit ou fortement déconseillé dans les secteurs sauvegardés (SPR) et abords de Monuments Historiques. Un matériau traditionnel (bois ou aluminium thermolaqué) est vivement recommandé pour éviter un refus de l'ABF.`)
            }
        }

        // Color check in historic zones
        if (proposedColor) {
            const forbiddenHistoricColors = ['bleu', 'rouge', 'vert', 'jaune', 'violet', 'orange', 'rose', 'fluo', 'brillant']
            const matchesBrightColor = forbiddenHistoricColors.some(c => 
                proposedColor.includes(c) && 
                !proposedColor.includes('fonce') && 
                !proposedColor.includes('sombre') &&
                !proposedColor.includes('sable') &&
                !proposedColor.includes('pastel')
            )
            if (matchesBrightColor) {
                status = "CONFORMITÉ INCERTAINE"
                warnings.push(`La couleur proposée (${displayColor}) semble trop vive ou non conforme aux palettes de teintes historiques. Dans le périmètre de protection (SPR/MH), seules les teintes de la palette locale ou les tons neutres et historiques (gris, beige, terre, bois) sont autorisés.`)
            }
        }
    }

    // Evaluate overlays (Seismic / Flood / Heritage)
    if (overlays?.hasSPR || (overlays?.monumentsWithin500m && overlays.monumentsWithin500m.length > 0)) {
        if (decision !== "PERMIS_CONSTRUIRE") {
            decision = "DECLARATION_PREALABLE_ABF"
        }
        warnings.push(`Le projet se situe dans un secteur sauvegardé (SPR) ou à proximité (<500m) d'un Monument Historique. L'avis conforme de l'Architecte des Bâtiments de France (ABF) est obligatoire, ce qui porte le délai d'instruction légal à 2 mois.`)
    }

    if (overlays?.hasFloodRisk || overlays?.hasPPRN) {
        warnings.push(`Le terrain est assujetti à un Plan de Prévention des Risques Naturels (PPRN) d'inondation. Vous devrez respecter les prescriptions de sécurité requises par ce règlement.`)
    }

    if (overlays?.seismicZone && parseInt(overlays.seismicZone) >= 3) {
        warnings.push(`La commune est classée en zone de sismicité ${overlays.seismicClass}. La construction doit se conformer aux normes de sécurité parasismique applicables.`)
    }

    return {
        status,
        decision,
        violations,
        warnings
    }
}

async function validate() {
    const lat = 45.5244;
    const lon = 4.8822; // Vienne
    
    console.log("=== 1. Testing Decision Engine Local Logic ===");
    
    const mockRules = {
        zone_code: "UA",
        facade: {
            allowed: true,
            allowed_materials: ["bois", "aluminium"],
            forbidden_materials: ["pvc"],
            allowed_colors: ["blanc", "gris", "beige"],
            forbidden_colors: ["rouge", "bleu"],
            color_restrictions: "Teintes claires",
            excerpts: []
        },
        extension: {
            max_area_m2: 20,
            max_height_m: 9,
            allowed: true,
            permit_required_if_exceed: true,
            excerpts: []
        }
    };
    
    // Scenario A: Extension exceeds max limit (25m2 > 20m2 limit)
    console.log("\nScenario A: Extension area 25m2 (limit 20m2)");
    const travauxA = {
        type: "menuiseries",
        surfaces: { creee: "25" }
    };
    const resA = evaluateProject(travauxA, mockRules, {});
    console.log("Decision:", resA.decision);
    console.log("Status:", resA.status);
    console.log("Violations:", resA.violations);
    if (resA.decision === 'PERMIS_CONSTRUIRE') {
        console.log("✅ Success: Detected Permis de Construire required");
    } else {
        console.log("❌ Fail: Expected Permis de Construire");
    }

    // Scenario B: Project in SPR (Site Patrimonial Remarquable)
    console.log("\nScenario B: Project in SPR");
    const travauxB = {
        type: "menuiseries",
        menuiseries: { materiau: "bois" },
        surfaces: { creee: "10" }
    };
    const overlaysB = {
        hasSPR: true,
        sprName: "Site patrimonial remarquable de Vienne"
    };
    const resB = evaluateProject(travauxB, mockRules, overlaysB);
    console.log("Decision:", resB.decision);
    console.log("Warnings:", resB.warnings);
    if (resB.decision === 'DECLARATION_PREALABLE_ABF') {
        console.log("✅ Success: Detected ABF approval required");
    } else {
        console.log("❌ Fail: Expected ABF approval required");
    }

    // Scenario C: Forbidden materials
    console.log("\nScenario C: Forbidden pvc menuiseries");
    const travauxC = {
        type: "menuiseries",
        menuiseries: { materiau: "pvc blanc" }
    };
    const resC = evaluateProject(travauxC, mockRules, {});
    console.log("Status:", resC.status);
    console.log("Violations:", resC.violations);
    if (resC.status === 'PROBABLEMENT NON-CONFORME' && resC.violations.length > 0) {
        console.log("✅ Success: Detected forbidden material violation");
    } else {
        console.log("❌ Fail: Expected forbidden material violation");
    }

    // Scenario D: Color violations and warnings
    console.log("\nScenario D: Color warnings and violations");
    const travauxD1 = {
        type: "menuiseries",
        menuiseries: { couleur: "rouge" } // Explicitly forbidden
    };
    const resD1 = evaluateProject(travauxD1, mockRules, {});
    console.log("D1 (Forbidden Red) Status:", resD1.status);
    console.log("D1 Violations:", resD1.violations);
    if (resD1.status === 'PROBABLEMENT NON-CONFORME' && resD1.violations.length > 0) {
        console.log("✅ Success: Detected forbidden color");
    } else {
        console.log("❌ Fail: Expected forbidden color");
    }
    
    const travauxD2 = {
        type: "menuiseries",
        menuiseries: { couleur: "Noir Anthracite", couleur_ral: "RAL 7016" } // Dark shade violating "Teintes claires"
    };
    const resD2 = evaluateProject(travauxD2, mockRules, {});
    console.log("D2 (Dark Anthracite) Status:", resD2.status);
    console.log("D2 Warnings:", resD2.warnings);
    if (resD2.status === 'CONFORMITÉ INCERTAINE' && resD2.warnings.length > 0) {
        console.log("✅ Success: Detected dark shade warning");
    } else {
        console.log("❌ Fail: Expected dark shade warning");
    }
}

validate();
