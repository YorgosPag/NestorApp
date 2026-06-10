# HANDOFF — ADR-436 Θεμελίωση / Foundation Discipline → Slice 1b (selection + grips)

**Date:** 2026-06-10 · **Model:** Opus 4.8 · **Από:** προηγούμενη συνεδρία (Slice 1 DONE + 2Δ pipeline fix)

---

## 0. Γλώσσα & βασικοί κανόνες (CLAUDE.md) — ΔΙΑΒΑΣΕ ΠΡΩΤΑ

- **Απαντάς ΠΑΝΤΑ στα Ελληνικά** (LANGUAGE RULE, overrides everything).
- **ΠΟΤΕ git commit/push** χωρίς ρητή εντολή Giorgio (N.(-1)). **Ο Giorgio κάνει το commit, ΟΧΙ εσύ.**
- **Shared working tree** με άλλον agent → `git add` **ΜΟΝΟ τα δικά σου** αρχεία, ΠΟΤΕ `git add -A`.
- **N.17:** ΕΝΑ `tsc` τη φορά — έλεγξε ότι δεν τρέχει άλλος ΠΡΙΝ ξεκινήσεις (`wmic process where "name='node.exe'" get commandline | grep -i tsc`). Σειριακά, ΠΟΤΕ παράλληλα.
- **ΜΗΝ** αγγίζεις `adr-index.md` (shared tree).
- Στόχος (Giorgio, ρητό): **«όπως η Revit / οι μεγάλοι παίκτες, FULL ENTERPRISE + FULL SSOT».** Μηδέν `any`/`as any`/`@ts-ignore`. Search πριν γράψεις. Πάρε εσύ τις enterprise/Revit αποφάσεις (μην ρωτάς για standard professional επιλογές — feedback memory) + ζήτα μόνο έγκριση plan.
- **N.14 model:** συνέχισε σε **Opus** (cross-cutting grip system, αγγίζει shared `useGripMovement`).

---

## 1. Το ΖΗΤΟΥΜΕΝΟ του Slice 1b (η ρητή εντολή Giorgio)

Το foundation **pad** σχεδιάζεται + φαίνεται **σωστά σε 2Δ (διακεκομμένο + concrete hatch + κεντρικός σταυρός) ΚΑΙ 3Δ** (browser-verified από Giorgio). **ΟΜΩΣ:**

> «ΔΕΝ ΜΠΟΡΩ ΝΑ ΤΟ ΕΠΙΛΕΞΩ ΚΑΙ ΝΑ ΕΜΦΑΝΙΣΤΟΥΝ ΤΑ ΧΕΡΟΥΛΙΑ ΩΣΤΕ ΝΑ ΤΟ ΧΕΙΡΙΣΤΩ»

**Έργο σου:** Revit-grade **selection + parametric grips** για το pad (move / rotation / width / length handles), FULL ENTERPRISE + FULL SSOT, mirror της **ΚΟΛΩΝΑΣ** 1:1.

**Γιατί λείπει:** στο Slice 1 το `FoundationRenderer.getGrips()` επιστρέφει σκόπιμα `[]` (deferred), επειδή τα canvas grips αγγίζουν το **shared** `useGripMovement` (το `ColumnGripKind` discriminant union + 5 forwarding boundaries) — cross-cutting, ήθελε δικό του slice.

---

## 2. Slice 1 — DONE (ΜΗΝ το ξαναγράψεις). Τι υπάρχει ήδη

### Data / geometry / validation (pure SSoT)
- `bim/types/foundation-types.ts` — `FoundationKind='pad'|'strip'|'tie-beam'`, `FoundationParams` discriminated union, `PadFootingParams` (πεδία: `position`, **`width`**, **`length`**, `rotation`, `anchor`, `profile`, `thicknessMm`, `topElevationMm`), `ANCHOR_OFFSETS`, `FOUNDATION_ANCHOR_CYCLE_ORDER`, `MIN_FOUNDATION_DIMENSION_MM`. **ΠΡΟΣΟΧΗ: pad = `width`×`length` (ΟΧΙ width×depth όπως column).**
- `bim/geometry/foundation-geometry.ts` — `computeFoundationGeometry(params)` (total over 3 kinds· pad = rect+anchor offset+rotation γύρω από `position`, ίδιο μοτίβο με `column-geometry.ts`). **Το math SSoT — τα grips ΔΕΝ το ξαναϋπολογίζουν, ο `UpdateFoundationParamsCommand` το καλεί.**
- `bim/validators/foundation-validator.ts` — `validateFoundationParams`.
- `hooks/drawing/foundation-completion.ts` — `buildFoundationEntity` / `buildDefaultFoundationParams` / `FoundationParamOverrides`.
- `services/factories/foundation.factory.ts` — `createFoundation` (prefix `fnd`).

### 2Δ render
- `bim/renderers/FoundationRenderer.ts` — extends `BaseEntityRenderer`. **`getGrips()` → `[]` (ΕΔΩ θα δουλέψεις).** Έχει `hitTest()` (bbox + pointInPolygon — λειτουργεί). `render()`: visibility check + fill + concrete RC hatch (reuse column hatch SSoT) + **διακεκομμένο** hidden-line περίγραμμα + κεντρικός σταυρός (pad). `finalizeRender(entity, options)` καλείται (αυτό ζωγραφίζει τα grips από `getGrips`).
- `bim/foundations/foundation-render-palette.ts`, `bim/foundations/foundation-hatch-patterns.ts`.

### 3Δ
- `bim-3d/converters/foundation-to-three.ts` — `foundationToMesh` (hang-down: `(topElev−thickness)·MM_TO_M+base`). Re-export στο `BimToThreeConverter`.
- `Bim3DEntitiesStore` foundations slice + `setFoundations`, `bim3d-resync`, `BimSceneLayer.syncFoundations`, `useFloors3DAggregator` multi-floor filter.

### Tool / ribbon / command / persistence
- `hooks/drawing/useFoundationTool.ts` (single-click pad + Tab anchor FSM) + `ui/ribbon/hooks/bridge/foundation-tool-bridge-store.ts`.
- `core/commands/entity-commands/UpdateFoundationParamsCommand.ts` — **ΗΔΗ ΕΤΟΙΜΟ** (execute/undo/redo/canMergeWith/mergeWith· recompute geometry+validation). **Αυτό θα καλούν τα grip commits.**
- Ribbon: `contextual-foundation-tab.ts`, `foundation-command-keys.ts`, `useRibbonFoundationBridge.ts`. Wired στον composer (`useDxfBimBridges`/`useRibbonCommands`/`-types`/`useDxfViewerRibbon`). Numeric editing (width/length/thickness/rotation/topElevation/anchor) ΔΟΥΛΕΥΕΙ μέσω ribbon.
- `app/FoundationPersistenceHost.tsx` — **Slice 1: ΜΟΝΟ 3D-store push** (currentScene→setFoundations). Firestore = Slice 1-persist (βλ. §6).
- `bim/foundations/add-foundation-to-scene.ts`.

### Registration / wiring
- `types/entities.ts` (`isFoundationEntity` + `Entity` union + `isBimEntity`), `types/base-entity.ts` (`EntityType += 'foundation'`), `EntityRendererComposite` (`renderers.set('foundation', …)`), `tool-definitions` (`foundation-pad`), `ribbon-contextual-config` (tab+triggers), `ToolType` union, `useSpecialTools`/`useCanvasClickHandler` (tool + dispatch), `home-tab-draw` (button «Θεμελίωση → Μεμονωμένο πέδιλο»), `config/bim-subcategories.ts` (foundation subcats), i18n el+en.

### 🔑 2Δ PIPELINE FIX (κρίσιμο μάθημα — το 2Δ canvas έχει ΞΕΧΩΡΙΣΤΟ entity σύστημα)
Το 2Δ render ΔΕΝ διαβάζει το `SceneModel` απευθείας· περνά από `convertEntity` (`SceneModel Entity → DxfEntityUnion`) → `DxfRenderer`. Το 3Δ διαβάζει `SceneModel` κατευθείαν (γι' αυτό φαινόταν 3Δ αλλά όχι 2Δ). Προστέθηκε `foundation` σε **6 σημεία**:
1. `canvas-v2/dxf-canvas/dxf-types.ts` — `DxfEntity.type += 'foundation'` + `DxfFoundation` interface + `DxfEntityUnion`.
2. `hooks/canvas/dxf-scene-entity-converter.ts` — `case 'foundation'` (έσταζε `null` → η αρχική αιτία αορατότητας 2Δ).
3. `canvas-v2/dxf-canvas/dxf-renderer-entity-model.ts` — `case 'foundation'`.
4. `services/hit-test-entity-model.ts` — `case 'foundation'` (geometry-recompute fallback· **για hover/click selection** — μέσω `buildBimEntityModel('foundation', …)`).
5. `canvas-v2/dxf-canvas/dxf-viewport-culling.ts` — `case 'foundation'` (geometry.bbox).
6. `types/entity-bounds.ts` — `case 'foundation'` (geometry.bbox· αλλιώς EMPTY → culled 2Δ).

### Verification Slice 1
- **84/84 jest** (geometry/validator/completion/converter + Slice 0). 
- **tsc καθαρό** στα ~30 foundation αρχεία μου. **Pre-existing errors ΟΧΙ δικά σου, ΜΗΝ τα διορθώσεις:** `bim-3d/converters/mesh-to-object3d.ts:124` (gizmo agent, string→union)· `bim-3d/proposal/proposal-ghost-3d-builders.ts` ×4 + `ProposalGhost3DMount.tsx` (untracked, άλλος agent).

---

## 3. Slice 1b — ΤΟ ΕΡΓΟ ΣΟΥ: selection + parametric grips (mirror ΚΟΛΩΝΑΣ)

**Ξεκίνα σε Plan Mode** → παρουσίασε plan → έγκριση Giorgio → υλοποίηση.

### 3.1 ΠΡΩΤΑ: επιβεβαίωσε/διόρθωσε το SELECTION
Πιθανώς η επιλογή (click→highlight) **δεν** δουλεύει ακόμη ή δεν δίνει οπτική ανάδραση. Το `FoundationRenderer.hitTest()` υπάρχει και το `hit-test-entity-model.ts` case προστέθηκε (Slice 1). **Ζήτα από τον Giorgio ακριβές repro** (confirm-repro feedback memory: «δεν επιλέγεται» → τι ακριβώς· κλικ στο σώμα; highlight; ribbon tab ανοίγει;). Έλεγξε το selection pipeline για foundation:
- `computeDxfEntityGrips` / spatial index (`BoundsCalculator`) — αναγνωρίζει foundation; (column case = πρότυπο).
- Universal selection hit-test path: clicking → `EntityRendererComposite.hitTest` → `renderers.get('foundation').hitTest`. 
- Το ribbon contextual tab («Ιδιότητες Θεμελίωσης») ανοίγει όταν επιλεγεί (`resolveContextualTrigger entity.type==='foundation'` = wired).
- ΠΙΘΑΝΟ root: χωρίς grips, ίσως η επιλογή φαίνεται αλλά χωρίς λαβές δεν «χειρίζεται». Επιβεβαίωσε αν το πρόβλημα είναι ΜΟΝΟ τα grips ή και η ίδια η επιλογή.

### 3.2 ΜΕΤΑ: parametric grips (το κύριο έργο) — mirror `bim/columns/column-grips.ts` 1:1

**Πρότυπο (διάβασέ το ΟΛΟ):** `bim/columns/column-grips.ts` (`getColumnGrips` + `applyColumnGripDrag`), `bim/columns/column-grip-utils.ts` (rotation/width/depth handle positions, `projectDeltaToLocal`, `farEdgeSign*`), `hooks/useGripMovement.ts` (`ColumnGripKind` union + `GripInfo`), `hooks/grips/grip-parametric-commits.ts` (`commitColumnGripDrag`/`commitColumnCopy`), `bim/grips/grip-glyph-registry.ts` (`gripGlyphShape`).

**Pad grips (Revit-grade, mirror rectangular column — declutter: ΟΧΙ central move grip, Alt+drag μετακινεί):**
- `gripIndex 1` → `foundation-rotation` (περιστροφή γύρω από `position`, anchor invariant)
- `gripIndex 2` → `foundation-width` (resize `width`, far-edge-from-anchor, local X)
- `gripIndex 3` → `foundation-length` (resize `length`, far-edge-from-anchor, local Y)

**Files να δημιουργήσεις:**
| Concern | NEW foundation αρχείο | MIRROR από |
|---|---|---|
| Grip positions + drag transforms | `bim/foundations/foundation-grips.ts` (`getFoundationGrips`, `applyFoundationGripDrag`) | `column-grips.ts` |
| (αν χρειαστεί) handle-position helpers | reuse ή `foundation-grip-utils.ts` | `column-grip-utils.ts` |
| Tests | `bim/foundations/__tests__/foundation-grips.test.ts` | column-grips tests |

**Files να τροποποιήσεις (το CROSS-CUTTING κομμάτι — προσοχή, shared):**
- `bim/renderers/FoundationRenderer.ts` — `getGrips()`: αντί `[]`, `return getFoundationGrips(entity).map(...)` με `shape: gripGlyphShape(g.foundationGripKind)` (mirror ColumnRenderer.getGrips).
- `hooks/useGripMovement.ts` — πρόσθεσε `FoundationGripKind` union + `foundationGripKind?` πεδίο στο `GripInfo` (mirror `columnGripKind`). **Additive — μην σπάσεις column.**
- `hooks/grips/grip-parametric-commits.ts` — `commitFoundationGripDrag` (καλεί `applyFoundationGripDrag` → `UpdateFoundationParamsCommand` [ΗΔΗ έτοιμο]). Mirror `commitColumnGripDrag`.
- Τα **5 forwarding boundaries** (μάθημα από ADR-410 furniture grips — ο discriminant πρέπει να περνά ΟΛΑ): `HOT_GRIP_OP_REGISTRY`, `wrapDxfGrip`/`commitDxfGripDragModeAware`, `buildDxfDragPreview`, `buildRotateReferencePreview`, `toEntityPreviewTransform`. Ψάξε πού το `columnGripKind` ταξιδεύει και πρόσθεσε `foundationGripKind` παράλληλα.
- `bim/grips/grip-glyph-registry.ts` — glyph για `foundation-rotation` (curved arrow) / `foundation-center` (4-arrow) — mirror column.
- Ghost/preview: `computeDxfEntityGrips` (να επιστρέφει foundation grips), draw-ghost / apply-preview αν χρειάζονται foundation branch.

**Resize math (ΠΡΟΣΟΧΗ pad = width×length):** mirror `resizeWidth`/`resizeDepth` του column, αλλά το δεύτερο axis είναι `length` (όχι `depth`). Anchor-aware (`ANCHOR_OFFSETS[anchor]`, `farEdgeSignX/Y`, `projectDeltaToLocal`, `mmScaleFor`). `MIN_FOUNDATION_DIMENSION_MM` clamp.

### 3.3 Alt+drag whole-entity move (αν το κάνει η κολώνα — ADR-363 Φ1G.5)
Η κολώνα έχει declutter: central move grip ΔΕΝ emit-άρεται· Alt+drag από οποιοδήποτε grip μετακινεί όλο το entity. Δες αν θες parity (πιθανώς Revit-grade ναι). Reuse το ίδιο Alt-move μονοπάτι.

### Κανόνες/Constraints
- **ΕΚΤΟΣ ADR-040** (η θεμελίωση δεν αγγίζει micro-leaf canvas αρχιτεκτονική). Αν προσθέσεις grip-drag **preview ghost overlay** → STAGE ADR-040 (CHECK 6B/6D).
- **i18n (N.11):** τυχόν νέα labels σε `el`+`en` `dxf-viewer-shell.json` (status-bar hints για grips ζουν στο `tool-hints.json` — δες column hot-grip hints).
- **N.15:** μετά → update ADR-436 changelog + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` (γραμμή ADR-436) + `MEMORY.md` (`project_adr436_foundation.md`). ΟΧΙ adr-index.

### Πρώτα βήματα
1. Διάβασε ADR-436 (`docs/centralized-systems/reference/adrs/ADR-436-bim-foundation-discipline.md`) §4.3 (grips).
2. Διάβασε `column-grips.ts` + `column-grip-utils.ts` + `useGripMovement.ts` (ColumnGripKind) + `grip-parametric-commits.ts` (commitColumnGripDrag) + `ColumnRenderer.getGrips`.
3. Grep πού ταξιδεύει το `columnGripKind` (5 boundaries) — `grep -rn "columnGripKind"`.
4. Plan Mode → plan → έγκριση → υλοποίηση.

---

## 4. Verification στο τέλος Slice 1b
- `npx jest foundation` πράσινο + νέα `foundation-grips.test.ts`.
- `tsc --noEmit` (N.17 single) — 0 νέα errors στα δικά σου (αγνόησε τα 6 pre-existing: mesh-to-object3d:124 + proposal-ghost ×5).
- Browser (Giorgio): επίλεξε pad → εμφανίζονται grips (rotation/width/length) → σύρε → resize/rotate live + commit (undo/redo). **Ο Giorgio κάνει browser-verify + commit (git add ΜΟΝΟ δικά σου).**

---

## 5. ΕΠΟΜΕΝΑ slices (roadmap, ΜΗΝ τα κάνεις τώρα)
- **Slice 1b (ΤΩΡΑ):** selection + grips.
- **Slice 1c (deferred από Slice 1):** live placement ghost overlay (STAGE ADR-040)· stepped/sloped pad profile· column base-attach σε pad (κολώνα εδράζεται στην άνω παρειά πεδίλου).
- **Slice 1-persist:** Firestore service/hook/audit + `floorplan_foundations` collection (`COLLECTIONS`, query-service registry, `FOUNDATION_TRACKED_FIELDS`) + **rules/indexes deploy** (CHECK 3.16 ZERO-TOL — μοτίβο water-heater· Giorgio deploys). Σήμερα ο `FoundationPersistenceHost` κάνει μόνο 3D-store push → οι θεμελιώσεις ΔΕΝ persist-άρουν cross-session ακόμη.
- **Slice 2:** `strip` + `tie-beam` (line tool, mirror beam· geometry/renderer/converter είναι ΗΔΗ total over 3 kinds → πολύ μικρό delta).
- **Slice 3:** slab foundation polish (εδαφόπλακα/κοιτόστρωση below-grade + BASESLAB, **reuse slab**, ΟΧΙ νέο entity).
- **Slice 4:** BOQ/ATOE + IFC export.

---

## 6. Memory pointers
- `~/.claude/projects/C--Nestor-Pagonis/memory/project_adr436_foundation.md` (πλήρες context Slice 0+1 + roadmap).
- `MEMORY.md` → «Pending Design» → γραμμή ADR-436.
- ΜΑΘΗΜΑ (γράψε το αν δεν υπάρχει): **κάθε νέο 2Δ-renderable BIM entity χρειάζεται 6 σημεία στο DXF pipeline** (dxf-types union+interface, convertEntity, dxf-renderer-entity-model, hit-test-entity-model, viewport-culling, entity-bounds) — αλλιώς φαίνεται 3Δ αλλά όχι 2Δ / δεν επιλέγεται. Το 2Δ canvas = ξεχωριστό `DxfEntityUnion` σύστημα από το `SceneModel`.
