# ADR-049: Unified Move Tool (DXF + Overlays)

| Metadata | Value |
|----------|-------|
| **Status** | APPROVED |
| **Date** | 2026-01-01 |
| **Last Updated** | 2026-05-11 |
| **Category** | Drawing System |
| **Canonical Location** | `MoveOverlayCommand.ts` + `hooks/tools/useMoveTool.ts` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Summary

- **Overlay move**: `MoveOverlayCommand.ts` (380+ lines) — drag-based, Priority 7 click handler
- **DXF entity move**: `hooks/tools/useMoveTool.ts` — AutoCAD-style 2-click state machine
- **Pattern**: Command Pattern with undo/redo (`MoveEntityCommand`, `MoveMultipleEntitiesCommand`)

## Architecture — DXF Entity Move Tool (2026-05-11)

### State Machine

```
idle → awaiting-entity → awaiting-base-point → awaiting-destination → execute → awaiting-base-point
```

- **awaiting-entity**: no entities selected; clicks pass through for normal entity selection
- **awaiting-base-point**: entities selected; next click sets the anchor point
- **awaiting-destination**: rubber band + ghost preview active; next click applies move
- On execute: `MoveEntityCommand` (single) or `MoveMultipleEntitiesCommand` (batch)
- On Escape: clear preview, switch to 'select' tool
- Continuous mode: after execute, loops back to `awaiting-base-point`

### Files

| File | Role |
|------|------|
| `hooks/tools/useMoveTool.ts` | State machine hook — phases, click handler, ESC |
| `hooks/tools/useMovePreview.ts` | RAF ghost preview on PreviewCanvas — rubber band + ghost entities |
| `components/dxf-layout/canvas-layer-stack-leaves.tsx` | `MovePreviewMount` — ADR-040 micro-leaf subscriber |
| `core/commands/entity-commands/MoveEntityCommand.ts` | Single entity move command (existing) |
| `core/commands/entity-commands/MoveMultipleEntitiesCommand.ts` | Batch entity move command (existing) |

### Click Priority

Priority 1.55 in `useCanvasClickHandler.ts` — between rotation (1.5) and guides (1.6).

### Preview (ADR-040 compliant)

`MovePreviewMount` renders as a React micro-leaf in `CanvasLayerStack`. It calls `useMovePreview`
which draws directly on the `PreviewCanvas` element via RAF — zero React re-renders from mousemove.

Draws:
- Base point crosshair (red)
- Rubber band line: base → cursor (dashed gold)
- Displacement tooltip: `Δx, Δy` near cursor
- Ghost entities (blue, 40% opacity) translated by current delta

## Changelog

| Date | Change |
|------|--------|
| 2026-01-01 | Initial: overlay drag move (`MoveOverlayCommand`) |
| 2026-05-11 | Added AutoCAD-style 2-click DXF entity move: `useMoveTool` + `useMovePreview` |
