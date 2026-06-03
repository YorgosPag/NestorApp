# HANDOFF — ADR-410: Εισαγωγή CC0 επίπλων (mesh-based BIM, δρόμος §D.1)

**Ημερομηνία:** 2026-06-03
**Τύπος:** ADR + (μετά από έγκριση) vertical-slice υλοποίηση — ΟΧΙ τυφλό coding
**Σχετικά ADR:** ADR-409 §D.1 (CC0 mesh + δικά μας δεδομένα) · ΝΕΟ **ADR-410** (mesh-import subsystem) · ADR-405 (discipline taxonomy) · ADR-406/407 (point/path-based BIM entity patterns) · ADR-040 (canvas micro-leaf)
**Μοντέλο:** Opus 4.8 (αρχιτεκτονική/cross-cutting)

---

## 🎯 ΤΙ ΘΑ ΚΑΝΕΙΣ

Ο Giorgio θέλει να **βρίσκουμε & προσθέτουμε ΔΩΡΕΑΝ έπιπλα (CC0, μηδέν υποχρέωση)** στο BIM, ξεκινώντας από **Poly Haven**. Επέλεξε: **«μόνο έρευνα/ADR τώρα»** → πρώτα **ADR-410** (αρχιτεκτονική + αποφάσεις), και **μετά από ρητή έγκριση** vertical slice (1 έπιπλο end-to-end).

### Σειρά εργασίας (PHASE 1 = ADR, PHASE 2 = code μετά από OK):
1. **Γράψε ADR-410** (mesh-import subsystem για fixed-shape CC0 BIM στοιχεία). Κλείσε τις ανοιχτές αποφάσεις (κάτω).
2. Ενημέρωσε ADR-409 §Open Questions #2 (CC0 app-ready λίστα) → δείξε στο ADR-410. Ενημέρωσε adr-index.md + N.15 tracking + memory.
3. **ΣΤΑΜΑΤΑ & ζήτα έγκριση** πριν γράψεις κώδικα (N.0.1 + N.8). Πρότεινε **vertical slice**: 1 έπιπλο (π.χ. καρέκλα) end-to-end.

---

## ✅ ΗΔΗ ΕΠΑΛΗΘΕΥΜΕΝΑ (μην τα ξαναψάξεις)

### Νομικά — CC0, μηδέν υποχρέωση (verified)
- **Poly Haven = καθολικά CC0** (ADR-409 PASS 2, 3-vote). Άρα **ΟΛΑ** τα έπιπλα CC0 → modify + redistribute σε προϊόν που πουλάς, **χωρίς attribution, χωρίς δημοσίευση κώδικα, καμία υποχρέωση**.
- **API confirmed 2026-06-03:** `https://api.polyhaven.com/assets?type=models&categories=furniture` → **78 furniture + 32 seating** (~110 σχετικά): καρέκλες, καναπέδες, τραπέζια, ντουλάπια, κρεβάτι, ράφια, γραφεία.
- Formats ανά asset: **glTF (4k/2k/1k), blend, usd, fbx**. → glTF ιδανικό για three.js. Files API: `https://api.polyhaven.com/files/<AssetName>`.
- Δρόμος §D.1: CC0 mesh + **δικά μας BIM metadata** (properties/IFC/ΑΤΟΕ) → **εμείς ο δημιουργός** του BIM αντικειμένου → 100% καθαρό εμπορικά.
- ⚠️ Caveat ποιότητας (ADR-409 §D): πολλά CC0 είναι high-poly → ίσως decimation/retopo για realtime. Έλεγξε poly count ανά asset.

### Αρχιτεκτονικός χάρτης (Explore recon 2026-06-03) — ΟΛΑ τα σημεία που αγγίζει νέο `furniture` entity

> **ΚΡΙΣΙΜΟ:** Το σημερινό 3D pipeline είναι **100% parametric/procedural**. **ΔΕΝ υπάρχει κανένας GLTFLoader πουθενά** (μόνο το `floorplan-background` φορτώνει 2D raster/PDF, άσχετο). Η φόρτωση εξωτερικού mesh είναι **ΕΝΤΕΛΩΣ ΝΕΑ δυνατότητα**.

| Area | Αρχείο | Σημεία |
|---|---|---|
| EntityType union | `types/base-entity.ts` | ~γρ.56 — πρόσθεσε `'furniture'` |
| Entity union + guard | `types/entities.ts` | ~464–509 union· ~657 `isBimEntity` |
| BimCategory + styles | `config/bim-object-styles.ts` | ~18–40 union· 104 array· 142 `DEFAULT_OBJECT_STYLES` |
| Discipline | `bim/discipline/bim-discipline.ts` | ~54–76 `DISCIPLINE_BY_CATEGORY` — `furniture: 'interior'` (το `interior` discipline υπάρχει αλλά ΚΕΝΟ — πρώτος καταναλωτής) |
| 2D renderer registry | `rendering/core/EntityRendererComposite.ts` | `initializeRenderers()` ~69–132 — `this.renderers.set('furniture', …)`. Extend `BaseEntityRenderer` (render/getGrips/hitTest). ADR-040: ZERO subscriptions, `getState()` at draw time. Πρότυπο: `MepFixtureRenderer`/`ElectricalPanelRenderer` (footprint+symbol). |
| 3D entity store slice | `bim-3d/stores/Bim3DEntitiesStore.ts` | ~38–72 — `furnitures: readonly FurnitureEntity[]` + `EMPTY_BIM_ENTITIES` |
| 3D scene dispatch | `bim-3d/scene/BimSceneLayer.ts` | `syncFloorEntities()` ~142· νέο `syncFurniture()` (πρότυπο `syncFixtures` ~330 / `syncPanels` ~345) |
| **Units-safe** | `utils/scene-units.ts` | `sceneUnitsToMeters` ~196–204. **ΧΡΗΣΙΜΟΠΟΙΗΣΕ το πρότυπο `panelToMesh`/`railingToMesh`/`StairToThree` (×sceneToM), ΟΧΙ το buggy `fixtureToMesh`** (καταναλώνει footprint unscaled→σωστό μόνο σε meter scenes). glTF mesh είναι σε μέτρα (glTF spec) → μόνο το placement transform θέλει ×sceneToM. |
| **GLTFLoader (ΝΕΟ)** | δεν υπάρχει | `bim-3d/converters/furniture-gltf-loader.ts` + cache |
| Firestore collection | `config/firestore-collections.ts` | ~346–373 — `FLOORPLAN_FURNITURE: … \|\| 'floorplan_furniture'` |
| Enterprise ID | `services/enterprise-id-convenience.ts` + `enterprise-id.service.ts` | `generateFurnitureId` + prefix `furn_*` (N.6 — ΥΠΟΧΡΕΩΤΙΚΟ setDoc+enterprise ID, ΟΧΙ addDoc) |
| ΑΤΟΕ BOQ | `bim/config/bim-to-atoe-mapping.ts` | ~24 `BimEntityType`· 127 `BIM_TO_ATOE_MAPPING`· 149 `resolveAtoeMapping`· 196 `deriveAtoeQuantity` — furniture→unit `'pcs'`, qty=1 |
| IFC type | `bim/types/ifc-entity-mixin.ts` | ~20–33 union· 35 array· 74 Zod — πρόσθεσε **`'IfcFurniture'`** (IFC4 ADD2) |
| Catalog + Ribbon | `bim/columns/section-catalog.ts` (πρότυπο) → νέο `bim/furniture/furniture-catalog.ts`· ribbon `ui/ribbon/data/contextual-mep-fixture-tab.ts` (πρότυπο)· placement `hooks/drawing/useMepFixtureTool.ts` (FSM πρότυπο) + `bim-3d/placement/use-bim3d-mep-fixture-placement.ts` |

### 🚨 Η ΚΥΡΙΑ ΑΡΧΙΤΕΚΤΟΝΙΚΗ ΑΠΟΦΑΣΗ: async glTF vs sync loop
Το `syncFloorEntities` του `BimSceneLayer` είναι **σύγχρονο** — δεν μπορεί να καλέσει async GLTFLoader απευθείας.
- **Option A (ΣΥΣΤΗΝΕΤΑΙ):** `FurnitureGltfCache` (Map<assetId, THREE.Group>) — pre-load στο placement/hydration· `syncFurniture()` διαβάζει σύγχρονα από cache· cache-miss → bounding-box placeholder (box widthMm×depthMm×heightMm) μέχρι να φορτώσει. Ίδιο μοτίβο με TextureLoader+cache· σέβεται το ενιαίο visibility/floor/building filter chain.
- **Option B:** πάντα bounding-box στο sync loop· πραγματικό glTF σε ξεχωριστό group εκτός loop → **σπάει** το visibility filter (ΟΧΙ προτιμητέο).

---

## ❓ ΑΝΟΙΧΤΕΣ ΑΠΟΦΑΣΕΙΣ ΓΙΑ ΤΟ ADR-410 (ρώτα τον Giorgio)

1. **Διανομή assets: bundle στο repo vs Firebase Storage.**
   - Bundle: απλό, offline, αλλά μεγαλώνει το build· γράφεται στο git.
   - Firebase Storage: lazy-load, καθαρό build, αλλά runtime fetch + storage.rules (company-scoped ήδη υπάρχουν). **Πρότεινε Storage** (ταιριάζει με υπάρχουσα υποδομή· τα CC0 mesh «ανήκουν» στο app μετά το enrichment).
2. **Asset pipeline:** decimation/retopo για high-poly· μετατροπή σε `.glb` (binary, compact)· πού γίνεται (build-time script vs χειροκίνητα τα «hero» έπιπλα). ADR-409 §D caveat: enrichment per-object κοστίζει → ξεκίνα με λίγα «hero» items.
3. **Ποιο πρώτο έπιπλο** για το vertical slice (π.χ. `WoodenChair_01` ή `dining_chair_02` — απλό low-ish poly).
4. **Scale/transform model:** glTF σε μέτρα· πώς αποθηκεύεται transform (x,y σε scene units + rotationDeg + scaleOverride). 2D ghost = footprint από widthMm×depthMm (χωρίς να φορτωθεί το glTF)· 3D ghost = πραγματικό mesh.
5. **Bounding-box / footprint:** από πού (catalog defaults vs glTF bbox at load).
6. **`three/examples/jsm/loaders/GLTFLoader`** — license check (three.js = MIT ✅, ήδη dependency) + bundle impact. Επιβεβαίωσε version.

---

## ⚠️ ΚΡΙΣΙΜΟ ΠΛΑΙΣΙΟ (ΜΗΝ το αγνοήσεις)

- 🌐 **Γλώσσα: ΕΛΛΗΝΙΚΑ πάντα.**
- 🚫 **COMMIT/PUSH κάνει ΜΟΝΟ ο Giorgio.** Ποτέ εσύ. Ποτέ `--no-verify`. (N.(-1))
- 🌳 **SHARED WORKING TREE με άλλον agent.** `git add` **ΜΟΝΟ** συγκεκριμένα δικά σου αρχεία, **ΠΟΤΕ** `git add -A`.
- 📦 **Uncommitted pending work στο tree (ΜΗΝ το πειράξεις/commit-άρεις):**
  - **ADR-409 PASS 3 (αυτή η συνεδρία, pending commit):** `src/subapps/dxf-viewer/bim/columns/section-catalog.ts` (provenance fix + cross-check note) + `docs/centralized-systems/reference/adrs/ADR-409-…md` (§C.4, Decision #4, v1.3).
  - Πολλά άλλα ADR pending commits (ADR-363/402/404/407/408 κ.λπ. — βλ. `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + MEMORY.md).
- 🏛️ **N.0.1 ADR-driven:** RECOGNITION (έγινε ήδη — αυτό το handoff) → ADR → (έγκριση) → code → ADR update.
- 🏛️ **N.8:** ~12-15 αρχεία / 3-4 domains / νέα dependency = **ΟΧΙ άμεση εκτέλεση**· Plan Mode + vertical slice, ή Orchestrator μόνο με έγκριση Giorgio.
- 🆔 **N.6:** enterprise ID υποχρεωτικό (setDoc + `furn_*`, ΟΧΙ addDoc).
- 🌍 **N.11:** μηδέν hardcoded strings — i18n keys σε el+en JSON ΠΡΩΤΑ.

---

## 📎 ΣΗΜΕΙΑ ΕΚΚΙΝΗΣΗΣ
- ADR-409 §B-θετικό (Poly Haven CC0) + §D.1 (CC0 mesh + δικά μας δεδομένα) + §Open Questions #2.
- adr-index.md: επόμενο ελεύθερο = **ADR-410** (ADR-409 = το τελευταίο).
- Πρότυπα entity (mirror): ADR-406 mep-fixture (point-based) = ο πλησιέστερος (placement FSM, contextual tab, 2D footprint, 3D converter, persistence, BOQ/IFC).
- Memory: `~/.claude/projects/C--Nestor-Pagonis/memory/project_adr409_bim_library_licensing.md`.
