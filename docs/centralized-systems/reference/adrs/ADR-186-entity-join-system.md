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
