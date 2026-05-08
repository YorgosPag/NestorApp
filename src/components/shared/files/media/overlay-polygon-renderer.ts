/**
 * =============================================================================
 * Overlay Polygon Renderer — Compatibility Shim
 * =============================================================================
 *
 * Phase 9 STEP E (ADR-340) split this module into per-shape files under
 * `./overlay-renderer/`. This file is now a re-export shim so the 6 existing
 * consumers keep working without import-path churn:
 *   - `floorplan-overlay-system.ts`
 *   - `floorplan-pdf-overlay-renderer.ts`
 *   - `useFloorplanCanvasRender.ts`
 *   - `FloorplanGallery.tsx`
 *   - `ListLayout.tsx` (read-only viewer)
 *   - `ReadOnlyMediaViewer.tsx`
 *
 * New consumers (multi-kind, post-STEP F) should import directly from
 * `./overlay-renderer` to keep the dispatch surface explicit.
 *
 * @module components/shared/files/media/overlay-polygon-renderer
 * @enterprise ADR-340 §3.6 / Phase 9 STEP E
 */

export * from './overlay-renderer';
