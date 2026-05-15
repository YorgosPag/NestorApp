# ADR-355 — Real-time Firestore Subscription SSOT Consolidation

**Status**: Implemented
**Date**: 2026-05-16
**Supersedes**: ADR-354 entry point #5 (manual super-admin switcher plumbing in `useLevelsFirestoreSync`)
**Related**: ADR-214 (Firestore Query Centralization), ADR-227 (Real-Time Subscription Consolidation Phases 1-3), ADR-354 (Super Admin Company Switcher SSOT)
**Owner**: Data layer / Multi-tenant

---

## Context

ADR-227 (2026-03-13) consolidated 10+ hooks to `firestoreQueryService.subscribe`, but two Firestore-listener call sites survived in `RealtimeService` because they didn't fit the typed `CollectionKey` API at the time. ADR-354 then added super-admin switcher integration to `firestoreQueryService.subscribe` (entry point #3) automatically — but the two stragglers had to wire it manually (Phase B `superAdminCompanyTick`). This ADR finishes the consolidation by migrating both holdouts and deleting the duplicate listener API.

The application has historically operated two parallel real-time subscription services for Firestore:

1. **`firestoreQueryService`** (`src/services/firestore/firestore-query.service.ts`) — tenant-aware (`buildTenantConstraints` auto-injects `where('companyId', '==', ...)` based on collection config), auth-gated (`waitForAuthReady`), and switcher-aware (rebuilds on `onSuperAdminActiveCompanyChange`, ADR-354 entry point #3). Used by the 30+ centralized `useRealtime*` hooks for buildings, properties, tasks, opportunities, etc.

2. **`RealtimeService.subscribeToCollection` / `subscribeToDocument`** (`src/services/realtime/RealtimeService.ts`) — none of those guarantees. Each caller had to inject the tenant filter manually, wait for auth manually, and wire a re-subscription on switcher change manually.

The duplication had real cost. ADR-354 Phase B (2026-05-15) had to add a manual `superAdminCompanyTick` state, an explicit `where('companyId', '==', getSuperAdminActiveCompanyId())` constraint, and an `onSuperAdminActiveCompanyChange` listener inside `useLevelsFirestoreSync` purely because `RealtimeService.subscribeToCollection` could not inherit entry point #3. Without that workaround, the DXF viewer auto-selected a level whose `sceneFileId` belonged to an arbitrary tenant and the scene loader called Storage with a stale path.

Inventory at the time of this ADR:

| Surface | Direct consumers | Outcome |
|---------|------------------|---------|
| `RealtimeService.subscribeToCollection` | 1 production (`useLevelsFirestoreSync`) + 1 unused generic (`useRealtimeQuery`) | Migrate the production hook, delete the unused wrapper |
| `RealtimeService.subscribeToDocument` | 1 production (`UserNotificationSettingsService.subscribeToSettings`) | Migrate |
| `RealtimeService.dispatch` / `subscribe` (event bus) | Many | **Keep** — different concern (cross-tab CustomEvent + storage events) |

## Decision

Collapse Firestore real-time subscriptions to a single SSOT: `firestoreQueryService`. `RealtimeService` shrinks to its event-bus role.

### Migration

- `useLevelsFirestoreSync` (`src/subapps/dxf-viewer/systems/levels/hooks/useLevelsFirestoreSync.ts`) now calls `firestoreQueryService.subscribe<DocumentData>('DXF_VIEWER_LEVELS', onData, onError, { constraints: [orderBy('order', 'asc')] })`. Tenant filter, super-admin switcher rebuild, and auth gating come from the service automatically. The manual `superAdminCompanyTick` state, `onSuperAdminActiveCompanyChange` subscription, and explicit `where('companyId', '==', ...)` constraint were removed. The bootstrap-on-empty path, level re-election logic, and orderBy are preserved.
- `UserNotificationSettingsService.subscribeToSettings` (`src/services/user-notification-settings/UserNotificationSettingsService.ts`) now calls `firestoreQueryService.subscribeDoc('USER_NOTIFICATION_SETTINGS', userId, onData, onError)`. The previous `RealtimeService.subscribeToDocument` call carried no tenant filter; `user_notification_settings` is keyed by `userId`, which Firestore rules already restrict to the owning user, so behavior is unchanged.

### Deletions

- `RealtimeService.subscribeToCollection`, `subscribeToDocument`, `unsubscribeCollection`, `unsubscribeAll`, `getActiveSubscriptionCount`, `getSubscriptionStatus`, the private subscription registry, the `permissionErrorsSeen` set, and `handleSubscriptionError` — all removed from `RealtimeService.ts`. The `onSnapshot`, `collection`, `doc`, `query`, `QueryConstraint`, `Unsubscribe` imports and the `db` import are gone.
- `src/services/realtime/hooks/useRealtimeQuery.ts` — deleted (zero consumers).
- Types `RealtimeCollection`, `RealtimeQueryOptions`, `RealtimeDocOptions`, `RealtimeQueryResult`, `RealtimeDocResult` — removed from `src/services/realtime/types.ts` and from the barrel `src/services/realtime/index.ts`.

### Preserved

- `RealtimeService.dispatch`, `RealtimeService.subscribe` (event-bus methods for cross-tab CustomEvent + storage events) — untouched.
- `dispatchBuildingProjectLinked`, `dispatchPropertyBuildingLinked` — untouched.
- All `Realtime*Payload` types + `REALTIME_EVENTS` map — untouched.
- `SubscriptionStatus` type — kept; consumed by the surviving `useRealtime*` hooks for UI state.

## Architecture

```
Before ADR-355
──────────────
                                    ┌─────────────────────────────────────┐
30+ useRealtime* hooks  ──────────► │ firestoreQueryService.subscribe     │
                                    │  • buildTenantConstraints           │
                                    │  • waitForAuthReady                 │
                                    │  • onSuperAdminActiveCompanyChange  │
                                    └─────────────────────────────────────┘

useLevelsFirestoreSync  ──manual switcher tick──┐
                                                ▼
useRealtimeQuery (unused)  ────────► RealtimeService.subscribeToCollection
                                       (raw onSnapshot, no tenant filter,
                                        no switcher, no auth gate)

UserNotificationSettings  ────────► RealtimeService.subscribeToDocument

After ADR-355
─────────────
                                    ┌─────────────────────────────────────┐
30+ useRealtime* hooks              │ firestoreQueryService.subscribe     │
useLevelsFirestoreSync       ─────► │  + subscribeDoc                      │
UserNotificationSettings            │  • buildTenantConstraints           │
                                    │  • waitForAuthReady                 │
                                    │  • onSuperAdminActiveCompanyChange  │
                                    └─────────────────────────────────────┘

RealtimeService = pure event bus (dispatch / subscribe to CustomEvent + storage)
```

## Security

- Tenant isolation moves from "every consumer remembers to add a `where('companyId')` filter" to "a single `buildTenantConstraints` enforces it for every subscription." Firestore rules remain the authoritative backstop.
- Super-admin override (ADR-354) is now wired into a single rebuild path. No subscription created after the consolidation can drift out of sync with the switcher.
- Removing the parallel listener path eliminates a class of races where `RealtimeService.subscribeToCollection` fired before auth was ready (which `firestoreQueryService.subscribe` explicitly avoids via `waitForAuthReady`).

## Affected Files

| File | Change |
|------|--------|
| `src/subapps/dxf-viewer/systems/levels/hooks/useLevelsFirestoreSync.ts` | Migrated to `firestoreQueryService.subscribe('DXF_VIEWER_LEVELS', …)`. Removed `superAdminCompanyTick`, `onSuperAdminActiveCompanyChange`, manual `where('companyId')`, imports of `RealtimeService` and `RealtimeCollection`. Hook shrinks from ~145 lines to ~100. |
| `src/services/user-notification-settings/UserNotificationSettingsService.ts` | `subscribeToSettings` migrated to `firestoreQueryService.subscribeDoc('USER_NOTIFICATION_SETTINGS', userId, …)`. |
| `src/services/realtime/RealtimeService.ts` | Stripped to event-bus role. ~200 lines removed. |
| `src/services/realtime/types.ts` | Removed `RealtimeCollection`, `RealtimeQueryOptions`, `RealtimeDocOptions`, `RealtimeQueryResult`, `RealtimeDocResult`. |
| `src/services/realtime/index.ts` | Removed corresponding type re-exports and `useRealtimeQuery` export. |
| `src/services/realtime/hooks/useRealtimeQuery.ts` | **Deleted** — zero consumers. |
| `docs/centralized-systems/reference/adrs/ADR-354-super-admin-company-switcher-ssot-override.md` | Entry point #5 marked superseded; Affected Files row updated; Changelog entry added. |
| `docs/centralized-systems/reference/adrs/ADR-355-realtime-subscription-ssot-consolidation.md` | **New file** (this document). |

## Trade-offs Considered

- **Façade pattern** (keep `RealtimeService.subscribeToCollection` API and delegate internally to `firestoreQueryService.subscribe`): rejected. Would have preserved a misleading public surface that implies a separate service; future consumers would call it expecting the parallel-listener semantics. Direct migration with deletion enforces SSOT at the type level.
- **Defer migration of `UserNotificationSettingsService`**: rejected. With the surface gone, leaving a single straggler would leave dead branches in the service.
- **Promote `RealtimeService` event bus into `firestoreQueryService`**: rejected. The event bus has no Firestore dependency, no tenant context, and lives at a different layer (cross-tab UI sync, link/cascade signals). Co-locating would muddle responsibilities.

## Verification

1. `npx tsc --noEmit` → clean for all migrated and deleted files.
2. `rg "RealtimeService\.(subscribeToCollection|subscribeToDocument)" src/` → zero matches.
3. `rg "useRealtimeQuery" src/` → zero matches.
4. **DXF levels regular user**: login as `company_admin`. `/dxf/viewer` levels list shows only the user's tenant. Switching levels updates state as before.
5. **DXF levels super-admin switcher**: login as super-admin. `/dxf/viewer` levels list re-scopes on every switcher change (A → B → A) via entry point #3 rebuild — no `superAdminCompanyTick` needed. No `[DxfFirestore] No valid scene found in any Storage path` log lines.
6. **DXF levels empty-collection bootstrap**: first-time tenant with no levels — `useLevelsFirestoreSync` writes default levels stamped with `companyId` from the calling context; next snapshot returns them.
7. **User notification settings live updates**: change a setting from another tab — the listener fires and the active tab updates the UI without manual refresh.
8. **Event bus parity**: `RealtimeService.dispatch('PROJECT_UPDATED', …)` continues to wake consumers via CustomEvent + storage event (unchanged).
9. **Pre-commit hooks**: SSOT ratchet stays green; any future re-introduction of `RealtimeService.subscribeToCollection` is blocked by the deleted symbol surface (tsc error) and by the registry entry to be added in a follow-up.

## Changelog

- **2026-05-16** — Initial implementation. Single migration commit covering `useLevelsFirestoreSync`, `UserNotificationSettingsService.subscribeToSettings`, deletion of `useRealtimeQuery.ts`, slim-down of `RealtimeService.ts` to the event-bus role, type cleanup, and ADR-354 supersession note. Net diff: more code removed than added.
