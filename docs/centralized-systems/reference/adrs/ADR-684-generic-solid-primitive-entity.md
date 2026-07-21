# ADR-684 — Generic Solid: παραμετρικά γεωμετρικά στερεά (κουλούρι / πυραμίδα / δίσκος / σφαίρα / κύλινδρος / κώνος / κουτί)

- **Status**: PROPOSED (Phase 1 — Recognition + σχέδιο· αναμονή έγκρισης Giorgio πριν την υλοποίηση)
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
- **Φ2 — MVP geometry**: types + schema + converter + render contract + point contract + store + persistence. Ένα σχήμα end-to-end (`box`) για να «ανάψει» ο pipeline, μετά τα υπόλοιπα σχήματα (μηδέν νέο dispatch — μόνο cases στο switch).
- **Φ3 — authoring UX**: tool + ribbon (επιλογή σχήματος + παράμετροι) + placement ghost + grips.
- **Φ4 — metadata**: BOQ/ταξινόμηση + `structuralRole` + υλικό (per-face appearance επαναχρησιμοποιεί ADR-539/679).

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

- **2026-07-21** — PROPOSED. Phase 1 recognition + σχέδιο (ADR-684). Αναμονή έγκρισης Giorgio + απόφαση execution mode (Orchestrator/Plan) πριν τη Φ2.
