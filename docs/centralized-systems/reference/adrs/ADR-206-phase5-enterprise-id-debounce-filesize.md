# ADR-206: Scattered Code Centralization — Phase 5

## Status: ✅ IMPLEMENTED

## Date: 2026-03-12

## Context

Phase 5 of scattered code centralization (successor to ADR-205 Phase 4, ADR-204 Phase 3, ADR-200 Phase 2, ADR-161 Phase 1). Comprehensive audit by 3 agents across the entire codebase identified remaining duplicated patterns. Three tasks were selected — verified for real duplication, manageable scope, and genuine value.

## Decision

### Task 1: Migrate `Math.random()` ID generation → `enterprise-id.service.ts`

**Problem**: 13+ files used `Math.random().toString(36)` for ID generation (~48 bits entropy) while `enterprise-id.service.ts` already existed with `crypto.randomUUID()` (128 bits entropy) and 50+ generators.

**Solution**: Extended `ENTERPRISE_ID_PREFIXES` with 6 new prefixes and corresponding generator methods, then migrated 10 files.

**New prefixes added**:

| Prefix Key | Value | Purpose |
|-----------|-------|---------|
| `PHOTO` | `'photo'` | Photo upload IDs |
| `ATTACHMENT` | `'att'` | Email attachment IDs |
| `FILE` | `'file'` | File upload storage paths |
| `SHARE` | `'share'` | Social share analytics IDs |
| `PENDING` | `'pending'` | WebSocket pending operation IDs |
| `SUBSCRIPTION` | `'sub'` | Performance subscription IDs |

**Migrated files (10)**:

| File | Old Pattern | New |
|------|------------|-----|
| `core/performance/core/EnterprisePerformanceManager.ts` (3x) | `metric_/sub_/session_${Date.now()}_${Math.random()...}` | `generateMetricId()`, `generateSubscriptionId()`, `generateSessionId()` |
| `components/generic/photo-system/hooks/usePhotosTabUpload.ts` | `photo-${Date.now()}-${random}` | `generatePhotoId()` |
| `components/crm/inbox/ReplyComposer.tsx` | `att_${Date.now()}_${random}` | `generateAttachmentId()` |
| `services/upload/utils/storage-path.ts` | `file_${timestamp}_${random}` | Re-export from enterprise-id.service |
| `lib/social-platform-system/analytics-service.ts` | `share_${timestamp}_${random}` | `generateShareId()` |
| `services/session/EnterpriseSessionService.ts` | `sess_${Date.now()}_${random}` | `generateSessionId()` |
| `lib/api/enterprise-api-client.ts` | `req_${Date.now()}_${random}` | `generateRequestId()` |
| `services/obligations/InMemoryObligationsRepository.ts` (2x) | `${Date.now()}-${random}` | `generateObligationId()` |
| `contexts/WebSocketContext.tsx` | `pending-${random}` | `generatePendingId()` |
| `core/modals/PhotoPreviewModal.tsx` | `${photoTypePrefix}_${timestamp}_${random}` | `generatePhotoId()` |

**Not migrated** (legitimate Math.random use):
- `AdvancedCharts.tsx` — SVG gradient IDs (ephemeral, visual-only)
- `rate-limit-store.ts` — Rate limit member IDs (server-only ephemeral)
- `pipeline-queue-service.ts` — Already uses `PIPELINE_PROTOCOL_CONFIG`

### Task 2: `useDebounce<T>` Hook

**Location**: `src/hooks/useDebounce.ts`

```typescript
function useDebounce<T>(value: T, delay: number): T;
```

Returns a debounced copy of `value` that updates only after `delay` ms of inactivity. Follows existing pattern of `useInterval` (ADR-205).

**Migrated files (2)**:

| File | Delay | Purpose |
|------|-------|---------|
| `components/building-management/StorageForm/useStorageFormState.ts` | 500ms | Price calculation debounce |
| `components/projects/general-tab/hooks/useAutosave.ts` | 2000ms | Auto-save debounce |

**Not migrated** (different patterns):
- `useGlobalSearch.ts` — Complex race condition handling
- `useHistoryStack.ts` — Callback debounce with immediate mode
- `useColorMenuState.ts` — Guard timer
- `usePdfThumbnail.ts` — Retry throttle
- `useViewportManager.ts` — Retry with backoff

### Task 3: `formatFileSize` Deduplication + Upload Constants

**Problem**: `formatFileSize()` existed canonically in `src/utils/file-validation.ts` (locale-aware) but was marked `@deprecated`. 5 files had duplicate implementations. Additionally 5 files hardcoded `5 * 1024 * 1024` instead of using `FILE_TYPE_CONFIG.image.maxSize`.

**Step 1**: Un-deprecated `formatFileSize` in `file-validation.ts` (the function is widely used as canonical).

**Step 2**: Migrated 5 duplicate formatFileSize implementations:

| File | Change |
|------|--------|
| `photos-tab-config.ts` | Re-export from `@/utils/file-validation` |
| `ReplyComposer.tsx` | Import from `@/utils/file-validation` |
| `AttachmentRenderer.tsx` | Thin wrapper (handles `undefined`) over canonical |
| `FloorPlanPreview.tsx` | Import from `@/utils/file-validation` |
| `PreviewStep.tsx` | Import from `@/utils/file-validation` |

**Step 3**: Replaced hardcoded upload constants in 5 files:

| File | Old | New |
|------|-----|-----|
| `useFloorplanUpload.ts` | `50 * 1024 * 1024` | `UPLOAD_LIMITS.MAX_FILE_SIZE` |
| `UnifiedPhotoManager.tsx` (3x) | `5 * 1024 * 1024` | `FILE_TYPE_CONFIG.image.maxSize` |
| `MultiplePhotosFull.tsx` | `5 * 1024 * 1024` | `FILE_TYPE_CONFIG.image.maxSize` |
| `MultiplePhotosCompact.tsx` | `5 * 1024 * 1024` | `FILE_TYPE_CONFIG.image.maxSize` |
| `useMultiplePhotosHandlers.ts` | `5 * 1024 * 1024` | `FILE_TYPE_CONFIG.image.maxSize` |

## Consequences

### Positive
- **Security**: 128-bit entropy IDs replace ~48-bit Math.random() across 10 files
- **Consistency**: All ID generation goes through single service with collision detection
- **DRY**: 5 duplicate `formatFileSize` implementations removed
- **Single source of truth**: Upload size limits reference `file-upload-config.ts` constants
- **Discoverability**: New `useDebounce` hook available for future debounce needs

### Negative
- ID format changes (timestamp+random → UUID) — no backward compatibility concerns since all IDs are ephemeral/non-persisted
- Minor format differences in `formatFileSize` output (locale-aware vs simple)

## Changelog

| Date | Change |
|------|--------|
| 2026-03-12 | Initial implementation — all 3 tasks completed |
