# DXF Viewer Investigation: Why Delete Removes Only Overlay Layers and Not DXF Entities

Date: 2026-02-14
Scope: `src/subapps/dxf-viewer`
Goal: Root-cause analysis and centralized (single source of truth) architecture direction for Delete behavior.

## 1) Problem Statement
Observed behavior:
- `Delete` / `Backspace` removes colored overlay layers (and overlay grips/vertices).
- `Delete` / `Backspace` does NOT remove selected DXF entities (line, circle, polyline, etc.).

Target behavior:
- Same Delete action must remove whichever selectable object is currently selected:
  - overlay grips/vertices
  - overlays
  - DXF entities
- Centralized deletion path, no scattered logic.

## 2) Root Cause (Code Evidence)
### A. Delete key ownership is centralized in `CanvasSection`, but only for overlay flows
- `src/subapps/dxf-viewer/hooks/useKeyboardShortcuts.ts:98`
  - Comment explicitly says Delete handling moved to `CanvasSection`.
- `src/subapps/dxf-viewer/components/dxf-layout/CanvasSection.tsx:1512`
  - `handleSmartDelete` exists.
- `src/subapps/dxf-viewer/components/dxf-layout/CanvasSection.tsx:1556`
  - Delete logic queries only `universalSelection.getIdsByType('overlay')`.

Conclusion:
- Current smart delete handler has overlay-only deletion branch (plus overlay vertex grips), no DXF entity deletion branch.

### B. DXF entity selection exists, but Delete pipeline does not consume it
- `src/subapps/dxf-viewer/components/dxf-layout/CanvasSection.tsx:1369`
  - DXF click selection stores `universalSelection.select(hitEntityId, 'dxf-entity')`.
- `src/subapps/dxf-viewer/components/dxf-layout/CanvasSection.tsx:1967`
  - Marquee entity selection callback is wired as `onEntitiesSelected={setSelectedEntityIds}` (local state).

Conclusion:
- There are two DXF selection channels:
  1. universal selection for click (`dxf-entity`)
  2. local `selectedEntityIds` state for marquee callback
- Delete handler reads only overlay selection, so selected DXF entities are ignored.

### C. Toolbar Delete enable/disable is also overlay-only
- `src/subapps/dxf-viewer/layout/FloatingPanelsSection.tsx:196`
  - `canDelete={universalSelection.getByType('overlay').length > 0}`

Conclusion:
- Toolbar UX reinforces overlay-only deletion and hides DXF entity delete capability.

### D. Entity delete command infrastructure already exists (but unused in smart delete)
- `src/subapps/dxf-viewer/core/commands/entity-commands/DeleteEntityCommand.ts:15`
  - `DeleteEntityCommand` implemented.
- `src/subapps/dxf-viewer/systems/entity-creation/LevelSceneManagerAdapter.ts:55`
  - `LevelSceneManagerAdapter` implements `ISceneManager` needed by entity commands.

Conclusion:
- Missing piece is integration into the centralized Delete orchestrator; not missing infrastructure.

## 3) Architecture Gap Summary
Current Delete flow is partially centralized but functionally incomplete:
- Centralized key interception: YES (`CanvasSection`)
- Centralized command history usage: YES (for overlays)
- Universal selection usage: PARTIAL
- Unified deletion for all selectable types: NO

This is why user-visible behavior is inconsistent.

## 4) Centralized Single-Source-of-Truth Direction
### Canonical SSoT decisions
1. Selection SSoT:
- Use `universalSelection` as the only authoritative source for delete targets.
- Entity type keys:
  - `overlay`
  - `dxf-entity`

2. Delete orchestration SSoT:
- Keep one Delete orchestrator (`handleSmartDelete`) in `CanvasSection` (or extract to dedicated `DeleteOrchestrator` hook/service).
- All triggers route there:
  - keyboard Delete/Backspace
  - toolbar delete event (`toolbar:delete`)

3. Execution SSoT:
- All delete actions must use Command Pattern + `useCommandHistory().execute(...)`.

### Required logical order (context-aware)
Recommended priority:
1. Selected grips (overlay vertex delete)
2. Selected overlays (overlay delete)
3. Selected DXF entities (`dxf-entity`) using `DeleteEntityCommand` / `DeleteMultipleEntitiesCommand`

This keeps existing overlay UX while enabling entity delete.

## 5) Specific Integration Points (High-Value)
1. Extend `handleSmartDelete` to include `dxf-entity` branch
- File: `src/subapps/dxf-viewer/components/dxf-layout/CanvasSection.tsx`
- After overlay deletion block, read:
  - `const selectedEntityIds = universalSelectionRef.current.getIdsByType('dxf-entity')`
- Create `LevelSceneManagerAdapter` with current level scene methods.
- Execute single/batch entity delete commands via command history.

2. Normalize selection writes
- Ensure marquee selection path also updates universal selection for `dxf-entity` (not only local `setSelectedEntityIds`).
- Keep local `selectedEntityIds` for rendering highlight if needed, but derive it from universal selection to avoid drift.

3. Update toolbar delete availability
- File: `src/subapps/dxf-viewer/layout/FloatingPanelsSection.tsx`
- `canDelete` should be true if ANY deletable selection exists:
  - overlays selected OR dxf-entities selected OR grips selected (if surfaced in shared state/event).

## 6) Why It Fails Today (Short Answer)
Delete is centralized at key-handler level, but not centralized at domain level. The current smart delete implementation handles only overlay-domain selections, so DXF-entity selections are never translated into delete commands.

## 7) Risks If Left As-Is
- Inconsistent UX (same selection model, different delete behavior).
- Hidden state divergence (`selectedEntityIds` local vs universal selection).
- More scattered conditional logic as features grow.

## 8) Recommended Next Step
Implement a single `DeleteOrchestrator` abstraction (hook/service) consumed by both keyboard and toolbar, with universal-selection input and command-history output. This keeps one path, one policy, one source of truth.
