# DXF Viewer Root Cause Report - Entity Click Auto-Opens Layering Toolbar

Date: 2026-02-14
Scope: Investigation only (no code changes).

## User-reported behavior
When the crosshair hovers an entity, highlight works. On click (selection), the small secondary drawing toolbar opens immediately (as if the user clicked the main Layers/Level tool), blocking normal entity-to-entity selection flow.

## Reproduction path in code
1. In Select tool, canvas click performs DXF entity hit-test and selects the hit entity as `dxf-entity`.
2. Universal selection updates `primarySelectedId` with that entity id.
3. A global effect in `DxfViewerContent` watches `primarySelectedId` and auto-switches tool to `layering` on any new primary selection.
4. In `NormalView`, `activeTool === 'layering'` makes overlay/layering toolbar visible.

## Evidence (file/line)
- DXF entity selection on click:
  - `src/subapps/dxf-viewer/components/dxf-layout/CanvasSection.tsx:1366`
  - `universalSelection.select(hitEntityId, 'dxf-entity');`
- Universal reducer is type-agnostic for primary selection:
  - `src/subapps/dxf-viewer/systems/selection/useSelectionReducer.ts:253`
  - `primarySelectedId: entry.id` (same pattern repeated for other universal actions)
- Auto-switch to layering based only on new `primarySelectedId`:
  - `src/subapps/dxf-viewer/app/DxfViewerContent.tsx:846`
  - `src/subapps/dxf-viewer/app/DxfViewerContent.tsx:854`
  - Effect calls `handleToolChange('layering')` when selection changes, without checking selected type.
- Layering toolbar visibility bound to active tool:
  - `src/subapps/dxf-viewer/components/dxf-layout/NormalView.tsx:37`
  - `const showOverlayToolbar = props.activeTool === 'layering';`

## Root cause
The auto-activation logic in `DxfViewerContent` uses `universalSelection.getPrimaryId()` as a generic trigger. Because `primarySelectedId` is shared for all selectable types (`overlay`, `dxf-entity`, etc.), selecting a normal DXF entity is incorrectly treated like an overlay selection and forces tool switch to `layering`.

This is a type-mismatch bug in the trigger condition, not a rendering or hit-test bug.

## Secondary contributing factor
Another effect can also force `layering` under certain tool/mode combinations:
- `src/subapps/dxf-viewer/app/DxfViewerContent.tsx:869`
This can make the UI feel "stuck" in layering once auto-switch has happened.

## Impact
- Unexpected tool switch after entity selection.
- Overlay/layering toolbar opens without explicit user intent.
- User cannot continue normal multi-entity selection workflow in Select mode.

## Recommended fix direction
1. Gate auto-switch to layering by selected type, not only by selected id.
2. Trigger layering auto-switch only for `overlay` selection events.
3. Keep DXF entity selection in `select` tool unless user explicitly changes tool.
4. Optional hardening: in toolbar props, avoid treating generic `primarySelectedId` as `selectedOverlayId` unless entry type is `overlay`.

## Confidence
High. The behavior is directly explained by the current selection->primary id->tool switch chain with clear line-level evidence.
