# ADR-514 — Unified BIM Cursor Snap («Ένας Εγκέφαλος Έλξης», Revit-grade)

- **Status**: 🟢 CORE COMPLETE + Φ6 IMPLEMENTED (UNCOMMITTED) — Φ1 foundation + Φ2 column + Φ3 wall/beam wiring + Φ5 SSoT-lock + **Φ6 face-snap slab/roof/foundation** DONE· Φ4 N/A (already uniform via central OSNAP). 🔴 pending browser-verify (Φ2+Φ3 + Φ6) πριν commit.
- **Date**: 2026-06-24
- **Category**: DXF Viewer — Snapping (Master companion to ADR-378)
- **Related**: ADR-378 (Snap Master Architecture), ADR-398 (Column placement snap), ADR-508 (Unified linear-member framing), ADR-040 (Preview Canvas perf)

---

## 1. Context — η αλήθεια μετά από βαθιά χαρτογράφηση (2026-06-24)

Διεξήχθη πλήρης χαρτογράφηση ΟΛΩΝ των μηχανισμών έλξης (snap) στο `/dxf/viewer` με στόχο FULL
SSoT. Το εύρημα: η έλξη είναι **ήδη ~90% κεντρικοποιημένη** (ADR-378 master). Υπάρχουν δύο
συμπληρωματικοί «κόσμοι»:

- **Κόσμος Α — OSNAP point engine** (`ProSnapEngineV2`, 26 sub-engines, singleton `getGlobalSnapEngine()`).
  Εφαρμόζεται **κεντρικά** στο cursor pipeline: ο `snap-scheduler` γράφει το snapped σημείο στο
  `ImmediateSnapStore` σε κάθε move (preview)· ο `mouse-handler-up` εφαρμόζει `findSnapPoint` στο click
  point ΠΡΙΝ φτάσει σε οποιοδήποτε tool (commit). **Όλα τα tools** (incl. wall/beam/column) ήδη
  λαμβάνουν OSNAP-snapped cursor.
- **Κόσμος Β — BIM placement/face snap**: η ειδικευμένη «έξυπνη» τοποθέτηση δομικού μέλους που τρέχει
  **πάνω** στον ήδη-OSNAP-snapped cursor. `column` → `resolveColumnFaceSnapFromTargets` (9-λαβές +
  polar/rect magnet)· `wall`/`beam` → `resolveMemberGhostSnapFromStore` (column-priority → Τ-framing).

### Το πρόβλημα (η μόνη γνήσια ασυμμετρία)

Η επίλυση «πού πάει ο BIM cursor» (Layer 2 placement) ζει σε **3 διάσπαρτα σημεία**:

1. `systems/cursor/mouse-handler-up.ts` — bespoke branch **μόνο** για την κολώνα (commit).
2. `hooks/drawing/useWallTool.ts` + `useBeamTool.ts` — in-tool calls (commit).
3. `hooks/drawing/*-preview-helpers.ts` — ανεξάρτητες κλήσεις (preview).

Η κολόνα κάνει placement στο pipeline· ο τοίχος/δοκάρι μέσα στο tool. Λειτουργικά δουλεύουν, αλλά:
(α) preview ≡ commit συντηρείται **χειροκίνητα** σε παράλληλο κώδικα ανά εργαλείο, (β) κάθε νέο BIM
εργαλείο που θέλει face-snap πρέπει να ξανα-καλωδιωθεί, (γ) η ασυμμετρία είναι anti-SSoT.

> **Revit reference**: η Revit έχει **ΕΝΑ** snapping subsystem που εξυπηρετεί όλα τα tools ομοιόμορφα
> (point snaps + reference/face snaps σε ΕΝΑ ranked pipeline). Δεν υπάρχει «column κάνει αλλιώς».

## 2. Decision — «Ένας Εγκέφαλος Έλξης»

Εισάγουμε **ΕΝΑ tool-agnostic σημείο εισόδου**, `resolveBimCursorSnap`, που απαντά: «δοθέντος raw
cursor + ενεργού εργαλείου, πού προσγειώνεται το σημείο και σε τι κούμπωσε;». Συνθέτει:

- **Layer 2 (placement, ανά `toolKind`)** → delegates στους ΥΠΑΡΧΟΝΤΕΣ resolvers (μηδέν νέο geometry).
- **Layer 1 (point, OSNAP)** → fallback μέσω injected `findSnapPoint`.

Επιστρέφει discriminated union (`member-placement` | `column-placement` | `point`) — οι placements
column vs member είναι κατηγορηματικά διαφορετικού τύπου, οπότε ΔΕΝ συγχωνεύονται βίαια· ο caller κάνει
branch στο `.kind`. Το πεδίο `point` υπάρχει **πάντα** (τελικό σημείο που κουμπώνει ο cursor).

**SSoT**: `commit` ΚΑΙ `preview` καλούν την ΙΔΙΑ συνάρτηση → **preview ≡ commit by construction**.
Κάθε νέο εργαλείο αποκτά ομοιόμορφη έλξη με μηδέν αντιγραφή.

### Τοποθεσία (μηδέν import cycle)

`bim/placement/bim-cursor-snap.ts` — **πάνω** από `bim/columns` (→ `bim/framing`) και `bim/framing`.
Εισάγει και τους δύο placement resolvers· τίποτα στο columns/framing δεν εισάγει το placement.
**Pure** — zero React/DOM/store· `findSnapPoint` injected → πλήρως testable, type-only εξάρτηση από `snapping`.

## 3. Contract

```ts
// Φ6 — προστέθηκαν 'polygon-vertex' (slab/roof flush) + 'foundation-pad' (pad → κολόνα).
type BimSnapToolKind = 'wall' | 'beam' | 'column' | 'polygon-vertex' | 'foundation-pad' | 'point-only';

resolveBimCursorSnap({
  toolKind, cursor, targets: SceneSnapTargets, sceneUnits,
  findSnapPoint?,                // Layer 1 (injected). OPTIONAL — παρέλειψέ το όταν ο cursor
                                 //   είναι ήδη OSNAP-snapped upstream → anti double-snap (§2 wiring).
  memberWidthMm?, memberKinds?,  // wall/beam
  columnOpts?,                   // column polar/rect magnet
}): BimCursorSnap

type BimCursorSnap =
  | { kind: 'member-placement'; placement: MemberGhostSnapResult; point }
  | { kind: 'column-placement'; placement: ColumnFaceSnap;        point }
  | { kind: 'point'; point; snapType: ExtendedSnapType | null; candidate: SnapCandidate | null }
```

Λογική: `column`/`foundation-pad` → `resolveColumnFaceSnapFromTargets`· `wall`/`beam`/`polygon-vertex`
→ `resolveMemberGhostSnapFromStore` (column-priority μέσα του· `polygon-vertex` με memberWidth **πάντα 0**
→ flush ΠΑΝΩ στην παρειά)· miss/`point-only` → `findSnapPoint` → `point`· κανένα → καθαρός cursor.

**Φ6 — polygon-vertex resolver (slab/roof):** πάνω από τον εγκέφαλο ζει ο pure `resolvePolygonVertexSnap`
(`bim/placement/polygon-vertex-snap.ts`) που προσθέτει το **edge-slide constraint** (Φ6b): δοθέντος
`lock` (η παρειά της προηγούμενης κορυφής, στο zero-React `polygonVertexLockStore`), προβάλλει τον cursor
**κατά μήκος** της κλειδωμένης παρειάς (ακμή flush), παραχωρεί σε φρέσκο snap σε **διαφορετική** παρειά
(corner-turn) και **απελευθερώνεται** όταν ο cursor απομακρυνθεί κάθετα πέρα από το capture. ΕΝΑΣ
resolver + ΕΝΑ store → preview (`drawing-preview-generator` slab/roof) ≡ commit (`useSlabTool`/
`useRoofTool.onCanvasClick`) by construction.

## 4. Phases

| Φ | Τι | Status | Verify |
|---|----|--------|--------|
| **Φ1** | Pure SSoT `resolveBimCursorSnap` + tests (6 jest). Μηδέν wiring → μηδέν regression. | ✅ DONE | jest GREEN |
| **Φ2** | Wire **κολόνα**: `mouse-handler-up` column branch (commit) + `column-preview-helpers` (preview) → καταναλώνουν τον εγκέφαλο (`toolKind:'column'`, ΧΩΡΙΣ findSnapPoint = anti double-snap). | ✅ DONE (jest, UNCOMMITTED) | 🔴 browser-verify κολόνα |
| **Φ3** | Wire **wall + beam** START placement (1ο κλικ): commit (`useWallTool.resolveWallStartAnchor` + `useBeamTool.resolveStartAnchor`) + preview (`makeWallGhostBeforeClick` + `makeBeamGhostBeforeClick`) → εγκέφαλος (`toolKind:'wall'\|'beam'`, ΧΩΡΙΣ findSnapPoint). Wall END snap (`wall-endpoint-snap`) = ξεχωριστό point-snap leaf, εκτός scope. | ✅ DONE (jest, UNCOMMITTED) | 🔴 browser-verify τοίχος/δοκάρι |
| **Φ4** | ~~Ομοιόμορφη έλξη slab/roof/foundation μέσω εγκεφάλου~~ → **N/A**: audit (2026-06-24) έδειξε ότι τα slab/roof/foundation tools έχουν **μηδέν** δικές τους snap κλήσεις — κουμπώνουν ήδη ομοιόμορφα από το **κεντρικό OSNAP** (`mouse-handler-up` else-branch). Καμία ασυμμετρία να ενοποιηθεί· point-only routing = no-op indirection (απορρίφθηκε από Giorgio). | ✅ N/A (already uniform) | — |
| **Φ5** | SSoT registry module `bim-cursor-snap` (tier 4, 4 forbidden patterns: no parallel brain + no direct Layer-2 resolver calls outside canonical/leaf) + ADR-378/398/508 cross-links. Dead-code: εγκέφαλος πλέον live (5 production consumers)· aliases ήδη test-only → μηδέν baseline change. | ✅ DONE (UNCOMMITTED) | golden 56/56 + dry-run CLEAN |
| **Φ6** | **NEW feature** (Giorgio 2026-06-24): face-snap σε slab/roof/foundation μέσω εγκεφάλου. **Φ6a** per-vertex flush (κάθε κορυφή πλάκας/στέγης κουμπώνει flush στην πλησιέστερη παρειά μέλους, `toolKind:'polygon-vertex'` width 0)· **Φ6b** edge-slide constraint (ακμή flush κατά μήκος κλειδωμένης παρειάς + corner-turn + release, `resolvePolygonVertexSnap` + `polygonVertexLockStore`)· **Φ6c** foundation pad → παρειά/άξονα κολόνας (`toolKind:'foundation-pad'` → `resolveColumnFaceSnapFromTargets`). Targets sync ενεργοποιήθηκε σε slab/roof/foundation (κοινό `useSceneSnapTargetSync`). Anti double-snap: ΧΩΡΙΣ findSnapPoint. | ✅ DONE (UNCOMMITTED) — 16+18+606 jest GREEN | 🔴 browser-verify |

⚠️ **Wiring touches ADR-040 architecture-critical files** (`mouse-handler-up`, snap-scheduler) → CHECK
6B/6D: stage ADR-040 + ADR-514 μαζί. Κάθε φάση browser-verified ΠΡΙΝ την επόμενη (zero-regression gate).

## 5. Consequences

- ✅ FULL SSoT: ΕΝΑ σημείο επίλυσης BIM cursor· preview ≡ commit by construction.
- ✅ Εξάλειψη ασυμμετρίας column-vs-wall/beam.
- ✅ Επεκτασιμότητα Revit-grade: νέο εργαλείο = ΕΝΑ `toolKind`, μηδέν αντιγραφή.
- ⚠️ Layer 1 (OSNAP) **παραμένει** κεντρικά στο pipeline (ήδη σωστό)· ο εγκέφαλος ΔΕΝ διπλο-εφαρμόζει
  point-snap — ο `findSnapPoint` καλείται **μόνο** στο fallback. Wiring πρέπει να αποφύγει double-snap.

## 6. Changelog

- **2026-06-24** — Φ1: δημιουργία `bim/placement/bim-cursor-snap.ts` (pure SSoT) + 6 jest. ADR created.
  (Αντικατέστησε ενδιάμεσο `bim/framing/unified-cursor-snap.ts` — στενότερο member+point — για μηδέν
  επικαλυπτόμενα SSoT.)
- **2026-06-24** — Φ2 (column wiring, UNCOMMITTED): `findSnapPoint` → **optional** στον εγκέφαλο
  (anti double-snap, §2: ο cursor έρχεται ήδη OSNAP-snapped κεντρικά). Wired **commit**
  (`systems/cursor/mouse-handler-up.ts` — column branch τώρα καλεί `resolveBimCursorSnap({toolKind:'column'})`,
  branch στο `.kind==='column-placement'`) + **preview** (`hooks/drawing/column-preview-helpers.ts` —
  ΙΔΙΟ entry point, ίδια opts/targets/cursor → preview ≡ commit by construction). Καθαρό refactor: ΙΔΙΟΙ
  resolvers/stores (`resolveColumnFaceSnapFromTargets` delegate· anchor/rotation/status setters αμετάβλητα),
  μηδέν νέο geometry/store. +2 jest (optional findSnapPoint). 76/76 jest GREEN (placement + column-face-snap).
  tsc: ✅ clean (επιβεβαιώθηκε στο Φ3 tsc run — μηδέν errors σε `mouse-handler-up`/`column-preview-helpers`/`bim-cursor-snap`).
  🔴 browser-verify εκκρεμεί. ⚠️ CHECK 6B/6D: stage ADR-040 + ADR-514 μαζί (τροποποιήθηκε `mouse-handler-up.ts`).
- **2026-06-24** — Φ3 (wall + beam START placement wiring, UNCOMMITTED): commit + preview και των δύο
  εργαλείων καλούν τώρα `resolveBimCursorSnap` αντί για τους dispatchers απευθείας. **Wall**:
  `useWallTool.resolveWallStartAnchor` (commit) + `wall-preview-helpers.makeWallGhostBeforeClick` (preview,
  signature: `columnFootprints`+`snapTargets` → ΕΝΑ `targets: SceneSnapTargets`· `collisionTargets`
  αμετάβλητο για overlap). **Beam**: `useBeamTool.resolveStartAnchor` (commit, `memberKinds:['beam','slab']`)
  + `beam-preview-helpers.makeBeamGhostBeforeClick` (preview, signature: `columnFootprints` → `targets`·
  `beamTargets` μένει για `isBeamCollinearOverlap`). ⚠️ ΧΩΡΙΣ findSnapPoint (cursor ήδη snapped, §2).
  Ο εγκέφαλος delegate-άρει στον ΙΔΙΟ `resolveMemberGhostSnapFromStore`· επιστρέφει ΟΛΟΚΛΗΡΟ
  `MemberGhostSnapResult` (start/end/status/targetId/faceFrame) → drop-in. Default member kinds του
  εγκεφάλου = `['wall','beam','slab','line']` = τα wall kinds (γι' αυτό το wall path δεν περνά memberKinds).
  Wall END snap (`wall-endpoint-snap`) αμετάβλητο (ξεχωριστό point-snap leaf). Τα aliases
  `resolveBeamGhostSnapFromStore`/`resolveBeamColumnFaceSnap` μένουν test-only (όπως ήδη ο 2ος — μηδέν
  dead-code regression, baseline file-level). 673/674 jest GREEN (το 1 fail = `beam-grips.test.ts:447`
  προϋπάρχον, μηδέν σχέση με τα αλλαγμένα αρχεία). tsc: ✅ clean (0 errors στα 5 αρχεία). 🔴 browser-verify
  εκκρεμεί. ⚠️ CHECK 6D: stage ADR-040 + ADR-514 μαζί (τροποποιήθηκαν drawing/preview canvas files).
- **2026-06-24** — Φ4 = **N/A** (audit-driven): τα slab/roof/foundation tools δεν έχουν δικές τους snap
  κλήσεις (grep-verified) — κουμπώνουν ήδη ομοιόμορφα από το κεντρικό OSNAP. Καμία ασυμμετρία να
  ενοποιηθεί· point-only routing απορρίφθηκε (no-op indirection). Η ασυμμετρία του ADR λύθηκε πλήρως
  με Φ2+Φ3. (Giorgio αποφάσισε: Φ5 πρώτα, μετά νέο feature face-snap = Φ6.)
- **2026-06-24** — Φ5 (SSoT-lock, UNCOMMITTED): NEW registry module `bim-cursor-snap` (`.ssot-registry.json`,
  tier 4, addedByAdr ADR-514) με 4 forbidden patterns: (1) re-declare `resolveBimCursorSnap` (parallel brain)·
  (2-4) direct `resolveColumnFaceSnapFromTargets(`/`resolveMemberGhostSnapFromStore(`/`resolveBeamGhostSnapFromStore(`
  εκτός canonical resolver files + brain + wall-endpoint leaf (allowlist 5 paths). Boy-scout: διορθώθηκε ένα
  JSDoc comment στο `column-preview-helpers.ts` (false-positive `(` μετά το όνομα). Cross-links: ADR-378
  (Companions row), ADR-398 (Σχετικά), ADR-508 (Related) → δείχνουν ADR-514. Dead-code: εγκέφαλος live (5
  consumers)· aliases ήδη test-only → μηδέν `.deadcode-baseline.json` change. Validation: registry golden
  56/56 PASS (ERE-validity όλων των patterns μέσω `grep -E -f`) + dry-run grep CLEAN (όλα τα matches σε
  allowlist/exempt). ssot:baseline ΔΕΝ τρέχτηκε (μηδέν violations· αποφυγή pollution από uncommitted
  άλλων agents στο shared tree). ⚠️ Στο commit: stage ADR-514 + `.ssot-registry.json` + τα 3 cross-linked ADR.
- **2026-06-24** — Φ6 (face-snap slab/roof/foundation, NEW feature, UNCOMMITTED): επέκταση `BimSnapToolKind`
  με `'polygon-vertex'` (slab/roof) + `'foundation-pad'` + αντίστοιχα branches στον εγκέφαλο (delegate
  `resolveMemberGhostSnapFromStore` width-0 / `resolveColumnFaceSnapFromTargets` — μηδέν νέο geometry).
  **NEW** `bim/placement/polygon-vertex-snap.ts` (pure `resolvePolygonVertexSnap`: Φ6a flush + Φ6b
  edge-slide/corner-turn/release) + `bim/placement/polygon-vertex-lock-store.ts` (zero-React lock SSoT,
  preview≡commit). **Wiring (ΧΩΡΙΣ findSnapPoint, anti double-snap §2):** `useSlabTool` + `useRoofTool`
  (νέο `getSceneEntities` option + `useSceneSnapTargetSync` + face-snap στο `onCanvasClick` + lock
  reset on activate/commit/deactivate· auto-close ελέγχεται στο RAW σημείο ΠΡΙΝ τον face-snap)·
  `useFoundationTool` (pad branch → `toolKind:'foundation-pad'` + sync)· `drawing-preview-generator`
  (slab/roof branches → `resolvePolygonPreviewCursor` = `resolveEffectivePreviewCursor` + ΙΔΙΟΣ resolver/
  store)· `useSpecialTools-area-tools` (περνά `getSceneEntities` σε slab/roof). **SSoT reuse-only** (Giorgio
  audit): `resolveMemberGhostSnapFromStore` + `resolveColumnFaceSnapFromTargets` + `scene-snap-targets` +
  `useSceneSnapTargetSync` + `GhostFaceFrame` — μηδέν διπλότυπο, **δεν** ξαναγράφτηκε το `ambient-alignment`
  (H/V, διαφορετικό). 16 (placement) + 18 (slab/foundation tools) + 606 (framing/columns regression) jest
  GREEN. tsc: 🔴 εκκρεμεί (N.17 — άλλος agent τρέχει tsc στο shared tree, δεν ξεκίνησα 2ο ταυτόχρονο).
  🔴 browser-verify εκκρεμεί. ⚠️ CHECK 6D: stage ADR-040 + ADR-514 μαζί (τροποποιήθηκε `drawing-preview-generator`).
  📌 Φ6c (pad) = commit-only face-snap (το pad δεν έχει WYSIWYG ghost preview· flush στο κλικ).
