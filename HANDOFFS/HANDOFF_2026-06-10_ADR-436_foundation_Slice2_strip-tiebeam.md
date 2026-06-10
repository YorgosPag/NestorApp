# HANDOFF — ADR-436 Θεμελίωση → Slice 2 (strip / tie-beam line tools + Revit "Wall Foundation")

**Date:** 2026-06-10 · **Model:** Opus · **Από:** συνεδρία Slice 1-persist (DONE + deployed) · **Στόχος:** Slice 2 πλήρες σε ΕΝΑ πέρασμα (Phase 2a core line tool + Phase 2b strip-from-wall)

---

## 0. Γλώσσα & ΑΠΑΡΑΒΑΤΟΙ κανόνες (CLAUDE.md) — ΔΙΑΒΑΣΕ ΠΡΩΤΑ

- **Απαντάς ΠΑΝΤΑ στα Ελληνικά** (LANGUAGE RULE, overrides everything).
- **ΠΟΤΕ git commit/push** χωρίς ρητή εντολή Giorgio (N.(-1)). **Ο Giorgio κάνει το commit, ΟΧΙ εσύ.**
- **Shared working tree** με άλλον agent → `git add` **ΜΟΝΟ τα δικά σου** αρχεία, ΠΟΤΕ `git add -A`/`-A`.
- **ΠΟΤΕ `--no-verify`** (N.(-1.1)). Hook fail → ανέφερε, μην παρακάμψεις.
- **N.17:** ΕΝΑ `tsc` τη φορά — έλεγξε ότι δεν τρέχει άλλος ΠΡΙΝ ξεκινήσεις (`Get-CimInstance Win32_Process` filter tsc). Σειριακά, ΠΟΤΕ παράλληλα.
- **ΜΗΝ** αγγίζεις `adr-index.md` (shared tree).
- **N.11 i18n:** μηδέν hardcoded strings σε `.ts/.tsx` — ΠΡΩΤΑ keys σε `src/i18n/locales/el/*.json` **ΚΑΙ** `en/*.json`, μετά `t('key')`. ΟΧΙ `defaultValue` με literal κείμενο.
- **N.2/N.3/N.4:** μηδέν `any`/`as any`/`@ts-ignore`· semantic HTML.
- **N.14 model:** **Opus** (cross-cutting, ~20 αρχεία, 2+ domains).
- **N.0.1 ADR-driven:** code = source of truth· πρώτα διάβασε τον τρέχοντα κώδικα, μετά υλοποίησε, μετά update ADR-436 changelog + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + MEMORY (N.15), ίδιο commit (που κάνει ο Giorgio).
- **Στόχος Giorgio (ρητό):** «όπως οι μεγάλοι παίκτες / Revit, FULL ENTERPRISE + FULL SSOT». Search πριν γράψεις· reuse τα beam patterns· μηδέν διπλασιασμός· πάρε εσύ την enterprise/Revit απόφαση + ζήτα μόνο plan approval.

**ΔΙΑΒΑΣΕ:** `docs/centralized-systems/reference/adrs/ADR-436-bim-foundation-discipline.md` (ολόκληρο — §3.2 taxonomy, §3.5 hosting, §4.1 2Δ strip/tie-beam, §5.1 3Δ, §7 phasing· το changelog έχει Slice 0/1/1b/1-persist DONE).

---

## 1. Τι έγινε ΗΔΗ (μην το ξαναγράψεις)

- **Slice 0** data model· **Slice 1** `pad` full 2Δ+3Δ· **Slice 1b** selection + parametric grips (pad)· **Slice 1-persist** Firestore persistence (firestore-service/hook/audit/collection/rules/indexes — **deployed σε production `pagonis-87766`**). Όλα DONE.
- **Foundation enterprise ID** `fnd` + `generateFoundationId()` υπάρχουν.

### 🔑 ΚΡΙΣΙΜΟ — τι είναι ΗΔΗ total over 3 kinds (δουλεύει αυτόματα για strip/tie-beam, ΜΗΝ το αγγίξεις):

| Σημείο | Filepath | Κατάσταση |
|---|---|---|
| Geometry `computeFoundationGeometry` | `bim/geometry/foundation-geometry.ts` | **ΕΤΟΙΜΟ** — `buildBandFootprint()` (start→end + half-width normal, CCW) για strip/tie-beam |
| 3Δ converter `foundationToMesh` | `bim-3d/converters/foundation-to-three.ts` | **ΕΤΟΙΜΟ** — footprint-extrude, kind-agnostic |
| Validator `validateFoundationParams` | `bim/validators/foundation-validator.ts` | **ΕΤΟΙΜΟ** — zero-length-axis hardError για line kinds |
| Move `moveFoundation` | `bim/utils/bim-move-geometry.ts` | **ΕΤΟΙΜΟ** — μετακινεί start+end |
| Palette/subcats | `bim/foundations/foundation-render-palette.ts`, `config/bim-subcategories.ts` | **ΕΤΟΙΜΟ** — `FOUNDATION_KIND_STROKE/FILL` 3 kinds· `'centerline'` subcat stub-defined |
| Completion defaults `buildDefaultFoundationParams` | `hooks/drawing/foundation-completion.ts` | **ΕΤΟΙΜΟ** — `axisEnd?` override ήδη στον τύπο, kind-defaults (`DEFAULT_STRIP_WIDTH_MM` κλπ) πλήρη |
| Alt+drag move (grips) | `bim/foundations/foundation-grips.ts` `applyFoundationGripDrag` `moveCenter` | **ΕΤΟΙΜΟ** για line kinds (translate start+end) |

---

## 2. ΤΟ ΕΡΓΟ — Slice 2 (Phase 2a + 2b, ΕΝΑ πέρασμα)

**Revit-grade απόφαση (LOCKED):** όπως η Revit έχει 3 ξεχωριστά foundation tools (Isolated / **Wall** / Slab), το `kind` ορίζεται από το **tool ID στη δημιουργία** — ΟΧΙ switchable combobox (η Revit ΔΕΝ μετατρέπει isolated↔wall footing· geometrically invalid pad↔line). Reuse του **beam μηχανισμού** (tooling/snap), foundation **entity** (IfcFooting). FULL SSOT, μηδέν διπλασιασμός.

### ΠΡΟΤΥΠΟ MIRROR = ΤΟ BEAM (δοκάρι) — διάβασε ΟΛΑ πριν γράψεις:

**Tool/FSM/preview:**
- `hooks/drawing/useBeamTool.ts` — 2-click straight FSM (`idle→awaitingStart→awaitingEnd→committed`) + `from-wall` 1-click branch· γράφει preview store ΠΡΙΝ `setState` (zero-delay rubber-band).
- `hooks/drawing/beam-completion.ts` — `buildBeamEntity`/`completeBeamFromTwoClicks`.
- `bim/beams/beam-preview-store.ts` — module store `{startPoint,endPoint,kind,overrides}` (single writer, multi-reader).
- `bim/beams/beam-tool-bridge-store.ts` — 2Δ↔3Δ bridge (overrides + getSceneUnits) για WYSIWYG ghost.
- `hooks/drawing/beam-preview-helpers.ts` — `generateBeamPreview` (rubber-band: []→dot, [start]→footprint, [start,end]→full).
- `hooks/drawing/drawing-preview-generator.ts:~126` — router `tool==='beam'` → `generateBeamPreview`.

**Grips:**
- `bim/beams/beam-grips.ts` — `getBeamGrips`/`applyBeamGripDrag`· index order: `beam-start`(0), `beam-end`(1), `beam-width`(edge, perp `width/2`), `beam-rotation`(lerp .75). Axis-based.
- `hooks/grip-kinds.ts:~235` — `BeamGripKind` union.
- `hooks/grip-computation.ts:~231` — `case 'beam': grips.push(...getBeamGrips(...))`.
- `hooks/grips/grip-commit-adapters.ts:~248` — `grip.beamGripKind` → `commitBeamGripDrag`.
- `hooks/grips/grip-parametric-commits.ts:~301` — `commitBeamGripDrag` (applyBeamGripDrag + `UpdateBeamParamsCommand` isDragging=true + emit `bim:beam-params-updated`).
- `rendering/ghost/apply-entity-preview-helpers.ts:~121` — `case 'beam'` live Alt move ghost.
- `rendering/ghost/draw-ghost-entity.ts:~208` — `case 'beam'` outline.

**Registration / dispatch / ribbon:**
- `systems/tools/tool-definitions.ts:~180` — `'beam'` + `'beam-from-wall'` (category 'drawing', allowsContinuous true).
- `hooks/canvas/useCanvasClickHandler.ts:~298` — dispatch: `'beam'`→`onCanvasClick(bimPoint ortho)`, `'beam-from-wall'`→`onCanvasClick(worldPoint raw)`.
- `hooks/tools/useSpecialTools.ts:~435` — instantiate useBeamTool (ΕΝΑ instance, 2 tool IDs), `onBeamCreated→appendEntityToScene`, `setPlacementMode` ανά activeTool.
- `app/ribbon-contextual-config.ts:~250,311` — `BEAM_CONTEXTUAL_TRIGGER` για activeTool beam/beam-from-wall ή entity.type beam.
- `ui/ribbon/data/home-tab-draw.ts:~449` — group button `beamGroup` με subVariants (beam / beam-from-wall).
- `ui/ribbon/data/contextual-beam-tab.ts` — `CONTEXTUAL_BEAM_TAB` + `BEAM_CONTEXTUAL_TRIGGER` (panels kind/geometry/material/actions).
- `ui/ribbon/hooks/bridge/beam-command-keys.ts` — `BEAM_RIBBON_KEYS` SSoT.
- `ui/ribbon/hooks/useRibbonBeamBridge.ts` — getComboboxState/onComboboxChange→`UpdateBeamParamsCommand`, `getPanelVisibility` (kind-conditional panels), emit `bim:beam-params-updated`.

**Wall Foundation (Phase 2b) πρότυπο:**
- `bim/beams/beam-from-wall.ts` — `pickWallEntityAt` (hit-test wall axis) + `buildBeamFromWall` (start/end/width=τοίχου). Wall reduction = auto από `useStructuralAutoAttach` (ADR-401) μέσω `drawing:entity-created`.
- `bim-3d/viewport/use-bim3d-beam-from-wall-pick.ts` + `bim-3d/placement/BeamFromWallGhost.ts` — 3Δ pick + ghost (AbortController-gated, raycast hover, emit `bim:beam-from-wall-picked-3d` → `useBeamTool.commitForWall`).

### ΤΙ ΛΕΙΠΕΙ & ΤΙ ΝΑ ΦΤΙΑΞΕΙΣ:

**Phase 2a — core line tool (drawable + editable):**

| # | Αρχείο | Αλλαγή (mirror beam) |
|---|---|---|
| 1 | MOD `hooks/drawing/useFoundationTool.ts` | Σήμερα ΜΟΝΟ single-click pad (`idle→awaitingPosition`). Πρόσθεσε line FSM `awaitingStart→awaitingEnd` branch όταν kind∈{strip,tie-beam}· `commitTwoClickFromState` (store start, 2ο click→completeFoundationFromTwoClicks)· status text key `statusEnd`. |
| 2 | NEW `bim/foundations/foundation-preview-store.ts` | mirror `beam-preview-store.ts` (`{startPoint,endPoint,kind,overrides}`, write πριν setState). |
| 3 | NEW `hooks/drawing/foundation-preview-helpers.ts` | `generateFoundationPreview` (rubber-band band live μέσω `computeFoundationGeometry`). |
| 4 | MOD `hooks/drawing/drawing-preview-generator.ts` | branch `tool==='foundation-strip'||'foundation-tie-beam'` → `generateFoundationPreview`. |
| 5 | MOD `hooks/drawing/foundation-completion.ts` | `completeFoundationFromTwoClicks(start,end,layerId,kind,overrides,sceneUnits)` (mirror `completeBeamFromTwoClicks`). |
| 6 | MOD `hooks/canvas/useCanvasClickHandler.ts` | dispatch branches `foundation-strip`/`foundation-tie-beam` (bimPoint ortho). |
| 7 | MOD `hooks/tools/useSpecialTools.ts` | wire foundation line tools (placement mode/activeTool→kind). |
| 8 | MOD `systems/tools/tool-definitions.ts` | +`foundation-strip`, +`foundation-tie-beam` (mirror beam, allowsContinuous). |
| 9 | MOD ToolType union (όπου ορίζεται, grep `'foundation-pad'`). | +2 tool IDs. |
| 10 | MOD `app/ribbon-contextual-config.ts` | contextual trigger για τα νέα tool IDs (foundation tab). |
| 11 | MOD `ui/ribbon/data/home-tab-draw.ts` | foundation group → 3 κουμπιά: Πέδιλο / Πεδιλοδοκός (strip) / Συνδετήρια (tie-beam). |
| 12 | MOD `ui/ribbon/data/contextual-foundation-tab.ts` + `ui/ribbon/hooks/useRibbonFoundationBridge.ts` + `ui/ribbon/hooks/bridge/foundation-command-keys.ts` | panel visibility ανά kind: line kinds → δείξε `width`, κρύψε `length`/`rotation`/`anchor`. (ΟΧΙ kind-switch combobox — kind fixed by tool.) |
| 13 | MOD `bim/foundations/foundation-grips.ts` | `getFoundationGrips`: για line kinds emit `foundation-start`/`foundation-end`(vertices) + `foundation-width`(edge perp). `applyFoundationGripDrag`: line drag transforms (mirror beam-grips). Κράτα pad branch ως έχει. |
| 14 | MOD `hooks/grip-kinds.ts` | `FoundationGripKind` += `foundation-start`/`foundation-end`/`foundation-width`. Οι 16 forwarding boundaries του Slice 1b ρέουν αυτόματα — **έλεγξε** grip-glyph-registry (glyph για νέα kinds), grip-projections, apply-entity-preview, grip-parametric-commits `commitFoundationGripDrag` (να καλύπτει line grips). |
| 15 | MOD `bim/renderers/FoundationRenderer.ts` | centerline dash-dot pass για `kind!=='pad'` (subcat `'centerline'` ήδη stub στο taxonomy). |
| 16 | i18n el+en | status `statusStart`/`statusEnd`, tool labels (Πεδιλοδοκός/Συνδετήρια), τυχόν panel labels. |

**Phase 2b — Revit "Wall Foundation" (strip-from-wall) + tie-beam pad-snap:**

| # | Αρχείο | Αλλαγή |
|---|---|---|
| 17 | NEW `bim/foundations/foundation-from-wall.ts` | `pickWallEntityAt` + `buildStripFromWall` (start/end/width=τοίχου, kind='strip', topElevation default). mirror `beam-from-wall.ts`. |
| 18 | MOD tool-definitions + ToolType + dispatch + ribbon | +`foundation-strip-from-wall` (1-click pick) + home-tab κουμπί «Πεδιλοδοκός από τοίχο». |
| 19 | NEW (προαιρετικό 3Δ) `bim-3d/.../use-bim3d-foundation-from-wall-pick.ts` + ghost | mirror beam-from-wall 3Δ. **Μπορεί να μπει σε δεύτερο πέρασμα** αν το context πιέσει — δήλωσέ το ρητά. |
| 20 | tie-beam pad-snap | endpoints snap σε pad centroids — reuse `getGlobalSnapEngine`/`findSnapPoint` (όπως opening drag). Πρόσθεσε pad centroids ως snap candidates. |

---

## 3. Pre-commit BLOCK gotchas
- **i18n CHECK 3.8** (RATCHET): νέα keys ΠΡΩΤΑ στα locale JSONs el+en.
- **ADR-040 CHECK 6B/6D:** ο `FoundationRenderer.ts` + τυχόν preview/ghost αρχεία = canvas drawing → STAGE το ADR-436 changelog μαζί (το ίδιο έγινε στο Slice 1b). Foundation ΔΕΝ αγγίζει micro-leaf orchestrators (εκτός preview ghost) — μην βάλεις `useSyncExternalStore` σε orchestrators.
- **File size N.7.1:** ≤500 γρ/αρχείο, ≤40 γρ/function. Αν το `useFoundationTool.ts` φουσκώσει → extract helper (mirror beam helpers split).
- **N.6:** entity creation περνά από `createFoundation` factory (ήδη). Καμία addDoc.
- **Dead-code CHECK 3.22:** κάθε νέα pure fn να καταναλώνεται.

## 4. Verification
- `npx jest foundation` πράσινο + νέα tests (line grips, line FSM two-click, foundation-from-wall, preview helper).
- `tsc --noEmit` (N.17 single, έλεγξε ότι δεν τρέχει άλλος ΠΡΩΤΑ) — 0 νέα errors στα δικά σου.
- **Browser (Giorgio):** διάλεξε «Πεδιλοδοκός» → 2 clicks → σχεδιάζεται band (διακεκομμένο + centerline)· grips start/end/width· 3Δ box· «από τοίχο» → κλικ σε τοίχο → strip στον άξονα. tie-beam → 2 clicks, endpoints snap σε πέδιλα.

## 5. N.15 (μετά, ίδιο commit που κάνει ο Giorgio)
ADR-436 changelog (Slice 2 entry) + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` (γραμμή ADR-436 → +Slice 2) + `~/.claude/projects/C--Nestor-Pagonis/memory/project_adr436_foundation.md` + MEMORY.md index. **ΟΧΙ adr-index.**

## 6. Roadmap μετά
Slice 1c (stepped/sloped pad + column base-attach σε pad)· Slice 3 (slab foundation polish — εδαφόπλακα/κοιτόστρωση below-grade + BASESLAB, reuse slab)· Slice 4 (BOQ/ATOE + IFC export IfcFooting)· Phase 2 (pile-cap/pile).

## 7. Memory pointers
- `~/.claude/projects/C--Nestor-Pagonis/memory/project_adr436_foundation.md` (πλήρες context όλων των slices).
- `~/.claude/projects/C--Nestor-Pagonis/memory/reference_2d_dxf_pipeline_bim_entity.md` (6 render + 3 selection σημεία ανά νέο BIM entity).
- `~/.claude/projects/C--Nestor-Pagonis/memory/feedback_make_revit_grade_decisions_yourself.md`.
