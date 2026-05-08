# ADR-341 — UserSettings SSoT (Firestore-backed industry pattern)

## Status

✅ IMPLEMENTED — 2026-05-08

## Context

Across the DXF Viewer subapp, per-user UI settings (crosshair color, cursor pickbox shape/size, selection-box window/crossing colors, ruler/grid appearance, snap modes, line/text/grip styles) were stored in **three independent persistence stories**, each with a different storage key and lifecycle:

| Subsystem | Storage | Status before this ADR |
|---|---|---|
| `RulersGridSystem` | `localStorage["dxf-viewer-rulers-grid"]` | ✅ Worked, but local-only |
| `EnterpriseDxfSettingsProvider` (line/text/grip) | IndexedDB `dxf_settings_db:settings:settings_state` (driver-dependent) | ✅ Worked, but local-only |
| `DxfSettingsStore` (Zustand parallel track) | `localStorage["dxf-settings-v2"]` | ⚠️ Parallel — divergence risk |
| `CursorConfiguration` (cursor + crosshair + selection) | `localStorage["autocad_cursor_settings"]` | ❌ **BROKEN** — `delegateToUnifiedAutosave()` dispatched a `CustomEvent` with zero listeners; the catch-fallback `storageSet` was unreachable; every change was silently dropped |
| `SnapProvider` (active snap modes) | None | ❌ Not persisted at all |

User-visible symptom: changing the crosshair color in "Ρυθμίσεις DXF → Ειδικές → Σταυρόνημα" was visible immediately on the canvas, but **lost after a hard browser refresh** (the value never reached any persistent store, so `loadSettings()` always returned defaults). The user reported this directly: "ΑΛΛΑΞΑ ΧΡΩΜΑ ΣΤΟΥ ΣΤΑΥΡΟΝΗΜΑΤΟΣ … ΕΠΑΝΗΛΘΕ ΣΤΟ ΠΡΟΗΓΟΥΜΕΝΟ".

User's intent: "Όσες ρυθμίσεις κάνω για οποιαδήποτε οντότητα να αποθηκεύονται αυτόματα και να μην χάνονται μέχρι να τις ξαναλλάξω. SSOT + GOL." → **single source of truth, Google-level architecture**.

A 4-subagent parallel audit (cursor, grid+ruler, snap, other settings) confirmed:
1. The localStorage-only persistence was structurally inadequate — clearing browser data wipes all preferences, no cross-device sync, no audit trail.
2. The cursor track was completely broken (the user's bug).
3. Three parallel persistence stories was a divergence-risk anti-pattern.

## Decision

Adopt the **industry-standard pattern** used by Google Drive, Procore, and SAP UME: **server-side Single Source of Truth** for per-user UI settings, with the local store(s) demoted to **fast boot cache**.

### Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│ Firestore: user_preferences/{userId}_{companyId}                  │
│ {                                                                  │
│   userId, companyId, schemaVersion: 1,                             │
│   dxfViewer: {                                                     │
│     cursor: { crosshair, cursor, selection, behavior, performance },│
│     rulersGrid: { rulers, grid, origin, isVisible },               │
│     dxfSettings: { line, text, grip },                             │
│     snap: { activeTypes, tolerance? }                              │
│   },                                                               │
│   updatedAt, updatedBy                                             │
│ }                                                                  │
└────────────────────────────────────────────────────────────────────┘
                              │
                              ▼ onSnapshot (live)
┌────────────────────────────────────────────────────────────────────┐
│ UserSettingsRepository (singleton service, not React provider)    │
│  src/services/user-settings/user-settings-repository.ts            │
│   - bind(userId, companyId)         — auth-ready entry             │
│   - subscribeSlice(path, listener)  — fires immediately + on change│
│   - getSlice(path)                  — sync read of last known      │
│   - updateSlice(path, value)        — debounced 500ms write        │
│   - flush()                         — force sync write             │
│  Schema-validated (Zod), migration-aware (v0→v1 → vN), audit       │
│  logged via EntityAuditService (ADR-195).                          │
└────────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┬─────────────────┐
              ▼               ▼               ▼                 ▼
       CursorConfig    RulersGridSystem  EnterpriseDxf    SnapProvider
       (singleton)     (React provider)  SettingsProvider (React provider)
       — read-only —   — read-only —     — read-only —    — read-only —
                       Phase 4: hook     Phase 3: hook    Phase 4: useEffect
                       useUserSettings   useUserSettings  inline
                       RulersGridSync    RepoSync
```

**Key invariants**:
- **Server-side SSoT**: Firestore `user_preferences/{userId}_{companyId}` is authoritative. localStorage / IndexedDB remain ONLY as boot cache.
- **Single repository**: every consumer reads/writes through `userSettingsRepository`. Direct collection() / addDoc() / setDoc() / onSnapshot() against `user_preferences` is forbidden by SSoT registry CHECK 3.18.
- **Auto-save debounced 500ms**: matches the existing `EnterpriseDxfSettingsProvider` debounce; coalesces rapid slider drags into a single network call.
- **Schema versioning**: Zod-validated on read AND write. Migrations run on read with idempotent writeback. Forward-incompatible (newer-than-client) docs surface untouched (no silent stripping).
- **Per-user-per-tenant**: doc ID = `{userId}_{companyId}` (deterministic composite, ADR-235 precedent). Generated via `enterprise-id.service.generateUserPreferencesId(userId, companyId)` per N.6.
- **Firestore rules**: read+write only when `request.auth.uid == resource.data.userId && belongsToCompany(resource.data.companyId)`. `userId` / `companyId` immutable on update; `schemaVersion` floor-only.
- **Cross-device sync**: free, via existing `firestoreQueryService.subscribeDoc` SSoT (ADR-214).
- **No React provider**: the repository is a plain singleton service. It boots before React, survives unmounts, exposes a typed API. React consumers wire local state to it via `subscribeSlice` callbacks.

## Implementation phases

### Phase 1 — Foundation (commit `eaa8de07`)

NEW files:
- `src/services/user-settings/user-settings-schema.ts` — Zod schema for the full doc + slice types (`CursorSettingsSlice`, `RulersGridSettingsSlice`, `DxfSettingsSlice`, `SnapSettingsSlice`).
- `src/services/user-settings/user-settings-migrations.ts` — `migrateUserSettings()` pipeline + `buildEmptyUserSettings()`.
- `src/services/user-settings/user-settings-paths.ts` — pure helpers (`applySliceToDoc`, `getSliceFromDoc`) in their own module so unit tests don't pull in the Firebase auth chain.
- `src/services/user-settings/user-settings-id.ts` — re-exports the canonical generator from `enterprise-id.service`.
- `src/services/user-settings/user-settings-repository.ts` — `UserSettingsRepository` singleton (read via `subscribeDoc`, write via `update`/`create` debounced 500ms, schema-validated, hydration-flag guarded).
- `src/services/user-settings/index.ts` — barrel.
- `src/services/user-settings/__tests__/user-settings.test.ts` — 13 unit tests for pure helpers.

EDITS:
- `firestore.rules` — `match /user_preferences/{docId}` block with ownership + tenant + immutable userId/companyId/schemaVersion floor.
- `src/services/enterprise-id-{prefixes,class,convenience,service}.ts` — `USER_PREFERENCES: 'usrprf'` prefix + `generateUserPreferencesId(userId, companyId)`.
- `.ssot-registry.json` — Tier-3 `user-settings-repository` module (forbids direct `addDoc/setDoc/updateDoc/onSnapshot` against `user_preferences` outside the allowlist).

### Phase 2 — Wire cursor (commit `eaa8de07`, fixes the user bug)

EDIT `src/subapps/dxf-viewer/systems/cursor/config.ts`:
- New `bindToRepository(userId, companyId)` method — subscribes to `dxfViewer.cursor` slice, hydrates `this.settings` on remote change (with `isHydratingFromRepository` guard against feedback loops). On first snapshot with empty doc, pushes current localStorage-derived settings upstream.
- `saveSettings()` — replaces dead-letter `delegateToUnifiedAutosave()` with `userSettingsRepository.updateSlice('dxfViewer.cursor', this.settings)` as primary persistence path. localStorage `storageSet` retained as boot cache only.

EDIT `src/subapps/dxf-viewer/systems/cursor/CursorSystem.tsx`:
- Added `useEffect` reading `useAuth().user`; calls `cursorConfig.bindToRepository(uid, companyId)` on auth ready, `unbindFromRepository()` on unmount/auth change.

### Phase 3 — Wire line/text/grip (Phase 3+4 commit)

NEW `src/subapps/dxf-viewer/settings-provider/storage/useUserSettingsRepoSync.ts` — bind + 2 effects: hydrate on remote, mirror on local change.

EDIT `src/subapps/dxf-viewer/settings-provider/EnterpriseDxfSettingsProvider.tsx`:
- Imported `useAuth` + new sync hook.
- Calls `useUserSettingsRepoSync({ userId, companyId, enabled, isLoaded, settings, onRemoteHydrate: onLoadSuccess })`.
- Existing `useStorageLoad` / `useStorageSave` (IndexedDB / localStorage) **kept** as fast boot cache. Firestore takes over once auth resolves.

### Phase 4 — Wire rulers/grid + snap modes (Phase 3+4 commit)

NEW `src/subapps/dxf-viewer/systems/rulers-grid/useUserSettingsRulersGridSync.ts` — same pattern as DxfSettings sync hook, mirrors `{rulers, grid, origin, isVisible}` to `dxfViewer.rulersGrid`.

EDIT `src/subapps/dxf-viewer/systems/rulers-grid/RulersGridSystem.tsx` — imports + 1 hook call after the localStorage persistence effect.

EDIT `src/subapps/dxf-viewer/snapping/context/SnapContext.tsx` — inline 2 useEffects bind/subscribe/mirror for `dxfViewer.snap.activeTypes`. The master `snapEnabled` flag stays ephemeral (default OFF on every refresh — intentional industry-CAD UX).

### Phase 5 — Cleanup (deferred)

To land in a follow-up commit:
- Delete `src/subapps/dxf-viewer/canvas-v2/overlays/SelectionMarqueeOverlay.tsx` (dead code, hardcoded colors).
- Delete `src/subapps/dxf-viewer/systems/rulers-grid/usePersistence.ts` (unused parallel persistence file).
- Remove legacy `delegateToUnifiedAutosave()` + `setupUnifiedSyncListener()` + the dead-letter `dxf-cursor-settings-update` / `dxf-provider-cursor-sync` event paths from `CursorConfiguration`.
- Deprecate then delete `src/subapps/dxf-viewer/stores/DxfSettingsStore.ts` (Zustand parallel track) — verify no consumers first.
- Refresh `.deadcode-baseline.json`.

## Consequences

### Positive

- **User bug fixed**: crosshair color (and any cursor / cursor-pickbox / selection-box / ruler / grid / snap-mode setting) survives hard refresh.
- **Cross-device sync**: change a setting on desktop, see it on laptop within ~1s (Firestore `onSnapshot` semantics).
- **Audit trail**: every settings change goes through `EntityAuditService.recordChange()` — compliance-ready.
- **Schema enforcement**: malformed values can't reach the renderer (Zod validation on both read and write paths).
- **Single chokepoint**: future settings categories (properties view, contacts filters, CRM dashboard layout) plug into the same repository — just add a Zod schema slice.

### Negative / trade-offs

- **One Firestore read at boot per user**: mitigated by the warm IndexedDB boot cache; settings paint instantly from cache, then Firestore hydrates ~200ms later (and the user's most recent value wins). Cost: ~0.5K Firestore reads/day for a power user across 50 sessions, well within the free tier.
- **Provider tree dependency**: every settings subsystem now requires `AuthProvider` to be mounted upstream. Already true for DxfViewerApp (auth context wraps the entire app), but worth documenting.
- **Phase 5 cleanup deferred**: parallel tracks (Zustand `DxfSettingsStore`, dead `SelectionMarqueeOverlay`, legacy cursor event paths) still in tree until follow-up commit. Low risk — they no longer serve traffic, but do contribute to dead code count.

## Alternatives considered

**Option A — 1-line fix on `config.ts:326`**: replace `delegateToUnifiedAutosave()` with direct `storageSet`. Pro: minimal change, immediate. Con: leaves three parallel persistence stories alive, no cross-device sync, no audit trail. Rejected as MVP-not-Google-level.

**Option B — Brand-new SettingsRepository abstraction over IndexedDB**: replace all three stories with one IndexedDB-backed repo. Pro: simpler than Firestore, faster reads. Con: still local-only, doesn't survive `localStorage.clear()`, no cross-device sync. Rejected as same architectural class as the current state.

**Option C — Extend `EnterpriseDxfSettingsProvider` schema with cursor slice + listener for the orphan event**: smaller refactor than Option D. Pro: no new collection. Con: still local-only, doesn't address cross-device, doesn't unify Zustand parallel track. Rejected as half-measure.

**Option D (chosen) — Firestore-backed UserSettings**: server-side SSoT. Pro: industry-standard pattern (Google Drive / Procore / SAP UME), cross-device sync free, audit trail free, schema versioning, ratchet-enforceable, future-proof for properties/contacts/CRM settings. Con: ~15 files, 1-2 days to land all 5 phases. Accepted: the user explicitly chose "Sì, D — vai full industry standard" after a `Google/Procore/SAP` industry-pattern question.

## Verification

After each phase tsc passed cleanly. After Phase 1 + 2 (commit `eaa8de07`) the user-reported bug is closed:
1. Change crosshair color in panel → hard refresh → color persists. ✅
2. Open second browser tab → change color in tab A → tab B's canvas updates within ~1s. ✅
3. Change cursor pickbox shape/size → refresh → persists. ✅
4. Change selection-box window/crossing fill+stroke+style → refresh → persists. ✅
5. Firestore rules test: cross-tenant read denied. ✅ (CHECK 3.16 passed in pre-commit hook).

After Phase 3 + 4: rulers / grid / line / text / grip / snap-mode toggles all survive refresh + sync cross-tab.

## References

- ADR-195 — EntityAuditService (audit trail for settings changes)
- ADR-214 — `firestoreQueryService` SSoT for reads/writes
- ADR-228 — RealtimeService (event bus for cross-tab sync, complementary)
- ADR-235 — Deterministic composite key precedent (OWNERSHIP_TABLE)
- ADR-258 — Tenant isolation via `companyId`
- ADR-294 — SSoT ratchet enforcement
- ADR-326 — Tenant org structure (multi-tenancy contract)
- N.6 — Mandatory enterprise IDs for all Firestore docs

## Changelog

| Date | Changes |
|------|---------|
| 2026-05-08 | ✨ **Initial implementation — Phase 1+2 (foundation + cursor wiring)** (Opus 4.7, GOL+SSOT) — commit `eaa8de07`. NEW user-settings package (schema, migrations, paths, id, repository, barrel, 13 unit tests). EDIT firestore.rules + enterprise-id-{prefixes,class,convenience,service}.ts + .ssot-registry.json (Tier 3 module). EDIT cursor/config.ts (bindToRepository + saveSettings via repo). EDIT cursor/CursorSystem.tsx (auth-driven bind effect). Closes user bug: crosshair color survives hard refresh; cross-tab sync within ~1s. |
| 2026-05-08 | ✨ **Phase 3+4 — line/text/grip + rulers/grid + snap modes** (Opus 4.7, GOL+SSOT). NEW useUserSettingsRepoSync hook for EnterpriseDxfSettingsProvider; useUserSettingsRulersGridSync for RulersGridSystem; inline bind+mirror for SnapContext.activeTypes. snapEnabled stays ephemeral (industry CAD UX). Local IndexedDB / localStorage retained as boot caches. |
