# HANDOFF — ADR-417 Φ2b: Γείσο στέγης (overhang + fascia/μετωπίδα + soffit) — FULL ENTERPRISE + FULL SSOT + PERSISTED + 2D

**Ημερομηνία:** 2026-06-06 · **Μοντέλο:** Opus 4.8 · **Mode:** Plan Mode (geometry + persistence + UI cross-cutting)

> **ΓΛΩΣΣΑ:** Ο Giorgio γράφει & διαβάζει **Ελληνικά**. ΑΠΑΝΤΑΣ ΠΑΝΤΑ ΣΤΑ ΕΛΛΗΝΙΚΑ.
> **ΠΟΙΟΤΗΤΑ:** «όπως οι μεγάλοι παίχτες, Revit» — **FULL ENTERPRISE + FULL SSOT + ΠΛΗΡΗ ΑΛΗΘΟΦΑΝΕΙΑ**. Μηδέν `any`/`as any`/`@ts-ignore`, μηδέν hardcoded strings (i18n SSoT el+en πρώτα), μηδέν duplicate, αρχεία ≤500 / συναρτήσεις ≤40 γραμμές. Enterprise IDs (N.6) όπου χρειάζεται.
> **COMMIT:** Τα commit τα κάνει **ΜΟΝΟ ο Giorgio** (N.(-1)). Ο agent ΔΕΝ κάνει commit/push.
> **⚠️ SHARED WORKING TREE** με άλλον agent (ADR-408 MEP) — `git add` ΜΟΝΟ specific δικά σου αρχεία, **ΠΟΤΕ `git add -A`**, ΜΗΝ αγγίξεις `adr-index.md`, ΜΗΝ committ-άρεις MEP αρχεία (`mep-*`, `grip-parametric-*`).

---

## 🎯 ΤΙ ΘΑ ΚΑΝΕΙΣ

Στην 3D στέγη **εξακολουθούν να φαίνονται οι στρώσεις (DNA layers) περιμετρικά στο γείσο** (η τίμια «Fine» τομή). Ο Giorgio (επιβεβαιωμένο 2026-06-06): «οι μεγάλοι το κρύβουν — θέλω **γείσο όπως η Revit, FULL ENTERPRISE + FULL SSOT**, όλα configurable/persisted».

Υλοποίησε το **γείσο (eave detailing)** στις **eave ακμές** (`params.edges[i].definesSlope===false` = χαμηλές ακμές):

1. **Overhang (προεξοχή)** — η στέγη προεξέχει πέρα από το footprint κατά `overhangMm` (συνεχίζει την κλίση προς τα έξω). **Το πεδίο `RoofEdgeSlope.overhangMm` ΥΠΑΡΧΕΙ ΗΔΗ** (per-edge, persisted, default 0) αλλά **ΔΕΝ καταναλώνεται γεωμετρικά** — Φ1 placeholder. Αυτό είναι το άγκυρο.
2. **Fascia / μετωπίδα** — κατακόρυφη σανίδα στο μέτωπο του (προεξέχοντος) γείσου που **καλύπτει την κομμένη στοίβα στρώσεων** (αυτό που ενοχλεί τον Giorgio).
3. **Soffit / υποκάτω επένδυση** — οριζόντια (ή κεκλιμένη) κάτω πλάκα από τη μετωπίδα μέχρι τον τοίχο.

**+ Persisted params** (Revit Type/Instance) **+ UI dialog controls + 2D κάτοψη ένδειξη γείσου.**

**ΞΕΚΙΝΑ ΜΕ RECOGNITION (N.0.1)** → πρότεινε execution-mode (N.8: αυτό είναι **Orchestrator-scale**, ~10-14 αρχεία/4+ domains — ρώτα/πρότεινε phasing) + μοντέλο (N.14) → **ρώτησε τον Giorgio με AskUserQuestion τις OPEN DECISIONS** ΠΡΙΝ γράψεις κώδικα.

---

## ✅ ΤΙ ΕΧΕΙ ΗΔΗ ΓΙΝΕΙ (όλα UNCOMMITTED — ο Giorgio committ-άρει· tsc 0 πλην pre-existing `mesh-to-object3d.ts:124` ADR-411)

### Φ2a (2026-06-05→06, Opus, Plan Mode phased) — hips + rounded εφαπτόμενοι κορφιάδες (3D) — ✅ BROWSER-VERIFIED τετράρριχτη από Giorgio
- **NEW `bim/geometry/roof-lower-envelope.ts`** — γενικός N-plane lower-envelope solver (`solveLowerEnvelope`): κάθε «νερό» = footprint όπου το επίπεδό του είναι το χαμηλότερο (διαδοχικό `clipByHalfPlane`)· κορφιάδες/hips = εσωτερικά ακμοτεμάχια faces (dedupe + min-length guard κορυφή πυραμίδας)· classify `ridge`(οριζόντιος)/`hip`(κεκλιμένος). **Αναπαράγει gable· δίνει σωστή τετράρριχτη.** Εκεί μετακινήθηκαν (Boy-Scout): `EavePlane`/`resolveEavePlanes`/`eaveDistance`/`inwardNormal`/`windingSign`/`clipByHalfPlane`/`roofZmm`/`makeFace`.
- **NEW `bim/geometry/roof-slope-units.ts`** — `roofSlopeToRatio`/`roofSlopeFromRatio` (anti-circular· re-export από `roof-geometry`).
- **NEW `bim-3d/converters/roof-world-transform.ts`** — SSoT `toWorld(x,y,zMm,sceneToM)` + `MM_TO_M`.
- **NEW `bim-3d/converters/roof-ridge-cap.ts`** — `findAdjacentFaces` + `facePlane` (**Newell's method** — robust σε degenerate clip-edges) + `buildRoundedRidgeCap` (ημικυκλική διατομή με τα 2 κάτω άκρα στα 2 slope planes).
- **MOD `roof-geometry.ts`** — `computeRoofGeometry`: 0→flat/1→mono/≥2→solver· `applyRoofShapePreset` +case `'hip'`.
- **MOD `roof-to-three.ts`** — import `toWorld`· `addRidgeCaps`→`findAdjacentFaces`+`buildRoundedRidgeCap` (παίρνει `faces`)· διαγραφή παλιού sunk-dome.
- **MOD UI:** `useRibbonRoofBridge.ts` (`clampShape`/casts +`'hip'`)· `contextual-roof-tab.ts` (option `'hip'`)· i18n el+en `roofEditor.shape.hip` («Τετράρριχτη»/«Hip»).
- **Tests:** NEW `roof-lower-envelope.test.ts` + NEW `roof-ridge-cap.test.ts` + hip cases στο `roof-geometry.test.ts`. **45/45 roof tests PASS.**
- ADR-417 §9 changelog + §10 #7 + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + memory ενημερωμένα.

### Νωρίτερα (Φ1 + Φ1-part-2 #1-#5, #8 + roof material/per-layer) — όλα DONE (βλ. ADR-417 §9/§10).

---

## 🗺️ ΤΕΧΝΙΚΟΣ ΧΑΡΤΗΣ (verified 2026-06-06)

### Α) Identification των eave ακμών — `params.edges[i].definesSlope === false`
- `RoofEdgeSlope` (`bim/types/roof-types.ts:77-81`): `{ definesSlope, slope, overhangMm }`. **`definesSlope===false` ⇒ eave** (χαμηλή ακμή).
- ⚠️ **ΚΡΙΣΙΜΟ:** τα faces (`RoofFace.outline`) είναι **clipped πολύγωνα** — οι ακμές τους που πέφτουν πάνω σε eave footprint edge είναι **ΤΜΗΜΑΤΑ** του (όχι ολόκληρη η footprint ακμή). Άρα δεν αρκεί να πάρεις `outline[i]→outline[i+1]` του footprint· πρέπει να βρεις, για κάθε eave footprint edge, τα face-boundary-edges που κείνται πάνω του.
- **ΣΥΝΙΣΤΩΜΕΝΗ ΑΡΧΙΤΕΚΤΟΝΙΚΗ (SSoT, symmetric με τους κορφιάδες):** επέκτεινε τον `solveLowerEnvelope` (ή companion στο `roof-lower-envelope.ts`) να **εκπέμπει `kind:'eave'` lines** = τα boundary face-edges των οποίων το midpoint κείται πάνω σε footprint edge με `definesSlope===false`. Έτσι ΚΑΙ το 3D ΚΑΙ το 2D καταναλώνουν `geometry.ridges.filter(kind==='eave')` — μία SSoT (όπως τώρα οι caps διαβάζουν `ridge`/`hip`). Reuse το `isInteriorEdge`-pattern αλλά για boundary edges + match στο footprint eave segment. `RoofRidgeLine.kind` ΗΔΗ περιλαμβάνει `'eave'` (`roof-types.ts:144`).
- `resolveEavePlanes` (`roof-lower-envelope.ts:91`) επιστρέφει ΗΔΗ `slopeEdgeIndices` — φτιάξε companion `resolveEaveEdgeIndices` (όπου `!definesSlope`).

### Β) 3D builder hook — `bim-3d/converters/roof-to-three.ts`
- `roofToMesh` (orchestrator, ~γρ. 240-268): faces→`addFaceMeshes`· ridges→`addRidgeCaps`. **Πρόσθεσε `addEaveDetails(group, roof.geometry, ctx)` παράλληλα με `addRidgeCaps`** (μετά την προσθήκη των caps).
- `buildDepthPrism(face, topDepthMm, botDepthMm, sceneToM, base)` — γενικό prism (μπορεί να εμπνεύσει το overhang strip).
- `RoofFaceMeshContext` (~γρ. 174): `{ roofId, layers, monoMaterialId, thicknessMm, sceneToM, baseElevationM, levelId }` — ίσως +`overhang/fascia/soffit` params.
- **NEW pure `bim-3d/converters/roof-eave-detail.ts`** (mirror `roof-ridge-cap.ts`): ανά eave segment → (1) overhang strip (συνέχεια slope επιπέδου προς τα έξω κατά `overhangMm`· outward horizontal normal × overhang· top=slope-parallel, bottom=−thickness)· (2) fascia quad (κατακόρυφο, στο εξωτερικό άκρο, ύψος=`fasciaHeightMm`)· (3) soffit quad (από fascia bottom μέχρι τον τοίχο/footprint). **Reuse `toWorld` (roof-world-transform) + `setBoxWorldUvs` (bim-uv-helpers).** Outward normal: το horizontal κάθετο της eave ακμής που δείχνει ΕΞΩ από το footprint (χρησιμοποίησε `inwardNormal` × −1).
- Υλικά: `mat-wood` (fascia), `mat-plaster` ή `mat-wood` (soffit), `mat-roof-tile` (overhang top = συνέχεια στέγης). Όλα υπάρχουν στο catalog.

### Γ) Data model — πού μπαίνουν τα params (Revit Type/Instance)
- **Overhang = per-edge (Revit «Rafter Cut/Overhang»):** ΗΔΗ `RoofEdgeSlope.overhangMm` (instance-level, persisted στο `params.edges`, **μηδέν schema change**). Απλώς **κατανάλωσέ το** στη γεωμετρία + δώσε UI για edit (default π.χ. 400-500mm αντί 0).
- **Fascia/soffit = type-level (Revit material/dims στον Roof Type):** πρόσθεσε στο **`RoofTypeParams`** (`bim/types/bim-family-type.ts:126-133` — σήμερα `{ thickness, dna?, material? }`): `fasciaMaterial?`, `soffitMaterial?`, `fasciaHeightMm?`, `soffitDepthMode?` (π.χ. 'horizontal'|'sloped'). **Sync schema** `bim-family-type.schemas.ts` (RoofTypeParamsSchema). Effective resolution μέσω υπάρχοντος `resolveEffectiveRoofParams`.
- `RoofParams` (`roof-types.ts:99`) — αν προτιμηθεί instance-level fallback για fascia (λιγότερο Revit-true). **Πρότεινε type-level** (1 γείσο ανά τύπο, όπως Revit).

### Δ) Persistence — `bim/roofs/roof-firestore-service.ts` + `hooks/data/roof-persistence-helpers.ts`
- `RoofDoc`/`RoofSaveInput` (~γρ. 51-91) persist-άρουν `params` (άρα `overhangMm` ΗΔΗ round-trips, μηδέν αλλαγή) + `typeId`/`typeOverrides: Partial<RoofTypeParams>`.
- `entityToSaveInput` (~γρ. 216): `params` + typeId/typeOverrides spread.
- `docToEntity` (`roof-persistence-helpers.ts:86`): `resolveRoofParamsFromStore` («type always wins» για type-governed· instance `outline/edges/...` επιβιώνουν) → νέα fascia/soffit type fields θα resolve-άρονται αυτόματα ΑΝ μπουν στα type-governed keys.
- **Schema:** `bim/types/roof.schemas.ts` (RoofEdgeSlopeSchema:47 έχει ΗΔΗ `overhangMm`) + `bim/types/bim-family-type.schemas.ts` (RoofTypeParamsSchema — +νέα fascia/soffit fields).

### Ε) Audit — `config/audit-tracked-fields.ts:873` `ROOF_TRACKED_FIELDS_RAW`
- Σήμερα: `layerId/thickness/basePivotZ/slopeUnit/material/dna/storeyId/offsetFromStorey`. `outline`/`edges` σκόπιμα OUT (coordinate-heavy).
- Πρόσθεσε type-level `fasciaMaterial/soffitMaterial/fasciaHeightMm` (scalar). `overhangMm` ζει στο `edges` (untracked — όπως slope). Αν θες audit overhang → χρειάζεται απόφαση (πιθανώς skip, parity με slope).

### ΣΤ) UI — `ui/ribbon/components/EditRoofTypeDialog.tsx` (~γρ. 58-241)
- Two-column: `SlabTypePreviewPanel` + controls (material `Select` + thickness + `SlabDnaEditor kind="roof"`).
- **Πρόσθεσε controls:** fascia material `Select` (CONSTRUCTION_MATERIAL_IDS), soffit material `Select`, fascia height input. Πρότυπο: το υπάρχον material `Select` (γρ. 150-178· `SELECT_CLEAR_VALUE` pattern).
- Overhang (per-edge) → στο **contextual ribbon tab** (`useRibbonRoofBridge.ts` + `contextual-roof-tab.ts`) ως νέο πεδίο (mirror basePivotZ· `applyRoofShapePreset` ή direct edge patch). Ή απλό «ίδιο overhang σε όλα τα eaves» input.
- `family-type-ui-helpers.ts:67` `ROOF_OVERRIDABLE_KEYS=['material']` — πρόσθεσε `fasciaMaterial`/`soffitMaterial` αν θες per-instance override.

### Ζ) 2D κάτοψη — `bim/renderers/RoofRenderer.ts` (ADR-040 CHECK 6D!)
- `render()` (~γρ. 61), `drawFace` (~γρ. 157), `drawRidgeLines` (~γρ. 172· διαβάζει `geometry.ridges`).
- **Πρόσθεσε `drawEaveOverhangs(roof)`:** offset outline προς τα έξω κατά overhang (reuse `offsetPolyline`/`insetClosedPolygon` από `shared/polygon-utils.ts`) + γραμμή μετωπίδας στις eave ακμές (αν εκπέμπεις `kind:'eave'`, ζωγράφισέ τες με διακριτό stroke). Pure renderer (zero subscriptions). **STAGE ADR-417** (CHECK 6D: αγγίζεις entity renderer → χρειάζεται ADR staged).

### Η) Υλικά — `bim/materials/construction-materials.ts:29` + `material-catalog-defs.ts:36`
- `CONSTRUCTION_MATERIAL_IDS` έχει ΗΔΗ `mat-wood`/`mat-plaster`/`mat-metal`. Label key: `constructionMaterials.${id}` (i18n `dxf-viewer-shell.json`). Αν θες νέο `mat-fascia` → πρόσθεσε ΚΑΙ στο catalog ΚΑΙ σε αυτή τη λίστα (μην φτιάξεις 2η λίστα — Boy-Scout N.0.2).

---

## ❓ OPEN DECISIONS (ρώτησε Giorgio με AskUserQuestion ΠΡΙΝ κώδικα)

Ο Giorgio είπε «όλα όπως Revit, FULL ENTERPRISE» — άρα όλα configurable/persisted. Όμως ΕΠΙΒΕΒΑΙΩΣΕ τα defaults + 2-3 σχεδιαστικά:

1. **Overhang default** (το πεδίο υπάρχει, default 0 σήμερα): τυπικό ελληνικό κεραμοσκεπής ~**400-500mm** ή μικρό ~100-150mm; (Revit default ~300mm.)
2. **Overhang scope:** per-edge editable (Revit-true, κάθε eave δικό του) **ή** ένα ενιαίο «roof overhang» (απλούστερο UI); — Σύσταση: per-edge (το πεδίο ήδη per-edge) με ενιαίο default.
3. **Soffit γεωμετρία:** οριζόντιο (κλασικό, κρύβει το κενό) **ή** κεκλιμένο παράλληλο στη στέγη (sloped soffit); Revit default = horizontal.
4. **Fascia ύψος** default (~200mm;) + **υλικά** fascia/soffit (default `mat-wood`/`mat-wood`; ή soffit=`mat-plaster`;).
5. **Phasing** (N.8 — είναι Orchestrator-scale): **Φ2b-1 γεωμετρία πρώτα** (overhang+fascia+soffit με Revit defaults, 3D μόνο → verify ότι κρύβονται οι στρώσεις) → **Φ2b-2 persisted params + UI dialog + 2D**; **ή** όλα μαζί; — Σύσταση: phased (όπως δούλεψε άψογα στο Φ2a).
6. **Per-instance override** fascia/soffit material (`ROOF_OVERRIDABLE_KEYS`) ή μόνο type-level;

---

## 🧭 ΣΥΝΙΣΤΩΜΕΝΗ ΑΡΧΙΤΕΚΤΟΝΙΚΗ (επικύρωσε με Giorgio)

1. **Engine:** `solveLowerEnvelope` (ή companion) εκπέμπει `kind:'eave'` lines (boundary face-edges πάνω σε non-slope footprint edges) → SSoT για 3D+2D.
2. **3D:** NEW pure `roof-eave-detail.ts` (`buildEaveDetail(eaveLine, face/slope, overhangMm, fasciaHeightMm, materials, sceneToM, base)` → overhang strip + fascia quad + soffit quad)· `addEaveDetails` στο `roof-to-three.ts` (reuse `toWorld`/`setBoxWorldUvs`).
3. **Data:** overhang = existing per-edge `overhangMm` (κατανάλωσέ το)· fascia/soffit material+dims = NEW `RoofTypeParams` fields (+schema +audit +effective-resolution).
4. **UI:** `EditRoofTypeDialog` fascia/soffit controls· contextual tab overhang input.
5. **2D:** `RoofRenderer.drawEaveOverhangs` (offset outline + fascia line)· STAGE ADR-417.
6. **i18n el+en** (keys πρώτα): `roofFamilyType.paramFasciaMaterial/...`, overhang label.
7. **Tests:** eave-line emission (solver)· `roof-eave-detail` geometry (overhang/fascia/soffit positions)· persistence round-trip fascia/soffit· schema.

---

## ⚠️ SHARED WORKING TREE — ΚΑΝΟΝΕΣ
- **ΠΟΤΕ `git add -A`.** git add ΜΟΝΟ τα δικά σου αρχεία, επιλεκτικά.
- **ΜΗΝ αγγίξεις** `adr-index.md` (άλλος agent).
- **ΜΗΝ committ-άρεις MEP αρχεία** (`mep-*`, `grip-parametric-*`).
- **Commit: ο Giorgio** (N.(-1)). Μετά: ADR-417 §9 changelog + §10 + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + memory (N.15).
- **ADR-040:** `roof-to-three.ts`/`roof-eave-detail.ts` = converters (ΟΧΙ micro-leaf)· `RoofRenderer` (2D) = CHECK 6D → STAGE ADR-417 αν το αγγίξεις. `bim-family-type`/schemas/persistence/UI dialog = low-freq (ΟΧΙ ADR-040).
- **N.6 Enterprise IDs:** αν δημιουργηθεί νέο Firestore doc (μάλλον όχι — fascia/soffit είναι fields σε υπάρχοντα roof/type docs).

## 🧪 TESTS / TSC
- Pre-existing (ΑΓΝΟΗΣΕ): `mesh-to-object3d.ts:124` (ADR-411).
- `npx tsc --noEmit` (πάντα `| grep -v "mesh-to-object3d.ts(124"`). Tests: `npx jest "roof"` (τώρα 45/45).
- Πρόσθεσε unit tests για eave-line emission + eave-detail geometry + persistence/schema round-trip.

## 📚 ΑΝΑΦΟΡΕΣ
- ADR-417 §9 (changelog· Φ2a entry 2026-06-05) · §10 (#7 hip→Φ2a DONE· γείσο=Φ2b) · ADR-412 (family types) · ADR-413 (PBR/υφές)
- Φ2a files: `roof-lower-envelope.ts` · `roof-ridge-cap.ts` · `roof-world-transform.ts` · `roof-slope-units.ts`
- Geometry: `roof-geometry.ts` · `roof-types.ts` (RoofEdgeSlope.overhangMm) · `bim-uv-helpers.ts` · `shared/polygon-utils.ts` (offsetPolyline/insetClosedPolygon)
- Persistence: `roof-firestore-service.ts` · `roof-persistence-helpers.ts` · `roof.schemas.ts` · `bim-family-type.ts`/`.schemas.ts` (RoofTypeParams)
- UI: `EditRoofTypeDialog.tsx` · `family-type-ui-helpers.ts` (ROOF_OVERRIDABLE_KEYS) · `useRibbonRoofBridge.ts` · `contextual-roof-tab.ts`
- 2D: `bim/renderers/RoofRenderer.ts` (CHECK 6D)
- Materials: `construction-materials.ts` · `material-catalog-defs.ts`
- Audit: `config/audit-tracked-fields.ts:873`
- Κανόνες: N.0.1 (ADR-driven) · N.0.2 (Boy-Scout SSoT) · N.6 · N.8 (execution mode) · N.11 (i18n) · N.14 (model) · N.15 (tracker)
