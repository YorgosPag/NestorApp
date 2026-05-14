# ADR-348: Scale Command (Κλιμάκωση)

**Status:** ✅ APPROVED  
**Date:** 2026-05-15  
**Domain:** DXF Viewer — Modify Tools  
**Shortcut:** `SC`  
**Ribbon:** Home → Modify → Κλιμάκωση  

---

## Context

The DXF Viewer ribbon (ADR-345) includes a "Κλιμάκωση" (Scale) button in the Modify section, currently marked `comingSoon: true`. Scale is one of the five core modify operations in every professional CAD system (Move, Copy, Rotate, **Scale**, Mirror).

### Industry Research (2026-05-15)

Research across AutoCAD, BricsCAD, progeCAD, GstarCAD, nanoCAD confirms strong convergence on the Scale command pattern. Procore and Bluebeam Revu were excluded from this analysis — they implement document-level calibration ("how many mm = 1px"), not entity-level geometric transformation.

**Industry consensus (5/5 CAD platforms agree):**

| Feature | AutoCAD | BricsCAD | progeCAD | GstarCAD | nanoCAD |
|---------|---------|---------|---------|---------|---------|
| Select → Base Point → Scale Factor | ✅ | ✅ | ✅ | ✅ | ✅ |
| Live preview during mouse drag | ✅ | ✅ | ✅ | ✅ | ✅ |
| Reference mode (R) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Copy mode (C) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Keyboard input (no click on field) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Uniform scale only (X=Y) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Non-uniform scale (X≠Y) | ❌ | ❌ | ❌ | ✅ only | ❌ |

**Non-uniform scaling** (different factor for X and Y): only GstarCAD implements it natively (FREESCALE command). All other major platforms require inserting a block with separate X/Y scale. This is **not an industry standard feature** — not implemented in Phase 1.

---

## Core Mathematics

### Uniform Scale (default)

```
new_position = base_point + (old_position - base_point) × scale_factor
```

Single scalar `scale_factor` — X and Y grow/shrink equally.

### Non-Uniform Scale (X≠Y) — CONFIRMED Phase 1

```
new_x = base_x + (old_x - base_x) × sx
new_y = base_y + (old_y - base_y) × sy
```

Two independent factors `sx` (horizontal) and `sy` (vertical).

**UX flow for non-uniform:**
1. User activates non-uniform sub-mode via toggle key (e.g. `N`) or status bar button
2. Prompted for `sx` first → ENTER
3. Prompted for `sy` second → ENTER (or drag second handle)
4. Live preview shows distorted shape in real-time

**Entity type conversion (critical — SSOT):**

When `sx ≠ sy`, some entity types must change to preserve geometric correctness:

| Original | After non-uniform scale | Notes |
|----------|------------------------|-------|
| `CIRCLE` | **ELLIPSE** | `radius → majorAxis × sx`, `ratio = sy/sx` |
| `ARC` | **ELLIPTICAL ARC** (ELLIPSE with startAngle/endAngle) | Same conversion |
| `ELLIPSE` | `ELLIPSE` (updated major axis + ratio) | No type change |
| `LINE`, `LWPOLYLINE`, `SPLINE`, `POINT` | Same type | Only coordinates change |
| `TEXT` | `TEXT` with `xScaleFactor` property set to `sx/sy` | Height scales by `sy` |
| `MTEXT` | `MTEXT` with column width adjusted | Height scales by `sy` |
| `INSERT` (block ref) | `INSERT` with separate `xScale=sx`, `yScale=sy` | Blocks already support X/Y scale |
| `HATCH` | `HATCH` with vertices transformed | Pattern deforms accordingly |

**SSOT for entity conversion**: `scale-entity-transform.ts` is the single file responsible for all type-changing conversions. No inline conversion logic elsewhere.

For each entity:
- `base_point` stays fixed (invariant point of the transformation)
- Every vertex, center, radius moves/grows/shrinks by the respective factor
- `scale_factor < 0` = mirror + scale (CONFIRMED — AutoCAD behavior)
- `scale_factor = 0` = INVALID — prompt error: `scaleTool.invalidZeroFactor`
- Validation: `factor !== 0` only; negative values fully allowed

---

## Decision

Implement the `scale` command in **2 phases**.

### Phase 1 — Core Scale (MVP complete feature)

**UX Flow:**

```
PHASE 1: SELECTION
  → Entities can be pre-selected (before activating command)  [AutoCAD pattern]
  → OR user activates command then selects entities
  → ENTER / right-click to confirm selection

PHASE 2: BASE POINT
  → Prompt: "Ορίστε σημείο βάσης:"
  → Interactive click with full snap support (endpoint, midpoint, center, quadrant, intersection)
  → OR keyboard coordinate input

PHASE 3: SCALE FACTOR
  → Sub-mode A — DIRECT FACTOR
      User types a number (e.g. "2") → ENTER
      Live preview: moving mouse away from base point shows real-time scaled preview
      Distance from base point maps to scale factor proportionally
  
  → Sub-mode B — REFERENCE [Phase 1 — CONFIRMED]
      User types "R" → ENTER (or clicks Reference button in status bar)
      Click point 1 on reference line (existing object) — snap active
      Click point 2 on reference line (defines reference length) — snap active
      Live preview: ghost line shows reference distance as user moves mouse
      Input new length numerically OR drag mouse to new length (live preview)
      System computes: scale_factor = new_length / reference_length
      SSoT: reference_length calculation in scale-reference-calc.ts (no inline math)
  
  → Sub-mode C — COPY MODE [Phase 1 — CONFIRMED]
      Toggle "C" key → ENTER (or status bar button) before entering scale factor
      Original entities remain untouched in place
      New scaled copies created as independent entities (same IDs structure, new IDs via enterprise-id.service)
      SSoT: copy creation in ScaleCommand.execute() — single code path, no inline duplication logic
      Undo: single Ctrl+Z removes ALL copies created in that operation

PHASE 4: CONFIRM
  → ENTER for numeric input confirmation
  → Click for mouse-driven confirmation
  → ESC at any point = cancel, no changes applied

PHASE 5: COMPLETION [Industry standard — CONFIRMED]
  → Command ENDS → tool returns to idle / selection cursor
  → ENTER or SPACE immediately after = repeat last command (universal CAD pattern)
  → No auto-repeat loop

UNDO: Single Ctrl+Z step reverses the entire scale operation
```

### Grip-Based Scaling — CONFIRMED Phase 1

**Spacebar cycle** (when a grip is hot/active):
```
Stretch → Move → Rotate → Scale → Mirror → (back to Stretch)
```

**Grip Scale UX:**
1. User selects entity (no command active) → blue grips appear
2. Click on a grip → grip turns red (hot)
3. Press SPACEBAR repeatedly until "Scale" mode is active (status bar shows mode)
4. Move mouse → live preview of scaling around the hot grip as base point
5. Click to confirm OR type number → ENTER for precise factor
6. ESC at any point = cancel

**SSOT integration:**
- Grip state machine extended with `GripMode` enum: `Stretch | Move | Rotate | Scale | Mirror`
- `GripScaleMode` shares `ScaleToolStore` preview logic — no duplicate preview code
- `ScaleCommand` is reused for the undo step (same command, different trigger path)
- `scale-entity-transform.ts` is the single transform SSOT for both ribbon command and grip mode

### Phase 2 — Future (post Q&A)

No items deferred to Phase 2. All 4 confirmed features (Reference, Copy, Non-uniform, Grip) are in Phase 1.

---

## 🚨 SSOT + GOL IMPLEMENTATION MANDATE

**BEFORE writing a single line of code**, the implementing agent MUST:

### Step 1 — Read centralized systems index
```
docs/centralized-systems/README.md
docs/centralized-systems/reference/adr-index.md
```

### Step 2 — Grep for existing systems that overlap with Scale

| System to check | Why |
|----------------|-----|
| Existing undo/redo command system | `ScaleCommand` must implement the canonical `UndoableCommand` interface — do NOT create a new one |
| Existing snap engine | Base point + reference point clicks use the snap system SSoT — do NOT write inline snap logic |
| Existing entity store / entity mutation API | Scale modifies entities — use the canonical store mutation API |
| Existing layer lock check utilities | Locked layer filter must use the canonical layer-lock check — do NOT inline |
| Existing grip system | Grip-based scale (Q4) extends the existing grip state machine — do NOT create a parallel system |
| Existing keyboard input buffer | `useCanvasKeyHandler` — numeric key capture is already centralized |
| Existing preview overlay pattern | `ScalePreviewOverlay` follows ADR-040 micro-leaf pattern exactly |
| `enterprise-id.service.ts` | Copy mode creates new entities → IDs from this service only |
| `toolHintOverrideStore` | All status bar prompts through this SSOT only |
| `tool-hints.json` (en + el) | All i18n strings added here FIRST, before code |

### Step 3 — GOL checklist (CLAUDE.md N.7.2)

Before implementing, answer internally:

| # | Question | Required answer |
|---|----------|----------------|
| 1 | Race condition in preview? | No — ScaleToolStore is module-level, no React state |
| 2 | Idempotent execute/undo? | Yes — snapshot stored before execute |
| 3 | Single source of truth for entity transform? | Yes — `scale-entity-transform.ts` only |
| 4 | Layer lock check duplicated? | No — one utility, called once in `useScaleTool` |
| 5 | Copy IDs from enterprise-id.service? | Yes — no inline `crypto.randomUUID()` |
| 6 | File size ≤ 500 lines? | Yes — split if exceeded |
| 7 | Functions ≤ 40 lines? | Yes — extract helpers if exceeded |

### Step 4 — Declare at end of implementation

```
✅ Google-level: YES — [reason]
⚠️ Google-level: PARTIAL — [gap]
❌ Google-level: NO — [what needs change]
```

---

## Architecture

### Command Registration

```typescript
// Discriminated union — handles both uniform and non-uniform
type ScaleParams =
  | { mode: 'uniform'; factor: number }
  | { mode: 'non-uniform'; sx: number; sy: number };

// src/subapps/dxf-viewer/systems/commands/scale-command.ts
export class ScaleCommand implements UndoableCommand {
  readonly type = 'scale';
  // Store originals for undo — entity type may change (circle→ellipse)
  private originalEntities: Map<DxfEntityId, DxfEntity>;

  constructor(
    private entities: DxfEntityId[],
    private basePoint: WorldPoint,
    private params: ScaleParams,
    private copyMode: boolean,
  ) {}

  execute(store: DxfEntityStore): void { /* apply transform via scale-entity-transform.ts */ }
  undo(store: DxfEntityStore): void { /* restore from originalEntities snapshot (handles type reversion) */ }
}
```

### State Machine

The scale command uses a linear state machine:

```
IDLE → SELECTING → BASE_POINT → SCALE_INPUT → DONE
         ↑ ESC         ↑ ESC          ↑ ESC
         └─────────────┴──────────────┘
```

Sub-states of SCALE_INPUT:
```
SCALE_INPUT → DIRECT_FACTOR (default, uniform)
           → DIRECT_X (after "N" — non-uniform sx input)
           → DIRECT_Y (after sx confirmed — sy input)
           → REFERENCE_LINE_P1_X (after "R" in uniform OR non-uniform X phase)
           → REFERENCE_LINE_P2_X (after P1_X click)
           → REFERENCE_NEW_LENGTH_X (after P2_X click)
           → REFERENCE_LINE_P1_Y (non-uniform only — after X confirmed)
           → REFERENCE_LINE_P2_Y (after P1_Y click)
           → REFERENCE_NEW_LENGTH_Y (after P2_Y click)
```

Non-uniform + Reference combination (enterprise mode — CONFIRMED Option A):
- Two independent reference lines: one for X axis, one for Y axis
- system computes: sx = new_x / ref_length_x, sy = new_y / ref_length_y
- Reference lines for X and Y are independent — user picks 2 points per axis
- SSoT: `scale-reference-calc.ts` handles both `computeUniformRef(p1,p2,newLen)` and `computeNonUniformRef(p1x,p2x,p1y,p2y,newLenX,newLenY)`

### Scale Tool Store

```typescript
// src/subapps/dxf-viewer/systems/scale/ScaleToolStore.ts
interface ScaleToolState {
  phase: 'idle' | 'selecting' | 'base_point' | 'scale_input';
  subPhase:
    | 'direct'                  // uniform: typing number
    | 'direct_x'               // non-uniform: typing sx
    | 'direct_y'               // non-uniform: typing sy (after sx confirmed)
    | 'ref_p1_x' | 'ref_p2_x' | 'ref_new_x'  // reference for X axis
    | 'ref_p1_y' | 'ref_p2_y' | 'ref_new_y'; // reference for Y axis (non-uniform)
  nonUniformMode: boolean;
  selectedEntityIds: DxfEntityId[];
  basePoint: WorldPoint | null;
  // Reference points — separate per axis
  refP1x: WorldPoint | null; refP2x: WorldPoint | null;
  refP1y: WorldPoint | null; refP2y: WorldPoint | null;
  // Live preview values
  currentSx: number;
  currentSy: number;
  copyMode: boolean;
}
```

### Entity Transform — per DXF entity type

| Entity | What scales |
|--------|------------|
| `LINE` | `start`, `end` points |
| `ARC` | `center` point, `radius` |
| `CIRCLE` | `center` point, `radius` |
| `LWPOLYLINE` | all `vertices`; `width` per segment scales with factor |
| `SPLINE` | `controlPoints`, `fitPoints` |
| `TEXT` | `insertionPoint`; `height` × factor |
| `MTEXT` | `insertionPoint`; `height` × factor |
| `INSERT` (block ref) | `insertionPoint` from base; inherits block's geometry |
| `HATCH` | `boundaryPaths` vertices; pattern scale × factor |
| `ELLIPSE` | `center`, `majorAxis` endpoint; `ratio` unchanged |
| `POINT` | position |
| `DIMENSION` | definition points (geometry) |

**Annotative entities** (text with `annotative: true`, annotative dimensions): only `insertionPoint` scales; display size is governed by viewport annotation scale — NOT changed by this command.

### Live Preview

Preview uses the ADR-040 micro-leaf subscriber pattern:

```
ScaleToolStore (pub/sub, no React) 
  → ScalePreviewOverlay (SVG canvas layer leaf subscriber)
  → Renders ghost outline of scaled entities in real-time
  → Updated on every mousemove (throttled 16ms = 60fps)
```

Preview renders as semi-transparent overlay on top of the DXF canvas (same pattern as lasso preview).

### Keyboard Input

Keyboard input captured via the existing `useCanvasKeyHandler` system (ADR-040 compliant). Numeric keys build a string buffer; ENTER confirms; ESC cancels. No DOM input element needed (same pattern as other commands).

### Snap Integration

Base point selection and Reference mode point selection use the existing SnapEngine (centralized, ADR-XXX). All snap types active: endpoint, midpoint, center, quadrant, intersection, perpendicular, nearest.

---

## Files to Create

| File | Lines | Role |
|------|-------|------|
| `systems/scale/ScaleToolStore.ts` | ~80 | State machine + pub/sub store |
| `systems/scale/scale-entity-transform.ts` | ~120 | Per-entity transform logic |
| `systems/scale/scale-reference-calc.ts` | ~30 | Reference mode math |
| `systems/commands/ScaleCommand.ts` | ~60 | Undoable command |
| `components/dxf-layout/ScalePreviewOverlay.tsx` | ~50 | Live preview leaf |
| `hooks/tools/useScaleTool.ts` | ~80 | Orchestrates state machine |

---

## Files to Modify

| File | Change |
|------|--------|
| `ui/ribbon/data/home-tab-modify.ts` | Remove `comingSoon: true` from scale button |
| `systems/tools/ToolStateManager.ts` | Register `scale` tool |
| `hooks/canvas/useCanvasClickHandler.ts` | Route clicks to scale tool phases |
| `hooks/canvas/useCanvasMouseMove.ts` | Feed mouse position to ScaleToolStore for preview |
| `components/dxf-layout/CanvasLayerStack.tsx` | Mount `ScalePreviewOverlay` |

---

## Open Design Decisions (Q&A with Giorgio)

| # | Question | Options | Status |
|---|----------|---------|--------|
| Q1 | Reference mode in Phase 1 or Phase 2? | Phase 1 / Phase 2 | ✅ Phase 1 |
| Q2 | Copy mode in Phase 1 or Phase 2? | Phase 1 / Phase 2 | ✅ Phase 1 |
| Q3 | Non-uniform scaling (X≠Y)? | Yes / No / Future | ✅ Phase 1 (circle→ellipse conversion in SSOT) |
| Q4 | Grip-based scaling (spacebar cycle through grip modes)? | Yes / No | ✅ Phase 1 (GripScaleMode in grip state machine) |
| Q5 | Prompt display system? | Existing ToolbarStatusBar SSoT | ✅ Existing SSoT — toolHintOverrideStore.setOverride() |

---

### User Prompts — SSOT: ToolbarStatusBar

The status bar below the ribbon already exists and is the canonical prompt channel.

**SSOT:** `hooks/toolHintOverrideStore.ts` — `toolHintOverrideStore.setOverride(text | null)`  
**Display:** `ui/toolbar/ToolbarStatusBar.tsx` — reads via `useSyncExternalStore`, renders below ribbon  
**i18n:** All prompt strings in `src/i18n/locales/{en|el}/tool-hints.json` under `scaleTool.*` namespace

```typescript
// useScaleTool.ts — prompt update pattern (same as useMoveTool.ts)
useEffect(() => {
  if (!isActive) { toolHintOverrideStore.setOverride(null); return; }
  const key = phaseToPromptKey[phase]; // e.g. 'scaleTool.selectObjects'
  toolHintOverrideStore.setOverride(i18next.t(`tool-hints:${key}`));
  return () => { toolHintOverrideStore.setOverride(null); };
}, [isActive, phase]);
```

**Prompt sequence (i18n keys):**

| Phase | Key | Greek text |
|-------|-----|-----------|
| selecting | `scaleTool.selectObjects` | Επιλέξτε αντικείμενα → ENTER |
| base_point | `scaleTool.specifyBasePoint` | Ορίστε σημείο βάσης |
| scale_input.direct | `scaleTool.enterScaleFactor` | Δώστε συντελεστή κλιμάκωσης \[C=Αντιγραφή / R=Αναφορά / N=Ανομοιόμορφη\] |
| scale_input.ref_p1 | `scaleTool.refPoint1` | Κάντε κλικ στο 1ο σημείο αναφοράς |
| scale_input.ref_p2 | `scaleTool.refPoint2` | Κάντε κλικ στο 2ο σημείο αναφοράς |
| scale_input.ref_new | `scaleTool.refNewLength` | Δώστε νέο μήκος |
| scale_input.nonuniform_x | `scaleTool.enterScaleX` | Δώστε συντελεστή Χ (οριζόντιος) |
| scale_input.nonuniform_y | `scaleTool.enterScaleY` | Δώστε συντελεστή Υ (κατακόρυφος) |

---

## Constraints

- ADR-040: ScalePreviewOverlay MUST be a micro-leaf subscriber, NOT rendered from CanvasSection/CanvasLayerStack orchestrators
- ADR-040: No `useSyncExternalStore` in CanvasSection or CanvasLayerStack
- No entity modification during preview — preview is read-only overlay
- ESC always cancels without side effects
- Single undo step for entire operation
- Shortcut: `SC` (two-key sequence, consistent with AutoCAD)
- **Locked layers — Option B CONFIRMED**: entities on locked layers are silently filtered out of the working set before the command executes. After filtering, if skipped count > 0, status bar shows: `scaleTool.lockedLayerSkipped` = `«X αντικείμενα σε κλειδωμένα επίπεδα παραλείφθηκαν»`. If ALL selected entities are on locked layers → command aborts with `scaleTool.allLockedAbort` = `«Όλα τα αντικείμενα είναι σε κλειδωμένα επίπεδα — ακύρωση»`
- Layer lock check is in `useScaleTool.ts` BEFORE phase transitions; filtering is SSOT (no inline layer checks in ScaleCommand)

---

## Changelog

| Date | Version | Change |
|------|---------|--------|
| 2026-05-15 | 0.1 | Initial draft — industry research complete, Q&A in progress |
| 2026-05-15 | 0.2 | Q1 confirmed: Reference mode included in Phase 1 (SSOT+GOL) |
| 2026-05-15 | 0.3 | Q2 confirmed: Copy mode included in Phase 1 (SSOT+GOL) |
| 2026-05-15 | 0.4 | Q3 confirmed: Non-uniform scale (X≠Y) in Phase 1; circle→ellipse SSOT conversion |
| 2026-05-15 | 0.5 | Q4 confirmed: Grip-based scaling (spacebar cycle) in Phase 1; GripScaleMode reuses ScaleCommand |
| 2026-05-15 | 0.6 | Q5 confirmed: Existing ToolbarStatusBar SSoT (toolHintOverrideStore); prompt i18n keys defined |
| 2026-05-15 | 0.7 | Q6 confirmed: Non-uniform+Reference = Option A (dual independent reference lines per axis). ScaleCommand uses discriminated union ScaleParams. State machine updated with full sub-states. |
| 2026-05-15 | 0.8 | Q7 confirmed: Negative scale factor allowed (mirror+scale, AutoCAD behavior); only factor=0 rejected |
| 2026-05-15 | 0.9 | Q8 confirmed: Locked layers → warning + skip (Option B); all-locked = abort; layer check SSOT in useScaleTool |
| 2026-05-15 | 1.0 | Q9 confirmed: Command ends after completion (5/5 CAD industry standard); ENTER/SPACE repeats last command |
| 2026-05-15 | 1.1 | Added SSOT+GOL Implementation Mandate section with pre-code checklist and GOL declaration requirement |
| 2026-05-15 | 1.2 | **IMPLEMENTED** — Phase 1 complete. New files: `scale-entity-transform.ts`, `scale-reference-calc.ts`, `ScaleEntityCommand.ts`, `ScaleToolStore.ts`, `useScaleTool.ts`, `useScalePreview.ts`. Modified: `home-tab-modify.ts` (removed comingSoon), `ToolStateManager.ts` (+scale), `canvas-click-types.ts`, `useCanvasClickHandler.ts`, `useCanvasKeyboardShortcuts.ts`, `commands/index.ts`, `hooks/tools/index.ts`, `canvas-layer-stack-leaves.tsx` (ScalePreviewMount), `canvas-layer-stack-types.ts` (+scalePreview), `CanvasLayerStack.tsx` (+scale prop), `CanvasSection.tsx` (wired useScaleTool). i18n keys added to el/en tool-hints.json. |
