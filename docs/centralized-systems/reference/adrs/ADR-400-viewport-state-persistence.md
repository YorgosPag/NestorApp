# ADR-400 — Viewport State Persistence (DXF Viewer)

**Status:** ✅ Implemented (pending commit) — 2026-05-30
**Domain:** DXF Viewer / Canvas / Levels
**Related:** ADR-040 (canvas performance), ADR-399 (floor navigation tabs), ADR-092 (centralized localStorage)

---

## Context

On `/dxf/viewer`, a page refresh (soft or hard) always re-ran **fit-to-view**, so
the user lost the pan/zoom and the active floor they were looking at. The camera
position was treated as ephemeral session state and persisted nowhere.

Industry tools persist the view: Figma remembers pan/zoom per file, Google Maps
encodes it in the URL (`@lat,lng,zoom`), Autodesk Forge exposes
`getState()/restoreState()`, Revit reopens the last active view. The convention
is: **the drawing is the data; the viewport is user state — and user state is
preserved.**

Decision (Giorgio, 2026-05-30): implement the **full** option — URL deep-link
**plus** a per-document fallback — so a refresh restores the exact view and a
copied link reproduces it for sharing.

## Decision

Persist the camera transform (`{ scale, offsetX, offsetY }`) and the active
floor (`currentLevelId`) to:

1. **The URL** (authoritative, shareable):
   `/dxf/viewer?s=<scale>&ox=<offsetX>&oy=<offsetY>&lvl=<levelId>`
2. **`localStorage`** keyed per FileRecord (fallback when no query string).

**First-ever open** (no persisted state) → fit-to-view (unchanged default).
**Refresh of an active session** → restore pan/zoom + floor.

### Architecture

| Concern | Implementation |
|---|---|
| SSoT service | `services/viewport-persistence.ts` — serialize/parse, URL read/write, localStorage fallback, finite/NaN guards |
| Write | `hooks/canvas/useViewportUrlSync.ts` — debounced (~400ms) `TransformStore.subscribe` → `persistViewport()`; immediate write on floor (`levelId`) change |
| Restore (transform) | `app/useAutoFitOnFileChange.ts` — on first scene, `readPersistedViewport()`; if a transform exists → emit `canvas-restore-viewport`, else fit-to-view |
| Restore applier | `hooks/canvas/useFitToView.ts` — listens `canvas-restore-viewport`, validates, `setTransform()` (absolute, no bounds math) |
| Restore (floor) | `systems/levels/LevelsSystem.tsx` — one-shot effect (when `levels` first becomes non-empty) → `setCurrentLevelId()` if the URL `lvl` matches an existing level (`useRef` guard) |
| Mount | `app/DxfViewerContent.tsx` — `useViewportUrlSync({ fileRecordId, levelId })` |
| Storage key | `utils/storage-utils.ts` → `STORAGE_KEYS.VIEWPORT_STATE_PREFIX = 'dxf-viewer:viewport-state'` (suffix `:{fileRecordId}`) |

### ADR-040 compliance (critical)

- **Writes use `window.history.replaceState`**, not Next `router.replace` — no
  React re-render, no router remount, so the pan/zoom hot path stays at 60fps
  (the Google Maps approach).
- **Reads use `window.location.search`** (the page is already `ssr:false`), so no
  Next `useSearchParams`/`<Suspense>` coupling is introduced; `page.tsx` is
  untouched.
- `useViewportUrlSync` is **effect-only**: a single long-lived plain
  `TransformStore.subscribe` (debounced), reading latest props via refs. It does
  **not** call `useSyncExternalStore`, renders nothing, and adds no subscription
  to the `CanvasSection`/`CanvasLayerStack` orchestrators (CHECK 6B/6C/6D safe).
- The pre-fit identity transform `{1,0,0}` is never persisted.

### Guards
- A transform is restorable only when `scale`, `offsetX`, `offsetY` are all finite
  and `scale > 0`. All three URL keys must be present or the transform is rejected
  (the level id is still honored independently).
- Floor restore is one-shot (`useRef` guard) and only fires when the persisted
  level differs from the current one and exists in `levels` — it never fights the
  Firestore level re-election in `useLevelsFirestoreSync`.

## Alternatives considered
- **localStorage only** — no shareable link. Rejected (Giorgio chose full).
- **URL only** — lost if the query string is cleared. Rejected.
- **Firestore per-user slice (`UserSettingsDoc`)** — cross-device persistence.
  Deferred to a future phase; localStorage is lighter and needs zero
  `firestore.rules` changes.

## Testing
- `services/__tests__/viewport-persistence.test.ts` — 18 tests: serialize↔parse
  roundtrip, missing/NaN/non-positive-scale rejection, URL read/write via
  `history.replaceState`, unrelated-query-key preservation, localStorage
  read/write/clear + invalid-drop, combined facade (URL-wins → storage-fallback),
  `persistViewport` writes both sinks + ignores invalid transforms.

### Manual verification
1. Load a drawing, pan/zoom into detail, switch floor → URL updates
   (`?s=&ox=&oy=&lvl=`).
2. Hard refresh → same pan/zoom + same floor (not fit-to-view).
3. Clear the query string manually + refresh → fit-to-view (default).
4. Open the copied URL in a new tab → same view (share).
5. FPS during pan/zoom unchanged (ADR-040 — no re-render regression).

## Changelog
- **2026-05-30** — Initial implementation. New `viewport-persistence.ts` SSoT +
  `useViewportUrlSync.ts`; restore-vs-fit in `useAutoFitOnFileChange.ts`;
  `canvas-restore-viewport` handler in `useFitToView.ts`; mount + floor
  precedence in `DxfViewerContent.tsx`; `VIEWPORT_STATE_PREFIX` storage key.
  18/18 tests PASS.
