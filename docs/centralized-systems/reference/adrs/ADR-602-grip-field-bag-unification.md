# ADR-602 — Grip Field-Bag Unification (ΕΝΑ `gripKind` αντί 31 optionals × 4 bags)

| | |
|---|---|
| **Status** | 🟢 **STAGE 5 IMPLEMENTED — ADR-602 COMPLETE (UNCOMMITTED)** — S5 (2026-07-08, Opus 4.8): **αφαιρέθηκαν ΟΛΑ τα 111 legacy `xxxGripKind` optionals** από τα 4 bags (31+31+28+21) → **ΕΝΑ `gripKind?: EntityGripKind` ανά bag** (η duplication ΤΕΛΟΣ· 124 σημεία → 1 `GripKindByEntity` map· νέος entity type = 1 γραμμή). Κάθε producer/hub/3D-bridge dual-write έγινε single-write `gripKind`· ~45 test files migrated σε `gripKindOf`/`gripKind`. **Safety gate έπιασε 4 incomplete-dualwrite producers** που τα S1-4 δεν είχαν καλύψει (column rect/circular adapters + `columnCenterMoveGrip` + `grip-computation` polyline vertex/edge emitters) → fixed σε single-write `gripKind`. **`ActiveDragGripInfo` ανέγγιχτη** (5η bespoke δομή, verified: τα 8 reads της + το `GripAlignmentRole.lineGripKind` DTO είναι δικά τους πεδία, ΟΧΙ 4-bag). **3D commit bridge logic-clone εξαλείφθηκε** — ο shared history-dispatcher εξήχθη σε `bim-3d/grips/grip-3d-commit-shared.ts` (`commit3DGripViaHistory`, N.18). **Verification (χωρίς tsc — N.17):** grep-net FULLY CLEAN (μηδέν legacy dot-reads/writes/indexed-access σε κώδικα· απομένουν μόνο σχόλια/helper-names/params/DTO-own)· **affected-surface jest 162 suites / 1721 tests πράσινα** (grip/ghost/preview/bim-3d/add-column/add-wall/footprint)· boy-scout: dead `FootprintGripKinds` interface αφαιρέθηκε από `footprint-reshape-anchors.ts`. jscpd:diff: logic-clone killed· απομένει pre-existing **51-token import/header clone** στα 2 3D bridges (unavoidable χωρίς merge· `toUnifiedGrip`≠`toRawDxfUnifiedGrip` λόγω polyline guard) → `SKIP_JSCPD_DIFF=1` justified στο commit. **Execution:** orchestrator, Wave 1 = 7 disjoint opus subagents (producers A/B/C + hubs D + boundary/trap G + tests F1/F2) → Wave 2 = 1 opus subagent (4 interfaces). Shared working tree με concurrent human-agent — μηδέν git ops από τους subagents. Giorgio: tsc + commit + browser-verify (live grip-drag/ghost 2D+3D). **Επόμενο (προαιρετικό): ADR-587 Φ7-8** (executable grip fields). ⬇️ S1-4: — S4 (2026-07-08, Opus 4.8): **~222 grip-discriminator reads → `gripKindOf(x,'on')`** σε ~62 files (18 renderers guarded· 14 parametric dispatch/commits· preview/ghost· systems/grip· **apply-entity-preview + apply-parametric-box** [surfaced late — preview-apply category]· CanvasSection+GroupGizmoLayer guarded· producer-internal stair/opening filters). 3D commit bridges forward `gripKind` (raw-DXF `on==='polyline'` guard)· **twin consolidation** `hasBimStructuralGripKind`→`hasFootprintGripKind` SSoT (jscpd 3→2 clones). **`ctrl-endpoint-rotate-copy` synthetic producer-gap fixed** (dual-write gripKind). **DEFER (ADR §3.3):** `ActiveDragGripInfo` (5η δομή, 8 reads/3 guarded cursor files) — δικά της πεδία, όχι 4-bag· δεν μπλοκάρει Stage 5. Any-entity coalesces (hot-grip/glyph 16-18-way) → `grip.gripKind?.kind` collapse. **~40 test files:** fixtures dual-write gripKind (legacy-only fixtures έτρεφαν migrated code)· ΟΛΑ grip/ghost/group/add-wall/add-column jest πράσινα· jscpd 3→2 (twin killed). 3 άσχετα full-suite failures (DimensionRenderer x-pos/coord.prop/wall-placement) = concurrent agent commit `bb20b252` (άλλαξε useDimensionGrips geometry), ΟΧΙ Stage 4. Επόμενο: Giorgio tsc+commit+browser-verify → Stage 5 (remove 31 legacy optionals + ActiveDragGripInfo decision). ⬇️ S1-3: — S1 additive SSoT + S2 hubs dual-write & 3 bug-fixes + **S3 producers dual-write** (Giorgio 2026-07-08, Opus 4.8). S1: `EntityGripKind`+`gripKindOf`+`GRIP_KIND_ENTITIES`+`GripKindByEntity` στο `grip-kinds.ts`· `gripKind?` ΔΙΠΛΑ στα 31 optionals σε 4 bags. S2: οι 4 2D forwarding hubs (`wrapDxfGrip`, `buildDxfDragPreview`, `buildRotateReferencePreview`, `toEntityPreviewTransform`) dual-write `gripKind` + **Bug 1** (mepWaterHeater@wrapDxfGrip) + **Bug 2** (mepSegment@toEntityPreviewTransform) fixed· **Bug 3** (disjoint builders) closed by construction. **S3: 32 producer files SET `gripKind: { on:'<entity.type>', kind:k }` δίπλα στο legacy `xGripKind:k` (124 siblings, dual-write, orchestrator 5 disjoint batches). Μηδέν read/behavior change (κανείς δεν διαβάζει `gripKind` ακόμη→Stage 4).** Tests 12/12 πράσινο· jscpd flat (pre-existing ray/xline+mep twins ΑΜΕΤΑΒΛΗΤΑ — μηδέν clone growth)· 3D bridges pristine (deferred→S4). Stages 4-5 σε επόμενα sessions (Giorgio: tsc + commit + browser-verify πρώτα). |
| **Context** | ADR-587 **Φ6** (prerequisite των executable grip fields / Φ7). Το grip discriminator field-bag διπλασιάζεται **4×**. |
| **Related** | ADR-587 (Entity Type Descriptor Registry — Φ6 είναι εδώ)· ADR-040 (preview-canvas perf, CHECK 6B/6C/6D)· ADR-561 (move/rotate grips primitives)· ADR-535/537 (3D grip commit bridges). |
| **Owner** | DXF Viewer / grips + preview-ghost. |

---

## 1. Πρόβλημα (code=truth, μετρημένο μέσω orchestrated recognition 2026-07-08)

Ο grip discriminator κουβαλιέται ως **31 optional `xxxGripKind?` πεδία** (ένα ανά entity type) που **επαναλαμβάνονται σε 4 field-bags**. Κάθε νέος entity type = χειροκίνητη προσθήκη σε **4 interfaces + ~4 forwarding hubs + producer + dispatch** — καθαρό anti-SSoT (η βάση του ADR-587).

### 1.1 Τα 4 bags + το master catalog

| Bag | Αρχείο | gripKind πεδία |
|---|---|---|
| `GripInfo` | `hooks/grip-types.ts` | **31/31** (SSoT source) |
| `UnifiedGripInfo` | `hooks/grips/unified-grip-types.ts` | **31/31** (1:1 forward από GripInfo) |
| `DxfGripDragPreview` | `hooks/grip-computation-types.ts` | **28/31** (λείπουν circle/xline/ray) |
| `EntityPreviewTransform` | `rendering/ghost/entity-preview-types.ts` | **21/31** (narrowest — μόνο όσα ζωγραφίζει το applyEntityPreview) |

**Master catalog = 31 GripKind unions** (`hooks/grip-kinds.ts`, re-export hub από 5 αρχεία: `grip-kinds` + `-mep-heating` + `-primitives` + `-text` + `-placeable`):
Stair, Dimension, Wall, Opening, Slab, SlabOpening, Roof, FloorFinish, Hatch, MepUnderfloor, Beam, Column, Foundation, MepFixture, ElectricalPanel, MepManifold, MepRadiator, MepBoiler, MepWaterHeater, Furniture, FloorplanSymbol, MepSegment, XLine, Ray, Polyline, Circle, Arc, Line, Group, AnnotationSymbol, Text.

⚠️ **Σημείωση path:** `grip-kinds.ts` ζει στο `hooks/grip-kinds.ts` (ΟΧΙ `hooks/grips/`).

### 1.2 Ροή (35 producers → 4 forwarding hops)

```
35 producers (bim/**/*-grips.ts, systems/**/*-grips.ts — ο καθένας SET-άρει 1 xGripKind σε GripInfo literal)
   │
   ▼  wrapDxfGrip()  [hooks/grips/grip-registry.ts]  (+3D: grip-3d-commit.toUnifiedGrip, grip-3d-dxf-commit.toRawDxfUnifiedGrip)
GripInfo ──▶ UnifiedGripInfo
   │
   ▼  buildDxfDragPreview() + buildRotateReferencePreview()  [hooks/grips/grip-projections.ts]
UnifiedGripInfo ──▶ DxfGripDragPreview
   │
   ▼  toEntityPreviewTransform()  [hooks/tools/grip-drag-preview-transform.ts]
DxfGripDragPreview ──▶ EntityPreviewTransform  ──▶ applyEntityPreview (Move tool + grip-drag ghost, ADR-040/049)
```

Κάθε hop κάνει **conditional-spread και των 31 fields** — αυτό είναι το πραγματικό «manual add per new type» pain point.

### 1.3 Reads: **617 occurrences / 104 αρχεία** (η αρχική εκτίμηση 746 ήταν over-count)

| Κατηγορία | Αρχεία | Reads | Σημείωση |
|---|---|---|---|
| test | 45 | ~225 | inert assertion data, μηδέν production risk |
| routing-dispatch | 20 | ~131 | **ο κύριος στόχος** — `if(grip.xGripKind){ applyXGripDrag(...); }` |
| forwarding | 31 | ~193 | copy/coalesce/filter field onward |
| preview-apply | 7 | ~28 | ghost/HUD/ribbon live-drag (ίδια math με commit, χωρίς write) |
| type-def | 2 | 34 | interfaces (κυρίως JSDoc) |

**6 hubs = 152 reads (~25%):** `grip-parametric-dispatch.ts`(24, THE dispatcher), `grip-registry.ts`(30), `grip-projections.ts`(38), `grip-drag-preview-transform.ts`(21), `unified-grip-types.ts`(31 type-def), `grip-parametric-copy.ts`(22).

### 1.4 🐞 3 latent forwarding bugs που ανέδειξε το audit (η ενοποίηση τα κλείνει *by construction*)

1. **`mepWaterHeaterGripKind`** — declared σε GripInfo+UnifiedGripInfo (το comment λέει «forwarded from GripInfo»), αλλά `wrapDxfGrip()` **δεν το αντιγράφει**· consumers (grip-parametric-dispatch/-copy/-heating-host-commits, transform-glyph-visibility) το περιμένουν populated.
2. **`mepSegmentGripKind`** — declared σε DxfGripDragPreview+EntityPreviewTransform, διαβάζεται στο `apply-parametric-box-preview.ts`, αλλά `toEntityPreviewTransform()` **δεν το αντιγράφει** → ζωντανό ghost dragged mep-segment χάνει το kind.
3. Οι 2 preview builders (`buildDxfDragPreview` vs `buildRotateReferencePreview`) forward-άρουν **disjoint subsets** (translate builder δεν έχει arc/polyline/annotationSymbol· κανένας δεν έχει circle/xline/ray/mep-heating/underfloor).

---

## 2. Απόφαση σχεδιασμού (enterprise, big-player-faithful)

**Target = tagged discriminated union.** Τα 31 kind-unions ΔΕΝ είναι εγγυημένα disjoint (πολλά μοιράζονται `'*-move'`, `'*-vertex-N'` literals) → **tag υποχρεωτικό** (Revit/Figma command-object pattern· flat union θα έχανε την ταυτότητα entity που χρειάζεται ο dispatcher).

```ts
// hooks/grip-kinds.ts (SSoT hub) — ADD:
export type EntityGripKind =
  | { readonly on: 'wall';  readonly kind: WallGripKind }
  | { readonly on: 'stair'; readonly kind: StairGripKind }
  | … // 31 μέλη (ένα ανά catalog entry)

// overloaded SSoT accessor — κρατά τα 617 call-sites terse + typed:
export function gripKindOf(g: { gripKind?: EntityGripKind }, on: 'wall'): WallGripKind | undefined;
export function gripKindOf(g: { gripKind?: EntityGripKind }, on: 'stair'): StairGripKind | undefined;
// … (overload ανά entity)  →  υλοποίηση: g.gripKind?.on === on ? g.gripKind.kind : undefined
```

Κάθε bag → **ΕΝΑ** `gripKind?: EntityGripKind` (αντικαθιστά τα 31).
- **Read:** `grip.wallGripKind` → `gripKindOf(grip, 'wall')`.
- **Write (producer):** `{ wallGripKind: k }` → `{ gripKind: { on: 'wall', kind: k } }`.
- **Forwarding hubs:** 31-field conditional-spread → copy **1** field `gripKind` → **κλείνει τα 3 bugs by construction** (ένα field δεν γίνεται selectively-dropped).

**Completeness anchor (ADR-587 pattern):** coverage test που δένει τα 31 μέλη του `EntityGripKind` στο descriptor domain — νέος entity type χωρίς μέλος → σπάει.

### 2.1 Γιατί ΟΧΙ τώρα executable grip fields στον descriptor
Ίδιος λόγος με ADR-587 §5.3: το `EntityGripKind` = **δηλωτικό discriminator SSoT**, ΟΧΙ owner της ανά-type grip math (αυτή μένει στα `*-grips.ts` producers + `applyXGripDrag`). Ο descriptor = domain + completeness anchor.

---

## 3. Staged migration plan (additive-first, zero-behavior-change ανά stage, tsc+commit ανάμεσα)

| Stage | Τι | Αρχεία (~) | Ποιος | Risk |
|---|---|---|---|---|
| **0** (precondition) | commit ADR-587 Φ5 (καθαρή βάση — shared tree) | — | **Giorgio** | — |
| **1** ✅ | `EntityGripKind` + `gripKindOf()` SSoT στο `grip-kinds.ts`· `gripKind?` **ΔΙΠΛΑ** στα 31 στα 4 bags (όχι remove)· coverage test 31-μελές↔domain | 6 | Opus, sequential | 🟢 additive, μηδέν read/write break — **DONE (uncommitted)** |
| **2** ✅ | 4 forwarding hubs → copy `gripKind` (dual-write: κρατούν & τα παλιά)· **fixα τα 3 bugs** | 5 | Opus + **browser-verify** (perf ghost) | 🟡 — **DONE (uncommitted)**· 3D bridges deferred→S4 (§3.2) |
| **3** ✅ | 32 producers SET `gripKind` (dual-write· 124 siblings) | 32 | orchestrator, 5 disjoint batches | 🟢 μηχανικό — **DONE (uncommitted)** |
| **4** ✅ | ~222 reads → `gripKindOf()`· batched disjoint + 3D forward + twin consolidation | ~62 (+~40 test) | orchestrator + core delicate | 🟡 — **DONE (uncommitted)**· ActiveDragGripInfo deferred (§3.3) |
| **5** | remove τα 31 optionals από 4 bags + κάθε dual-write — **duplication τέλος** | 4 | Opus, sequential | 🟡 |

Orchestrator = Stages 3-4 (disjoint μηχανικά files, worktree ΟΧΙ απαραίτητο αν batches αγγίζουν ξένα files). Core (1,2,5) = Opus sequential.

### 3.1 Guards (ADR-040 CHECK 6B/6C/6D) — καλό νέο
- **ΚΑΝΕΝΑ** αρχείο μέσα σε `hooks/grips/` ή `rendering/ghost/` δεν είναι guarded. Έκθεση **μόνο** από consumers: `rendering/entities/*Renderer.ts` (getGrips), `systems/cursor/*`, `canvas-v2/*`, `components/dxf-layout/Canvas*`.
- **Stage ADR-040 → ικανοποιεί ΚΑΙ 6B ΚΑΙ 6D** (6B: «ADR-040» στο staged filename· 6D: οποιοδήποτε staged ADR .md). **Vale ο κανόνας:** όποιο stage αγγίζει renderer/systems-cursor/canvas → stage `ADR-040-preview-canvas-performance.md` + `ADR-602` + (αν αλλάζει grip production/render arch) `ADR-561`.
- **6C** δεν σκάει (δεν προσθέτουμε `useSyncExternalStore` σε CanvasSection/CanvasLayerStack). ADR-561 = doc-only (μηδέν hook grep).

---

### 3.3 Stage 4 recognition (2026-07-08, 3 parallel Sonnet readers) — 2 surfaced hazards

Read-only recognition χαρτογράφησε τα ~222 read-sites (R1 routing/commits 145· R2 forwarding/preview/systems 55· R3 renderers/3D 22) και ανέδειξε **δύο** πράγματα που το αρχικό §1.3 plan δεν είχε λάβει υπόψη:

1. **`ActiveDragGripInfo` = 5η bespoke δομή** (`systems/cursor/GripDragStore.ts`) — **ΔΕΝ** είναι ένα από τα 4 field-bags· έχει **δικά της** πεδία (`gripKind: string|null`, `dimGripKind?`, `lineGripKind?`) που ΔΕΝ κουβαλούν το tagged `EntityGripKind`. **8 reads** την διαβάζουν (`mouse-handler-up.ts` ×3, `grip-drag-alignment-tracking.ts` ×3 — guarded· `GripDragStore.ts` ×1 owner· `grip-drag-alignment-role.ts:113` role field). **DEFER εκτός Stage 4** (χωριστή απόφαση αν αποκτήσει tagged gripKind). **ΔΕΝ μπλοκάρει το Stage 5:** τα πεδία της είναι ξεχωριστό schema — το Stage 5 αφαιρεί legacy από τα 4 bags, ΟΧΙ από την `ActiveDragGripInfo`. Τα πεδία της τροφοδοτούνται στο boundary (`grip-mouse-handlers.ts`) από **migrated** `gripKindOf` reads του source UnifiedGripInfo.
2. **`ctrl-endpoint-rotate-copy.ts` producer-gap:** φτιάχνει synthetic grips `{ ...grip, lineGripKind: LINE_ROTATION_KIND }` που dual-write **μόνο** το legacy → Stage 4 τα έκανε dual-write ΚΑΙ το `gripKind` (αλλιώς `gripKindOf(syntheticGrip, …)` στους consumers `grip-mouse-handlers.ts:211/213` = `undefined` → silent regression του Ctrl+drag rotate-copy).

**Transform policy:** entity-specific reads → `gripKindOf(x,'on')` (type-preserving, ίδιος τύπος). «Any-entity» coalesces όπου το entity identity είναι άσχετο (glyph-shape `dataGripGlyphShape` 16-way· hot-grip `hotGripKindOf` 18-way) → collapse σε `grip.gripKind?.kind` (SSoT win). Footprint 7-way + alignment-role 4-way + context-menu 3-way = **1:1 `gripKindOf` chain** (ΟΧΙ collapse — διατηρεί τα «undefined για non-member» semantics). Guarded renderers (18) → stage ADR-040 (CHECK 6D). Τα 3D commit bridges (§3.2) forward `gripKind` (raw-DXF με `on==='polyline'` guard ώστε να μη leak-άρει BIM kind).

### 3.2 3D commit bridges → deferred στο Stage 4 (ΟΧΙ Stage 2)
Οι 2 3D bridges (`grip-3d-commit.toUnifiedGrip`, `grip-3d-dxf-commit.toRawDxfUnifiedGrip`) φτιάχνουν
`UnifiedGripInfo` για το **3D commit path** — ΟΧΙ μέρος των «4 forwarding hubs» (2D chain). Το 3D commit
**δεν διαβάζει** `gripKind` μέχρι να migrate ο dispatcher (`commitDxfGripDragModeAware`) στο **Stage 4**,
οπότε το `gripKind` forward εκεί ανήκει στο Stage 4. **Επιπλέον** τα δύο bridge files είναι **pre-existing
structural twins** (jscpd CHECK 3.28 τα flag-άρει σε headers/imports 1-37 + commit-bodies — ΟΧΙ δικό μας
diff): το Stage 4 είναι το σωστό σημείο και για το gripKind forward ΚΑΙ για τυχόν consolidation του twin
scaffold (mirror bridges με διαφορετικό filtering: reshape 7 BIM kinds vs raw-DXF μόνο polyline). Στο Stage
2 τα αφήσαμε **pristine** → μηδέν jscpd trip, καθαρό commit χωρίς `SKIP_JSCPD_DIFF`.

## 4. Επόμενο βήμα
Stages 1+2+3+4 ✅ DONE (uncommitted). **Επόμενο = Giorgio: tsc + commit + browser-verify** (Bug 1/2 perf ghost
από S2: water-heater grip drag + mep-segment live ghost· + browser-verify του live grip-drag/ghost αφού το S4
άλλαξε τα read paths — δες apply-entity-preview/apply-parametric-box) → μετά **Stage 5** (Opus sequential):
**remove τα 31 legacy `xGripKind` optionals** από τα 4 bags + κάθε dual-write (producers S3 + hubs S2 +
3D bridges S4) — duplication τέλος. **ΠΡΟΣΟΧΗ S5:** (α) migrate και τα legacy conditional-spread forwards
(`grip-projections`/`grip-registry`/`grip-drag-preview-transform`) σε copy-1-field· (β) **`ActiveDragGripInfo`
απόφαση** (§3.3): αποκτά tagged `gripKind` ή μένει bespoke;· (γ) update τα ~40 test fixtures να αφαιρέσουν
legacy (κρατούν μόνο `gripKind`). Δες §3 πίνακα.

### 4.2 Παραδοτέα Stage 2 (code=truth, υλοποιημένα)
- **4 2D forwarding hubs dual-write `gripKind`** (conditional-spread, inert μέχρι Stage 3):
  `wrapDxfGrip` (grip-registry.ts, +exported για test)· `buildDxfDragPreview` + `buildRotateReferencePreview`
  (grip-projections.ts)· `toEntityPreviewTransform` (grip-drag-preview-transform.ts).
- **Bug 1 fix:** `wrapDxfGrip` τώρα forward-άρει `mepWaterHeaterGripKind` (ήταν το μόνο heating kind χωρίς
  forward· consumers το έπαιρναν πάντα undefined).
- **Bug 2 fix:** `toEntityPreviewTransform` τώρα forward-άρει `mepSegmentGripKind` (ζωντανό ghost dragged
  mep-segment έχανε το kind).
- **Bug 3 fix by construction:** το ΕΝΑ `gripKind` προωθείται ΚΑΙ από τους δύο preview builders → ο
  disjoint-subset κίνδυνος εξαλείφεται όταν migrate τα reads (Stage 4).
- **Tests:** `grip-gripkind-dualwrite.test.ts` (νέο, 6 tests: wrapDxfGrip gripKind+Bug1+sibling· builders
  gripKind present/absent)· `grip-drag-preview-transform.test.ts` (+3: Bug 2 + gripKind present/absent).
  12/12 πράσινο· **jscpd:diff καθαρό** (10 Stage 1+2 files). 3D bridge tests **ανέγγιχτα** (pristine).

### 4.1 Παραδοτέα Stage 1 (code=truth, υλοποιημένα)
- **SSoT** (`hooks/grip-kinds.ts`): `GripKindByEntity` map (31 entries, `on` tag = `entity.type`,
  code-verified)· `EntityGripKind` = mapped-type distribution (μηδέν χειρόγραφη 31-λίστα)· **ΕΝΑ** generic
  `gripKindOf<K>()` (ΟΧΙ 31 overloads)· `GRIP_KIND_ENTITIES` const με `satisfies readonly (keyof
  GripKindByEntity)[]` (forward completeness). +19 `import type` bindings των sibling kinds (τα 12 local).
- **`gripKind?: EntityGripKind`** ΔΙΠΛΑ στα 31 optionals: `GripInfo` (grip-types.ts)· `UnifiedGripInfo`
  (`readonly`)· `DxfGripDragPreview`· `EntityPreviewTransform` (`readonly`). Κανένα optional δεν αφαιρέθηκε.
- **Coverage test** (`hooks/__tests__/grip-kinds-coverage.test.ts`, 6/6): bidirectional compile-time bridge
  (map ≡ const)· runtime 31 + no-dupes + `group` presence· behavioral pin `gripKindOf` (match/mismatch/absent/
  template-literal). firebase-auth mock κορυφή. **jscpd:diff καθαρό** στα 6 αρχεία.
- **Anchor απόφαση:** domain = οι 31 grip-producers = `keyof GripKindByEntity` (self-referential mirror),
  ΟΧΙ `RENDERABLE_ENTITY_TYPES` (επιβεβαιώθηκε: `group` renderable-λείπει· `railing`/`mep-fitting` renderable
  χωρίς grip-kind).

---

## 5. Changelog

| Ημ/νία | Model | Αλλαγή |
|---|---|---|
| 2026-07-08 | Opus 4.8 | **STAGE 5 IMPLEMENTED — ADR-602 COMPLETE (UNCOMMITTED).** Το «contract» βήμα του Parallel Change: **αφαιρέθηκαν ΟΛΑ τα 111 legacy `xxxGripKind?` optionals** από τα 4 bags (`GripInfo` 31 / `UnifiedGripInfo` 31 / `DxfGripDragPreview` 28 / `EntityPreviewTransform` 21) + τα now-unused per-entity union imports → **ΕΝΑ `gripKind?: EntityGripKind` ανά bag**. Κάθε producer/hub/3D-bridge dual-write → single-write `gripKind`· ~45 test files: assertions→`gripKindOf`, fixtures→drop legacy· ο special `grip-gripkind-dualwrite.test` + `grip-drag-preview-transform.test` έχασαν τα legacy-forward it-blocks (κρατούν το `gripKind` contract). **SSoT audit (grep) πριν:** κατηγοριοποίηση κάθε occurrence (interface-decl/producer-write/hub-forward/3D-forward/test-fixture/test-assertion/**ActiveDragGripInfo-own=ΚΡΑΤΑ**). **Safety gate έπιασε 4 producers που τα S1-4 ΔΕΝ dual-write-αραν** (column `rect-adapter`/`circular-adapter` corner+quad grips, `column-grip-utils.columnCenterMoveGrip`, `grip-computation` polyline vertex/edge emitters) → fixed σε single-write `gripKind` (αλλιώς χαμένος discriminator). **`ActiveDragGripInfo` ανέγγιχτη** (verified: own πεδία `gripKind:string\|null`/`dimGripKind?`/`lineGripKind?` + `GripAlignmentRole.lineGripKind` DTO τροφοδοτούνται από migrated `gripKindOf`, ΟΧΙ 4-bag). **3D bridge twin:** ο shared history-backed dispatcher (`buildDeps`+override `execute`+`commitDxfGripDragModeAware`) εξήχθη σε νέο `bim-3d/grips/grip-3d-commit-shared.ts` `commit3DGripViaHistory` (N.18 logic-clone killed)· `toUnifiedGrip`/`toRawDxfUnifiedGrip` μένουν χωριστά (raw έχει `on==='polyline'` guard). **Execution:** orchestrator — Wave 1 = 7 disjoint opus subagents (producers structural/mep/primitives + hubs + boundary/trap + 2 test batches) με per-producer safety-gate → Wave 2 = 1 opus subagent (4 interfaces). **Verification (NO tsc, N.17):** grep-net FULLY CLEAN — μηδέν legacy dot-reads/writes/indexed-access σε κώδικα (μόνο σχόλια/helper-names/function-params/DTO-own απομένουν)· **affected-surface jest 162 suites / 1721 tests πράσινα** (grip/ghost/preview/bim-3d/add-column/add-wall/footprint). **Boy-scout:** dead/unused `FootprintGripKinds` interface (legacy field-name σκιά) αφαιρέθηκε από `footprint-reshape-anchors.ts`. **jscpd:diff:** logic-clone εξαλείφθηκε· απομένει pre-existing **51-token import/header clone** στα 2 3D bridge files (unavoidable — ίδιο import signature· merge = scope creep + concurrent-agent risk) → commit με `SKIP_JSCPD_DIFF=1` (justified). Shared tree με concurrent human-agent — μηδέν git ops από subagents. Επόμενο: Giorgio tsc + commit + browser-verify → (προαιρετικά) ADR-587 Φ7-8 executable grip fields. |
| 2026-07-08 | Opus 4.8 | **STAGE 4 IMPLEMENTED (UNCOMMITTED).** **~222 grip-discriminator reads → `gripKindOf(x,'on')`** (type-preserving) σε ~62 production files. **Recognition** (3 parallel Sonnet readers) ανέδειξε 2 hazards που το §1.3 plan δεν είχε (τεκμηρίωση §3.3): (1) **`ActiveDragGripInfo`** = 5η bespoke δομή (δικά της `gripKind:string\|null`/`dimGripKind?`/`lineGripKind?`, ΟΧΙ tagged) — 8 reads/3 guarded cursor files **DEFER** (δεν μπλοκάρει S5)· (2) **`ctrl-endpoint-rotate-copy` synthetic producer-gap** (dual-write μόνο legacy → fixed να dual-write ΚΑΙ gripKind). **Batches:** M1 renderers 18 (guarded→co-stage ADR-040)· M2 parametric dispatch/commits 14 (138 reads, hoist-const)· M3 preview/ghost 6· M4 systems/grip 7· core-delicate (εγώ): 5 3D bridges (forward gripKind· raw-DXF `on==='polyline'` guard· **twin consolidation** `hasBimStructuralGripKind`→`hasFootprintGripKind` SSoT)· grip-mouse-handlers boundary· wall-hot-grip-fsm+transform-glyph-visibility (any-entity coalesce→`grip.gripKind?.kind` collapse)· footprint-reshape-anchors bespoke-bag· grip-context-menu-resolver· grip-drag-alignment-role. **Surfaced-late stragglers** (preview-apply category, όχι σε recognition scope): `apply-entity-preview.ts` (17-field destructure)· `apply-parametric-box-preview.ts` (9-field)· `CanvasSection.tsx`+`GroupGizmoLayer.tsx` (guarded)· producer-internal `stair-grips`/`opening-grips` filters. **Tests:** ~40 test files είχαν legacy-only fixtures που έτρεφαν migrated code (assertion reads inert, ΑΛΛΑ fixtures→dispatch έσπαγαν)· 5 fix-agents dual-write gripKind σε fixtures (μηδέν assertion weakening)· ΟΛΑ grip/ghost/group/add-wall/add-column jest πράσινα. **jscpd 3→2 clones** (twin killed, N.18 ✓). Guarded co-stage: ADR-040 changelog ✅. 3 άσχετα full-suite failures (DimensionRenderer x-pos/coord.prop/use-bim3d-wall-placement, 0 gripKind refs, unmodified files) = concurrent agent commit `bb20b252` (grip computation/types batch· άλλαξε useDimensionGrips geometry), ΟΧΙ Stage 4. Επόμενο: Giorgio tsc+commit+browser-verify → Stage 5. |
| 2026-07-08 | Opus 4.8 | **STAGE 3 IMPLEMENTED (UNCOMMITTED).** Οι **32 grip-producers** SET-άρουν το tagged `gripKind: { on: '<entity.type>', kind: k }` δίπλα σε κάθε legacy `xGripKind: k` (**dual-write, 124 siblings**· κανένα legacy field δεν αφαιρέθηκε). SSoT audit (grep) code=truth: 30 `*-grips.ts` + `hooks/dimensions/useDimensionGrips.ts` (dimension) + `hooks/grip-computation.ts` (hatch, 4 write-sites) = 32 files / 31 entity types (column ×2 files)· on-tag = πραγματικό `entity.type`· inline literal type-safe by construction (discriminated union `EntityGripKind` από S1 — **κανένα `makeGripKind()` wrapper**, καμία import churn)· template-literal & helper-computed kinds (`slab-vertex-${i}`, `WALL_ROLE_TO_KIND[g.role]`, `HATCH_GRADIENT_ORIGIN_KIND` κ.λπ.) reuse την ΙΔΙΑ έκφραση. **Execution:** orchestrator, 5 disjoint batches (A structural 11 · B mep 8 · C primitives 6 · D annotations/group/text 5 = 4 parallel Sonnet agents· E dimension+hatch 2 = core Opus, γιατί grip-computation.ts έχει reads στο ίδιο file). **Verification:** υπάρχοντα grip jest 12/12 πράσινα (S1 coverage + S2 preview-transform)· **jscpd flat** (HEAD είχε ήδη 2 clones/20 lines σε ray/xline+mep twins· post-change ΙΔΙΟ count → μηδέν clone growth, N.18 OK)· **3D bridges pristine** (`toUnifiedGrip`/`toRawDxfUnifiedGrip` deferred→S4, §3.2). Μηδέν read/behavior change (τα 617 reads μεταναστεύουν στο Stage 4). Επόμενο: Giorgio tsc + commit + browser-verify → Stage 4. |
| 2026-07-08 | Opus 4.8 | **STAGE 2 IMPLEMENTED (UNCOMMITTED).** Οι 4 2D forwarding hubs (`wrapDxfGrip`, `buildDxfDragPreview`, `buildRotateReferencePreview`, `toEntityPreviewTransform`) dual-write το `gripKind` (conditional-spread, inert μέχρι Stage 3). **Bug 1** (`mepWaterHeaterGripKind` δεν αντιγραφόταν στο `wrapDxfGrip`) + **Bug 2** (`mepSegmentGripKind` δεν αντιγραφόταν στο `toEntityPreviewTransform`) fixed· **Bug 3** (disjoint preview builders) closed by construction. `wrapDxfGrip` exported για unit-test. Tests: νέο `grip-gripkind-dualwrite.test.ts` (6) + `grip-drag-preview-transform.test.ts` (+3) = 12/12· **jscpd:diff καθαρό** (10 files). **3D bridges deferred→Stage 4** (§3.2: όχι part των 4 hubs· 3D commit διαβάζει gripKind μόνο μετά dispatcher migration· pre-existing twin scaffold → consolidation μαζί στο S4). Μηδέν behavior change πλην Bug 1/2 (browser-verify). |
| 2026-07-08 | Opus 4.8 | **STAGE 1 IMPLEMENTED (UNCOMMITTED).** Additive grip-discriminator SSoT, μηδέν behavior change. SSoT audit (grep) επιβεβαίωσε code=truth: δεν προϋπήρχε `EntityGripKind`/`gripKindOf`· 31 `on` tags = πραγματικά `entity.type` strings· 4 bags 31/31/28/21 (§1.1)· anchor = 31 grip-producers ≠ RENDERABLE. **Υλοποίηση:** `GripKindByEntity` map + mapped-type `EntityGripKind` + **ΕΝΑ** generic `gripKindOf<K>()` (ΟΧΙ 31 overloads — βελτίωση έναντι του §2 sketch, Figma-grade) + `GRIP_KIND_ENTITIES` (`satisfies`) στο `grip-kinds.ts` (+19 local `import type` bindings)· `gripKind?: EntityGripKind` ΔΙΠΛΑ στα 31 optionals σε 4 bags (κανένα optional δεν αφαιρέθηκε)· coverage test 6/6 (bidirectional compile-time bridge + runtime 31 + behavioral pin)· **jscpd:diff καθαρό**. Μηδέν touch σε producers/hubs/reads/3 bugs (=Stages 2-5). Επόμενο: Giorgio tsc + commit → Stage 2. |
| 2026-07-08 | Opus 4.8 | **PHASE 1 RECOGNITION + DESIGN (UNCOMMITTED).** Orchestrated read-only recognition (4 παράλληλοι Sonnet investigators, 424k tokens): χαρτογράφησε τα 4 bags (31/31/28/21 πεδία), το master catalog (31 unions/5 αρχεία), τη ροή (35 producers → 4 forwarding hops), τα 617 reads/104 αρχεία (test 45· routing-dispatch 20· forwarding 31· preview 7· type-def 2· 6 hubs=152 reads), και το guard surface (ΚΑΝΕΝΑ grips/ghost αρχείο guarded· έκθεση μόνο από consumers· stage ADR-040→6B+6D). **3 latent forwarding bugs surfaced** (mepWaterHeater στο wrapDxfGrip· mepSegment στο toEntityPreviewTransform· disjoint preview builders). **Design (Giorgio-approved):** tagged `EntityGripKind` discriminated union + `gripKindOf()` overloaded accessor· ΕΝΑ `gripKind?` αντί 31 optionals· forwarding hubs copy 1 field (κλείνει τα 3 bugs)· completeness coverage test. **Staged plan (5 stages, additive-first):** S1 SSoT+additive· S2 hubs+bugfix· S3 35 producers· S4 617 reads· S5 remove optionals. Stage 0 = Giorgio commit Φ5. Καμία αλλαγή κώδικα ακόμη. |
