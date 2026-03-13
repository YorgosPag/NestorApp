# SPEC-214-03: File Services Migration

| Metadata | Value |
|----------|-------|
| **ADR** | ADR-214 |
| **Phase** | 3 |
| **Status** | COMPLETED |
| **Risk** | MEDIUM |
| **Αρχεία** | 3 modified |
| **Depends On** | SPEC-214-01 |
| **Completed** | 2026-03-13 |

---

## Στόχος

Migration file-related services στον κεντρικοποιημένο `FirestoreQueryService`. Μόνο READ methods μεταφέρθηκαν — writes, onSnapshot, και read-then-update flows παρέμειναν.

---

## Migrated Methods

### 1. `src/services/file-record.service.ts` — 7 read methods

| Method | Migration | Tenant Impact |
|--------|-----------|--------------|
| `getFileRecord(fileId)` | `firestoreQueryService.getById()` + `toFileRecord()` | None (getById no tenant filter) |
| `getFilesByEntity(...)` | `firestoreQueryService.getAll()` — removed explicit `companyId` | AUTO tenant filter |
| `queryFileRecords(params)` | `firestoreQueryService.getAll()` — removed explicit `companyId` | AUTO tenant filter |
| `getTrashedFiles(opts)` | `firestoreQueryService.getAll()` — removed explicit `companyId` | AUTO tenant filter |
| `getFilesEligibleForPurge()` | `firestoreQueryService.getAll()` with `tenantOverride: 'skip'` | Skip (server-side) |
| `getLinkedFiles(...)` | `firestoreQueryService.getAll()` — removed explicit `companyId` | AUTO tenant filter |
| `findByHash(hash)` | `firestoreQueryService.getAll()` with `maxResults: 1` | AUTO tenant filter |

**Shared helper**: `toFileRecord(raw)` — timestamp normalization + `isFileRecord()` validation.

**Removed imports**: `collection`, `query`, `getDocs` (no longer needed).

### 2. `src/services/file-approval.service.ts` — 2 read methods

| Method | Migration | Tenant Impact |
|--------|-----------|--------------|
| `getFileApprovals(fileId)` | `firestoreQueryService.getAll()` with orderBy | AUTO tenant filter |
| `getPendingForUser(userId, companyId)` | `firestoreQueryService.getAll()` — removed explicit `companyId` | AUTO tenant filter |

**Unchanged**: `createApproval`, `subscribeToApprovals`, `approve`, `reject`, `cancel`.

### 3. `src/services/file-folder.service.ts` — 2 read methods

| Method | Migration | Tenant Impact |
|--------|-----------|--------------|
| `getFolders(companyId)` | `firestoreQueryService.getAll()` with orderBy | AUTO tenant filter |
| `createFolder()` siblings query | `firestoreQueryService.getAll()` — removed explicit `companyId` | AUTO tenant filter |

**Unchanged**: `createFolder` (addDoc), `renameFolder`, `deleteFolder`, `moveFolder`, `moveFileToFolder`, `moveFilesToFolder`, `reorderFolders`, `updateColor`.

**Removed imports**: `query`, `getDocs` (no longer needed).

---

## Verification Checklist

- [x] File listing works correctly
- [x] File upload flow unaffected (write methods unchanged)
- [x] File classification (updateDoc) works (unchanged)
- [x] Search by entityType works
- [x] companyId filtering is now automatic
- [x] `getFilesEligibleForPurge` uses `tenantOverride: 'skip'`
- [x] Public API signatures preserved
