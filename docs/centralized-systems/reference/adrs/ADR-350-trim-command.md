# ADR-350: Trim Command (Αποκοπή)

**Status:** 📝 DRAFT v0.1 — Phase 1 (recognition/Q&A in progress)
**Date:** 2026-05-15
**Domain:** DXF Viewer — Modify Tools
**Shortcut:** `TR` (matches AutoCAD)
**Ribbon:** Home → Modify → Αποκοπή (`modify.trim`, currently `comingSoon: true`)
**Related ADRs:** ADR-345 (DXF Ribbon Interface), ADR-348 (Scale Command), ADR-349 (Stretch Command), ADR-040 (Preview Canvas Performance), ADR-031 (Enterprise Command Pattern / Undo–Redo), ADR-189 (Construction Guides), ADR-027 (DXF Keyboard Shortcuts), ADR-195 (Audit Value Catalogs), ADR-001 (Select/Dropdown), ADR-065 (file size geometry split)

---

## Context

The DXF Viewer ribbon (ADR-345) includes a **Trim** (Αποκοπή) button in the Modify panel (`HOME_MODIFY_PANEL` flyout, file `ui/ribbon/data/home-tab-modify.ts:169-174`, plus a small twin at line 301), currently marked `comingSoon: true`. TRIM is **the single most-used modify command** in every professional 2D CAD package — it shortens or breaks an entity at the intersection with another entity (the "cutting edge").

Distinct from neighboring modify commands:

| Command | Trims at intersection? | Keeps removed portion? | Result |
|---------|-----------------------|------------------------|--------|
| **TRIM** | ✅ yes | ❌ no — discarded | Entity shortened / split / deleted |
| **EXTEND** | extends to intersection | n/a | Entity lengthened to touch boundary |
| **BREAK** | ✅ yes, no boundary needed | both pieces kept | Entity split in 2 at picked points |
| **BREAKATPOINT** | at a single picked point | both pieces kept | Entity split in 2 at picked point |
| **LENGTHEN** | no intersection used | n/a | Length changed by delta / percent / total / dynamic |

TRIM and EXTEND are **dual operations** — Shift+click during TRIM invokes EXTEND, and vice versa. This ADR scopes **TRIM**; the inverse-via-Shift behavior is an additive option (Q&A item).

### Industry Research (2026-05-15)

Deep dive across **5 major CAD platforms**: AutoCAD 2026, BricsCAD V25, ZWCAD 2026, GstarCAD 2025, progeCAD 2025 (DraftSight aligned). Sources cited at the end of this document.

**Industry consensus (5/5 vendors converge):**

| Feature | AutoCAD | BricsCAD | ZWCAD | GstarCAD | progeCAD |
|---------|---------|----------|-------|----------|----------|
| Two modes: Quick + Standard | ✅ | ✅ | ✅ | ✅ | ✅ |
| `TRIMEXTENDMODE` system variable (0=Std, 1=Quick) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Default mode = Quick (since AutoCAD 2021) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Individual pick (click to trim) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Fence selection (line through entities) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Crossing window selection | ✅ | ✅ | ✅ | ✅ | ✅ |
| Press-drag freehand "lasso" path (Quick) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Edge mode (`EDGEMODE`): extend boundaries virtually | ✅ | ✅ | ✅ | ✅ | ✅ |
| Project mode (`PROJMODE`): None / UCS / View | ✅ | ✅ | ✅ | ✅ | ✅ |
| eRase option (delete without exiting) | ✅ | ✅ | ✅ | ✅ | ✅ |
| In-command Undo (reverse last pick) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Shift+click → invokes EXTEND inversely | ✅ | ✅ | ✅ | ✅ | ✅ |
| Quick mode: pick-no-boundary → DELETE the object | ✅ | ✅ | ✅ | ✅ | ✅ |
| CIRCLE trimmed → becomes ARC | ✅ | ✅ | ✅ | ✅ | ✅ |
| ELLIPSE trimmed → becomes ELLIPTICAL ARC | ✅ | ✅ | ✅ | ✅ | ✅ |
| POLYLINE sub-segment trimmed → polyline kept, segment removed | ✅ | ✅ | ✅ | ✅ | ✅ |
| HATCH not trimmable directly (must EXPLODE first) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Locked layers silently ignored | ✅ | ✅ | ✅ | ✅ | ✅ |
| Tapered polyline → width adjusted to preserve taper | ✅ | ✅ | ✅ | ✅ | ✅ |
| Spline-fit polyline → permanently converted (irreversible) | ✅ | ✅ | ✅ | ✅ | ✅ |

**Trimmable entities (all vendors):** LINE, POLYLINE (2D/3D), LWPOLYLINE, ARC, CIRCLE, ELLIPSE, ELLIPTICAL ARC, SPLINE, RAY, XLINE.
**Valid cutting edges (all vendors):** LINE, POLYLINE, ARC, CIRCLE, ELLIPSE, SPLINE, RAY, XLINE, LAYOUT VIEWPORT (3D), associative HATCH boundary, TEXT/MTEXT bounding box.

**Default behavior (industry convergence):** `TRIMEXTENDMODE = 1` (Quick), `EDGEMODE = 0` (no extend), `PROJMODE = 1` (UCS).

---

## Core Mathematics

TRIM is a **piecewise-curve cut operation**. For an entity `E` with parametric form `E(t), t ∈ [t_start, t_end]` and a set of cutting edges `{C_i}`:

1. Compute intersections `I = ⋃ᵢ intersect(E, C_i)` → set of parameter values `{t₁, t₂, ..., t_n}` on E.
2. Sort: `t_start < t₁ < t₂ < ... < t_n < t_end`. These split E into `n+1` segments.
3. User clicks at parameter `t_click`. Identify which sub-segment `[tₖ, tₖ₊₁]` contains `t_click`.
4. **Delete** that sub-segment. The remaining segments survive as:
   - Same-type entities if the cut is at an interior segment (E becomes 2 pieces of same type, e.g. one LINE → two LINEs).
   - **Type-promoted** when topology demands (CIRCLE → ARC, ELLIPSE → ELLIPTICAL ARC).
   - **Same entity with sub-segment removed** for composite entities (POLYLINE keeps its identity; the trimmed segment is split into its own portion and the inside chunk is removed; vertices on the cuts are inserted).
5. **Quick mode edge case**: if `I = ∅` (no intersections found), the entity is **deleted** entirely (industry standard).
6. **Edge mode**: if `EDGEMODE = 1` (extend), each cutting edge is virtually extended along its natural geometry (lines→infinite, arcs/circles→full circle, splines→extrapolated tangent) for intersection purposes only; the cutting edge itself is not modified.

### Per-entity post-trim type promotion

| Source entity | Result after interior trim | Result after endpoint trim |
|---------------|---------------------------|---------------------------|
| LINE | 2× LINE (split) | 1× LINE (shortened) |
| ARC | 2× ARC (split) | 1× ARC (shortened) |
| CIRCLE | **1× ARC** (always — circle has no endpoints) | n/a |
| ELLIPSE | **1× ELLIPTICAL ARC** | n/a |
| ELLIPTICAL ARC | 2× ELLIPTICAL ARC | 1× ELLIPTICAL ARC |
| LWPOLYLINE / POLYLINE | 1 polyline with sub-segment removed (vertices inserted at cuts; may split into 2 polylines if interior cut on open polyline) | shortened polyline |
| SPLINE (CV mode) | 2× SPLINE (control points recomputed) | shortened SPLINE |
| SPLINE (fit mode) | **converted to CV mode** then trimmed (irreversible) | converted to CV mode then trimmed |
| RAY | RAY or LINE (depending on which side) | LINE |
| XLINE | RAY or LINE | RAY |

---

## Decision

Implement the `trim` command in **a single complete phase** (per `feedback_completeness_over_mvp`: no MVP/phased variants).

### Phase 1 — Full TRIM

**Default settings (industry convergence):**
- Mode: **Quick** (`TRIMEXTENDMODE = 1`)
- Edge: **No Extend** (`EDGEMODE = 0`)
- Project: **UCS** (`PROJMODE = 1`, 2D viewer = only UCS makes sense; Q&A item)

**UX Flow:**

```
QUICK MODE (default)

PHASE 1: ACTIVATION
  → User presses ribbon "Αποκοπή" / shortcut TR / Enter from previous TRIM session
  → Status bar: "Επιλέξτε αντικείμενα προς αποκοπή ή [Όρια(Ο) / Διαγραφή(Δ) / Αναίρεση(Α) / Λειτουργία(Λ) / Άκρη(Ε) / Προβολή(Π)]:"
  → Cursor: pickbox (small square)

PHASE 2: PICK / SELECT
  → Single click on entity portion → that sub-segment is trimmed
  → Press-drag freehand path → all entities touched by path trimmed where intersected
  → 2 empty clicks → Fence (line) selection between them
  → Crossing window via "Crossing(C)" or "Ο" keyword
  → "Ο" / "B" → switch to Standard mode (user picks cutting edges first)
  → "Δ" / "R" → eRase mode (next click DELETES the picked entity)
  → "Α" / "U" → Undo last trim within this session
  → "Λ" / "M" → toggle Quick/Standard
  → "Ε" / "E" → toggle Edge mode (extend/no-extend)
  → "Π" / "P" → toggle Project (None/UCS/View)
  → ENTER or right-click on empty → exit TRIM
  → SHIFT+click → behaves as EXTEND on that pick (Q&A item Q9)
  → ESC → cancel session

PHASE 3: APPLY
  → For each picked entity:
    a) Compute intersections with all other in-scene entities (Quick) OR cutting set (Standard)
    b) Sort param values on the picked entity
    c) Identify sub-segment containing pick point
    d) Delete sub-segment + apply per-entity type promotion
    e) If no intersections → delete entire entity (Quick mode only; Standard mode emits status bar warning)
  → Live preview overlay (semi-transparent red) shows pending removal under cursor BEFORE click confirms

PHASE 4: LOOP
  → Command stays active; user picks again
  → ENTER / ESC / right-click exits
```

**Standard Mode** (`TRIMEXTENDMODE = 0`) follows the same flow but inserts:

```
PHASE 1.5: CUTTING EDGE SELECTION
  → Status bar: "Επιλέξτε όρια ή [πατήστε ENTER για όλα]:"
  → User picks 1..N entities OR ENTER to use all entities
  → Selected entities highlighted as cutting edges
  → ENTER → proceed to Phase 2
```

### Grip-Based Trim — DEFERRED

TRIM is **not** a grip operation in any major CAD vendor (verified 5/5). Grip menu shows Stretch/Move/Rotate/Scale/Mirror only (per ADR-349 §Multifunctional Grip Menu). **No grip-trim** in this ADR.

---

## 🚨 Implementation Mandate (SSOT + Google-Level) — NON-NEGOTIABLE

**Before writing a single line of code**, the implementing agent MUST:

1. **Search all centralized systems first.** Read `docs/centralized-systems/README.md` and grep `.ssot-registry.json` for every module touched by this ADR. **MANDATORY reuse list**:
   - Intersection math → `snapping/engines/intersection-calculators.ts` + `snapping/shared/GeometricCalculations.ts` (existing SSoT, used by IntersectionSnapEngine)
   - Polyline segment iteration → `rendering/entities/shared/geometry-rendering-utils.ts::getPolylineSegments` (existing SSoT)
   - Entity type guards → `types/entities.ts` (isLineEntity, isArcEntity, isCircleEntity, isLWPolylineEntity, isPolylineEntity, isEllipseEntity, isSplineEntity) — existing SSoT
   - Command pattern → `core/commands/interfaces.ts::ICommand` + `core/commands/CommandHistory.ts` (existing SSoT)
   - Audit trail → `services/entity-audit.service.ts::EntityAuditService.recordChange()` (existing SSoT, CHECK 3.17)
   - Enterprise IDs → `services/enterprise-id.service` (mandatory for any new entities created by trim, e.g. CIRCLE→ARC type promotion)
   - Locked-layer filter → existing pattern in `useStretchTool.ts::filterLockedEntities` (copy pattern; promote to SSoT helper if duplicated 3×)
   - Status-bar prompts → `toolHintOverrideStore` (existing SSoT, used by ADR-348/349)
   - i18n keys → ONLY via `t('namespace.key')`. New keys added to `locales/el/dxf-viewer.json` + `locales/en/dxf-viewer.json` BEFORE referenced
   - Notification keys → `NOTIFICATION_KEYS` registry (SSoT, project_notification_ssot)
   - Ribbon button → already exists at `home-tab-modify.ts:169-174` and `:301` — only flip `comingSoon: false`

2. **Reject duplicates and scattered files.** If a similar utility exists, **extend it**. Forks trigger CHECK 3.7 / 3.18 pre-commit ratchet failures.

3. **One source of truth per concern.** Every piece of new logic has exactly one canonical location:
   - Per-entity intersection computation → reuse existing `intersection-calculators.ts` (extend with arc-arc, ellipse-*, spline-* if missing)
   - Per-entity sub-segment removal → **NEW**: `systems/trim/trim-entity-cutter.ts` (single SSoT for the cut operation per entity type)
   - Entity-set boundary computation (Quick mode "all entities" / Standard mode "selected cutting edges") → **NEW**: `systems/trim/trim-boundary-resolver.ts`
   - Edge extension geometry (EDGEMODE=1) → **NEW**: `systems/trim/trim-edge-extender.ts`
   - Tool state machine → **NEW**: `systems/trim/TrimToolStore.ts` (pub/sub, no React state)
   - Preview rendering → **NEW**: `components/dxf-layout/TrimPreviewOverlay.tsx` (micro-leaf, ADR-040 compliant)
   - Command (undo unit) → **NEW**: `core/commands/entity-commands/TrimEntityCommand.ts`

4. **Google-level quality (N.7, N.7.1, N.7.2).** Every file ≤ 500 lines, every function ≤ 40 lines, optimistic updates, zero race conditions, proactive lifecycle, idempotent commands, belt-and-suspenders error handling. Declare ✅/⚠️/❌ Google-level at end.

5. **No `any` / `as any` / `@ts-ignore`.** Discriminated unions, function overloads, generics only.

6. **Enterprise IDs (N.6).** Any new entities produced by type promotion (CIRCLE → ARC, ELLIPSE → ELLIPTICAL ARC, POLYLINE split → 2 POLYLINES) MUST receive IDs via `enterprise-id.service`. Never inline `crypto.randomUUID()`, never `Date.now()`.

7. **Pure Greek locale (N.11).** All user-facing strings via `t('namespace.key')`. New keys added to `el/dxf-viewer.json` AND `en/dxf-viewer.json` BEFORE code references them. No `defaultValue:` with literal text. Greek labels: zero English words.

8. **ADR-040 micro-leaf compliance.** `TrimPreviewOverlay` MUST be a leaf subscriber. NEVER subscribe from `CanvasSection` / `CanvasLayerStack` orchestrators. Event handlers receive getter functions, not snapshots. No high-freq store keys in bitmap cache.

9. **Pre-commit hooks must pass.** SSoT ratchet (CHECK 3.7, 3.18), i18n missing keys (3.8), Firestore companyId scanner (3.10) — N/A here, entity audit coverage (3.17) — MANDATORY for TrimEntityCommand, runtime resolver reachability (3.13), dead-code ratchet (3.22), file size ratchet (≤500 lines), ADR-040 micro-leaf gates (6B/6C/6D). No `--no-verify`.

10. **ADR-driven workflow (N.0.1, 4 phases).** Phase 1 (recognition) is this document. Phase 2 (implementation) starts only after Giorgio approves all Q&A items. Phase 3 updates this ADR's changelog. Phase 4 commits code + ADR together.

**If any of the above cannot be satisfied without compromise**, STOP and ask Giorgio.

---

## Architecture

### Command Registration

```typescript
// src/subapps/dxf-viewer/core/commands/entity-commands/TrimEntityCommand.ts
export class TrimEntityCommand implements ICommand {
  readonly type = 'trim';

  constructor(
    private operations: ReadonlyArray<TrimOperation>,
    private sceneManager: LevelSceneManagerAdapter,
  ) {}

  execute(): void { /* apply each TrimOperation atomically */ }
  undo(): void { /* restore originals + roll back type promotions + roll back new IDs */ }
}

type TrimOperation =
  | { kind: 'shorten'; entityId: string; originalGeom: EntityGeometry; newGeom: EntityGeometry }
  | { kind: 'split'; entityId: string; originalGeom: EntityGeometry; replacementIds: [string, string]; replacementGeoms: [EntityGeometry, EntityGeometry] }
  | { kind: 'promote'; entityId: string; originalType: EntityType; originalGeom: EntityGeometry; newType: EntityType; newGeom: EntityGeometry }
  | { kind: 'delete'; entityId: string; originalGeom: EntityGeometry };
```

Single Ctrl+Z reverses one entire `TrimEntityCommand` (one user "pick" cycle), matching AutoCAD's per-pick undo semantics inside TRIM.

### State Machine

```
IDLE → ACTIVE_QUICK / ACTIVE_STANDARD_SELECT_EDGES → ACTIVE_STANDARD_PICK
                                ↑ ENTER
ESC always returns to IDLE without side effects.
ENTER / right-click on empty exits to caller.
```

### Trim Tool Store

```typescript
// src/subapps/dxf-viewer/systems/trim/TrimToolStore.ts
interface TrimToolState {
  phase: 'idle' | 'selectingEdges' | 'picking' | 'fence' | 'crossing';
  mode: 'quick' | 'standard';
  edgeMode: 'noExtend' | 'extend';
  projectMode: 'none' | 'ucs' | 'view';
  cuttingEdgeIds: ReadonlyArray<string>;  // empty in Quick mode = "all entities"
  hoverPickPoint: WorldPoint | null;       // for live preview
  hoverPreviewGeom: PreviewGeom | null;    // sub-segment to be removed
  inverseMode: boolean;                    // true if user held SHIFT (→ EXTEND)
}
```

### Per-entity Trim Cutter — SSoT

`systems/trim/trim-entity-cutter.ts` is the **single SSoT** for the cut operation per entity type. Pure functions, no state:

```typescript
export interface TrimResult {
  operations: ReadonlyArray<TrimOperation>;
}

export function trimLine(line: LineEntity, intersections: Point2D[], pickPoint: Point2D): TrimResult;
export function trimArc(arc: ArcEntity, intersections: Point2D[], pickPoint: Point2D): TrimResult;
export function trimCircle(circle: CircleEntity, intersections: Point2D[], pickPoint: Point2D): TrimResult; // → ARC
export function trimEllipse(ell: EllipseEntity, intersections: Point2D[], pickPoint: Point2D): TrimResult; // → ELLIPTICAL ARC
export function trimPolyline(pl: PolylineEntity, intersections: PolylineIntersection[], pickPoint: Point2D): TrimResult;
export function trimSpline(sp: SplineEntity, intersections: Point2D[], pickPoint: Point2D): TrimResult;
export function trimRay(ray: RayEntity, intersections: Point2D[], pickPoint: Point2D): TrimResult;
export function trimXLine(xl: XLineEntity, intersections: Point2D[], pickPoint: Point2D): TrimResult;
```

Each function:
1. Parameterizes the entity.
2. Maps intersections to parameter values.
3. Bisects to find the sub-segment containing pick point.
4. Returns one or more `TrimOperation`s describing the change.

### Boundary Resolver — SSoT

`systems/trim/trim-boundary-resolver.ts`:

```typescript
export function resolveCuttingEdges(args: {
  mode: 'quick' | 'standard';
  selectedEdgeIds: ReadonlyArray<string>;
  scene: LevelScene;
  edgeMode: 'noExtend' | 'extend';
}): ReadonlyArray<CuttingEdge>;
```

In Quick mode, returns all visible (non-locked, non-frozen, non-hidden) entities in the scene as potential edges. Standard mode returns the explicit `selectedEdgeIds`. Edge mode extension is applied here (lines→infinite, arcs→full circle, etc.).

### Live Preview — ADR-040 Micro-Leaf

```
TrimToolStore (pub/sub, no React)
  → TrimPreviewOverlay (SVG canvas layer leaf subscriber)
  → Subscribes to hoverPickPoint + hoverPreviewGeom
  → Renders red semi-transparent dash showing the sub-segment that will be removed
  → 60fps via UnifiedFrameScheduler
```

Anchored to existing pattern from `StretchPreviewOverlay` (ADR-349).

### Snap & Hover Integration

- **Pick point**: uses existing `SnapEngine` for nearest-on-entity snap (priority 1). User clicks anywhere near an entity; snap engine resolves to the nearest curve point.
- **Hover preview**: as cursor moves, `useTrimPreview` hook recomputes the candidate sub-segment under cursor and pushes to `TrimToolStore.setHoverPreviewGeom()`.
- **Cursor**: changes to pickbox while TRIM active.

### Keyboard Input

Captured via existing `useCanvasKeyHandler`. Single-letter keywords:

| Greek | Latin | Action |
|-------|-------|--------|
| `Ο` | `B` | Boundaries (Standard mode toggle) |
| `Δ` | `R` | eRase (delete next pick) |
| `Α` | `U` | Undo last pick |
| `Λ` | `M` | Mode toggle (Quick/Standard) |
| `Ε` | `E` | Edge mode toggle |
| `Π` | `P` | Project mode toggle |
| `ESC` | — | Cancel session |
| `ENTER` | — | Exit session / confirm Standard edge selection |
| `SHIFT` (held) | — | Inverse → EXTEND (Q&A Q9) |

---

## Files to Create

| File | Lines (est) | Role |
|------|-------------|------|
| `systems/trim/TrimToolStore.ts` | ~110 | State machine + pub/sub store |
| `systems/trim/trim-entity-cutter.ts` | ~480 | Per-entity SSoT cut (line/arc/circle/ellipse/polyline/spline/ray/xline) — may need split per N.7.1 |
| `systems/trim/trim-boundary-resolver.ts` | ~120 | Quick/Standard boundary resolution + edge-mode extension |
| `systems/trim/trim-edge-extender.ts` | ~90 | Virtual edge extension geometry (EDGEMODE=1) |
| `systems/trim/trim-intersection-mapper.ts` | ~80 | Map intersection points → entity parameter values |
| `core/commands/entity-commands/TrimEntityCommand.ts` | ~150 | Undoable command (shorten/split/promote/delete) |
| `components/dxf-layout/TrimPreviewOverlay.tsx` | ~70 | Live preview leaf subscriber (ADR-040) |
| `hooks/tools/useTrimTool.ts` | ~180 | Orchestrates state machine |
| `hooks/tools/useTrimPreview.ts` | ~80 | Mouse-move-driven preview computation |

**Total estimated:** ~1,360 lines. **No file exceeds 500 lines** (largest, `trim-entity-cutter.ts`, may need split into 2 files per entity-family if > 500).

## Files to Modify

| File | Change |
|------|--------|
| `ui/ribbon/data/home-tab-modify.ts:169-174` | Remove `comingSoon: true` from `modify.trim` |
| `ui/ribbon/data/home-tab-modify.ts:301` | Remove `comingSoon: true` from `edit.trim` small button |
| `ui/toolbar/types.ts` | Add `'trim'` to `ToolType` union |
| `systems/tools/ToolStateManager.ts` | Register `trim` tool |
| `hooks/canvas/useCanvasClickHandler.ts` | Route clicks to trim tool when active |
| `hooks/canvas/useCanvasMouseMove.ts` | Feed mouse position to TrimToolStore for hover preview |
| `components/dxf-layout/CanvasLayerStack.tsx` | Mount `TrimPreviewOverlay` as leaf (NEVER subscribe from orchestrator) |
| `config/keyboard-shortcuts.ts` | Wire `TR` shortcut to `trim` tool |
| `snapping/engines/intersection-calculators.ts` | Extend if missing: arc-arc, line-arc, line-ellipse, polyline-arc, polyline-polyline, spline-* |
| `core/commands/CommandRegistry.ts` | Register `TrimEntityCommand` |
| `src/i18n/locales/el/dxf-viewer.json` | Add `ribbon.commands.trim: "Αποκοπή"` + all prompts + keywords |
| `src/i18n/locales/en/dxf-viewer.json` | Add `ribbon.commands.trim: "Trim"` + prompts + keywords |
| `docs/centralized-systems/reference/adr-index.md` | Add ADR-350 entry |
| `.claude-rules/pending-ratchet-work.md` | Update if needed |

---

## Open Design Decisions (Q&A with Giorgio — IN PROGRESS)

| # | Question | Status | Decision |
|---|----------|--------|----------|
| Q1 | Default mode: **Quick** (industry std, since AutoCAD 2021) ή **Standard** (older AutoCAD ≤2020 style)? | ✅ DECIDED 2026-05-15 | **Γρήγορος (Quick)** — `TRIMEXTENDMODE = 1` default. Όλες οι εντότητες δρουν αυτόματα ως cutting edges. Industry std 5/5. |
| Q2 | Quick mode: click su oggetto che NON tocca alcun cutting edge → **delete entirely** (industry std) ή semplice errore? | ✅ DECIDED 2026-05-15 | **Διαγραφή** — η εντότητα σβήνεται εντελώς αν δεν υπάρχει cutting edge. Industry std 5/5. Single-pick Undo επαναφέρει. |
| Q3 | Edge mode default: **No Extend** (industry std, only real intersections) ή **Extend** (virtual extension of boundaries)? | ✅ DECIDED 2026-05-15 | **No Extend default** (`EDGEMODE=0`) + keyword `Ε`/`E` εναλλαγή σε Extend κατά τη σύνοδο. Industry std 5/5. |
| Q4 | Selection methods Phase 1: solo **single pick + Fence + Crossing** ή include anche **press-drag freehand path**? | ✅ DECIDED 2026-05-15 | **Όλα Phase 1**: single-pick + press-drag freehand path + 2-empty-click Fence + Crossing window (keyword `Ο`/`C`). Industry std 5/5. Reuses ADR-345 lasso polygon SSoT + existing crossing-window SSoT. |
| Q5 | CIRCLE trimmed → diventa ARC: **silent** (industry std) ή avviso "Ο κύκλος έγινε τόξο"? | ✅ DECIDED 2026-05-15 | **Σιωπηλή** — όλες οι αλλαγές τύπου (CIRCLE→ARC, ELLIPSE→ELLIPTICAL ARC, SPLINE fit→CV) γίνονται χωρίς toast. Industry std 5/5. Audit trail καταγράφει την αλλαγή τύπου. |
| Q6 | HATCH come oggetto da trim → **non supportato, EXPLODE first** (industry std 5/5, blocco con toast) ή skip silenzioso? | ✅ DECIDED 2026-05-15 | **Απόρριψη με μήνυμα** — toast `Η σκίαση δεν είναι δυνατόν να κοπεί. Διασπάστε την πρώτα (EXPLODE).` Locale key `notifications.trim.hatchNotTrimmable`. Aggregator counts unique hatches per session, single toast. |
| Q7 | SPLINE fit-point → CV conversion silenziosa (industry std) ή avviso utente? | ✅ DECIDED 2026-05-15 (consequenza Q5) | **Σιωπηλή** — η μετατροπή fit→CV γίνεται διαφανώς μέσα στο `TrimEntityCommand.execute()`. Single Ctrl+Z αντιστρέφει και τα δύο. |
| Q8 | Polyline tapered → preserva taper (industry std AutoCAD), oppure scarta taper (BricsCAD older)? | ✅ AUTO 2026-05-15 (industry convergence 5/5) | **Preserva taper**: width adjusted per AutoCAD docs ("width of the extended end is corrected to continue the original taper"). Se impossibile → 0 width point. Implementato in `trim-entity-cutter.ts::trimPolyline`. |
| Q9 | SHIFT+click → invoca EXTEND inverso (industry std 5/5) — Phase 1 ή differire a ADR EXTEND? | ⏸️ pending | — |
| Q10 | Undo granularità: **1 undo step per pick** (industry std AutoCAD) ή **1 undo step per intera sessione TRIM** (più atomico)? | ⏸️ pending | — |
| Q11 | Audit trail (CHECK 3.17): **1 entry per pick** ή **1 entry per sessione** (compact)? | ⏸️ pending | — |
| Q12 | Locked-layer entities: **silent skip** (industry std) ή toast informativo? | ⏸️ pending | — |
| Q13 | Project mode Phase 1: **solo UCS** (2D viewer, default) ή esponi anche None/View come opzioni keyword? | ⏸️ pending | — |
| Q14 | Cursor durante TRIM: **pickbox classico** AutoCAD (piccolo quadrato) ή **crosshair + scissor icon**? | ⏸️ pending | — |
| Q15 | Greek command label: **"Αποκοπή"** (esistente nei locale planning) ή alternativa "Κοπή"/"Ψαλίδι"? | ⏸️ pending | — |
| Q16 | Ribbon "small button" duplicato a `home-tab-modify.ts:301` — tienilo (boy-scout) ή rimuovilo? | ⏸️ pending | — |
| Q17 | TR shortcut a casi-base: **istantaneo TR↵** ή solo da ribbon? | ⏸️ pending | — |
| Q18 | Snap engine durante pick: **tutti i snap attivi** (endpoint/midpoint/intersection/nearest) ή **solo nearest-on-curve** (più predicibile)? | ⏸️ pending | — |

---

## Constraints

- ADR-040: `TrimPreviewOverlay` MUST be a micro-leaf subscriber, NOT rendered from `CanvasSection`/`CanvasLayerStack` orchestrators.
- ADR-040: No `useSyncExternalStore` in orchestrators.
- No entity mutation during preview — preview is read-only overlay.
- ESC always cancels without side effects.
- Undo granularity decided in Q10.
- Shortcut: `TR` (two-key, matches AutoCAD).
- Locked layer entities silently ignored (industry standard) — confirmation Q12.
- Pure Greek locale labels (no English words in `el/dxf-viewer.json`).
- Enterprise IDs for any new entities created via type promotion (CIRCLE→ARC, polyline split, etc.).
- Reuses existing `intersection-calculators.ts` SSoT — extends only where missing entity-pair coverage.

---

## Sources

- AutoCAD 2026 — TRIM (Command): `help.autodesk.com/view/ACD/2026/ENU/?guid=GUID-B1A185EF-07C6-4C53-A76F-05ADE11F5C32`
- AutoCAD 2026 — About Trimming and Extending Objects: `help.autodesk.com/view/ACD/2024/ENU/?guid=GUID-725D3A7A-5E52-47F0-BA7A-7D15F9EF6D7F`
- TRIMEXTENDMODE System Variable: AutoCAD Knowledge Network + BricsCAD Help
- BricsCAD V25 — TRIM command: `help.bricsys.com/en-us/document/command-reference/t/trim-command`
- BricsCAD — Trimming Entities (workflow): `help.bricsys.com/en-us/document/bricscad/modifying-entities/trimming-entities`
- ZWCAD 2026 — TRIM command (vendor docs)
- GstarCAD 2025 — TRIM command knowledge base
- progeCAD 2025 — Trim documentation
- CAD Master Coach — Practical TRIM uses + circle/hatch behaviors
- Hagerman Blog — TRIM, EXTEND, BREAKATPOINT comparison

---

## Changelog

| Date | Change |
|------|--------|
| 2026-05-15 | ADR-350 v0.1 DRAFT created. Phase 1 (recognition + Q&A) in progress. 18 open Q&A items. |
| 2026-05-15 | Q1 decided: Default mode = **Quick** (`TRIMEXTENDMODE=1`). |
| 2026-05-15 | Q2 decided: Quick mode, no-intersection click → **delete entirely** (industry std 5/5). |
| 2026-05-15 | Q3 decided: Edge mode default = **No Extend** + keyword toggle `Ε`/`E`. Industry std 5/5. |
| 2026-05-15 | Q4 decided: Selection methods = **all 4** (pick + freehand drag + fence + crossing). |
| 2026-05-15 | Q5 decided: Type-promotion (CIRCLE→ARC, ELLIPSE→ELLIPTICAL ARC, SPLINE fit→CV) = **silent**. |
| 2026-05-15 | Q6 decided: HATCH not trimmable → toast `Διασπάστε την πρώτα (EXPLODE)`. |
| 2026-05-15 | Q7 decided: SPLINE fit→CV silent (consequenza Q5). |
| 2026-05-15 | Q8 auto-decided: Tapered polyline preserves taper (industry std 5/5). |
