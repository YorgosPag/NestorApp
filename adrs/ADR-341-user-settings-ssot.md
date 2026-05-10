# ADR-341 — UserSettings SSoT (Firestore-backed per-user DXF viewer settings)

**Status:** Active  
**Date:** 2026-05-10  
**Authors:** Γιώργος Παγωνής + Claude Code

---

## Context

The DXF viewer has multiple per-user settings subsystems (cursor, rulers/grid, snap modes, CAD toolbar toggles). Each subsystem previously managed its own ephemeral React state that was lost on page refresh. The need is a single, Firestore-backed SSOT so settings persist across sessions and devices.

---

## Decision

All per-user DXF viewer settings live in a **single Firestore document** per user (`USER_PREFERENCES` collection, doc ID = `buildUserPreferencesDocId(userId, companyId)`).

### Architecture

| Layer | File | Role |
|-------|------|------|
| Schema | `user-settings-schema.ts` | Zod validation, type exports, `DxfViewerSlicePath` union |
| Paths | `user-settings-paths.ts` | `SliceValueMap`, `getSliceFromDoc`, `applySliceToDoc` |
| Repository | `user-settings-repository.ts` | Singleton, Firestore subscription, `subscribeSlice`, `updateSlice` (debounced 500ms) |
| Consumer hooks | `useCadToggles.ts`, `SnapContext.tsx`, etc. | Bind + subscribe, local React state, echo-loop guard |

### Slice paths registered

| Path | Schema | Persisted | Notes |
|------|--------|-----------|-------|
| `dxfViewer.cursor` | `cursorSettingsSchema` | ✅ | Crosshair, pickbox, selection box |
| `dxfViewer.rulersGrid` | `rulersGridSettingsSchema` | ✅ | Rulers + grid visibility |
| `dxfViewer.dxfSettings` | `dxfSettingsSliceSchema` | ✅ | Line/text/grip settings |
| `dxfViewer.snap` | `snapSettingsSchema` | ✅ Modes only | Master `snapEnabled` synced via `cadToggles.osnap` (see §OSNAP sync) |
| `dxfViewer.cadToggles` | `cadTogglesSchema` | ✅ | Osnap, grid, snap, ortho, polar, dynInput |

### Echo-loop guard pattern

Every consumer hook that subscribes AND writes must guard against its own Firestore echo:

```typescript
const lastHashRef = useRef<string>('');

// subscribe:
const remoteHash = stableHash(remote);
if (remoteHash === lastHashRef.current) return; // own echo — skip
lastHashRef.current = remoteHash;
setState(remote);

// write effect:
const hash = stableHash(state);
if (hash === lastHashRef.current) return;
lastHashRef.current = hash;
userSettingsRepository.updateSlice('dxfViewer.cadToggles', state);
```

### OSNAP master toggle sync (SnapContext ↔ cadToggles.osnap)

`SnapContext.snapEnabled` is **not** ephemeral — it is bidirectionally synced with `cadToggles.osnap`:

- **Read path**: `SnapContext` subscribes to `dxfViewer.cadToggles`; when `remote.osnap` differs from current `snapEnabled`, calls `setSnapEnabled(remote.osnap)`.
- **Write path**: when `snapEnabled` changes (e.g. ProSnapToolbar SNAP button in CadDock panel), a `useEffect` writes the updated cadToggles back via `updateSlice('dxfViewer.cadToggles', { ...lastCadToggles, osnap: snapEnabled })`.
- **Echo-loop guard**: `lastCadTogglesRef` tracks last-written cadToggles; write-back is skipped if `current.osnap === snapEnabled`.

**Architectural consequence**: `CadStatusBar OSNAP Switch` = canonical master toggle for object snap (AutoCAD status-bar pattern). `ProSnapToolbar` in `CadDock` panel = snap type configuration only (master SNAP button hidden unless `onToggleSnap` prop passed).

### ORTHO/POLAR mutual exclusion

AutoCAD-like: enabling ORTHO disables POLAR and vice versa. Implemented in `useCadToggles` toggle/set callbacks via `setState(prev => ...)`.

---

## Consequences

- ✅ Settings persist across page refresh and devices
- ✅ Single network subscription per user session (singleton repository)
- ✅ Optimistic UI: local state updates immediately; Firestore write debounced 500ms
- ✅ Schema-validated on every read and write
- ✅ Race-condition safe: pending-writes guard skips stale remote snapshots

---

## Changelog

| Date | Change |
|------|--------|
| 2026-05-10 | ADR created. Added `dxfViewer.cadToggles` slice (osnap/grid/snap/ortho/polar/dynInput). Rewrote `useCadToggles.ts` from ephemeral `useState` to `userSettingsRepository` SSOT. Added `cad-toggles` module to `.ssot-registry.json`. |
| 2026-05-10 | AutoCAD-standard snap refactor: SnapContext.snapEnabled now synced with `cadToggles.osnap`. ProSnapToolbar removed from top toolbar (EnhancedDXFToolbar). CadStatusBar OSNAP = canonical master toggle + ChevronUp popover for snap types. ProSnapToolbar SNAP button made optional. |
