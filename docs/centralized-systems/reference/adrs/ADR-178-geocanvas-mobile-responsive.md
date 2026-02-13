# ADR-178: GeoCanvas Mobile Responsive Remediation

**Status**: Implemented (with repository-level gate blockers)
**Date**: 2026-02-13
**Author**: Codex (GPT-5)
**Category**: UI Components

---

## Context

`/geo/canvas` was desktop-oriented:
- Fixed right sidebar (`w-80`) always visible.
- Desktop overlays/panels always visible and difficult on touch devices.
- Dense header/toolbar rows overflowed on narrow screens.
- Desktop footer consumed critical map interaction space on mobile.

---

## Decision

Use ADR-176 responsive strategy principles and shared systems:
- `useIsMobile()` (`src/hooks/useMobile.tsx`) for centralized breakpoint logic.
- Shared `Sheet` component (`src/components/ui/sheet.tsx`) for mobile access panels.
- Keep desktop behavior available, but gate desktop-only layout regions behind `!isMobile`.

---

## Implemented Changes

### 1) Mobile toolbar actions
In `src/subapps/geo-canvas/app/GeoCanvasContent.tsx`:
- Added mobile actions (`Panels`, `Status`) in georeferencing view.
- These open bottom-sheet panels for touch-friendly access.

### 2) Desktop-only overlays/panels
- Right-map `FloorPlanControls` kept on desktop only.
- Draggable `FloorPlanControlPointPicker` kept on desktop only.
- Role-specific drawing interface (citizen/professional/technical) rendered once via shared `roleWorkspacePanel` and kept desktop draggable.

### 3) Mobile workspace sheet
- Added bottom sheet (`SheetContent side="bottom"`) for:
  - Floor plan controls (when available)
  - Control point picker (professional/technical + floorplan)
  - Role workspace interface

### 4) Mobile status sheet
- Extracted existing right-sidebar status content into shared `systemStatusContent`.
- Desktop renders it in `<aside>`.
- Mobile renders it in a bottom sheet.

### 5) Mobile shell polish
- Header and toolbar made wrap-friendly.
- Select controls made narrower on small screens.
- Foundation content adjusted for mobile (`grid-cols-1` then desktop split).
- Desktop footer hidden on mobile.
- Alert management fixed sidebar panel disabled on mobile.

---

## Files

- Modified: `src/subapps/geo-canvas/app/GeoCanvasContent.tsx`
- Added: `docs/centralized-systems/reference/adrs/ADR-178-geocanvas-mobile-responsive.md`

---

## Quality Gate Evidence

Executed commands:
1. `npx eslint "src/subapps/geo-canvas/app/GeoCanvasContent.tsx"`
- Result: pass (warnings only, no errors).

2. `npm run typecheck`
- Result: fail (pre-existing, unrelated errors in `src/subapps/dxf-viewer/canvas-v2/layer-canvas/LayerRenderer.ts:225`).

3. `npm test`
- Result: fail (multiple pre-existing test failures across unrelated modules, including DXF, communications, firestore-rules, auth/fetch environment).

4. `npm run build`
- Result: fail (environment/filesystem issue writing `C:\Nestor_Pagonis\.next\trace` with `EPERM`).

5. `npm run lint`
- Result: fail due large existing repository-wide lint errors unrelated to this change set.

---

## Notes

- This change set specifically addresses GeoCanvas mobile usability and preserves desktop-oriented structures as much as possible.
- Repository-wide quality gates are currently blocked by existing unrelated issues and environment constraints.
