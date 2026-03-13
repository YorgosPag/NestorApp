# SPEC-214-05: Communication Services Migration

| Metadata | Value |
|----------|-------|
| **ADR** | ADR-214 |
| **Phase** | 5 |
| **Status** | ✅ COMPLETED |
| **Date** | 2026-03-13 |
| **Risk** | LOW |
| **Αρχεία** | 4 modified |
| **Depends On** | SPEC-214-01 |

---

## Στόχος

Migration communication + notification services στον firestoreQueryService.
SECURITY FIX: Προσθήκη companyId tenant filtering σε 4 read methods που δεν είχαν.

---

## Αλλαγές

### 1. `src/services/communications-client.service.ts` ('use client')

**Migrated reads** (4 methods → firestoreQueryService):
- `getCommunicationsClient(limitCount)` — `getAll('MESSAGES', { constraints, maxResults })`
- `getCommunicationsByContactClient(contactId, limitCount)` — `getAll('MESSAGES', { constraints, maxResults })`
- `getCommunicationsByContact(contactId)` — **relocated from communications.service.ts**
- `deleteAllCommunications()` — **relocated from communications.service.ts**, read via firestoreQueryService + writeBatch for delete

**SECURITY FIX**: Αυτόματο `where('companyId', '==', ctx.companyId)` μέσω tenant config (ήταν MISSING).

**New**: `toCommunication()` transform helper (same pattern as Phase 4).

### 2. `src/services/communications.service.ts` ('use server')

**Removed** (relocated to client service):
- `getCommunicationsByContact()` — client SDK read in server file → firestoreQueryService needs auth.currentUser
- `deleteAllCommunications()` — client SDK read in server file → same issue
- `transformCommunication()` — only used by getCommunicationsByContact

**Untouched** (Admin SDK — no migration needed):
- `fetchTriageCommunications()`, `getTriageCommunications()`, `getTriageStats()`
- `approveCommunication()`, `rejectCommunication()`
- `addCommunication()`, `updateCommunicationStatus()`

**Cleaned imports**: Removed `getDocs`, `query`, `where`, `orderBy`, `writeBatch`, `QueryDocumentSnapshot`, `DocumentData`, `Timestamp`.

### 3. `src/services/notificationService.ts`

**Migrated**: `fetchNotifications()` → firestoreQueryService with dual-path:
- **Client context** (`auth.currentUser` available): `firestoreQueryService.getAll('NOTIFICATIONS', ...)` — auto `where('userId', '==', ctx.uid)` via tenant config
- **Server context** (API routes, `auth.currentUser` null): Direct query with explicit `where('userId', '==', userId)` (existing behavior preserved)

**New**: `toNotification()` transform helper.

**Skipped**: `subscribeToNotifications()` → Phase 7 (onSnapshot).

### 4. `src/components/communications/hooks/useCommunicationsHistory.ts`

**Changed import**: `getCommunicationsByContact` from `communications-client.service` (was `communications.service`).

---

## Αρχιτεκτονική Απόφαση: Mixed SDK File

`communications.service.ts` has `'use server'` directive — all exports are server actions.
Server actions run where `auth.currentUser` is null, so `firestoreQueryService.requireAuthContext()` fails.

**Solution**: Client SDK reads relocated to `communications-client.service.ts` ('use client'),
where Firebase client auth is available and firestoreQueryService works correctly.

## Verification Checklist

- [x] Communications client reads: auto companyId filter
- [x] getCommunicationsByContact: relocated + tenant-aware
- [x] deleteAllCommunications: scoped to current company
- [x] Notifications: auto userId filter (client path)
- [x] Notifications API route: server fallback preserved
- [x] Admin SDK methods (triage, approve, reject): UNTOUCHED
- [x] onSnapshot (subscribeToNotifications): SKIPPED → Phase 7
- [x] `npx tsc --noEmit` (background check)
