# ADR-034: Guide Commands Split — SRP Refactoring

**Status**: IMPLEMENTED
**Date**: 2026-04-06
**Author**: Claude (Opus 4.6)
**Category**: DXF Viewer / Code Quality

## Context

`guide-commands.ts` contained 18 command classes in a single 1876-line file, exceeding the 500-line limit (ADR N.7.1) by 3.7x. All classes implement `ICommand` for the undo/redo system.

## Decision

Split into 7 files by semantic domain under `systems/guides/commands/`:

| File | Classes | Lines |
|------|---------|-------|
| `guide-create-commands.ts` | CreateGuide, CreateParallel, CreateDiagonal, CreateGridFromPreset | 374 |
| `guide-delete-commands.ts` | DeleteGuide, BatchDeleteGuides | 143 |
| `guide-move-commands.ts` | MoveGuide | 101 |
| `guide-rotate-commands.ts` | RotateGuide, RotateAllGuides, RotateGuideGroup | 375 |
| `guide-scale-equalize-commands.ts` | ScaleAllGuides, EqualizeGuides | 256 |
| `guide-pattern-commands.ts` | MirrorGuides, PolarArrayGuides, CopyGuidePattern | 358 |
| `guide-entity-commands.ts` | GuideFromEntity, GuideOffsetFromEntity, BatchGuideFromEntities + EntityGuideParams | 311 |
| `index.ts` | Barrel re-exports | 28 |

## Grouping Rationale

- **Create**: All commands that add new guides from scratch
- **Delete**: Single + batch deletion
- **Move**: Positional change without axis conversion
- **Rotate**: All rotation variants (single/group/all) share `ROTATION_EXTENT` constant and `rotatePoint` dependency
- **Scale + Equalize**: Both transform offset values without axis change
- **Pattern**: Mirror/Polar/Copy — all create copies based on geometric patterns
- **Entity**: All commands that derive guides from DXF entities

## Consumer Impact

3 files updated their imports:
- `useGuideState.ts` — `../../systems/guides/commands`
- `useCanvasContainerHandlers.ts` — `../../systems/guides/commands`
- `canvas-click-types.ts` — `../../systems/guides/commands`

Parent barrel `systems/guides/index.ts` updated to re-export from `./commands`.

## Follows Existing Pattern

Consistent with `core/commands/entity-commands/`, `overlay-commands/`, `vertex-commands/` — each having small focused files with a barrel index.

## Changelog

| Date | Change |
|------|--------|
| 2026-04-06 | Initial split: 1 file (1876 lines) -> 7 files + barrel (all < 500 lines) |
