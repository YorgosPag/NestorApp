# ADR-186: Entity Join System — AutoCAD JOIN Semantics

| Field | Value |
|-------|-------|
| **Status** | IMPLEMENTED |
| **Date** | 2026-02-17 |
| **Category** | DXF Viewer / Entity Operations |
| **Author** | Claude Code (Anthropic AI) + Giorgos Pagonis |

## Context

The DXF Viewer needed the ability to merge/join entities, similar to AutoCAD's JOIN command. When two or more geometric entities share endpoints (or are close enough), users should be able to combine them into a single entity.

## Decision

Implement a centralized Entity Join System following AutoCAD JOIN semantics with full undo/redo support.

## AutoCAD JOIN Rules

| Input Combination | Result |
|-------------------|--------|
| Line + Line (collinear, touching) | **Line** |
| Line + Line (non-collinear, touching) | **Polyline** |
| Line + Arc (touching) | **Polyline** |
| Arc + Arc (same center/radius) | **Arc** (or **Circle** if 360 deg) |
| Polyline + anything (touching) | **Polyline** |
| Mixed coplanar entities | **Polyline** |
| Closed entities (circles, closed polylines) | **NOT JOINABLE** |
| Measurements, text, annotations, blocks | **EXCLUDED** |

## Architecture

### Files Created

| File | Purpose |
|------|---------|
| `core/commands/entity-commands/JoinEntityCommand.ts` | Command with full undo/redo |
| `ui/components/EntityContextMenu.tsx` | Right-click context menu for select mode |
| `hooks/useEntityJoin.ts` | Orchestration hook (service + command + history) |

### Files Modified

| File | Change |
|------|--------|
| `services/EntityMergeService.ts` | Complete rewrite with type-aware JOIN semantics |
| `utils/geometry/GeometryUtils.ts` | Added `arePointsCollinear()` utility |
| `core/commands/entity-commands/index.ts` | Export JoinEntityCommand |
| `core/commands/index.ts` | Export JoinEntityCommand |
| `ui/icons/MenuIcons.tsx` | Added JoinIcon + DeleteIcon |
| `hooks/canvas/useCanvasContextMenu.ts` | Entity context menu branch (select mode) |
| `hooks/canvas/useCanvasKeyboardShortcuts.ts` | J key shortcut for join |
| `components/dxf-layout/CanvasLayerStack.tsx` | Mount EntityContextMenu |
| `components/dxf-layout/CanvasSection.tsx` | Wire useEntityJoin + pass props |
| `i18n/locales/en/dxf-viewer.json` | English translations |
| `i18n/locales/el/dxf-viewer.json` | Greek translations |

### Flow

```
User selects 2+ entities → Right-click / Press J
  → useEntityJoin.joinEntities(entityIds)
    → EntityMergeService.joinEntities()
      → entityToSegments() → chainSegments() → determineResultType()
      → buildMergedEntity() based on result type
    → JoinEntityCommand(sourceIds, mergedEntity, sceneManager)
      → CommandHistory.execute(command)
        → execute(): snapshot originals → remove → add merged
    → publishHighlight([newEntityId])
```

### Undo/Redo

- **Undo (Ctrl+Z)**: Remove merged entity → restore all original entities
- **Redo (Ctrl+Y)**: Remove originals → re-add merged entity

### User Interaction

- **Right-click** in select mode with 1+ entities → EntityContextMenu
  - Join (J) — enabled with 2+ mergeable, shows result type
  - Delete (Del) — always enabled
  - Cancel (Esc) — close menu
- **J key** in select mode with 2+ entities → instant join

### Validation Rules

1. Minimum 2 entities required
2. All entities must be in MERGEABLE_ENTITY_TYPES whitelist
3. No closed entities (circles, closed polylines)
4. No measurement entities (measurement flag = true)
5. No text, annotations, blocks, points, construction lines
6. Entities must be geometrically connected (segment chaining must succeed)

## Consequences

- Users can join entities with AutoCAD-familiar behavior
- Full undo/redo support via Command Pattern
- Type-aware output: collinear lines stay as lines, same-center arcs stay as arcs
- Clean separation: service (logic) + command (undo) + hook (orchestration) + UI (menu)

## Changelog

### 2026-07-06 — Closed-loop JOIN emits canonical closed polyline (no duplicate vertex)

**Problem:** Joining 3 lines that form a triangle produced a closed `lwpolyline` whose
`vertices` were `[A, B, C, A]` — the closing vertex duplicated. `closed:true` *already*
implies the last→first edge, so the duplicate yields a zero-length closing segment and
places the closing-edge grip (`line-utils` midpoint(last, first)) onto corner A.

**Fix:** In `buildMergedEntity` (lwpolyline branch) drop the redundant closing vertex when
the chain closes: `vertices = isClosed ? chain.slice(0, -1) : chain`. Result matches the
app-wide convention (rectangles/regions store unique corners + `closed:true`) and
AutoCAD/Revit. Visual result unchanged (a triangle); representation now clean.

**Files:** `services/EntityMergeService.ts`.

### 2026-07-06 — Centralized, localized JOIN feedback (SSoT in `useEntityJoin`)

**Problem:** When JOIN failed (most commonly: selected entities share no endpoints — a
real user hit `min gap: 6606 units`), feedback was **inconsistent across the 3 entry
points**:
- Ribbon button + `J` shortcut (`useJoinRibbonAction`) → only a subtle
  `toolHintOverrideStore` override → users perceived the button as doing *nothing*.
- Right-click context menu (`useCanvasEditActions` → `onWarning`/`onSuccess`) → a toast,
  but showing the service's raw **English** `result.message` (an N.11 violation).

Feedback was NOT centralized even though **all 3 entry points already funnel through the
`useEntityJoin` SSoT**.

**Fix — own the localized feedback in `useEntityJoin` (the single funnel):**
- `EntityMergeService` now returns a machine-readable `reasonCode`
  (`'too-few' | 'non-joinable-type' | 'closed-entity' | 'not-connected'`) on **both**
  `MergeResult` (from `joinEntities`) and `JoinPreview` (from `getJoinPreview`), set at each
  failure branch. UI picks the message by code — never by matching English `reason` text.
- `useEntityJoin` maps `reasonCode → i18n key` via a local `JOIN_REJECT_KEY` record
  (mirrors `useWallMergeTool`'s `BLOCK_REASON_KEY`). On failure it calls
  `onWarning(localizedText)` when a sink is wired, else falls back to `toast.warning(...)`
  directly — so **every** entry point shows the same localized toast, exactly once.
  Success text is likewise localized (`join.joined`, `{count}` ICU); success stays
  caller-controlled (ribbon/`J` silent — Revit-like).
- `useJoinRibbonAction` reverted to a thin caller: invoke + drop to `select` on success.
  No feedback logic, no `<2` pre-guard (the SSoT handles it).
- New i18n keys `join.{notConnected,nonJoinableType,closedEntity,joined}` in
  `{el,en}/tool-hints.json` (pure-Greek locale).

Confirmed with the AutoCAD rule (option A): JOIN requires shared endpoints; crossing-only
lines are correctly refused — now with a clear, localized toast on **all** entry points.

**Files:** `services/EntityMergeService.ts`, `hooks/useEntityJoin.ts`,
`ui/ribbon/hooks/useJoinRibbonAction.ts`, `i18n/locales/{el,en}/tool-hints.json`.

### 2026-06-16 — Perf guard on reactive join-preview (FPS-1 fix)

**Problem:** `useCanvasEditActions.entityJoinState` recomputed `getJoinPreview(selectedEntityIds)`
on *every* selection change. `getJoinPreview` runs `chainSegmentsDetailed` (O(n²) greedy chain +
force-connect). Marquee-selecting a whole floorplan (~300 entities / 375 segments) before a
mass-delete ran this synchronously on the main thread per pointer-move → **FPS dropped to ~1**,
which starved the auto-save `POST /api/cad-files` fetch into a 60s client timeout.

**Fix:** Gate the preview by selection size — `JOIN_PREVIEW_MAX_SELECTION = 64` in
`hooks/canvas/useCanvasEditActions.ts`. Above the threshold the menu stays enabled (cheap
`canJoin` type-check) but the result-type label (only meaningful for the small "join these few
segments" case) is skipped. The actual `joinEntities` command is unchanged (user-invoked,
one-shot). See `HANDOFFS/HANDOFF_2026-06-16_adr420-autosave-filedoc-corruption_perf-fps1.md` §2.
