# ADR-057: Unified Entity Completion Pipeline

| Metadata | Value |
|----------|-------|
| **Status** | APPROVED |
| **Date** | 2026-01-01 |
| **Category** | Drawing System |
| **Canonical Location** | `completeEntity()` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Summary

- **Canonical**: `completeEntity()` from `hooks/drawing/completeEntity.ts`
- **Result**: 4 code paths → 1 function

## Changelog

- **2026-05-11** — STEP 2 now routes every entity through `CreateEntityCommand` +
  `getGlobalCommandHistory().execute()` (ADR-031) instead of mutating the scene
  directly via `setScene()`. This wires Ctrl+Z / the toolbar undo button to all
  drawing tools (line, rectangle, circle, polyline, polygon, measure-*, arc,
  circle-best-fit). The caller-provided entity id is preserved through the
  command via the new `CreateEntityOptions.existingId` field so grip selection,
  AI tools, and `floorplan_overlays` persistence continue to address the same
  entity. `drawing:complete` event payload now carries the command's final
  entity reference. `trackForUndo` callback retained for continuous-measurement
  session bookkeeping (orthogonal to the global command stack).
