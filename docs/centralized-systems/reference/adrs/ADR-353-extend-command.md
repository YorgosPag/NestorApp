# ADR-353: Extend Command (Επέκταση)

**Status:** ✅ FULLY IMPLEMENTED — Phase 2 + Phase 3 complete (2026-05-15)
**Date:** 2026-05-15
**Domain:** DXF Viewer — Modify Tools
**Shortcut:** `EX` (matches AutoCAD)
**Ribbon:** Home → Modify → **Επέκταση** (`modify.extend`, currently `comingSoon: true` — to be flipped)
**Related ADRs:** ADR-345 (DXF Ribbon Interface), ADR-348 (Scale Command), ADR-349 (Stretch Command), ADR-350 (Trim Command — dual operation + existing math SSoT), ADR-040 (Preview Canvas Performance), ADR-031 (Enterprise Command Pattern / Undo–Redo), ADR-189 (Construction Guides), ADR-027 (DXF Keyboard Shortcuts), ADR-195 (Audit Value Catalogs), ADR-001 (Select/Dropdown), ADR-065 (file size geometry split)

---

## Context

The DXF Viewer ribbon (ADR-345) includes an **Extend** (Επέκταση) button in the Modify panel (`HOME_MODIFY_PANEL` flyout, file `ui/ribbon/data/home-tab-modify.ts:176-187`, plus a small twin at line ~310), currently marked `comingSoon: true`. EXTEND is **the dual operation of TRIM** — where TRIM shortens an entity at an intersection, EXTEND **grows** an entity from its nearest endpoint to the nearest boundary intersection.

The **critical architectural fact for this ADR**: TRIM (ADR-350) already implemented SHIFT+click-as-EXTEND in its Phase 1 (Q9 decision). As a result, `systems/trim/trim-entity-cutter.ts` **already contains `extendLine`, `extendArc`, and `extendPolyline` functions**. ADR-353 promotes these to a **first-class standalone command** — it does NOT duplicate the math.

Distinct from neighboring modify commands:

| Command | Direction | Intersection? | Result |
|---------|-----------|---------------|--------|
| **EXTEND** | grows entity | ✅ yes — reaches boundary | Entity lengthened to touch boundary |
| **TRIM** | shrinks entity | ✅ yes — cuts at boundary | Entity shortened / split |
| **LENGTHEN** | grows/shrinks | ❌ no boundary needed | Length changed by delta/percent/total/dynamic |
| **STRETCH** | deforms | ❌ no boundary | Vertices displaced by delta |

TRIM and EXTEND are **dual operations** — Shift+click during EXTEND invokes TRIM, and vice versa (ADR-350 Q9 already implements SHIFT→EXTEND inside TRIM; this ADR does the symmetric SHIFT→TRIM inside EXTEND).

---

## Industry Research (2026-05-15)

Deep dive across **5 major CAD platforms**: AutoCAD 2026, BricsCAD V25, ZWCAD 2026, GstarCAD 2025, progeCAD 2025.

### Command Flow — AutoCAD (industry canonical)

**Quick mode (TRIMEXTENDMODE=1, default since AutoCAD 2021):**
```
Command: EX
Select objects to extend or Shift-select to trim or
  [Boundary/Fence/Crossing/mOde/Project/Edge/Undo]:
  → click near endpoint of entity to extend → entity grows to nearest boundary
  → ENTER or ESC to exit
```

**Standard mode (TRIMEXTENDMODE=0, two-phase):**
```
Command: EX
Select boundary edges... (or <select all>):
  → pick boundary entities → ENTER
Select object to extend or [...]:
  → click near endpoint to extend → entity grows to picked boundaries
```

### Industry Consensus (5/5 vendors)

| Feature | AutoCAD | BricsCAD | ZWCAD | GstarCAD | progeCAD |
|---------|---------|----------|-------|----------|----------|
| Quick mode (`TRIMEXTENDMODE=1` default) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Standard mode (`TRIMEXTENDMODE=0`) | ✅ | ✅ | ✅ | ✅ | ✅ |
| EDGEMODE (0=actual, 1=implied/virtual) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Nearest-endpoint detection (pick point) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Shift+click = TRIM inverse | ✅ | ✅ | ✅ | ✅ | ✅ |
| Real-time hover preview (ghost extension) | ✅ (2018+) | ✅ | ✅ | ✅ | ✅ |
| Fence selection | ✅ | ✅ | ✅ | ✅ | ✅ |
| Crossing window selection | ✅ | ✅ | ✅ | ✅ | ✅ |
| In-command Undo (U) | ✅ | ✅ | ✅ | ✅ | ✅ |

### Extendable Entity Types (all vendors)

- LINE
- ARC (open)
- LWPOLYLINE / POLYLINE (open only — first/last segment)
- RAY
- Open SPLINE

**Cannot be extended:** Circles, closed polylines, closed splines, ellipses, xlines (already infinite), text, hatches, blocks.

### Valid Boundary Edge Types

- LINE, ARC, CIRCLE, POLYLINE, ELLIPSE, SPLINE, RAY, XLINE, LAYOUT VIEWPORT, associative HATCH boundary.

### System Variables

| Variable | Values | Meaning |
|----------|--------|---------|
| `TRIMEXTENDMODE` | 0=Standard, 1=Quick | Mode selection |
| `EDGEMODE` | 0=No extend, 1=Extend (implied) | Virtual boundary extension |
| `PROJMODE` | 0=None, 1=UCS, 2=View | Projection (2D viewer: always UCS) |
| `COMMANDPREVIEW` | 0/1 | Real-time ghost preview on hover |

### EDGEMODE — Natural Extension Concept

- `EDGEMODE=0` (default): Entity can only extend to actual physical boundary geometry
- `EDGEMODE=1`: Boundary entities are virtually extended along their natural path (lines→infinite, arcs→full circle, elliptical arcs→full ellipse) for intersection computation only; the boundary itself is NOT modified

### Pick-Point → Nearest Endpoint Rule (Universal)

**Critical:** The endpoint **nearest to the user's pick point** is the one that gets extended.

- Click near left end of a line → left end grows
- Click near right end → right end grows
- Click near start point of an arc → start angle extends CW (or CCW depending on arc direction)
- Click near end point of an arc → end angle extends CCW
- For polylines: nearest open endpoint (start or end of the entire polyline)

### EDGEMODE=1 Options

| # | Option | Key | Description |
|---|--------|-----|-------------|
| 1 | Boundary | B | Add/reselect boundary edges (Standard mode) |
| 2 | Fence | F | Extend all entities crossing a freehand fence path |
| 3 | Crossing | C | Extend entities crossing a crossing window |
| 4 | mOde | O | Toggle Quick/Standard |
| 5 | Project | P | Set projection: None/UCS/View |
| 6 | Edge | E | Toggle EDGEMODE (actual/implied) |
| 7 | Undo | U | Undo last extension |

---

## Core Mathematics

### Extension Algorithm — Line

**Input:** LineEntity (A→B), pickPoint P, boundaries `{Cᵢ}`.

**Step 1 — Determine extending endpoint:**
```
distA = distance(pickPoint, A)
distB = distance(pickPoint, B)
extendEnd = (distA < distB) ? A : B
otherEnd  = (extendEnd == A) ? B : A
direction = normalize(extendEnd - otherEnd)   // extension ray direction
```

**Step 2 — Parametric forward ray:**
```
Ray: R(t) = extendEnd + t × direction,   t > 0
```

**Step 3 — Find all boundary intersections with t > ε:**
```
for each boundary Cᵢ:
    s = intersectRayWithBoundary(extendEnd, direction, Cᵢ)
    if s > EPSILON:
        candidates.push({ s, point: extendEnd + s × direction, boundaryId: Cᵢ.id })

candidates.sort(by s ascending)
result = candidates[0]  // nearest forward intersection
```

**Step 4 — Update line:**
```
if extendEnd === B: line.endPoint = result.point
else:              line.startPoint = result.point
```

> **SSoT note:** This algorithm is already implemented in `trim-entity-cutter.ts::extendLine` (ADR-350 Q9). ADR-353 reuses it directly.

### Extension Algorithm — Arc

**Input:** ArcEntity (center, radius, startAngle, endAngle), pickPoint P.

**Step 1 — Determine extending end:**
```
startPt = center + radius × (cos(startAngle), sin(startAngle))
endPt   = center + radius × (cos(endAngle),   sin(endAngle))
extendingStart = distance(pickPoint, startPt) < distance(pickPoint, endPt)
```

**Step 2 — Circle-boundary intersection:**
For each boundary, compute intersection of the arc's full circle with the boundary geometry (circle-line or circle-circle intersection — existing SSoT `intersection-calculators.ts`).

**Step 3 — Convert to angles, select forward:**
- If extending `endAngle` end: find angle that is **angularly forward** (CCW for CCW arcs) from `endAngle`, closest.
- If extending `startAngle` end: find angle angularly backward (CW) from `startAngle`, closest.

**Step 4 — Validate:** intersection must not already be inside arc span.

**Step 5 — Update:**
```
if extendingEnd:   arc.endAngle   = chosenAngle
else:              arc.startAngle = chosenAngle
```

> **SSoT note:** Already in `trim-entity-cutter.ts::extendArc` (ADR-350 Q9). ADR-353 reuses.

### Extension Algorithm — Open Polyline

Only the **first** (start) and **last** (end) segments are extensible:
- Identify terminal segment type (line or arc)
- Apply corresponding `extendLine` or `extendArc` to the terminal segment
- Update the terminal vertex position

> **SSoT note:** Already in `trim-entity-cutter.ts::extendPolyline` (ADR-350 Q9). ADR-353 reuses.

### No-Intersection Edge Cases

| Scenario | Behavior |
|----------|----------|
| No boundary in Quick mode | Entity **unchanged** — no deletion (EXTEND≠TRIM; TRIM deletes, EXTEND is a no-op) |
| Extension direction = backward (t < 0) | Ignored — wrong direction |
| Parallel entity and boundary | No intersection; entity unchanged |
| Already touches boundary | No-op (already extended) |
| Entity is closed (circle, closed poly) | Silently skipped |
| Multiple valid boundaries | **Nearest** forward intersection wins (smallest t > ε) |
| EDGEMODE=1, boundary very far | Extension can go far along natural path — user intent |

---

## Decision

Implement the `extend` command in **a single complete phase** (per `feedback_completeness_over_mvp`: no MVP/phased variants).

**Default settings (industry convergence, pending Q&A confirmation):**
- Mode: **Quick** (`TRIMEXTENDMODE = 1`) ✅ Q1
- Edge: **No Extend** (`EDGEMODE = 0`) ✅ Q3
- Project: **UCS** (`PROJMODE = 1`, 2D viewer — same as TRIM) ✅ auto

**UX Flow (Quick mode):**

```
QUICK MODE (default)

PHASE 1: ACTIVATION
  → User presses ribbon "Επέκταση" / shortcut EX / Enter from previous EXTEND session
  → Status bar: "Επιλέξτε αντικείμενα προς επέκταση ή [Όρια(Ο) / Φράχτης(Φ) / Διασταύρωση(Δ) / Λειτουργία(Λ) / Άκρη(Ε) / Αναίρεση(Α)]:"
  → Cursor: crosshair + extend-arrow icon (12×12px badge)

PHASE 2: PICK / SELECT
  → Single click near endpoint of entity → entity extends to nearest boundary
  → Press-drag freehand path → all entities crossed by path extend
  → "Ο" / "B" → boundary keyword (Standard mode toggle)
  → "Φ" / "F" → Fence (line between two points)
  → "Δ" / "C" → Crossing window
  → "Λ" / "M" → toggle Quick/Standard
  → "Ε" / "E" → toggle Edge mode (actual/implied boundary extension)
  → "Α" / "U" → Undo last extension within this session
  → ENTER or right-click on empty → exit EXTEND
  → SHIFT+click → behaves as TRIM on that pick (Q&A item Q4)
  → ESC → cancel session entirely

PHASE 3: APPLY
  → For each picked entity:
    a) Determine extending endpoint (nearest to pick point)
    b) Cast forward ray from that endpoint
    c) Resolve boundaries (Quick: all visible entities; Standard: selected set)
    d) Find nearest forward intersection (smallest t > ε)
    e) If no intersection → entity unchanged (no deletion)
    f) Call extendLine/extendArc/extendPolyline from trim-entity-cutter.ts SSoT
    g) Create ExtendEntityCommand (undoable) + push to CommandHistory
    h) EntityAuditService.recordChange() (CHECK 3.17)
  → Live preview overlay (semi-transparent green/blue) on hover shows ghost extension

PHASE 4: LOOP
  → Command stays active; user picks again
  → ENTER / ESC / right-click exits
```

---

## 🚨 Implementation Mandate (SSOT + Google-Level) — NON-NEGOTIABLE

**Before writing a single line of code**, the implementing agent MUST:

1. **Search all centralized systems first.** Read `docs/centralized-systems/README.md` and grep `.ssot-registry.json`. **MANDATORY reuse list**:
   - Extend math (line/arc/polyline) → **`systems/trim/trim-entity-cutter.ts::extendLine/extendArc/extendPolyline`** (existing SSoT from ADR-350 Q9) — REUSE, never duplicate
   - Boundary resolution (Quick/Standard/locked filter) → **`systems/trim/trim-boundary-resolver.ts::resolveCuttingEdges`** — REUSE directly; extend and trim share identical boundary semantics
   - Virtual edge extension (EDGEMODE=1) → **`systems/trim/trim-edge-extender.ts`** — REUSE directly
   - Intersection math → **`snapping/engines/intersection-calculators.ts`** + **`snapping/shared/GeometricCalculations.ts`** (existing SSoT)
   - Polyline segment iteration → **`rendering/entities/shared/geometry-rendering-utils.ts::getPolylineSegments`** (existing SSoT)
   - Entity type guards → **`types/entities.ts`** (isLineEntity, isArcEntity, isLWPolylineEntity, etc.) — existing SSoT
   - Command pattern → **`core/commands/interfaces.ts::ICommand`** + **`core/commands/CommandHistory.ts`** (existing SSoT)
   - Spatial index → **`core/spatial/SpatialIndexFactory.ts`** + **`ISpatialIndex.ts`** + **`HitTester.ts`** (existing SSoT — same as TRIM G22)
   - Audit trail → **`services/entity-audit.service.ts::EntityAuditService.recordChange()`** (existing SSoT, CHECK 3.17)
   - Status-bar prompts → **`toolHintOverrideStore`** (existing SSoT, used by ADR-348/349/350)
   - Cursor SSoT → **`systems/cursor/ToolCursorStore.ts`** — extend with `'extend-arrow'` variant (already planned in ADR-350 B2)
   - Locked-layer filter → **`filterLockedEntities`** pattern from `useStretchTool.ts` / promote to helper if used ≥3×
   - Notification keys → **`NOTIFICATION_KEYS`** registry (existing SSoT)
   - Ribbon button → already exists in `home-tab-modify.ts` — only flip `comingSoon: false`

2. **The ONLY truly new code for EXTEND** (not reused from TRIM):
   - `systems/extend/ExtendToolStore.ts` — state machine (different state shape than TrimToolStore)
   - `systems/extend/extend-intersection-caster.ts` — forward-ray cast + nearest-t selection logic
   - `core/commands/entity-commands/ExtendEntityCommand.ts` — wraps calls to existing extendLine/Arc/Polyline
   - `components/dxf-layout/ExtendPreviewOverlay.tsx` — leaf subscriber, ADR-040 (ghost extension preview, green color)
   - `hooks/tools/useExtendTool.ts` — orchestrates state machine
   - `hooks/tools/useExtendPreview.ts` — hover preview computation

3. **Reject duplicates.** If similar utility exists, **extend it**. Do NOT create `extend-boundary-resolver.ts` — call `resolveCuttingEdges` from `trim-boundary-resolver.ts` directly.

4. **Google-level quality (N.7, N.7.1, N.7.2).** Every file ≤ 500 lines, every function ≤ 40 lines, optimistic updates, zero race conditions, proactive lifecycle, idempotent commands, belt-and-suspenders error handling.

5. **No `any` / `as any` / `@ts-ignore`.** Discriminated unions, function overloads, generics only.

6. **Pure Greek locale (N.11).** All user-facing strings via `t('namespace.key')`. New keys added to `el/dxf-viewer.json` AND `en/dxf-viewer.json` BEFORE code references them.

7. **ADR-040 micro-leaf compliance.** `ExtendPreviewOverlay` MUST be a leaf subscriber. NEVER subscribe from `CanvasSection` / `CanvasLayerStack` orchestrators. Event handlers receive getter functions, not snapshots.

8. **Pre-commit hooks must pass.** SSoT ratchet (CHECK 3.7, 3.18), i18n (3.8), entity audit coverage (3.17), dead-code ratchet (3.22), file size (≤500 lines), ADR-040 micro-leaf gates (6B/6C/6D). No `--no-verify`.

9. **ADR-driven workflow (N.0.1, 4 phases).** Phase 2 starts only after all Q&A items resolved. Phase 3 updates this ADR changelog. Phase 4 commits code + ADR together.

---

## Architecture

### Files to Create (new)

| File | Lines (est) | Role |
|------|-------------|------|
| `systems/extend/ExtendToolStore.ts` | ~110 | State machine + pub/sub store |
| `systems/extend/extend-intersection-caster.ts` | ~120 | Forward-ray cast → nearest boundary intersection per entity |
| `core/commands/entity-commands/ExtendEntityCommand.ts` | ~120 | Undoable command (wraps extendLine/Arc/Polyline SSoT) |
| `components/dxf-layout/ExtendPreviewOverlay.tsx` | ~70 | Live preview leaf subscriber (ADR-040) — ghost green extension |
| `hooks/tools/useExtendTool.ts` | ~180 | Orchestrates state machine |
| `hooks/tools/useExtendPreview.ts` | ~80 | Mouse-move hover preview computation |

**Total estimated:** ~680 lines. No file exceeds 500 lines.

### Files to Modify

| File | Change |
|------|--------|
| `ui/ribbon/data/home-tab-modify.ts:180-186` | Flip `comingSoon: false` on `modify.extend` |
| `ui/ribbon/data/home-tab-modify.ts:~310-311` | Flip `comingSoon: false` on `edit.extend` small button |
| `ui/toolbar/types.ts` | Add `'extend'` to `ToolType` union |
| `systems/tools/ToolStateManager.ts` | Register `extend` tool (same category as `trim`) |
| `hooks/canvas/useCanvasClickHandler.ts` | Route clicks to extend tool when active |
| `hooks/canvas/useCanvasMouseMove.ts` | Feed mouse position to ExtendToolStore for hover preview |
| `components/dxf-layout/canvas-layer-stack-leaves.tsx` | Mount `ExtendPreviewOverlay` as leaf (NEVER from orchestrator) |
| `config/keyboard-shortcuts.ts` | Wire `EX` shortcut to `extend` tool |
| `systems/cursor/ToolCursorStore.ts` | Add `'extend-arrow'` variant (ADR-350 B2 already planned this) |
| `core/commands/CommandRegistry.ts` | Register `ExtendEntityCommand` |
| `src/i18n/locales/el/dxf-viewer.json` | Add `ribbon.commands.extend`, `extendTool.*` prompts, `notifications.extend.*` |
| `src/i18n/locales/en/dxf-viewer.json` | Mirror with English values |
| `docs/centralized-systems/reference/adr-index.md` | Add ADR-353 entry |
| `docs/centralized-systems/reference/adrs/ADR-350-trim-command.md` | Add note: SHIFT+TRIM is now wired to standalone EXTEND (ADR-353) |
| `.claude-rules/pending-ratchet-work.md` | Add/update if needed |
| `ui/ribbon/components/buttons/RibbonButtonIconPaths.tsx` | Verify `'extend'` icon key; add SVG extend-arrow if missing |

### Reused WITHOUT Modification

| File | What is reused |
|------|----------------|
| `systems/trim/trim-entity-cutter.ts` | `extendLine`, `extendArc`, `extendPolyline` (ADR-350 Q9) |
| `systems/trim/trim-boundary-resolver.ts` | `resolveCuttingEdges` — identical semantics for extend boundaries |
| `systems/trim/trim-edge-extender.ts` | EDGEMODE=1 virtual boundary extension |
| `snapping/engines/intersection-calculators.ts` | All intersection math |
| `core/spatial/SpatialIndexFactory.ts` + `HitTester.ts` | Spatial queries |
| `core/commands/interfaces.ts` | ICommand interface |
| `core/commands/CommandHistory.ts` | Undo stack |
| `services/entity-audit.service.ts` | CHECK 3.17 audit trail |
| `toolHintOverrideStore` | Status bar prompts |

### State Machine

```
IDLE → ACTIVE_QUICK / ACTIVE_STANDARD_SELECT_EDGES → ACTIVE_STANDARD_PICK
                                ↑ ENTER
ESC always returns to IDLE without side effects.
ENTER / right-click on empty exits to IDLE.
```

### ExtendToolStore — Shape

```typescript
interface ExtendToolState {
  phase: 'idle' | 'selectingEdges' | 'picking' | 'fence' | 'crossing';
  mode: 'quick' | 'standard';
  edgeMode: 'noExtend' | 'extend';
  projectMode: 'none' | 'ucs' | 'view';
  boundaryEdgeIds: ReadonlyArray<string>;   // empty in Quick = "all entities"
  hoverPickPoint: WorldPoint | null;
  hoverPreviewGeom: PreviewGeom | null;     // ghost extension path
  inverseMode: boolean;                     // true if SHIFT held → TRIM
}
```

### ExtendEntityCommand

```typescript
export class ExtendEntityCommand implements ICommand {
  readonly type = 'extend';

  constructor(
    private operations: ReadonlyArray<ExtendOperation>,
    private sceneManager: LevelSceneManagerAdapter,
  ) {}

  execute(): void { /* apply each ExtendOperation */ }
  undo(): void { /* restore originals */ }
}

type ExtendOperation =
  | { kind: 'extend'; entityId: string; originalGeom: EntityGeometry; newGeom: EntityGeometry }
  | { kind: 'noOp'; entityId: string }  // no intersection found
```

### Live Preview (ADR-040 Micro-Leaf)

```
ExtendToolStore (pub/sub, no React)
  → ExtendPreviewOverlay (SVG canvas layer leaf subscriber)
  → Subscribes to hoverPickPoint + hoverPreviewGeom
  → Renders green semi-transparent dash showing the ghost extension from endpoint to boundary
  → 60fps via UnifiedFrameScheduler
```

### Preview Color Coding

- **Green** ghost = extension preview (EXTEND active)
- **Red** ghost = removal preview (SHIFT held → TRIM inverse, reuses TrimPreviewOverlay color)
- Cursor badge auto-toggles: extend-arrow icon ↔ scissor icon on SHIFT keydown/keyup

---

## Open Design Decisions (Q&A with Giorgio — IN PROGRESS)

| # | Question | Status | Decision |
|---|----------|--------|----------|
| Q1 | Default mode: **Quick** (industry std, since AutoCAD 2021) or **Standard** (classic two-phase)? | ✅ DECIDED 2026-05-15 | **Γρήγορος (Quick)** — `TRIMEXTENDMODE=1` default. Όλες οι οντότητες αυτόματα ως όρια. Industry std 5/5. Συνέπεια με ADR-350 Q1. |
| Q2 | Quick mode, no boundary found → entity **unchanged** (no deletion, unlike TRIM) or error toast? | ✅ DECIDED 2026-05-15 | **Μένει ως έχει** — no-op silenzioso. Industry std. Nessun toast, nessuna cancellazione. |
| Q3 | Edge mode default: **No Extend** (EDGEMODE=0, only real intersections) or **Extend** (implied/virtual)? | ✅ DECIDED 2026-05-15 | **No Extend** (`EDGEMODE=0`) default. Μόνο πραγματικές τομές. Keyword `Ε`/`E` εναλλαγή κατά σύνοδο. Industry std 5/5. Συνέπεια με ADR-350 Q3. |
| Q4 | SHIFT+click during EXTEND → TRIM inverse (mirror of ADR-350 Q9): Phase 1 or deferred? | ✅ DECIDED 2026-05-15 | **Phase 1** — SHIFT+click εντός EXTEND → TRIM inverse. Συμμετρικό με ADR-350 Q9. Cursor scissor icon αυτόματα με SHIFT. Industry std 5/5. |
| Q5 | Greek label for ribbon button: keep "Επέκταση" or alternate (Μήκυνση, Προέκταση, other)? | ✅ DECIDED 2026-05-15 | **"Επέκταση"** — `ribbon.commands.extend = "Επέκταση"`. Locale key confermato. |
| Q6 | Selection methods Phase 1: solo **single click** or also **fence/crossing/press-drag**? | ✅ DECIDED 2026-05-15 | **Όλοι οι τρόποι Phase 1**: single-click + press-drag freehand + 2-click fence + crossing window. Συνέπεια με ADR-350 Q4. Industry std 5/5. |
| Q7 | Undo granularity: **1 step per pick** (industry std) or **1 step per session**? | ✅ DECIDED 2026-05-15 | **1 step per pick** — κάθε κλικ = ξεχωριστό `ExtendEntityCommand` στο `CommandHistory`. Industry std 5/5. Συνέπεια με ADR-350 Q10. |
| Q8 | Shortcut: **EX** (matches AutoCAD/BricsCAD) or other? | ✅ DECIDED 2026-05-15 | **EX** — wired via `config/keyboard-shortcuts.ts` SSoT. Industry std 5/5. |
| Q9 | Cursor icon during EXTEND: **extend-arrow badge** (ToolCursorStore SSoT) or different? | ✅ DECIDED 2026-05-15 | **extend-arrow badge** via `ToolCursorStore`. Auto-toggle σε scissor icon με SHIFT. Reuse pattern ADR-350 B2. |

---

## Open Design Decisions — Round 2 (Gap Analysis 2026-05-15)

Dopo rilettura completa post-Q&A Round 1, identificati 12 gap. Risolti come segue.

### ✅ DECISIONE GIORGIO (Gap A)

| Gap | Decisione |
|-----|-----------|
| **Fence/Crossing → quale endpoint?** | **Endpoint più vicino al punto di intersezione fence×entità** — stesso criterio del singolo pick. Industry std AutoCAD/BricsCAD. |

### 🟡 AUTO-DECISIONI (industry std + coerenza ADR-350)

| # | Gap | Decisione + motivazione |
|---|-----|-------------------------|
| G1 | Right-click durante sessione | **= ENTER (esce)** — industry std 5/5. ADR-350 G6. Nessun context menu. |
| G2 | ESC durante fence drag a metà | **= Uscita totale** — single ESC sempre termina. ADR-350 G15. Operazioni già confermate restano. |
| G3 | Soglia drag (click vs press-drag) | **5px world-space** — riusa costante ADR-350 G7. `mouseup entro 5px = click; oltre = fence drag`. |
| G4 | Snap durante pick (quale endpoint viene esteso) | **Solo `nearest-on-entity`** — prevedibile per la regola "endpoint più vicino". ADR-350 Q18. |
| G5 | Entità = suo stesso confine (self-boundary) | **Skip silenzioso** — impossible geometricamente, ignorato. |
| G6 | Standard mode: ENTER senza selezionare confini | **= Tutte le entità come confini** — equivalente Quick mode. Industry std 5/5. |
| G7 | SHIFT→TRIM inside EXTEND: quale comando in CommandHistory? | **`TrimEntityCommand`** riusato (SSOT). Simmetrico con ADR-350 Q9 (`TrimEntityCommand::kind:'extend'` per SHIFT+EXTEND in TRIM). Undo label: `"Αναίρεση Ψαλιδίσματος"`. |
| G8 | `noIntersectionFound` — silent o status bar? | **Status bar ephemereo** (non toast popup) — `toolHintOverrideStore` mostra `extendTool.noIntersection` per 2s poi torna al prompt normale. Coerente con AutoCAD command line feedback. La chiave i18n `notifications.extend.noIntersectionFound` → spostata in `extendTool.noIntersection`. |
| G9 | Fence preview durante drag | **Ghost verde** (estensioni semi-trasparenti) calcolate a 80ms throttle — stesso pattern `trim-fence-hit-detector.ts` ma inverte operazione: mostra estensione anziché rimozione. Spatial index assicura <16ms. |
| G10 | Audit trail formato | `{ op: 'extend', pickPoint, affectedEntityIds, operations: ExtendOperation[] }` — ADR-350 Q11 pattern. |
| G11 | Toast aggregatore locked layer | Singolo toast aggregato a fine sessione — `NOTIFICATION_KEYS` + pattern `warningAggregator` in `ExtendToolStore`. ADR-350 G9. |
| G12 | Status bar icon key | `'extend'` — `toolHintOverrideStore` with `iconKey: 'extend'`. ADR-350 G13 pattern. |

---

## Test Plan

### Unit Tests

| Module | Scenarios |
|--------|-----------|
| `extend-intersection-caster.ts` | (a) line → forward intersection found, (b) line → no intersection (no-op), (c) line → multiple boundaries → nearest wins, (d) arc endpoint detection, (e) polyline open end detection, (f) closed entity skipped |
| `ExtendEntityCommand.ts` | execute + undo round-trip (LINE/ARC/POLYLINE), no-op operation type |
| `trim-entity-cutter.ts::extendLine` (existing) | Covered by ADR-350 test suite — no re-test needed |

### Integration Tests

- `useExtendTool.test.tsx`: state machine transitions, ESC behavior, SHIFT→TRIM inversion, Quick/Standard mode toggle
- `extend-intersection-caster.test.ts`: full ray-cast + boundary selection (Quick/Standard)
- `ExtendPreviewOverlay.test.tsx`: render assertion, no orchestrator-level subscription (ADR-040 gate)

### Performance Benchmarks

- `extend-performance.bench.ts`: pick on 100 / 1000 / 5000 / 50000 entity scenes. Target: <16ms / pick with spatial index reuse.

---

## i18n Keys

### `src/i18n/locales/el/dxf-viewer.json` (additions)

```json
{
  "ribbon": {
    "commands": {
      "extend": "Επέκταση"
    }
  },
  "extendTool": {
    "prompt.pick": "Επιλέξτε αντικείμενα προς επέκταση ή [Όρια(Ο) / Αναίρεση(Α) / Λειτουργία(Λ) / Άκρη(Ε)]:",
    "prompt.standardEdges": "Επιλέξτε όρια ή πατήστε ENTER για όλα:",
    "prompt.trimming": "ΨΑΛΙΔΙΣΜΑ: επιλέξτε αντικείμενα (κρατήστε SHIFT):",
    "mode.quick": "Λειτουργία: Γρήγορη",
    "mode.standard": "Λειτουργία: Κλασική",
    "edge.noExtend": "Άκρη: Χωρίς νοερή προέκταση",
    "edge.extend": "Άκρη: Με νοερή προέκταση",
    "undo.empty": "Δεν υπάρχει επέκταση για αναίρεση",
    "noIntersection": "Δεν βρέθηκε όριο για επέκταση"
  },
  "notifications": {
    "extend": {
      "lockedSkipped_one": "1 οντότητα σε κλειδωμένο επίπεδο παραλείφθηκε",
      "lockedSkipped_other": "{{count}} οντότητες σε κλειδωμένο επίπεδο παραλείφθηκαν"
    }
  }
}
```

> **Note:** Greek label `"Επέκταση"` is preliminary — confirmed in Q5.

---

## Constraints

- ADR-040: `ExtendPreviewOverlay` MUST be a micro-leaf subscriber.
- ADR-040: No `useSyncExternalStore` in `CanvasSection`/`CanvasLayerStack` orchestrators.
- No entity mutation during preview — preview is read-only overlay.
- ESC always cancels without side effects.
- Shortcut: `EX` (two-key, matches AutoCAD).
- Locked layer entities silently ignored (industry standard).
- Pure Greek locale labels (no English words in `el/dxf-viewer.json`).
- **CRITICAL SSoT rule:** DO NOT reimplement extend math — call `trim-entity-cutter.ts::extendLine/extendArc/extendPolyline` directly.
- **CRITICAL SSoT rule:** DO NOT create `extend-boundary-resolver.ts` — call `trim-boundary-resolver.ts::resolveCuttingEdges` directly.

---

## Sources

- AutoCAD 2026 — EXTEND (Command): `help.autodesk.com/cloudhelp/2023/ENU/AutoCAD-Core/files/GUID-89DD7B0F-F4F1-410D-9A3A-5847CA5F8744.htm`
- AutoCAD 2021 — TRIMEXTENDMODE change: `help.autodesk.com/cloudhelp/2021/ENU/AutoCAD-WhatsNew/files/GUID-7F5F20DC-819A-42D6-A9EB-EA1F0D7943C2.htm`
- AutoCAD — EDGEMODE System Variable: `help.autodesk.com/cloudhelp/2021/ENU/AutoCAD-Core/files/GUID-ED7D2A22-0C65-49C3-A58E-D10A3BECBE57.htm`
- BricsCAD V25 — EXTEND command: `help.bricsys.com/en-us/document/command-reference/e/extend-command`
- BricsCAD — Extending Entities: `help.bricsys.com/en-us/document/bricscad/modifying-entities/extending-entities`
- CAD Master Coach — EXTEND practical guide: `cadmastercoach.com/commands/modify/extend`
- Onshape — Extend Sketch: `cad.onshape.com/help/Content/Sketch/extend.htm`
- GeometricTools — Line-Circle Intersection: `geometrictools.com/Documentation/IntersectionLine2Circle2.pdf`
- QCAD — Trim/Extend unified tool: `qcad.org/doc/qcad/3.1.0/reference/en/scripts/Modify/Trim/doc/Trim_en.html`

---

## Changelog

| Date | Change |
|------|--------|
| 2026-05-15 | ADR-353 v0.1 DRAFT created. Phase 1 — Industry research complete (5 platforms). Q&A open (9 questions). Key insight: extend math SSoT already exists in `trim-entity-cutter.ts` (ADR-350 Q9). |
| 2026-05-15 | **Phase 1 Q&A Round 1 COMPLETE — 9/9 resolved.** Q1: Quick mode. Q2: no-op silenzioso. Q3: EDGEMODE=0. Q4: SHIFT→TRIM Phase 1. Q5: "Επέκταση". Q6: tutti 3 metodi. Q7: 1 undo per pick. Q8: EX. Q9: extend-arrow cursor. |
| 2026-05-15 | **Phase 1 Q&A Round 2 COMPLETE — 12 gap risolti.** Gap A (Giorgio): fence endpoint = più vicino all'intersezione. G1-G12 auto-decisi: right-click=ENTER, ESC=uscita totale, 5px drag threshold, nearest-snap, self-boundary skip, Standard ENTER=all, SHIFT→TRIM usa TrimEntityCommand (SSOT), noIntersection→status bar efimero, fence preview verde 80ms throttle, audit trail format, locked aggregator toast, status bar icon='extend'. |
| 2026-05-15 | **Phase 2 IMPLEMENTATION COMPLETE.** 6 new files created: `extend-types.ts`, `ExtendToolStore.ts`, `extend-intersection-caster.ts`, `ExtendEntityCommand.ts`, `useExtendPreview.ts`, `useExtendDragCapture.ts`, `useExtendTool.ts`, `ExtendPreviewOverlay.tsx`. 14 existing files modified: i18n (tool-hints el+en), `types.ts` (ToolType), `keyboard-shortcuts.ts`, `ToolStateManager.ts`, `CommandRegistry.ts`, `canvas-click-types.ts`, `useCanvasClickHandler.ts`, `useCanvasKeyboardShortcuts.ts`, `useModifyTools.ts`, `canvas-layer-stack-leaves.tsx`, `CanvasSection.tsx`, `home-tab-modify.ts` (comingSoon→false × 2), `hooks/tools/index.ts`. Note: extend math (`extendLine`/`extendArc`/`extendPolyline`) did NOT exist in `trim-entity-cutter.ts` (ADR was aspirational) — implemented from scratch in `extend-intersection-caster.ts` using existing SSoT primitives. |
| 2026-05-15 | **Phase 3 ADR UPDATE.** ADR-353 status updated to FULLY IMPLEMENTED. ADR-index updated with ADR-350, ADR-352, ADR-353 entries. |
