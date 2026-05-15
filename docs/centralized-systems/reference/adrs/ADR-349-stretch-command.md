# ADR-349: Stretch Command (Επιμήκυνση)

**Status:** 🚧 Phase 1a + 1b.1 + 1b.2 + 1c-A + 1c-B1 + 1c-B2 + 1c-B3 IMPLEMENTED (2026-05-15). Phase 1d audit pending.
**Date:** 2026-05-15
**Domain:** DXF Viewer — Modify Tools
**Shortcut:** `S`
**Ribbon:** Home → Modify → Επιμήκυνση
**Related:** ADR-345 (DXF Ribbon Interface), ADR-348 (Scale Command), ADR-040 (Preview Canvas Performance)

---

## Context

The DXF Viewer ribbon (ADR-345) includes a **Stretch** (Επιμήκυνση) button in the Modify panel (`HOME_MODIFY_PANEL` flyout row), currently marked `comingSoon: true`. STRETCH is one of the core modify operations in every professional CAD system — distinct from MOVE (rigid translation), SCALE (uniform proportional resize), and LENGTHEN (1-D length adjustment).

STRETCH's defining trait: a **crossing-window selection** captures vertices; vertices inside the window translate by a displacement vector, vertices outside stay anchored, and entities deform accordingly.

### Industry Research (2026-05-15)

Research across AutoCAD, BricsCAD, progeCAD, GstarCAD, nanoCAD confirms total convergence on the STRETCH command pattern. DraftSight and ZWCAD follow the same model.

**Industry consensus (5/5 CAD platforms agree):**

| Feature | AutoCAD | BricsCAD | progeCAD | GstarCAD | nanoCAD |
|---------|---------|----------|----------|----------|---------|
| Crossing window required for stretch | ✅ | ✅ | ✅ | ✅ | ✅ |
| Window selection degenerates to MOVE | ✅ | ✅ | ✅ | ✅ | ✅ |
| Crossing polygon (CP) selection | ✅ | ✅ | ✅ | ✅ | ✅ |
| Displacement (D) option | ✅ | ✅ | ✅ | ✅ | ✅ |
| Copy modifier in STRETCH command | ❌ | ❌ | ❌ | ❌ | ❌ |
| Copy modifier via grip-stretch | ✅ | ✅ | ✅ | ✅ | ✅ |
| Associative dimensions auto-update | ✅ | ✅ | ✅ | ✅ | ✅ |
| Associative hatches follow boundary | ✅ | ✅ | ✅ | ✅ | ✅ |
| Circles/ellipses move only if center inside | ✅ | ✅ | ✅ | ✅ | ✅ |
| Blocks move only if insertion point inside | ✅ | ✅ | ✅ | ✅ | ✅ |
| Text moves only if insertion point inside | ✅ | ✅ | ✅ | ✅ | ✅ |
| Grip-stretch (single vertex equivalence) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Locked layers silently ignored | ✅ | ✅ | ✅ | ✅ | ✅ |
| Multi-window (MSTRETCH Express Tool) | ✅ Express | ✅ Express | ❌ | ❌ | ❌ |
| Reference mode | ❌ | ❌ | ❌ | ❌ | ❌ |

**Reference mode**: STRETCH has no Reference option in any vendor — it is purely vector-based (unlike SCALE).

**Copy in command**: not part of the STRETCH command itself in any vendor. Copy semantics belong to **grip-stretch** (typing `C` while grip is hot). Not implemented as a STRETCH command option in Phase 1.

**Multi-window (MSTRETCH)**: AutoCAD/BricsCAD ship it as an Express Tool — accepts multiple crossing windows/polygons in one invocation, processed as the union of captured vertex sets with a single displacement. 2/5 vendor convergence — treated as power user feature, **Q&A item Q1**.

---

## Core Mathematics

STRETCH applies a **displacement vector** `Δ = (P2 - P1)` to every vertex `v` whose evaluation against the crossing window returns `inside`:

```
v_new = (Δ + v)   if v ∈ CrossingWindow
v_new = v         otherwise
```

For composite entities (polylines, splines, hatches), vertex-level evaluation is independent — each control point is tested against the window separately, producing partial deformation when some vertices are inside and others outside.

Entities with **no addressable vertices** (circles, ellipses, blocks, text) use their **anchor point** (center, insertion point) as the single evaluation point:

```
entity_translates_rigidly   if anchor ∈ CrossingWindow
entity_ignored              otherwise
```

---

## Decision

Implement the `stretch` command in **a single complete phase** (per `feedback_completeness_over_mvp`: no MVP/phased variants).

### Phase 1 — Full STRETCH

**UX Flow:**

```
PHASE 1: SELECTION
  → Crossing window (right-to-left drag, green outline) — REQUIRED for stretch
  → Crossing polygon ("CP" keyword) — alternative
  → Window selection (left-to-right) → degenerates to MOVE on captured entities
  → Single-pick → entity moves as whole (no deformation)
  → Pre-selection accepted (entities selected before command activation)
  → Add/Remove modifiers in selection phase
  → ENTER / right-click to confirm selection
  → ESC at any point = cancel

PHASE 2: BASE POINT
  → Prompt: "Ορίστε σημείο βάσης ή [Μετατόπιση(Μ)]:"
  → Click base point with full snap support (endpoint, midpoint, center, etc.)
  → OR type "Μ" / "D" → enter Displacement mode (skip to numeric input)
  → OR keyboard coordinate input "x,y"

PHASE 3: SECOND POINT / DISPLACEMENT
  → Standard: click second point → displacement = (P2 - P1)
  → Live preview: rubber-band ghost of deformed geometry tracks cursor
  → Dynamic input boxes show current distance + angle near cursor (if DYNMODE)
  → ORTHO (F8) constrains to H/V axis
  → POLAR snaps to configured angles
  → OSNAP active for vertex-to-vertex precision
  → OR keyboard input "@dx,dy" relative coordinates

PHASE 4: CONFIRM
  → Click confirms second point
  → ENTER confirms keyboard-entered numeric values
  → ESC at any point = cancel, no changes

UNDO: Single Ctrl+Z step reverses the entire stretch operation
```

### Grip-Based Stretch — CONFIRMED Phase 1

STRETCH is the **default** grip mode (per industry standard, all 5 vendors).

**Spacebar cycle** (when a grip is hot/active, ADR-348 pattern):
```
Stretch → Move → Rotate → Scale → Mirror → (back to Stretch)
```

**Grip Stretch UX (default mode):**
1. User selects entity (no command active) → blue grips appear
2. Click on a grip → grip turns red (hot)
3. Default mode is STRETCH (no spacebar needed)
4. Move mouse → live preview of single-vertex stretch
5. Click to confirm OR type "@dx,dy" → ENTER for precise displacement
6. Type "C" + ENTER → COPY mode: original stays, multiple new copies at each clicked point
7. ESC at any point = cancel

**SSOT integration with ADR-348 grip framework:**
- Grip state machine already extended with `GripMode` enum: `Stretch | Move | Rotate | Scale | Mirror`
- `GripStretchMode` shares `StretchToolStore` preview logic — single SSoT
- `StretchCommand` is reused for the undo step from both ribbon command and grip path
- `stretch-vertex-classifier.ts` is the single SSoT for vertex-in-window evaluation

---

## 🚨 Implementation Mandate (SSOT + Google-Level) — NON-NEGOTIABLE

**Before writing a single line of code**, the implementing agent MUST:

1. **Search all centralized systems first.** Read `docs/centralized-systems/README.md` and grep `.ssot-registry.json` for every module touched by this ADR (snap engine, command history, audit service, entity store, grip state machine, lasso polygon SSoT, toolHintOverrideStore, notification keys, enterprise-id service, etc.). If a centralized system already covers a concern, **use it**. Never re-implement.

2. **Reject duplicates and scattered files.** If a similar utility, hook, store, or component already exists, **extend it**, do not fork. Forks become SSoT violations and trigger CHECK 3.7 / 3.18 pre-commit ratchet failures.

3. **One source of truth per concern.** Every piece of logic listed in this ADR has exactly one canonical location:
   - Vertex enumeration → `stretch-vertex-classifier.ts` (this ADR)
   - Crossing window capture → `stretch-crossing-capture.ts` (this ADR)
   - Per-entity transform → `stretch-entity-transform.ts` (this ADR)
   - Dimension defpoint resolution → `dimension-defpoint-resolver.ts` (this ADR)
   - Grip menu options → `grip-menu-resolver.ts` (this ADR)
   - Lengthen math → `lengthen-axial-stretch.ts` (this ADR)
   - Arc radius math → `arc-radius-edit.ts` (this ADR)
   - Snap engine, audit service, command history, entity store, notification keys, enterprise IDs, status-bar prompts, lasso polygon → **existing SSoTs only** (never re-introduced).

4. **Google-level quality (N.7, N.7.1, N.7.2).** Every file ≤ 500 lines, every function ≤ 40 lines, optimistic updates, zero race conditions, proactive lifecycle, idempotent commands, belt-and-suspenders error handling. At end of implementation declare ✅/⚠️/❌ Google-level explicitly per N.7.2 checklist.

5. **No `any` / `as any` / `@ts-ignore`.** Discriminated unions, function overloads, generics — enterprise TypeScript only (CLAUDE.md TERMINAL PROHIBITIONS).

6. **Enterprise IDs (N.6).** Any new entity created via grip-stretch Copy mode or vertex-add MUST use `enterprise-id.service`. Never `addDoc()`, `Date.now()`, inline `crypto.randomUUID()`.

7. **Pure Greek locale (N.11).** All user-facing strings in `t('namespace.key')` with keys added to `el/dxf-viewer.json` AND `en/dxf-viewer.json` BEFORE the code references them. No `defaultValue:` with literal text. Greek labels zero English words.

8. **ADR-040 micro-leaf compliance.** `StretchPreviewOverlay`, `GripHoverMenu`, and any new canvas-layer subscriber must be leaf components — NEVER subscribe from `CanvasSection` / `CanvasLayerStack` orchestrators. Event handlers receive getter functions, not snapshots. No high-freq store keys in bitmap cache.

9. **Pre-commit hooks must pass.** SSoT ratchet (CHECK 3.7, 3.18), i18n missing keys baseline (3.8), Firestore companyId scanner (3.10), entity audit coverage (3.17), runtime resolver reachability (3.13), dead-code ratchet (3.22), file size ratchet (≤500 lines), ADR-040 micro-leaf gates (6B/6C/6D). No `--no-verify`.

10. **ADR-driven workflow (N.0.1, 4 phases).** Phase 1 (recognition) is this document. Phase 2 (implementation) starts only after Giorgio gives the GO. Phase 3 updates this ADR's changelog with the final implementation notes. Phase 4 commits code + ADR together.

**If any of the above cannot be satisfied without compromise**, STOP and ask Giorgio rather than ship a sub-Google solution.

---

## Architecture

### Command Registration

```typescript
// src/subapps/dxf-viewer/systems/commands/StretchCommand.ts
export class StretchCommand implements UndoableCommand {
  readonly type = 'stretch';

  constructor(
    private vertexMoves: ReadonlyArray<VertexMove>,   // per-vertex addressing
    private entityMoves: ReadonlyArray<EntityMove>,   // anchor-point rigid moves
    private displacement: WorldVector,
  ) {}

  execute(store: DxfEntityStore): void { /* apply vertex/entity moves */ }
  undo(store: DxfEntityStore): void { /* restore original positions */ }
}

interface VertexMove {
  entityId: DxfEntityId;
  vertexPath: VertexPath;   // e.g. { kind: 'polyline-vertex', index: 3 } | { kind: 'line-end' }
  delta: WorldVector;
}

interface EntityMove {
  entityId: DxfEntityId;
  delta: WorldVector;
}
```

### State Machine

```
IDLE → SELECTING → BASE_POINT → DISPLACEMENT → DONE
         ↑ ESC        ↑ ESC          ↑ ESC
         └────────────┴───────────────┘
```

Sub-states of `BASE_POINT`:
```
BASE_POINT → AWAITING_PICK   (default)
           → DISPLACEMENT_INPUT (after "Μ"/"D" keyword)
```

### Stretch Tool Store

```typescript
// src/subapps/dxf-viewer/systems/stretch/StretchToolStore.ts
interface StretchToolState {
  phase: 'idle' | 'selecting' | 'base_point' | 'displacement' | 'done';
  selectionMode: 'crossing-window' | 'crossing-polygon' | 'window' | 'pre-selected';
  capturedVertices: ReadonlyArray<VertexRef>;  // computed from crossing window
  capturedEntities: ReadonlyArray<DxfEntityId>;  // for whole-entity moves
  basePoint: WorldPoint | null;
  currentDisplacement: WorldVector;  // live during preview
}
```

### Vertex Classification — per DXF entity type

`stretch-vertex-classifier.ts` is the SSoT for what counts as a "vertex" per entity type and how it is moved.

| Entity | Vertex-level addressing | Anchor (whole-entity fallback) |
|--------|-------------------------|--------------------------------|
| `LINE` | start, end | — |
| `LWPOLYLINE` / `POLYLINE` | each `vertex[i]` (bulge preserved per segment) | — |
| `POLYLINE3D` | each vertex (3D) | — |
| `ARC` | start point, end point; center recomputed when 1 endpoint moves | center (if both endpoints + center captured → rigid move) |
| `CIRCLE` | — | center |
| `ELLIPSE` | — | center |
| `SPLINE` (CV mode) | each control vertex | — |
| `SPLINE` (fit-point mode) | each fit point; **may convert to CV mode** (documented behavior) | — |
| `TEXT` / `MTEXT` | — | insertion point |
| `INSERT` (block ref) | — | insertion point |
| `HATCH` (associative) | follows boundary — no direct vertex addressing | — |
| `HATCH` (non-associative) | ignored (industry standard) | — |
| `DIMENSION` | definition points (extension origin, dim-line position, text midpoint) — value auto-updates | — |
| `LEADER` / `MLEADER` | arrow attachment, landing point (independent) | — |
| `POINT` | — | position |

**Wide polylines**: width preserved; ends squared off (industry standard).

**Bulge preservation**: for polyline arc segments, the bulge ratio is preserved across the chord-length change — the resulting arc has a new radius/center but the same sagitta-to-chord ratio (industry standard, AutoCAD documented).

### Live Preview

Preview uses the ADR-040 micro-leaf subscriber pattern (matching ADR-348 ScalePreviewOverlay):

```
StretchToolStore (pub/sub, no React)
  → StretchPreviewOverlay (SVG canvas layer leaf subscriber)
  → Renders rubber-band ghost outline of deformed entities in real-time
  → Updated on every mousemove (throttled 16ms = 60fps)
```

Anchored vertices render at original position; moving vertices follow cursor; connecting segments redraw between them. Semi-transparent overlay on top of DXF canvas (same pattern as lasso/scale preview).

### Keyboard Input

Captured via `useCanvasKeyHandler` (ADR-040 compliant). Numeric `x,y` or `@dx,dy` builds a string buffer; ENTER confirms; ESC cancels. No DOM input element.

### Snap Integration

Base point + second point both use the existing centralized SnapEngine. All snap types active: endpoint, midpoint, center, quadrant, intersection, perpendicular, nearest.

### Crossing Window Capture

`stretch-crossing-capture.ts` is the SSoT for vertex-in-window evaluation. Uses the existing crop/lasso geometry SSoT where possible (ADR-040 / ADR-345 Phase 1 crop variants).

For each entity in scene:
1. Enumerate its **addressable vertices** via `stretch-vertex-classifier.ts`
2. Test each vertex against the crossing window polygon (point-in-polygon)
3. Build the `capturedVertices` list
4. For entities with no vertex addressing (circle, block, text), test the anchor point → add to `capturedEntities` if inside

---

## Files to Create

| File | Lines | Role |
|------|-------|------|
| `systems/stretch/StretchToolStore.ts` | ~100 | State machine + pub/sub store |
| `systems/stretch/stretch-vertex-classifier.ts` | ~150 | Per-entity vertex enumeration SSoT |
| `systems/stretch/stretch-crossing-capture.ts` | ~80 | Crossing window vertex capture SSoT |
| `systems/stretch/stretch-entity-transform.ts` | ~120 | Apply displacement to vertices/anchors |
| `systems/commands/StretchCommand.ts` | ~70 | Undoable command |
| `components/dxf-layout/StretchPreviewOverlay.tsx` | ~60 | Live preview leaf subscriber |
| `hooks/tools/useStretchTool.ts` | ~90 | Orchestrates state machine |
| `systems/grip/GripStretchMode.ts` | ~40 | Grip-stretch wrapper (reuses StretchCommand) |

---

## Files to Modify

| File | Change |
|------|--------|
| `ui/ribbon/data/home-tab-modify.ts` | Remove `comingSoon: true` from `modify.stretch` (line 154). Boy Scout: also `edit.stretch` (line 287). |
| `systems/tools/ToolStateManager.ts` | Register `stretch` tool |
| `hooks/canvas/useCanvasClickHandler.ts` | Route clicks to stretch tool phases |
| `hooks/canvas/useCanvasMouseMove.ts` | Feed mouse position to StretchToolStore for preview |
| `components/dxf-layout/CanvasLayerStack.tsx` | Mount `StretchPreviewOverlay` as leaf |
| `systems/grip/GripStateMachine.ts` | Add `GripStretchMode` to spacebar cycle (already wired for SCALE — extend) |
| `src/i18n/locales/el/dxf-viewer.json` | Add `ribbon.commands.stretch: "Επιμήκυνση"` + prompts |
| `src/i18n/locales/en/dxf-viewer.json` | Add `ribbon.commands.stretch: "Stretch"` + prompts |
| `docs/centralized-systems/reference/adr-index.md` | Add ADR-349 entry |

---

## Open Design Decisions (Q&A with Giorgio)

| # | Question | Status |
|---|----------|--------|
| Q1 | Multi-window MSTRETCH (Express Tool variant) in Phase 1? | ✅ YES — as separate companion command `mstretch`, shipped together with `stretch` in Phase 1 |
| Q2 | DIMENSION entities — full support (defpoint auto-update) Phase 1, or whole-entity-move only? | ✅ FULL — industry standard with defpoint capture + recalc + text repositioning. DIMASSOC honored. |
| Q3 | HATCH entities — associative only, or also fallback for non-associative? | ✅ Industry standard (associative follows boundary; non-associative ignored) **+ warning toast** when crossing window captures any non-associative hatch — message: `Η σκίαση δεν είναι συνδεδεμένη — δεν μετακινήθηκε.` |
| Q4 | SPLINE fit-point → CV mode conversion — silent (industry std) or warn user? | ✅ Silent — industry standard. Conversion happens transparently inside `StretchCommand.execute()`. Single Ctrl+Z reverses both stretch and CV conversion as one atomic operation. |
| Q5 | Crossing Polygon (CP) selection — Phase 1 or future? | ✅ Phase 1 — industry standard 5/5. Reuses ADR-345 lasso polygon SSoT. Keyword `CP` (or `ΠΟ` for Greek alias) at selection prompt switches to polygon mode. |
| Q6 | Status bar prompts text style — Greek text / icons / both? (consistency with ADR-348 Q5) | ✅ Icon + Greek text. Format: `[icon] Greek prompt [Keyword(Κ)]`. Convention applies to all modify commands. SSoT: **existing `toolHintOverrideStore` from ADR-348 extended** with optional `icon` field — no new component. ADR-348 Q5 ('Existing ToolbarStatusBar SSoT') stays canonical; this ADR adds `iconKey?: string` to `ToolHintOverride`. |
| Q7 | Z-axis — 2D only or full 3D? | ✅ **2D only** (Δz=0 always). Crossing window evaluates XY only. Coordinate input `x,y` (no z). Matches AutoCAD PROJMODE=UCS default. Future 3D = separate ADR. |
| Q8 | Pre-selected entities — how does STRETCH treat them when no crossing window was drawn? | ✅ Industry std (rigid MOVE on all pre-selected entities) **+ info toast** `Προεπιλεγμένες οντότητες θα μετακινηθούν ολόκληρες.` Locale key: `notifications.stretch.preSelectionMoveOnly`. Suppress toast if `selectionMode === 'pre-selected'` was followed by user explicitly drawing a crossing window inside the command (re-selection). |
| Q9 | DIMENSION non-associative (DIMASSOC=0) — toast warning like hatches? | ✅ Industry std (defpoints move, value stays stale) **+ toast warning** `Η διάσταση δεν είναι συνδεδεμένη — η τιμή δεν θα ανανεωθεί.` Locale key: `notifications.stretch.nonAssociativeDimensionSkipped`. Consistent with Q3 hatch decision. Aggregator counts unique non-assoc dimensions per session, emits one toast. |
| Q10 | Multi-grip stretch (Shift+click multiple grips, drag one → all move together) Phase 1? | ✅ **Phase 1** — industry std 5/5. Grip state machine already supports multi-hot-grips (ADR-348). `GripStretchMode.applyCollectiveDelta(hotGrips, delta)` applies the same displacement to all hot grips simultaneously. Edge case: hot grips on locked-layer entities skipped silently. |
| Q11 | Audit trail (ADR-195) granularity — per command, per entity, per vertex? | ✅ **1 entry per command** (compact, atomic with Undo). Audit payload: `{ op: 'stretch', displacement: {x,y}, affectedEntityIds: [...], affectedVertexCount: N }`. Matches ADR-348 SCALE pattern. `StretchCommand.execute()` invokes `EntityAuditService.recordChange()` once at end. Single Undo reverses both the geometric change and the audit entry (audit is a sibling, not a child). |
| Q12 | Grip multifunctional menu (hover → Stretch/Lengthen/Radius) Phase 1? | ✅ **Phase 1**. Brings LENGTHEN (line/arc endpoint length input) and ARC Radius edit into ADR-349 scope as **sub-features**. Removed from Non-Goals. See new "Multifunctional Grip Menu" architecture section. |

---

## Constraints

- ADR-040: `StretchPreviewOverlay` MUST be a micro-leaf subscriber, NOT rendered from `CanvasSection`/`CanvasLayerStack` orchestrators
- ADR-040: No `useSyncExternalStore` in orchestrators
- No entity mutation during preview — preview is read-only overlay
- ESC always cancels without side effects
- Single undo step for entire stretch operation
- Shortcut: `S` (single key, matches AutoCAD default)
- Locked layer entities silently ignored (industry standard)
- Pure Greek locale labels (no English words in `el/dxf-viewer.json`)
- Enterprise IDs for any new entities created via grip-stretch Copy mode (enterprise-id.service)

---

## MSTRETCH Companion Command (Q1 — Phase 1)

Per Q1 decision, **MSTRETCH ships in Phase 1 as a separate command** following AutoCAD/BricsCAD Express Tool pattern.

### MSTRETCH Differences from STRETCH

| Aspect | STRETCH | MSTRETCH |
|--------|---------|----------|
| Crossing windows per invocation | exactly 1 | 1..N (user adds with `C`/`CP`/ENTER) |
| Captured vertex set | single window | **union** of all windows |
| Displacement vector | single P1→P2 | single P1→P2 applied to union |
| Ribbon button | `modify.stretch` (existing) | new `modify.mstretch` (small button in flyout, adjacent) |
| Shortcut | `S` | `MS` (two-key, mirrors AutoCAD Express Tool) |
| Locale key | `ribbon.commands.stretch` (`Επιμήκυνση`) | `ribbon.commands.mstretch` (`Πολλαπλή επιμήκυνση`) |

### MSTRETCH UX Flow (additions over STRETCH)

```
PHASE 1: SELECTION (modified)
  → Prompt: "Ορίστε crossing window ή [Πολύγωνο(CP) / Αφαίρεση(R)]:"
  → User draws crossing window #1
  → Prompt: "Επόμενο crossing window ή ENTER για ολοκλήρωση:"
  → User draws crossing window #2  (or types CP for polygon, R to remove)
  → ... repeat until user presses ENTER without drawing
  → All captured vertices are unioned

PHASE 2, 3, 4: identical to STRETCH (single base point, single displacement vector)
```

### MSTRETCH Architecture — Shared SSoT

MSTRETCH reuses **the same** `StretchToolStore`, `StretchCommand`, `stretch-vertex-classifier`, `stretch-entity-transform`, and `StretchPreviewOverlay`. The only delta is the **selection phase**:

- `StretchToolState.crossingWindows: ReadonlyArray<CrossingWindow>` (length 1 for STRETCH, ≥1 for MSTRETCH)
- `stretch-crossing-capture.ts` accepts an array of windows; vertex capture is the union across all windows
- `useStretchTool.ts` reads a `mode: 'single' | 'multi'` flag to control the selection sub-state machine

This means: **+1 ribbon button, +1 hook config flag, +~30 lines** for the multi-window selection loop. No duplicate command, no duplicate transform logic.

### Files to Modify (MSTRETCH delta)

| File | Change |
|------|--------|
| `ui/ribbon/data/home-tab-modify.ts` | Add `modify.mstretch` button (small, in flyout) |
| `systems/stretch/StretchToolStore.ts` | `crossingWindows: ReadonlyArray<CrossingWindow>` (replaces single `crossingWindow`) |
| `systems/stretch/stretch-crossing-capture.ts` | Accept array, return unioned vertex set |
| `hooks/tools/useStretchTool.ts` | `mode: 'single' \| 'multi'` flag; multi-window selection loop |
| `systems/tools/ToolStateManager.ts` | Register `mstretch` tool (delegates to stretch with mode='multi') |
| `src/i18n/locales/{el,en}/dxf-viewer.json` | Add `ribbon.commands.mstretch` + multi-window prompts |

---

## Industry Defaults (auto-applied, no Q&A needed)

These behaviors follow the documented industry standard (5/5 vendor convergence). Adopted without explicit Giorgio sign-off; flagged here for transparency.

| Topic | Default | Rationale |
|-------|---------|-----------|
| Layer **frozen** entities | Ignored — vertex/anchor neither evaluated nor moved | Industry std; frozen = non-editable |
| Layer **off** entities | Editable — vertex/anchor evaluated and moved normally | Industry std; visibility ≠ editability |
| Layer **locked** entities | Silently ignored | Already in Constraints section |
| BLOCK **ATTRIB** entities (attribute text) | Move with parent block (rigid translation when block insertion point inside window) | ATTRIBs are slaved to block reference |
| Block scale ≠ 1 | Insertion point still the anchor; scale unchanged | Stretch is a translation, not a scale |
| Nested blocks | Top-level INSERT insertion point is the anchor | Recursive block content never deforms |
| **Self-intersecting polylines** post-stretch | Silent — no warning | Industry std; user responsibility |
| **Degenerate entities** (zero-length line, zero-radius arc) post-stretch | Silent — entity persists as-is | Industry std; user can Undo or delete manually |
| **Coordinate input syntax** | `x,y` absolute · `@dx,dy` relative · `@dist<angle` polar (angle in degrees) | AutoCAD standard |
| **ORTHO (F8) / POLAR (F10) / SNAP (F9)** mid-command | Toggled freely; affects displacement constraint only | Industry std |
| **Pan / Zoom** mid-command | Allowed; command state preserved | Industry std |
| **"Nothing to stretch"** (window captures 0 vertices) | Return to selection prompt with toast `Δεν επιλέχθηκαν σημεία προς επιμήκυνση.` | Industry std |
| **Right-click** during selection | Equivalent to ENTER (confirm) | AutoCAD default; matches viewer existing pattern |
| **Right-click** during base/displacement phase | Equivalent to ENTER if input pending; otherwise opens existing context menu | Existing viewer pattern |
| **Negative displacement** through anchored vertex | Silent — no collision validation | Industry std |
| **MTEXT bounding box** | Never deforms — insertion point is anchor; text content/wrap unchanged | Industry std |
| **LEADER/MLEADER** independent stretch | Arrow attachment and landing point evaluated independently — partial stretch allowed | Industry std |

---

## Multifunctional Grip Menu (Q12 — Phase 1)

When the user **hovers** over a grip (without clicking), a small floating menu appears next to it listing the operations available for that grip type:

| Grip type | Menu options |
|-----------|--------------|
| LINE endpoint | Stretch · Lengthen |
| LWPOLYLINE / POLYLINE vertex | Stretch · Add Vertex · Remove Vertex · Convert to Arc / to Line |
| ARC endpoint | Stretch · Lengthen |
| ARC midpoint | Stretch · Radius |
| SPLINE control vertex | Stretch · Add CV · Remove CV |
| Block/Text insertion point | Stretch (= MOVE for single-point entities) |

**LENGTHEN minimal scope (Phase 1 sub-feature):** when invoked from the grip menu, a status-bar prompt asks for either a new absolute length or `±delta`. The chosen endpoint moves along the entity's own axis (line: along its direction; arc: along its tangent at the endpoint, preserving the arc's center+radius). Per-entity logic in `lengthen-axial-stretch.ts`. Standalone `LENGTHEN` ribbon command remains a separate future ADR — only the grip-driven path is in Phase 1.

**ARC Radius edit (Phase 1 sub-feature):** invoked from the midpoint grip. The user drags or types a new radius; the arc's center recomputes to keep both endpoints fixed. Per-entity logic in `arc-radius-edit.ts`.

**Polyline vertex add/remove/convert (Phase 1 sub-feature):** invoked from vertex grip menu. Operates on a single polyline vertex; updates the vertex array (and bulge factor for arc-segment conversion).

### Architecture

- `GripHoverMenuStore` (pub/sub): tracks hovered grip + menu visibility
- `<GripHoverMenu>` (micro-leaf component, ADR-040 compliant): floating UI rendered above canvas
- `grip-menu-resolver.ts` (SSoT): maps `(entityType, gripKind)` → list of menu options
- Menu options are dispatched as commands (LengthenCommand, RadiusEditCommand, PolylineVertexCommand) all undoable via the existing CommandHistory

**Hover hold-time:** 400ms (matches Windows ToolTip default). Configurable via `GRIPMENUDELAY` setting (default 400).

**Ctrl modifier:** holding Ctrl while hovering bypasses the delay (menu appears immediately) — matches AutoCAD `GRIPMULTIFUNCTIONAL=3`.

### Files to Create (Q12 delta)

| File | Lines | Role |
|------|-------|------|
| `systems/grip/GripHoverMenuStore.ts` | ~50 | Hover state pub/sub |
| `systems/grip/grip-menu-resolver.ts` | ~80 | (entityType, gripKind) → menu options SSoT |
| `systems/commands/LengthenCommand.ts` | ~60 | Axial endpoint length adjustment (line/arc) |
| `systems/commands/ArcRadiusEditCommand.ts` | ~50 | Arc midpoint radius change |
| `systems/commands/PolylineVertexCommand.ts` | ~80 | Add/Remove/Convert vertex |
| `systems/grip/lengthen-axial-stretch.ts` | ~70 | Per-entity axial-length math SSoT |
| `systems/grip/arc-radius-edit.ts` | ~50 | Arc center-recompute math SSoT |
| `components/grip/GripHoverMenu.tsx` | ~80 | Floating menu micro-leaf component |

---

## Non-Goals (Phase 1)

- Standalone `LENGTHEN` ribbon command (only the grip-driven path is in scope)
- Parametric/Dynamic Block STRETCH (no Dynamic Blocks support yet in viewer)
- PARAMETRICSTRETCH (BricsCAD exclusive — not industry standard)
- Reference mode (no vendor implements it for STRETCH)
- Copy modifier in STRETCH command (industry: only in grip-stretch path)
- 3D stretching (Z-axis displacement)
- Standalone polyline-vertex-add ribbon command (only grip menu invokes it)

---

## Changelog

| Date       | Version | Change |
|------------|---------|--------|
| 2026-05-15 | 0.1     | Initial draft — industry research complete (5/5 vendor convergence table), Q&A pending. Pattern follows ADR-348. |
| 2026-05-15 | 0.2     | Q1 confirmed: MSTRETCH ships in Phase 1 as separate companion command (`mstretch`, shortcut `MS`). Shared SSoT — same StretchCommand/Store/transform reused. Selection phase differs (1..N crossing windows, union). |
| 2026-05-15 | 0.3     | Q2 confirmed: DIMENSION entities get full industry-standard support — defpoint enumeration, geometry recalc, text repositioning, DIMASSOC associativity honored. Adds `dimension-defpoint-resolver.ts` SSoT (~100 lines) for defpoint-per-dim-type mapping (Linear/Aligned/Angular/Radial/Diametric/Ordinate). |
| 2026-05-15 | 0.4     | Q3 confirmed: HATCH — associative follows boundary (industry standard); non-associative ignored **with toast warning** `Η σκίαση δεν είναι συνδεδεμένη — δεν μετακινήθηκε.` Adds locale key `notifications.stretch.nonAssociativeHatchSkipped` and `stretch-hatch-warning.ts` aggregator (count unique non-assoc hatches per session, emit one toast). |
| 2026-05-15 | 0.5     | Q4 confirmed: SPLINE fit-point→CV conversion is silent (industry standard). StretchCommand captures pre-state of any fit-point spline before mutation; undo restores both vertex positions AND fit-point representation atomically. |
| 2026-05-15 | 0.6     | Q5 confirmed: Crossing Polygon (CP) included in Phase 1. Selection sub-state machine adds `crossing-polygon` mode; reuses ADR-345 lasso polygon SSoT. Keyword aliases: `CP` (English) and `ΠΟ` (Greek). |
| 2026-05-15 | 0.7     | Q6 confirmed: Status bar prompts use **icon + Greek text** format (`[icon] prompt [Keyword(Κ)]`). Implementation reuses existing `toolHintOverrideStore` SSoT (canonical per ADR-348 Q5); only delta is optional `iconKey?: string` field added to `ToolHintOverride`. No new component. |
| 2026-05-15 | 0.8     | Review pass identified 13 gaps. 10 auto-resolved by industry default (added as "Industry Defaults" section). 6 new questions opened (Q7-Q12). Status → Q&A IN PROGRESS again. Q7 confirmed: 2D only. POLYLINE3D entities stretchable in XY plane; Z preserved unchanged. |
| 2026-05-15 | 0.9     | Q8 confirmed: pre-selected entities → MOVE + info toast. Q9 confirmed: non-associative dimensions → defpoints move + toast warning (consistent with hatches Q3). |
| 2026-05-15 | 0.10    | Q10 confirmed: multi-grip stretch (Shift+click multiple grips, drag → all move) in Phase 1. Q11 confirmed: audit trail 1 entry per STRETCH command via EntityAuditService.recordChange (ADR-195 compliant, ADR-348 pattern). |
| 2026-05-15 | 0.11    | Q12 confirmed: grip multifunctional menu in Phase 1. Scope expanded: LENGTHEN (line/arc endpoint axial) + Arc Radius edit + Polyline vertex add/remove/convert become Phase 1 sub-features. Standalone LENGTHEN ribbon command remains future ADR. New "Multifunctional Grip Menu" architecture section added. Status → ACCEPTED (12/12 resolved). |
| 2026-05-15 | 0.12    | Added **🚨 Implementation Mandate (SSOT + Google-Level)** section per Giorgio directive. 10 non-negotiable pre-implementation rules: centralized systems first, no duplicates, one SSoT per concern, Google-level quality (N.7/7.1/7.2), no `any`/`as any`, enterprise IDs (N.6), pure Greek locale (N.11), ADR-040 micro-leaf compliance, pre-commit hooks pass, 4-phase ADR-driven workflow. |
| 2026-05-15 | 1.6     | **Phase 1c-B3 IMPLEMENTED — Legacy fragmented commit replaced with `StretchEntityCommand` path + arc partial-capture math + rectangle → polyline coercion.** Modified: `systems/stretch/stretch-entity-transform.ts` — `applyVertexDisplacement` return type changed from `Partial<SceneEntity>` to discriminated `StretchUpdate = {kind:'noop'} \| {kind:'update', updates} \| {kind:'replace', entity}`; new `stretchArcSingleEndpoint` (bulge-preserving math: derives new center via L = chord, r' = L/(2 sin\|θ/2\|), distance from chord midpoint = √(r'²−(L/2)²), side selected by sign of original chord×center cross product so the bulge stays on the same geometric side regardless of CW/CCW or reflex sweep, signed sweep preserved by atan2 + 2π wrap when sign flips); new `stretchArcMidpoint` (3-point circumcircle through old start, new midpoint, old end via determinant formula — collinear→null no-op); new `stretchRectangle` (1–3 corners captured → coerce to closed `polyline` with 4 vertices preserving the entity id so selection/refs stay valid; 4 corners → rigid x/y translate; 0 → noop). `systems/stretch/stretch-vertex-classifier.ts` — added `arc-mid` to `VertexKind` + `enumerateVertices` (start, mid, end) + `getVertexPosition` (midpoint at (startAngle+endAngle)/2 — derivable even when not captured by the crossing window). `core/commands/entity-commands/StretchEntityCommand.ts` — `execute` / `undo` / `redo` adapt to `StretchUpdate`: snapshots both update and replace entries; for replacements, undo `removeEntity(newId)` + `addEntity(oldEntity)` to reverse the type change atomically (single undo step covers both vertex moves and rectangle coercion); orphan `hasUpdates` helper removed. `hooks/tools/useStretchPreview.ts` — `buildVertexGhost` switches on `result.kind` (noop→null, update→`{...entity, ...updates}`, replace→`result.entity` so the ghost shows the coerced polyline live). `hooks/grips/grip-commit-adapters.ts` — legacy `commitDxfGripDrag` (manual edge mutation per entity type / `MoveVertexCommand` / `moveEntities`) deleted; new `commitDxfGripDragViaStretchCommand` resolves grip via `gripToVertexRefs` SSoT → builds `StretchEntityCommand` with `vertexMoves` (refs found) or `anchorMoves` (movesEntity fallback for circle/ellipse/text/etc.) → `command.validate()` guard → `deps.execute(command)`; `commitDxfGripDragModeAware` stretch branch routes through the new helper; orphan imports removed (`i18next`, `MoveVertexCommand`, `toolHintOverrideStore`); `createSceneManagerAdapter` retained — needed by the command. `hooks/grips/index.ts` — re-export updated (`commitDxfGripDrag` removed, `commitDxfGripDragViaStretchCommand` + `commitDxfGripDragModeAware` exported). Behavior: every stretch grip drag now flows through one command — undo/redo is a single step regardless of entity type or capture configuration; the same math drives the live preview (`useStretchPreview`) and the commit (`StretchEntityCommand.execute`) so they cannot diverge by construction. Edge cases: arc with both endpoints captured → rigid translate (unchanged); arc with degenerate sweep (≈0 or ≥2π) or chord collapse → no-op (no Update); rectangle with 0 corners → noop. **Deferred Phase 1d**: audit-trail wiring per Q11 of the original ADR. |
| 2026-05-15 | 1.5     | **Phase 1c-B2 IMPLEMENTED — Rotate/Scale/Mirror grip handoff.** New: `systems/grip/GripHandoffStore.ts` (tiny module singleton — `set(tool, point)` / `consume(tool)` / `clear()`; entry consumed exactly once by target tool hook on activation; ADR-349 Phase 1c-B2 SSoT for pre-seeded first-click). Modified: `hooks/grips/grip-commit-adapters.ts` (removed `deferredHint` stub — replaced with `GripHandoffStore.set(mode, grip.position)` + `deps.onToolChange(mode)`; `gripModeMeta` import dropped; `onToolChange: (tool: string) => void` added to `DxfCommitDeps`), `hooks/grips/unified-grip-types.ts` (`onToolChange?: (tool: string) => void` added to `UseUnifiedGripInteractionParams`), `hooks/grips/useUnifiedGripInteraction.ts` (destructure `onToolChange`; stable ref pattern `onToolChangeRef` avoids stale closure in `dxfCommitDeps` useMemo; `onToolChange` threaded into `DxfCommitDeps`), `components/dxf-layout/CanvasSection.tsx` (`props.onToolChange` passed to `useUnifiedGripInteraction`), `hooks/tools/useRotationTool.ts` (on `activate+hasEntities`: `GripHandoffStore.consume('rotate')` — if present → pre-seed `basePoint` + jump to `awaiting-reference`, else → `awaiting-base-point`), `hooks/tools/useScaleTool.ts` (on `activate+hasEntities`: `GripHandoffStore.consume('scale')` — if present → `ScaleToolStore.setBasePoint(pt)` + `setPhase('scale_input','direct')`, else → `setPhase('base_point')`), `hooks/tools/useMirrorTool.ts` (on `activate+hasEntities`: `GripHandoffStore.consume('mirror')` — if present → pre-seed `firstPoint` + jump to `awaiting-second-point`, else → `awaiting-first-point`). Behavior: grip drag in rotate/scale/mirror mode → grip release position auto-becomes the pivot/base/axis-first-point for the target tool; user lands directly in the second-click phase (reference-direction / scale-factor / axis-second-point) without an extra click. **Deferred Phase 1c-B3**: `StretchEntityCommand`-only commit path (replacing legacy fragmented `commitDxfGripDrag`). |
| 2026-05-15 | 1.4     | **Phase 1c-B1 IMPLEMENTED — StretchPreviewOverlay micro-leaf.** New files: `hooks/tools/useStretchPreview.ts` (RAF-driven preview hook subscribed to `StretchToolStore` (LOW-freq phase) + `useCursorWorldPosition` (60fps) — draws base-point crosshair, dashed-gold rubber band, Δx,Δy tooltip, and translucent ghost entities during the `displacement` phase; ghost geometry built via the SAME math the command uses on commit — `applyVertexDisplacement` + `translateEntityByAnchor` — so preview cannot diverge from final result by construction; entity lookup memoised on scene-array identity for O(1) per-frame access; ADR-040 micro-leaf — clears canvas on phase exit, RAF only during `displacement`). Modified: `components/dxf-layout/canvas-layer-stack-leaves.tsx` (+`StretchPreviewMount` zero-JSX wrapper + `stretch` slot in `PreviewCanvasMounts` composite), `components/dxf-layout/canvas-layer-stack-types.ts` (+`stretchPreview: Record<string, never>` — store-driven, zero props needed, mirrors `scalePreview` pattern), `components/dxf-layout/CanvasLayerStack.tsx` (destructure `stretchPreview` + thread to `<PreviewCanvasMounts stretch={…} />`), `components/dxf-layout/CanvasSection.tsx` (`stretchPreview={{}}` prop). Reuses SSoT primitives `drawGhostEntity` + `GHOST_DEFAULTS` from `rendering/ghost` — no duplicate ghost rendering. Behavior: STRETCH/MSTRETCH → click base point → live ghost follows cursor showing the exact deformation; click again or `dx,dy ENTER` → command commits the same geometry the preview displayed. **Deferred Phase 1c-B2**: rotate/scale/mirror grip handoff via `onToolChange` + pre-seeded basePoint in respective Tool stores. **Deferred Phase 1c-B3**: `StretchEntityCommand`-only commit path (replacing legacy fragmented `commitDxfGripDrag` — requires arc-partial-capture bulge-preserving math + rectangle-to-polyline coercion). |
| 2026-05-15 | 1.3     | **Phase 1c-A IMPLEMENTED — Spacebar grip-mode cycle + GripStretchMode default.** New files: `systems/grip/grip-mode-cycle.ts` (pure SSoT: 5-mode order `stretch→move→rotate→scale→mirror`, per-mode meta with `implemented` flag), `systems/grip/GripModeStore.ts` (pub/sub micro-leaf store, LOW-freq one-set-per-keypress; resets to `stretch` on phase idle), `systems/grip/grip-to-vertex-refs.ts` (SSoT mapping `UnifiedGripInfo → VertexRef[]` for LINE/ARC/POLYLINE/RECTANGLE — preparatory for full Phase 1c-B StretchEntityCommand routing), `hooks/grips/useGripSpacebarCycle.ts` (window keydown listener — Spacebar cycles forward while phase ≠ idle; ignores input/textarea/contentEditable; updates `toolHintOverrideStore` with `gripMode.cycleHint`; resets mode + clears hint on idle). Modified: `hooks/grips/grip-commit-adapters.ts` (new `commitDxfGripDragModeAware(grip, delta, deps, mode)` — branches: `stretch`→legacy fragmented commit (no behavioral change), `move`→`moveEntities([entityId], delta)` whole-entity translate regardless of grip type, `rotate`/`scale`/`mirror`→`toolHintOverrideStore.setOverride(gripMode.deferredHint)` skip-commit honest stub; full RotationTool/ScaleTool/MirrorTool handoff ships in Phase 1c-B), `hooks/grips/useUnifiedGripInteraction.ts` (invoke `useGripSpacebarCycle({phase, activeTool})` after state setup; commit call → `commitDxfGripDragModeAware(... GripModeStore.getSnapshot())`). i18n: `tool-hints:gripMode.{stretch,move,rotate,scale,mirror,cycleHint,deferredHint}` el+en added — ICU `{mode}` interpolation, pure Greek. Behavior: hover any DXF grip + click & hold → status bar shows `Λειτουργία λαβής: Έλξη — Space για εναλλαγή`; press Space → cycles to next mode + updates hint; release mouse → commits per current mode; release without click → mode resets to default on phase idle. **Deferred Phase 1c-B**: rotate/scale/mirror handoff via `onToolChange('rotate'/'scale'/'mirror')` + pre-seeded basePoint in the respective Tool stores, full StretchEntityCommand-only commit path (replacing legacy fragmented logic, requires Phase 1c arc-partial-capture + rectangle-to-polyline coercion math), `StretchPreviewOverlay` micro-leaf for live ghost during grip-stretch drag. |
| 2026-05-15 | 1.2     | **Phase 1b.2 IMPLEMENTED — Multifunctional grip hover menu.** New files: `systems/grip/GripHoverMenuStore.ts` (pub/sub micro-leaf store, ADR-040 compliant — LOW-freq visibility transitions only), `systems/grip/grip-menu-resolver.ts` (pure SSoT `(Entity, UnifiedGripInfo) → MenuActionMeta[]`: LINE endpoint→Stretch+Lengthen, ARC endpoint→Stretch+Lengthen, ARC midpoint→Stretch+Radius, POLYLINE/LWPOLYLINE vertex→Stretch+AddVertex+RemoveVertex, default→Stretch only), `systems/grip/grip-menu-actions.ts` (action→ICommand dispatcher binding LengthenCommand/ArcRadiusEditCommand/PolylineVertexCommand with prompt-dialog facade), `hooks/grips/useGripHoverMenuController.ts` (400ms hold timer = Windows ToolTip default, Ctrl bypass, drag-state suppression, level scene lookup via `LevelSceneManagerAdapter`), `components/grip/GripHoverMenu.tsx` (floating `<nav>` micro-leaf — only subscriber to GripHoverMenuStore via useSyncExternalStore; outside-click + Escape dismiss; semantic `<ul>`/`<button>` with i18n labels). Modified: `hooks/grips/unified-grip-types.ts` (+`hoveredGrip`,`phase` in return interface), `hooks/grips/useUnifiedGripInteraction.ts` (expose `hoveredGrip` + `phase` in return — needed by controller, zero high-freq subscription added), `components/dxf-layout/CanvasSection.tsx` (invoke `useGripHoverMenuController` after `useUnifiedGripInteraction`, mount `<GripHoverMenu />` as sibling of `<PromptDialog />`), `i18n/locales/el/tool-hints.json` + `en/tool-hints.json` (added `gripMenu.{ariaLabel,stretch,lengthen,addVertex,removeVertex,radius,prompt.*}` keys — pure Greek per N.11). Behavior: hover any DXF grip in `select`/`layering` tool for 400ms → menu pops near cursor; click action → execute via undo/redo chain; Escape or outside click dismisses; Ctrl held suppresses entirely; dragging hides immediately. **Deferred**: spacebar cycle (Stretch→Move→Rotate→Scale→Mirror), default-grip-mode wrapper `GripStretchMode.ts` (Phase 1c), multi-grip Shift+click collective stretch through menu (Phase 1c), convert-vertex-to-arc (blocked on `bulges[]` entity-model addition — separate ADR-GEOMETRY entry). |
| 2026-05-15 | 1.1     | **Phase 1b.1 IMPLEMENTED — Commands + math SSoT (no grip integration yet).** New files: `systems/grip/lengthen-axial-stretch.ts` (LINE direction-axial + ARC tangent-sweep math), `systems/grip/arc-radius-edit.ts` (midpoint → radius/center recompute, both endpoints fixed; also radius-input variant), `core/commands/entity-commands/LengthenCommand.ts` (undoable, delta/total modes), `core/commands/entity-commands/ArcRadiusEditCommand.ts` (undoable, accepts midpoint or radius), `core/commands/entity-commands/PolylineVertexCommand.ts` (undoable add/remove; convert-to-arc deferred — entity model lacks `bulges[]` field). Exports added in `core/commands/index.ts`. ⚠️ **Phase 1a wiring regression**: `CanvasSection.tsx` `useStretchTool` import + invocation were reverted by linter/auto-format on save — to be re-applied manually together with Phase 1b.2 grip integration. STRETCH ribbon button is registered but not yet hot in the UI. **Deferred to Phase 1b.2**: GripStretchMode (default grip mode, multi-grip Shift+click), GripHoverMenuStore + GripHoverMenu micro-leaf, grip-menu-resolver SSoT, spacebar cycle integration (Stretch → Move → Rotate → Scale → Mirror), bulges[] field in entity model + convert-to-arc op. |
| 2026-05-15 | 1.0     | **Phase 1a IMPLEMENTED — Foundation Commands + Ribbon.** New files: `systems/stretch/StretchToolStore.ts` (state machine + pub/sub SSoT), `systems/stretch/stretch-vertex-classifier.ts` (per-entity vertex enumeration SSoT), `systems/stretch/stretch-crossing-capture.ts` (point-in-polygon union over N windows), `systems/stretch/stretch-entity-transform.ts` (apply Δ to vertices/anchors), `core/commands/entity-commands/StretchEntityCommand.ts` (undoable command), `hooks/tools/useStretchTool.ts` (state machine hook). Modified: `home-tab-modify.ts` (removed `comingSoon` from `modify.stretch` + `edit.stretch`, added `modify.mstretch` button), `ui/toolbar/types.ts` (+`stretch`,`mstretch`), `systems/tools/ToolStateManager.ts` (registered both tools), `canvas-click-types.ts` (+stretchIsActive,handleStretchClick), `useCanvasClickHandler.ts` (PRIORITY 1.58 + grip-guard widened), `useCanvasKeyboardShortcuts.ts` (stretch Escape+KeyDown), `core/commands/index.ts` (+StretchEntityCommand export), `hooks/tools/index.ts` (+useStretchTool export), `CanvasSection.tsx` (wired `useStretchTool` + click + keyboard), i18n `el/en` `tool-hints.json` (`stretchTool.*` keys with ICU `{count}` syntax) + `dxf-viewer-shell.json` (`ribbon.commands.mstretch`). Phase 1a behavior: pre-selected entities → rigid MOVE via anchor / per-vertex displacement, base→target click or `dx,dy` keyboard input, ESC cancel, single-undo. **Deferred to Phase 1b**: GripStretchMode, GripHoverMenuStore, LengthenCommand, ArcRadiusEditCommand, PolylineVertexCommand. **Deferred to Phase 1c**: StretchPreviewOverlay micro-leaf, in-command crossing-window/CP drag, dimension defpoint resolver, hatch associative-follow, arc partial-capture bulge-preserving geometry, rectangle partial-capture polyline conversion. **Deferred to Phase 1d**: EntityAuditService.recordChange hook, DIMASSOC/HATCH non-associative toasts, pre-selection info toast (Q8). |
