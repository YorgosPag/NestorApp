# ADR-684 — Generic Solid: παραμετρικά γεωμετρικά στερεά (κουλούρι / πυραμίδα / δίσκος / σφαίρα / κύλινδρος / κώνος / κουτί)

- **Status**: ACCEPTED (Φ2 + Φ3 + Φ4 **πλήρη** — geometry + citizen integration + authoring UX + per-shape reshape grips + dual-mode per-selection editor + Φ4-C metadata: structuralRole + BOQ classification + **per-face υλικό (D1)** + **auto-feed BOQ ποσότητας (D2)** + **audit trail (ADR-195)** + per-face COLLADA export)
- **Ημερομηνία**: 2026-07-21
- **Domain**: DXF Viewer / BIM 3D
- **Σχετικά**: ADR-550 (Unified Entity Render Contract), ADR-587 (Entity Type Descriptor Registry + capability anchors), ADR-411 (mesh library), ADR-683 (imported mesh / linked model), ADR-604 (generic family-type framework), ADR-412 (family types)

---

## 1. TL;DR

Εισάγουμε **ΜΙΑ** νέα BIM οντότητα, `generic-solid`, που καλύπτει **όλα** τα παραμετρικά
γεωμετρικά στερεά με έναν shape-discriminator (`box | sphere | cylinder | cone | torus |
pyramid | disc | prism`). Χτίζεται ως `d3Builder: 'point'` με δικό της converter που παράγει
`THREE` geometry απευθείας από τις παραμέτρους (όπως `railingToMesh`/`roofToMesh`, **όχι** μέσω
`meshToObject3D`). Το «δομικό ή διακοσμητικό» **δεν** είναι ξεχωριστός geometry pipeline — είναι
metadata (ταξινόμηση/BOQ/υλικό) πάνω στην ίδια οντότητα.

Τα **ελεύθερης μορφής** αντικείμενα (γλυπτά, μαξιλάρια, σεντόνια, κουρτίνες, οργανικά πλέγματα)
**δεν** μπαίνουν εδώ: πηγαίνουν στον υπάρχοντα δρόμο εισαγόμενου πλέγματος (ADR-683) / curated
mesh library (ADR-411). Καμία νέα γραμμή κώδικα — μόνο workflow (§8).

---

## 2. Το πρόβλημα

Σήμερα ο Νέστωρ δημιουργεί οντότητες DXF (γραμμές/τόξα/hatch…) και BIM (τοίχος/κολώνα/δοκός/
πλάκα/σκάλα/στέγη/κάγκελο/MEP/έπιπλο/εισαγόμενο πλέγμα). **Δεν υπάρχει κανένας τρόπος να
δημιουργηθεί ένα απλό παραμετρικό στερεό** — κουτί, σφαίρα, κύλινδρος, κώνος, **κουλούρι
(torus)**, **πυραμίδα**, **δίσκος**. Επιβεβαιωμένο με grep (`torus|sphere|cylinder|cone|pyramid|
generic-solid|mass`): μηδέν σχετικά ευρήματα. Ούτε το DXF import υποστηρίζει `3DSOLID`/
`POLYFACE_MESH` (μόνο `3DFACE`, ADR-635).

Ο Giorgio ζήτησε δύο διαφορετικά πράγματα, που **λύνονται με διαφορετικό δρόμο**:

1. **Ογκομετρικά παραμετρικά** (κουλούρια, πυραμίδες, δίσκοι, «όγκοι») — δομικά ή διακοσμητικά.
2. **Ελεύθερης μορφής** (πλέγματα, σεντόνια, μαξιλάρια, γλυπτά).

---

## 3. Recognition — η υπάρχουσα αρχιτεκτονική (code = source of truth)

Ο κώδικας ήδη διαχωρίζει **δύο** δρόμους δημιουργίας 3D όγκου, σκόπιμα:

| Δρόμος | Τι είναι | Πού ζει |
|---|---|---|
| **Α. Παραμετρικός** | σχήμα από λίγους αριθμούς, το χτίζει ο κώδικας | `bim-3d/converters/*` — `bespoke` (τοίχος/σκάλα/πλάκα/στέγη/κολώνα/δοκός) ή `point` (θεμέλιο/κάγκελο/στέγη/finish/MEP/έπιπλο) |
| **Β. Εισαγόμενη mesh** | σχήμα ψημένο αλλού, φορτώνεται | `bim-3d/library/bim-mesh-library/` (ADR-411 curated) + `bim/entities/imported-mesh/` (ADR-683 uploads) — και τα δύο μέσω **ενός** `meshToObject3D` |

Τα **σημεία επέκτασης** για νέα BIM οντότητα (επιβεβαιωμένα στον κώδικα):

- `rendering/contract/renderable-entity-type.ts` → `BIM_RENDERABLE_TYPES` (master gate· `Record`-completeness σπάει το tsc αν λείπει εγγραφή).
- `rendering/contract/entity-render-contract.ts` → `ENTITY_RENDER_CONTRACTS` (δηλωτικό `d2/d3/d3Builder/placementGhost3D`).
- `bim-3d/scene/bim-scene-point-contracts.ts` → `POINT_ENTITY_CONTRACTS` (**το πραγματικό converter registry** για `point` — μία γραμμή `pointContract(...)`).
- `bim-3d/scene/bim-3d-renderable-types.ts` → `BIM_3D_CONVERTER_TYPES` (SSoT λίστα για το coverage test).
- ADR-587 **capability anchors** (CHECK 5C, blocking): κάθε νέος type οφείλει να απαντήσει *μετακινείται; περιστρέφεται; εξάγεται; έχει ghost/λαβές;*

**Τι κάνουν οι μεγάλοι**: το μοτίβο είναι καθολικό — **παραμετρικά primitives = procedural,
ελεύθερη μορφή = imported**. Revit: Generic Model / Mass vs. imported SAT/SketchUp/mesh, με το
«structural» ως **flag κατηγορίας** όχι ως άλλη γεωμετρία. ArchiCAD: GDL objects vs. Morph/
imported. Blender/C4D: `Add → primitive` vs. sculpt/cloth-sim → **bake σε στατικό mesh** →
export glTF. Ο Νέστωρ έχει ήδη τον Δρόμο Β· λείπει το «Add primitive» του Δρόμου Α.

---

## 4. Απόφαση

### 4.1 ΜΙΑ οντότητα `generic-solid`, shape-discriminated

Δημιουργούμε **έναν** νέο BIM kind `'generic-solid'` με discriminated params ανά σχήμα — **όχι**
7 ξεχωριστά kinds (θα ήταν sibling clones → χτυπά N.18/jscpd + πολλαπλασιάζει τα ADR-587 anchors).

```ts
// bim/types/generic-solid-types.ts (νέο)
export type GenericSolidShape =
  | { kind: 'box';      widthMm: number; depthMm: number; heightMm: number }
  | { kind: 'sphere';   radiusMm: number }
  | { kind: 'cylinder'; radiusMm: number; heightMm: number }
  | { kind: 'cone';     radiusBottomMm: number; radiusTopMm: number; heightMm: number } // radiusTopMm=0 → κώνος
  | { kind: 'torus';    majorRadiusMm: number; tubeRadiusMm: number }                   // κουλούρι
  | { kind: 'pyramid';  baseWidthMm: number; baseDepthMm: number; heightMm: number }
  | { kind: 'disc';     radiusMm: number; thicknessMm: number }
  | { kind: 'prism';    radiusMm: number; heightMm: number; sides: number };            // κανονικό n-γωνο πρίσμα
```

Ο converter είναι ένα `switch(shape.kind)` πάνω σε `THREE` geometry constructors
(`BoxGeometry`, `SphereGeometry`, `CylinderGeometry`, `ConeGeometry`, `TorusGeometry`· η
`pyramid` = `ConeGeometry(radius, height, 4)`, ο `disc` = λεπτός `CylinderGeometry`).

> **Σημείωση σχήματος**: `disc` και `prism` είναι εκφυλισμοί του `cylinder`, αλλά τους κρατάμε
> ρητούς γιατί έχουν **διαφορετική σημασιολογία authoring** (ο δίσκος έχει «πάχος», το πρίσμα
> «πλευρές») — ο χρήστης δεν πρέπει να μαντεύει «βάλε cylinder με ύψος 5mm». Ο Giorgio ζήτησε
> ρητά «δίσκους».

### 4.2 `d3Builder: 'point'` — κουμπώνει στο υπάρχον registry

Το `generic-solid` είναι **ανεξάρτητα τοποθετούμενο** (κανένα cross-entity host context) → `point`,
όχι `bespoke`. Μία γραμμή στο `POINT_ENTITY_CONTRACTS`:

```ts
pointContract('generic-solid', 'generic-solid', (e) => e.genericSolids,
  (s, c, r) => genericSolidToObject3D(s, c.floorElevationMm, c.activeLevelId, r.baseElevation)),
```

Διαφορά από έπιπλο/imported-mesh: ο converter **χτίζει** geometry (όπως `roofToMesh`), δεν
φορτώνει asset μέσω `meshToObject3D`.

### 4.3 «Δομικό vs διακοσμητικό» = metadata, όχι δεύτερος pipeline

Το ίδιο `generic-solid` μπορεί να είναι δομικός δακτύλιος ή διακοσμητικό. Η διάκριση ζει σε:
ταξινόμηση/BOQ (`bim-to-atoe-mapping` — ADR-587 TIER-2), υλικό, και ένα optional
`structuralRole` flag — **ίδια γεωμετρία**. Ακριβώς όπως το Revit «Structural» toggle.

---

## 5. Extension checklist (touch points — Phase 2)

1. **Types/schema**: `bim/types/generic-solid-types.ts` + `bim/types/generic-solid.schemas.ts` (Zod mirror). `GenericSolidEntity extends BimEntity<'generic-solid', GenericSolidParams, GenericSolidGeometry>`, `ifcType: 'IfcBuildingElementProxy'` (γεωμετρία χωρίς δομική σημασιολογία, ίδιο με imported-mesh).
2. **Geometry cache**: `computeGenericSolidGeometry(params)` → footprint (bbox projection στην κάτοψη) + bbox + area + height (παράγωγο, SSoT = params· ίδιο μοτίβο με imported-mesh).
3. **Renderable type**: `+ 'generic-solid'` στο `BIM_RENDERABLE_TYPES`.
4. **Render contract**: `'generic-solid': point('generic-solid', true)` (με 3D placement ghost — τοποθετείται με κλικ, σε αντίθεση με το imported-mesh).
5. **Converter**: `bim-3d/converters/generic-solid-to-three.ts` (switch → THREE geometry, units-safe pattern από `roof-to-three`/`railing-to-three`).
6. **Point contract**: μία γραμμή στο `POINT_ENTITY_CONTRACTS` + εγγραφή στο `BIM_3D_CONVERTER_TYPES`.
7. **Placement ghost 3D**: `GenericSolidPlacementGhost` στο `PLACEMENT_GHOST_3D_FACTORIES`.
8. **BimCategory**: `+ 'generic-solid'` στο `config/bim-object-styles.ts` (V/G visibility + χρώμα).
9. **Store slot**: `genericSolids` στο `Bim3DEntitiesStore` + hydrate wiring (`scene-bim-load-policy`, lifecycle events).
10. **Persistence**: Firestore service `bim/entities/generic-solid/` (mirror `imported-mesh-firestore-service`), enterprise-id prefix (π.χ. `gsol`) στο `enterprise-id.service.ts` (N.6).
11. **Tool + ribbon**: `TOOL_DEFINITIONS` entry + contextual tab (επιλογή σχήματος + αριθμητικές παράμετροι μέσω του editable numeric combobox SSoT).
12. **Grips**: MOVE/ROTATE (πάντα) + reshape grips ανά σχήμα (π.χ. ακτίνα torus) — TIER-1 `grip-kinds`.
13. **i18n**: κλειδιά σε `el/*.json` + `en/*.json` **πρώτα** (N.11).
14. **Export**: DXF/mesh3D coverage (`entity-export-coverage`).
15. **ADR-587 anchors**: ικανοποίηση των ~20 capability anchor tests (βλ. §6).

---

## 6. ADR-587 capability anchors — οι απαντήσεις (υποχρεωτικές, CHECK 5C blocking)

| Anchor | Απάντηση |
|---|---|
| **Μετακινείται;** | ΝΑΙ — `position` transform (move-entity-geometry-coverage). |
| **Περιστρέφεται;** | ΝΑΙ — `rotationDeg` περί κατακόρυφο (rotate-entity-coverage). |
| **Εξάγεται;** | ΝΑΙ — mesh3D export (triangle soup)· DXF export ως footprint polyline (δεν υπάρχει 3DSOLID writer — §9). |
| **Ghost τοποθέτησης;** | ΝΑΙ — 3D placement ghost (τοποθέτηση με κλικ). |
| **Λαβές;** | MOVE/ROTATE πάντα + per-shape reshape (π.χ. ακτίνα/ύψος). |
| **Hit-test/bounds;** | ΝΑΙ — footprint + bbox (ίδιο μοτίβο imported-mesh). |
| **2D κάτοψη;** | ΝΑΙ — projected outline (κύκλος για sphere/cylinder/disc/cone, ορθογώνιο για box/pyramid, δακτύλιος για torus). |
| **Ποιο tool το φτιάχνει;** | `generic-solid` placement tool (tool-creates-entity-coverage). |

---

## 7. Φάσεις υλοποίησης

- **Φ1 (αυτό το ADR)**: recognition + σχέδιο. ✅
- **Φ2 — MVP geometry**: types + schema + converter + render contract + point contract + store + persistence. Και τα 8 σχήματα (`shapeBoundingBoxMm` + `buildGenericSolidShapeGeometry`). ✅
- **Φ3 — authoring UX** ✅: grips (move/rotation + box corner resize μέσω centred-box adapter) + `UpdateGenericSolidParamsCommand` + selection preview (box ghost branch) **+ authoring μέσω κλικ**: single-click placement tool (`useGenericSolidTool` πάνω στο `createSingleClickPlacementTool`) + ToolType/TOOL_DEFINITIONS/TOOL_CREATES_ENTITY + orchestrator/click-dispatch wiring + ribbon (draw-tab button `bim-generic-solid` + tool-active tab με shape selector 8 σχημάτων + per-shape numeric params via visibilityKey) + 3D placement ghost (`GenericSolidPlacementGhost`, flip `point('generic-solid', true)`) + i18n el+en. Απομένει: per-selection contextual editor tab (Φ4).
- **Φ4 — grips + per-selection editor + metadata**:
  - **Φ4-A ✅** — per-shape reshape grips: radial λαβή ακτίνας (σφαίρα/κύλινδρος/δίσκος/κώνος/πρίσμα) + major/tube (κουλούρι), plan-visible (mirror `column-circular-adapter`). Ύψος/πάχος/πλευρές/άνω-ακτίνα **σκόπιμα ΟΧΙ** plan λαβή (καμία οπτική ανάδραση σε κάτοψη — μη-Revit-grade)· επεξεργάζονται από τον editor (Φ4-B).
  - **Φ4-B ✅** — per-selection editor tab: dual-mode `useRibbonGenericSolidBridge` (επιλεγμένο στερεό → `UpdateGenericSolidParamsCommand` ↔ tool defaults), selected-entity contextual trigger (`generic-solid` στο `ENTITY_CONTEXTUAL_TRIGGER`, ΤΟ ΙΔΙΟ trigger με το tool-active — mirror annotation-symbol).
  - **Φ4-C ✅** — metadata + per-face + BOQ auto-feed. Βάση: `structuralRole` flag (§4.3, δομικό/διακοσμητικό) + Zod schema + BOQ classification SSoT (`resolveGenericSolidMapping`: δομικό → RC OIK-2.03 m³· διακοσμητικό/απόν → null, mirror imported-mesh §10.2) + editor selector. **D1 (per-face υλικό, reuse ADR-539/679):** νέο `generic-solid-face-keys.ts` (σταθεροί faceKeys ανά σχήμα, ευθυγραμμισμένοι με τα THREE groups)· ο converter εκπέμπει material array μέσω του κοινού `resolveFaceMaterial` + `userData.faceKeyByMaterialIndex` όταν `shouldRenderFaced` → όλο το generic paint pipeline (raycaster/`SetFaceAppearanceCommand`/panel) δουλεύει χωρίς νέα γραμμή· `faceAppearance` persist στο firestore service (mirror foundation). **D2 (auto-feed BOQ ποσότητας):** νέο `generic-solid-boq.ts` (mirror `imported-mesh-boq.ts`) με **αναλυτικά ακριβή** όγκο ανά σχήμα· wiring μέσω του κοινού `createBimBoqAuditLifecycle` (το `recordChange` έγινε optional → BOQ-only, ο bridge κάνει skip για διακοσμητικό). **Ανοιχτό follow-up:** audit trail (ADR-195) — trivially προσθέσιμο με μία γραμμή `recordChange`.

> **Execution mode (N.8)**: η Φ2 μόνη της αγγίζει **10+ αρχεία σε 2+ domains** (types / 3D / rendering-contract / persistence / store). → **Orchestrator ή Plan Mode** — προτείνεται στον Giorgio πριν ξεκινήσει η υλοποίηση.

---

## 8. Ελεύθερης μορφής (γλυπτά / μαξιλάρια / σεντόνια / πλέγματα) — Δρόμος Β, καμία νέα γραμμή

Αυτά **δεν** μοντελοποιούνται παραμετρικά. Κανείς δεν κάνει runtime cloth-sim μέσα σε CAD: το
μαξιλάρι/σεντόνι φτιάχνεται με προσομοίωση υφάσματος σε Blender/C4D, **ψήνεται σε στατικό mesh**,
εξάγεται glTF, εισάγεται. Ο Νέστωρ **έχει ήδη** τον μηχανισμό:

- **One-off** (ένα γλυπτό, ένα ειδικό μαξιλάρι) → upload `.glb` → οντότητα `imported-mesh` (ADR-683). Μετακινείται/περιστρέφεται, **χωρίς** reshape (μη-παραμετρικό by design).
- **Επαναχρησιμοποιούμενο** (κατάλογος διακοσμητικών) → curated `bim-mesh-library` (ADR-411, super-admin write).

Καμία δουλειά κώδικα — μόνο τεκμηρίωση workflow.

---

## 9. Alternatives rejected

- **7 ξεχωριστά kinds** (box/sphere/…): sibling clones (N.18), ×7 τα ADR-587 anchors, καμία επαναχρησιμοποίηση. → ΜΙΑ οντότητα shape-discriminated.
- **`bespoke` builder**: το generic-solid δεν έχει cross-entity host context (δεν «κολλάει» σε τοίχο/όροφο σαν άνοιγμα). → `point`.
- **DXF `3DSOLID`/ACIS import**: B-rep parsing είναι τεράστιο, κλειστό format, εκτός scope. Τα primitives είναι procedural — δεν χρειάζονται parser. (Ξεχωριστό μελλοντικό ADR αν ζητηθεί DXF 3D solid import.)
- **Fold στο imported-mesh**: το imported-mesh είναι ρητά μη-παραμετρικό (ADR-683 §3)· ένα torus με «ακτίνα» ΕΙΝΑΙ παραμετρικό. Λάθος οικογένεια.

---

## Changelog

- **2026-07-22 (🔴 CRITICAL — τα στερεά εξαφανίζονταν στο reload)** — ο Giorgio: «μετά από σκληρή ανανέωση τα στερεά εξαφανίζονται». **Root cause (Firestore ground truth, MCP query):** `floorplan_generic_solids` = **0 docs ΠΟΤΕ** (ενώ `floorplan_imported_meshes`=10, `floorplan_columns`=3 → το draw→persist path δουλεύει). Το `generic-solid` είναι `isBimEntity` → `isPerEntityPersistedEntity` → ο `reconcileLoadedSceneBim` **πετά** το scene-snapshot copy και ξαναγεμίζει ΜΟΝΟ από per-entity doc· χωρίς doc → μόνιμη εξαφάνιση. **Γιατί 0 docs:** το ADR-684 πρόσθεσε το νέο collection ΑΛΛΑ **ούτε ο κανόνας ασφαλείας ούτε τα indexes** — δύο κενά, καθένα αρκετό:
  1. **`firestore.rules`** — έλειπε τελείως το `match /floorplan_generic_solids/{id}`. Default-deny → **κάθε write απορριπτόταν** (η save-promise πετούσε, σιωπηλά caught στον persistence hook) → 0 docs. Προστέθηκε ακριβές mirror του `floorplan_imported_meshes` (AUTHORING tier, company-scoped, `canCreate/Update/DeleteBimEntity`).
  2. **`firestore.indexes.json`** — έλειπαν τα 4 composite indexes (indexes = per-collection). Η subscription query (`buildBimScopeConstraints`: companyId+projectId+floorId/floorplanId) θα αποτύγχανε ακόμα και με σωστό rule → docs δεν φορτώνουν στο reload. Προστέθηκαν 4 (mirror imported_meshes).
  - **SSoT/coverage:** `floorplan_generic_solids` καταχωρήθηκε στο `tests/firestore-rules/_registry/bim-tiers.ts` (24ο authoring) + counts στο `check-firestore-rules-tier-conformance.test.js` (23→24 authoring, 37→38 blocks, 20/20 πράσινα)· index-coverage check πράσινο.
  - ⚠️ **ΑΠΑΙΤΕΙ DEPLOY** (production): `firebase deploy --only firestore:rules,firestore:indexes` — μέχρι τότε το bug παραμένει. Τα ήδη-φτιαγμένα στερεά (0 docs) είναι χαμένα· μετά το deploy, νέα στερεά persist-άρουν κανονικά.
  - ✅ **Google-level: YES** — code=source-of-truth διάγνωση (Firestore query, όχι εικασία), exact mirror υπάρχοντος SSoT, coverage-registered (δεν ξανασυμβαίνει σιωπηλά). **Παράλειψη του Φ2:** το persistence service/host/hook γράφτηκαν σωστά αλλά ο κανόνας+index (deploy-side) ξεχάστηκαν — το per-entity persistence δεν είναι πλήρες χωρίς rules+indexes.
- **2026-07-21** — PROPOSED. Phase 1 recognition + σχέδιο (ADR-684). Αναμονή έγκρισης Giorgio + απόφαση execution mode (Orchestrator/Plan) πριν τη Φ2.
- **2026-07-21** — **Φ2 πλήρης + Φ3 grips/preview**. Foundation (data model/schema/geometry/persistence/enterprise-id `gsol`/3D converter και τα 8 σχήματα/2D renderer/store/events) + η **πλήρης ένταξη πολίτη** πάνω στα ADR-587 capability seams, mirror του `imported-mesh`/`furniture` (μηδέν νέος μηχανισμός, jscpd clean):
  - **build-entity-model** (`DxfGenericSolid` variant + quartet passthrough), **grips** (`GenericSolidGripKind` centred-box adapter: move/rotation πάντα + 4 corners ΜΟΝΟ για `box`, reuse `createCentredBoxGripAdapter` + `computeCentredBoxFootprint`), **`UpdateGenericSolidParamsCommand`** (mergeable, recompute geometry+validation), **grip producer/dispatch** (Seam A/B/C), **move** (`case 'generic-solid'` στο `calculateBimMovedGeometry` — μετατόπιση `position`), **rotate** (no-op via grip path, όπως imported-mesh), **toDxf** (flat handler → `DxfGenericSolid`), **export** (`{dxf:'decompose', tek:'missing'}` — generic footprint extractor), **bounds/hit-test** (3 seams: `Bounds`/`entity-bounds-ssot`/`hit-test-model-bim`), **selection preview** (box ghost branch στο `apply-parametric-box-preview`), **contextual-trigger** (no-selection-tab, mirror furniture), **factory** (`createGenericSolid`, N.6 `generateGenericSolidId` + `IfcBuildingElementProxy`), **i18n** (`genericSolid.validation.hardErrors.*` el+en).
  - Και τα **20 ADR-587 capability anchors** πράσινα (332 coverage tests + 16 νέα geometry unit tests). N.17 (καμία tsc), N.18 (jscpd clean).
  - **Απομένει (Φ3-UX)**: single-click placement tool + ToolType/TOOL_DEFINITIONS/TOOL_CREATES_ENTITY + tool orchestrator wiring + ribbon (draw-tab button + tool-active shape selector/numeric params) + 3D placement ghost + per-selection contextual editor tab. Καλύτερα ως ενιαία επόμενη ομάδα (κοινή ribbon/bridge/orchestrator επιφάνεια).
- **2026-07-21** — **Φ3 authoring UX πλήρες** (interactive placement). Mirror του `furniture` tool end-to-end (ADR-410/600/605/629), μηδέν νέος μηχανισμός, jscpd clean, 332 coverage tests πράσινα:
  - **A. Completion builder** (`hooks/drawing/generic-solid-completion.ts`) — `buildDefaultGenericSolidParams` + `buildGenericSolidEntity` μέσω του shared `buildBimPointEntity` (validate/computeGeometry/createGenericSolid).
  - **B. Tool hook** (`useGenericSolidTool`) — config πάνω στο `createSingleClickPlacementTool`· extra state = `shape` (default box 500³)· `genericSolidToolBridgeStore` (mirror furniture) + νέο event `bim:place-generic-solid-3d`.
  - **C. ToolType/registry** — `'generic-solid'` στο `ui/toolbar/types.ts` + `TOOL_DEFINITIONS` + `TOOL_CREATES_ENTITY` (`'generic-solid' → 'generic-solid'`).
  - **D. Orchestrator + click-dispatch** — `useSpecialTools-placement-tools.ts` (activate/commit via `addGenericSolidToScene`) + threading `useSpecialTools`→`CanvasSection`→`useCanvasClickHandler`→`canvas-click-mep-dispatch` (RAW worldPoint, priority 4.92a-ter· `GenericSolidToolLike` = alias του `FurnitureToolLike`, N.18).
  - **E. Ribbon draw button** — split-button variant «Στερεό» στο `home-tab-draw.ts` (icon `bim-generic-solid` = Lucide `Box`, shortcut GS).
  - **F. Tool-active tab** (`contextual-generic-solid-tab.ts`) — shape selector (8 σχήματα) + **per-shape numeric panels ΓΕΝΝΗΜΕΝΑ με loop** πάνω στο `GENERIC_SOLID_SHAPE_DIMENSIONS` (N.18: μηδέν 8× copy-paste), gated με `visibilityKey` ανά shape.kind (mirror stair). Bridge `useRibbonGenericSolidBridge` (η μόνη διαφορά από furniture: οι διαστάσεις ζουν ΜΕΣΑ στο `shape` union → `setShape`, όχι flat overrides) + πλήρης registration στον `useRibbonCommands` composer + registry + `resolve-tool-active-trigger`. `ribbon-quantity-kind-coverage` πράσινο.
  - **G. 3D placement ghost** (`GenericSolidPlacementGhost` + `use-bim3d-generic-solid-placement` via `createBim3DPointPlacementHook`) + register στο `PLACEMENT_GHOST_3D_FACTORIES`/`GhostBimType` + mount στο `use-bim3d-placement-and-pick-hooks` + **flip `entity-render-contract.ts` → `point('generic-solid', true)`** (τελευταίο, μετά την ύπαρξη του ghost). `entity-render-coverage` ghost-binding πράσινο.
  - **H. i18n** (N.11, el+en πρώτα) — `tools.genericSolid.*`, `ribbon.commands.bim.genericSolid.*`, `ribbon.tabs/panels.genericSolid*`, `ribbon.commands.genericSolidEditor.*` (shape labels + per-field dim labels).
  - **Απομένει (Φ4)**: per-selection contextual editor tab (dual-mode selected-entity branch) + BOQ/ταξινόμηση + `structuralRole` + υλικό.
- **2026-07-21 (fixes)** — δύο integration gaps του Φ2/Φ3 που δεν έπιανε κανένα test:
  1. **Ribbon bridge threading** — το `genericSolidBridge` δημιουργούνταν (`useDxfBimBridges`) αλλά το ενδιάμεσο `useDxfViewerRibbon` (χειροκίνητη ονομαστική λίστα ~40 bridges) δεν το έκανε destructure ούτε το περνούσε στο `useRibbonCommands` → `d.genericSolidBridge` undefined → crash μόλις ζωγραφιζόταν η καρτέλα. Προστέθηκε στα 2 σημεία.
  2. **3D scene sync** — η οντότητα γέμιζε σωστά το `Bim3DEntitiesStore.genericSolids` (via `GenericSolidPersistenceHost`), αλλά **και τα δύο** store→manager sync assemblies (`bim3d-resync.ts` single-floor default scope + `useFloors3DAggregator.liveActive` multi-floor active) χειροκίνητα απαριθμούν entity types και **παρέλειπαν το `genericSolids`** → το `syncPointEntities` διάβαζε `undefined` → μηδέν 3D mesh. Προστέθηκε `genericSolids` και στα δύο (SSoT `selectBim3DEntities` το είχε σωστά — τα δύο consumers είχαν αποκλίνει). Σημείωση: το ίδιο pattern παραλείπει και το `importedMesh` (ξεχωριστό, ADR-683).
- **2026-07-22** — **Φ4 (A + B πλήρη, C partial)**. Mirror των πλησιέστερων αδελφών (μηδέν νέος μηχανισμός, jscpd clean, όλα τα coverage tests πράσινα):
  - **Φ4-A — per-shape reshape grips**. Νέο module `generic-solid-shape-grips.ts` (αδελφός `column-circular-adapter`): radial λαβή ακτίνας στην περιφέρεια (+X, symmetric resize περί κέντρου) για σφαίρα/κύλινδρος/δίσκος/κώνος(κάτω ακτίνα)/πρίσμα + **δύο** ομοαξονικές (major + tube) για κουλούρι. Ενιαία μαθηματικά: `newField = clamp(oldField + delta.x/scale, MIN)` (Δαπόσταση = Δπεδίο), write-back μέσω του SSoT `updateGenericSolidShapeDimension`. Νέα grip kinds `generic-solid-{radius,major,tube}` (extend `GenericSolidGripKind`)· `getGenericSolidGrips`/`applyGenericSolidGripDrag` προσθέτουν τις radial πριν το fall-through στον centred-box adapter (mirror `applyColumnGripDrag`). **Big-player decision:** ΚΑΜΙΑ plan λαβή ύψους/πάχους/πλευρών — το ύψος δεν αλλάζει το ίχνος → μηδενική οπτική ανάδραση (ούτε Revit/ArchiCAD τη βάζουν)· επεξεργάζονται από τον editor (Φ4-B). +14 unit tests. Τα 3 grip coverage seams (kinds/computation/dispatch) μένουν πράσινα (entity-level· τα νέα kinds είναι εντός του ίδιου `generic-solid` on-tag).
  - **Φ4-B — per-selection editor tab (dual-mode)**. `useRibbonGenericSolidBridge` → dual-mode (mirror `useRibbonAnnotationSymbolBridge`): επιλεγμένο στερεό → read/write μέσω `UpdateGenericSolidParamsCommand` (undoable, geometry recompute, `emitBimEntityParamsUpdated` για 3D sync)· καμία επιλογή → tool defaults (Φ3, **ΑΘΙΚΤΟ**). Νέο pure SSoT `bridge/generic-solid-ribbon-edit.ts` (classify/read/apply — κοινό key→field και στα 2 modes, React-free, +9 tests). Selected-entity trigger: `'generic-solid'` μετακινήθηκε από `NO_SELECTION_TAB_TYPES` στο `ENTITY_CONTEXTUAL_TRIGGER` map (ΤΟ ΙΔΙΟ `generic-solid-tool-active` trigger εξυπηρετεί edit + placement)· `resolve-contextual-trigger-coverage` ενημερωμένο + πράσινο. Props (`levelManager`/`universalSelection`) threaded από `useDxfBimBridges`.
  - **Φ4-C — metadata (PARTIAL)**. `structuralRole: 'structural' | 'decorative'` optional πεδίο στο `GenericSolidParams` + Zod schema + default `decorative` (§4.3 — metadata, ΟΧΙ γεωμετρία, Revit «Structural» toggle). BOQ classification SSoT: `resolveGenericSolidMapping` (δομικό → OIK-2.03 m³ RC· διακοσμητικό/απόν → null, mirror ανανάθετου imported-mesh §10.2) + `'generic-solid'` στο `BimEntityType` + branch στο `BimToBoqBridge.resolveEntityAtoeMapping`. Editor selector (structural/decorative combobox, i18n el+en) + `structuralRole` σε `GenericSolidParamOverrides` (settable σε edit + placement). +5 mapping tests. **Αναβάλλονται:** per-face υλικό (ADR-539/679 — 3D subsystem) + auto-feed BOQ quantity (save-pipeline hook + `volumeM3` payload). ⚠️ Google-level: PARTIAL — η ταξινόμηση/metadata βάση είναι πλήρης+testable· η οπτική per-face βαφή + η αυτόματη εκπομπή γραμμής BOQ είναι scoped follow-ups (δεν χτίστηκαν half-baked).
- **2026-07-22 (Φ4-C υπόλοιπο — D1 + D2)** — **per-face υλικό + auto-feed BOQ ποσότητας**. Mirror των πλησιέστερων αδελφών (ADR-539/679 per-face, imported-mesh BOQ), μηδέν νέος μηχανισμός, jscpd clean, όλα τα coverage/unit tests πράσινα (332 anchors + 116 τοπικά):
  - **D1 — per-face υλικό (reuse ADR-539/679).** Κρίσιμο εύρημα audit: το paint pipeline (`BimEntityRaycaster` → `SetFaceAppearanceCommand` → `apply-face-appearance` → Polygon Material Panel) είναι **100% generic** πάνω στο `userData.faceKeyByMaterialIndex` — καμία γραμμή σε UI/commands/raycaster. Το `faceAppearance` ζει στο `BimEntity` envelope (`bim-base.ts`), **όχι** στα params, **όχι** σε zod (κανένας αδελφός δεν το βάζει σε schema). Υλοποίηση: (α) νέο SSoT `bim-3d/converters/generic-solid-face-keys.ts` — σημασιολογικές έδρες ανά σχήμα (box=6, κυλινδρικά=3 side/top/bottom, sphere/torus=1, pyramid=5), ντετερμινιστικά ευθυγραμμισμένες με τα geometry groups που δίνουν οι THREE primitives (η πυραμίδα παίρνει χειροκίνητα `addGroup` στο `generic-solid-shape-geometry.ts`)· (β) ο `generic-solid-to-three.ts` κάνει gate μέσω του SSoT `shouldRenderFaced` και faced → material array μέσω του κοινού `resolveFaceMaterial` + `userData.faceKeyByMaterialIndex` (legacy single-material path ακέραιος, byte-for-byte)· (γ) `faceAppearance?: FaceAppearanceMap` στο `generic-solid-firestore-service` (Doc/SaveInput/UpdateInput + save/update branches + entityToSaveInput/docToEntity + hook update), mirror foundation. Tests: `generic-solid-face-keys.test.ts` (8 σχήματα), `generic-solid-faced-3d.test.ts` (faced vs legacy, userData), `generic-solid-face-appearance-persistence.test.ts` (round-trip save/update/doc↔entity).
  - **D2 — auto-feed BOQ ποσότητας.** Η ταξινόμηση (`resolveGenericSolidMapping` + bridge branch) ήταν έτοιμη· απόμενε η εκπομπή γραμμής. Νέο `bim/entities/generic-solid/generic-solid-boq.ts` (mirror `imported-mesh-boq.ts`): `genericSolidVolumeM3(shape)` = **αναλυτικά ακριβής** όγκος ανά σχήμα (box/sphere/cylinder/frustum-cone/torus 2π²Rr²/pyramid/disc/regular-prism — GROSS, όχι bbox) + `genericSolidBoqGeometry` + `genericSolidBoqPayload`. Wiring: το `recordChange` του κοινού `createBimBoqAuditLifecycle` (ADR-628) έγινε **optional** → το `useGenericSolidPersistence` spread-άρει το lifecycle **χωρίς** audit client (μόνο BOQ upsert/delete· ο bridge κάνει skip μόνος του για διακοσμητικό/null mapping). Μηδέν inline clone του guard (N.18). Tests: `generic-solid-boq.test.ts` (γνωστές τιμές: sphere r=1000mm→4.19 m³ κ.λπ. + payload wiring anti-dead-code), `create-bim-boq-audit-lifecycle.test.ts` (νέο BOQ-only path χωρίς recordChange). **Ανοιχτό follow-up:** audit trail (ADR-195) — trivially προσθέσιμο με μία γραμμή `recordChange`.
  - ⚠️ **Google-level: YES** — reuse των υπαρχόντων SSoT (paint pipeline, `resolveFaceMaterial`, `createBimBoqAuditLifecycle`), μηδέν νέος μηχανισμός, ακριβής (αναλυτικός) όγκος, idempotent persistence, το payload συνδέεται πραγματικά (όχι dead code). N.17 (καμία tsc), N.18 (jscpd clean).
- **2026-07-22 (Φ4-C follow-ups — export + audit)** — δύο επόμενα βήματα μετά τα D1/D2:
  - **Per-face COLLADA export (belt-and-suspenders).** Επιβεβαιώθηκε (νέο `generic-solid-mesh3d-export.test.ts`) ότι ένα βαμμένο generic-solid εξάγεται per-face στο `.dae`: `extractBim3DEntities` περιλαμβάνει `genericSolids` → ο headless `BimSceneLayer.syncMultiFloor` τρέχει τον ΙΔΙΟ `genericSolidToObject3D` (faced, `userData.faceKeyByMaterialIndex`) → `assignExportMaterials` (material array) → `serialiseCollada` γράφει `<face_keys>`. Στη headless σκηνή το Polygon Mode είναι κλειστό, άρα faced μόνο όταν υπάρχει `faceAppearance` — βαμμένο → per-face, άβαφο → single-material. Μηδέν νέος κώδικας export.
  - **Audit trail (ADR-195).** Νέο `generic-solid-audit-client.ts` (mirror `furniture-audit-client`) + `GENERIC_SOLID_TRACKED_FIELDS` (το `shape` track-άρεται ολόκληρο· `structuralRole` = κρίσιμο BOQ-metadata) + `'generic-solid'` στο `AuditEntityType` + `ENTITY_COLLECTION_MAP` (server route). Wiring μέσω του `recordChange` του lifecycle (τώρα audit **+** BOQ). +5 audit-client tests. **Boy-Scout (§B):** διορθώθηκε προϋπάρχον desync bug — `imported-mesh` **και** `furniture` έλειπαν από το `AuditEntityType`/`ENTITY_COLLECTION_MAP` → κάθε audit POST τους έκανε 400 σιωπηλά (fire-and-forget) → το ιστορικό τους δεν καταγραφόταν ΠΟΤΕ· προστέθηκαν μαζί (ίδια κλάση με mep-fitting/foundation). **Guard κατά της επανεμφάνισης (§#2):** το `ENTITY_COLLECTION_MAP` εξήχθη από το route σε shared config `src/config/audit-entity-collection-map.ts` (SSoT + testable) + regression test που κλειδώνει ότι ΚΑΘΕ BIM audit entityType είναι εγγεγραμμένος → το σιωπηλό 400 δεν ξανασυμβαίνει (CI-enforced). **jscpd (§#1):** τα **προϋπάρχοντα MEP data-map δίδυμα** (fixture/panel/manifold/radiator/boiler/water-heater) εξήχθησαν σε ΕΝΑ `MEP_POINT_BODY_TRACKED_FIELDS_RAW` base + spread — CHECK 3.28 **καθαρό χωρίς SKIP**, field-sets ταυτόσημα (verified 11/11/14/13/14/15).
- **2026-07-22 (marquee gap fix — `generic-solid` window/crossing selection)** — Ίδιο bug/fix με το
  `imported-mesh` (ADR-683): το `generic-solid` ήταν rendered + click-selectable αλλά **όχι**
  marquee-selectable, γιατί ο BIM bounds delegate (`calculateBimEntity2DBounds`) ήταν **whitelist `switch`**
  χωρίς case γι' αυτό → σιωπηλά `null` (ενώ το registry το δρομολογούσε σωστά). **Fix (ADR-587 Φ9
  BIM-delegate convergence):** ο delegate έγινε type-agnostic `geometry.bbox` reader (κατάργηση whitelist,
  big-player idiom) → κάθε BIM type με `geometry.bbox` (incl. `generic-solid`, του οποίου το `footprint`
  bbox της §6 είναι έτοιμο) γίνεται αυτόματα window/crossing-selectable. Live pins στο
  `bounds-twins-coverage`. Λεπτομέρειες: ADR-587 changelog 2026-07-22. (NO tsc, N.17.)
- **2026-07-22 (§6 2D outline — τρύπα torus + ακμές πυραμίδας)** — δύο plan-fidelity gaps που ανέφερε ο Giorgio συγκρίνοντας με C4D top-view («η πυραμίδα δεν δείχνει τις ακμές της· το κουλούρι είναι γεμάτο, όχι άδειο στο κέντρο»):
  1. **Torus = πραγματικός δακτύλιος (όχι γεμάτος δίσκος).** Πριν, ο `GenericSolidRenderer` γέμιζε ολόκληρο τον εξωτερικό κύκλο και ζωγράφιζε τον εσωτερικό **μόνο ως γραμμή** → γεμάτος δίσκος + αχνή εσωτερική γραμμή. Τώρα νέο SSoT painter `fillRingsEvenOdd` (στο `bim-polygon-render.ts`, N.18) ζωγραφίζει όλα τα `rings` με κανόνα **even-odd** → η τρύπα διαβάζεται ως πραγματικά άδειο κέντρο. Το SSoT περιγράμματος έβγαζε ήδη σωστά 2 ομόκεντρα δαχτυλίδια· έλειπε μόνο το punch στο fill.
  2. **Πυραμίδα = εσωτερικές ακμές (το «Χ»).** Νέο πεδίο `interiorEdges: readonly GenericSolidPlanEdge[]` στο `GenericSolidPlanOutline` (top-view feature edges = προβολή πραγματικών 3Δ ακμών). Για την πυραμίδα, οι 4 ακμές γωνία→κορυφή προβάλλονται σε γωνία→κέντρο βάσης (η κορυφή κάθεται πάνω από το κέντρο) → 2 πλήρεις διαγώνιοι = το «Χ» της C4D/Revit κάτοψης. Τα υπόλοιπα σχήματα → κενό (κύκλος/n-γωνο/ορθογώνιο τα περιγράφουν ήδη πλήρως — το πρίσμα ως n-γωνο είναι ήδη σωστό). Ο renderer ζωγραφίζει τις ακμές με πιο αχνό `edge` χρώμα (thinner).
  - Ο `GenericSolidRenderer.render` ενοποιήθηκε: υπολογίζει το πλήρες `computeGenericSolidPlanOutline` μία φορά → even-odd fill + stroke όλων των rings + stroke interiorEdges (αντικατέστησε το ειδικό-για-torus branch). +2 unit tests (`generic-solid-plan-outline.test.ts`: 4 ακμές πυραμίδας καταλήγουν στο κέντρο· καμία ακμή για τα άλλα 7 σχήματα), 25/25 GREEN. N.17 (καμία tsc), N.18 (μηδέν clone — reuse `strokePolylinePaths`/νέο `fillRingsEvenOdd`).
  - ✅ **Google-level: YES** — μία SSoT πηγή περιγράμματος (rings+edges) καταναλώνεται από hit-test/bounds/renderer· even-odd = ο κανονικός τρόπος annulus fill· idempotent/pure. **Εκκρεμεί επιβεβαίωση browser** από Giorgio.
- **2026-07-22 (λαβές δεν φαίνονταν στην επιλογή)** — ο Giorgio ζήτησε να εμφανίζονται οι λαβές στην επιλογή στερεού «όπως σε DXF+BIM+MEP». **Root cause:** οι λαβές **ζωγραφίζονται** από το render path (`BaseEntityRenderer.getGrips` → `EntityRendererComposite`), ξεχωριστό από το interaction path (`computeDxfEntityGrips` / `GRIP_PRODUCERS`). Ο producer `'generic-solid'` ήταν σωστά συνδεδεμένος (interaction OK) αλλά ο `GenericSolidRenderer.getGrips` επέστρεφε ακόμη `[]` (Φ2 placeholder) → οι λαβές υπολογίζονταν αλλά **δεν σχεδιάζονταν** ποτέ. Fix (mirror `ImportedMeshRenderer.getGrips`, drawn ≡ pickable): ο renderer επιστρέφει `mapBimGrips(getGenericSolidGrips(entity), g => gripGlyphShape(gripKindOf(g,'generic-solid')))` — **ο ΙΔΙΟΣ** SSoT `getGenericSolidGrips` με το interaction, μηδέν απόκλιση. **Boy Scout (N.0.2):** το `grip-glyph-registry` δεν είχε entries ούτε για `generic-solid` ούτε για `imported-mesh` → τα move/rotation θα σχεδιάζονταν ως απλά τετράγωνα· προστέθηκαν `{generic-solid,imported-mesh}-{move→'move', rotation→'rotation'}` (οι γωνίες/radial μένουν 'square', parity furniture/κολόνας). 2 src + glyph test (+1 case, 77 πράσινα), jscpd clean, N.17. **Εκκρεμεί επιβεβαίωση browser.**
- **2026-07-21 (§6 2D outline)** — **ακριβές περίγραμμα κάτοψης ανά σχήμα** (Revit/ArchiCAD/C4D plan-faithful). Πριν, το `footprint` ήταν πάντα το ορθογώνιο του bbox → τα 7/8 σχήματα (default 500×500) φαίνονταν πανομοιότυπα ορθογώνια στην κάτοψη. Νέο SSoT `generic-solid-plan-outline.ts` (`computeGenericSolidPlanOutline`): **κύκλος** (σφαίρα/κύλινδρος/δίσκος/κώνος, tessellated 64-gon), **κανονικό n-γωνο** (πρίσμα), **ορθογώνιο** (κουτί/πυραμίδα, reuse `computeCentredBoxFootprint`), **δακτύλιος = 2 ομόκεντροι κύκλοι** (torus). Το `computeGenericSolidGeometry.footprint` = το εξωτερικό `rings[0]` → **hit-test + bounds + DXF export γίνονται όλα ακριβή** από ΜΙΑ πηγή· ο `GenericSolidRenderer` ζωγραφίζει επιπλέον τα inner rings (τρύπα torus). Reuse `rotateVector`→`rotatePoint` (ADR-188), `polygonArea/polygonBbox`. +7 unit tests (`generic-solid-plan-outline.test.ts`), 348 coverage GREEN, jscpd clean. N.17 (καμία tsc).
