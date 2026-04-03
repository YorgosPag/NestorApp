# ADR-281: SSOT Soft-Delete System — Google-Level Enterprise Trash Lifecycle

| Metadata | Value |
|----------|-------|
| **Status** | APPROVED |
| **Date** | 2026-04-03 |
| **Category** | Backend Systems / Data Safety / Entity Systems |
| **Canonical Location** | `src/lib/firestore/soft-delete-engine.ts` |
| **Author** | Giorgos Pagonis + Claude Code (Anthropic AI) |
| **Extends** | ADR-226 (Deletion Guard), ADR-191 (Document Management) |
| **Entities** | contact, property, building, project, parking, storage |

---

## 1. Context

### To Provlima

Simera **mono oi Epafes** exoun soft-delete (kados). Ola ta ypoloipa business entities (Properties, Buildings, Projects, Parking, Storage) kanoun **hard delete** — mia lathos klik kai ta dedomena xanontai gia panta.

### Ti kanoun oi megaloi

| Platform | Pattern | Retention |
|----------|---------|-----------|
| **Google** (Gmail, Drive, Contacts) | Trash se OLA | 30 imeres |
| **Salesforce** | Recycle Bin se OLA ta records | 15 imeres |
| **HubSpot** | Soft delete se OLA | 90 imeres |
| **Procore** (kataskeves) | Archive + Trash | configurable |
| **Microsoft Dynamics** | Recycle Bin se OLA | 30 imeres |

**Kanenas sovaros paiktis den kanei hard delete se business data. Pote.**

### Trexousa Katastasi

| Entity | Soft Delete | Dependency Guards | Hard Delete |
|--------|-------------|-------------------|-------------|
| Contact | **YES** (ADR-191) | YES (ADR-226) | Apo kado mono |
| Property | NO | YES | Amesa |
| Building | NO | YES | Amesa |
| Project | NO | YES | Amesa |
| Parking | NO | YES | Amesa |
| Storage | NO | YES | Amesa |

---

## 2. Decision

### Arxitektoniki: SSOT Soft-Delete Engine

**ENAS kentrikopoiimenos mixanismos**, oxi copy-paste ana entity. O mixanismos:
1. Metatrepei to existing DELETE endpoint se soft-delete (status='deleted')
2. Parexei centralized restore + permanent-delete routes
3. ENA cron gia auto-purge OLON ton entities (30 imeres)
4. Epekteinei to ADR-226 (Deletion Guard) — den to antikathista

### Lifecycle Diagram

```
User pataei "Metafora ston kado"
        |
  DELETE /api/{entity}/{id}  (existing routes, NEA symperifora)
        |
  softDelete() <-- src/lib/firestore/soft-delete-engine.ts (SSOT)
        |
  status='deleted', previousStatus, deletedAt, deletedBy
        |
  Undo toast 5sec --> POST /api/trash/{entityType}/{id}/restore
        |
  30 imeres ston kado
        |
  Cron auto-purge --> permanentDelete() --> executeDeletion() (ADR-226)
```

---

## 3. Implementation Blueprint

### 3.1 NEA Arxeia — Server Side

---

#### Arxeio 1: `src/types/soft-deletable.ts` (~35 grammes)

```typescript
/**
 * SoftDeletableFields — Mixin interface gia soft-delete lifecycle
 *
 * Kathe entity pou ypostirizei soft-delete kanei intersection me auto:
 *   export interface Property extends BaseProperty & SoftDeletableFields { ... }
 *
 * @module types/soft-deletable
 * @enterprise ADR-281 — SSOT Soft-Delete System
 */

/** Firestore-compatible timestamp (server | client | read) */
type FirestoreishTimestamp = Date | { toDate: () => Date };

/**
 * Fields added to every soft-deletable entity.
 * Present ONLY when status='deleted' (or after restore).
 */
export interface SoftDeletableFields {
  /** Timestamp otan metafer8ike ston kado */
  deletedAt?: FirestoreishTimestamp;
  /** UID tou xristi pou to esvise */
  deletedBy?: string;
  /** To status prin tin diagrafi — xrisimopoieitai gia restore */
  previousStatus?: string;
  /** Timestamp teleftaias epanaforas apo ton kado */
  restoredAt?: FirestoreishTimestamp;
  /** UID tou xristi pou to epanefere */
  restoredBy?: string;
}

/** Entity types pou ypostirizoun soft-delete lifecycle */
export type SoftDeletableEntityType =
  | 'contact'
  | 'property'
  | 'building'
  | 'project'
  | 'parking'
  | 'storage';
```

---

#### Arxeio 2: `src/lib/firestore/soft-delete-config.ts` (~100 grammes)

```typescript
/**
 * Soft-Delete Configuration Map — SSOT gia entity-specific settings
 *
 * Kathe entity exei: collection name, default restore status, permission,
 * labels gia i18n/logging.
 *
 * @module lib/firestore/soft-delete-config
 * @enterprise ADR-281 — SSOT Soft-Delete System
 */

import 'server-only';

import { COLLECTIONS } from '@/config/firestore-collections';
import type { SoftDeletableEntityType } from '@/types/soft-deletable';

export interface SoftDeleteEntityConfig {
  /** Firestore collection name (apo COLLECTIONS) */
  collection: string;
  /** Default status otan ginei restore kai den yparxei previousStatus */
  defaultRestoreStatus: string;
  /** Permission string gia withAuth */
  permission: string;
  /** Label sta Ellinika (gia logs kai audit) */
  labelEl: string;
  /** Label sta Agglika (gia API responses) */
  labelEn: string;
}

/**
 * SSOT config gia kathe soft-deletable entity type.
 *
 * PROSTHIKI NEOU ENTITY:
 * 1. Prosthese entry edo
 * 2. Prosthese 'deleted' sto status union tou entity type
 * 3. Prosthese SoftDeletableFields sto interface tou entity
 * 4. Allakse to DELETE route na kalei softDelete() anti executeDeletion()
 * 5. Prosthese .where('status', '!=', 'deleted') sto list route
 */
export const SOFT_DELETE_CONFIG: Record<SoftDeletableEntityType, SoftDeleteEntityConfig> = {
  contact: {
    collection: COLLECTIONS.CONTACTS,
    defaultRestoreStatus: 'active',
    permission: 'crm:contacts:delete',
    labelEl: 'Epafi',
    labelEn: 'Contact',
  },
  property: {
    collection: COLLECTIONS.PROPERTIES,
    defaultRestoreStatus: 'available',
    permission: 'properties:properties:delete',
    labelEl: 'Akinito',
    labelEn: 'Property',
  },
  building: {
    collection: COLLECTIONS.BUILDINGS,
    defaultRestoreStatus: 'active',
    permission: 'buildings:buildings:delete',
    labelEl: 'Ktirio',
    labelEn: 'Building',
  },
  project: {
    collection: COLLECTIONS.PROJECTS,
    defaultRestoreStatus: 'planning',
    permission: 'projects:projects:delete',
    labelEl: 'Ergo',
    labelEn: 'Project',
  },
  parking: {
    collection: COLLECTIONS.PARKING_SPACES,
    defaultRestoreStatus: 'available',
    permission: 'units:units:delete',
    labelEl: '8esi sta8mefsis',
    labelEn: 'Parking Spot',
  },
  storage: {
    collection: COLLECTIONS.STORAGE,
    defaultRestoreStatus: 'available',
    permission: 'units:units:delete',
    labelEl: 'Apo8iki',
    labelEn: 'Storage Unit',
  },
};

/** Validate pou enas entity type einai soft-deletable */
export function isSoftDeletableEntity(value: string): value is SoftDeletableEntityType {
  return value in SOFT_DELETE_CONFIG;
}
```

---

#### Arxeio 3: `src/lib/firestore/soft-delete-engine.ts` (~200 grammes) — THE CORE

```typescript
/**
 * Soft-Delete Engine — SSOT gia soft-delete, restore, permanent-delete
 *
 * ENAS mixanismos gia OLA ta entities. Kanena copy-paste.
 *
 * Lifecycle:
 *   softDelete()      → status='deleted', preserves previousStatus
 *   restoreFromTrash() → restores previousStatus, clears delete fields
 *   permanentDelete()  → guards status='deleted', then executeDeletion() (ADR-226)
 *
 * @module lib/firestore/soft-delete-engine
 * @enterprise ADR-281 — SSOT Soft-Delete System
 */

import 'server-only';

import { FieldValue } from 'firebase-admin/firestore';
import { SOFT_DELETE_CONFIG } from './soft-delete-config';
import { executeDeletion } from './deletion-guard';
import { EntityAuditService } from '@/services/entity-audit.service';
import { ApiError } from '@/lib/api/ApiErrorHandler';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import type { SoftDeletableEntityType } from '@/types/soft-deletable';

const logger = createModuleLogger('SoftDeleteEngine');

// ============================================================================
// SOFT DELETE — Move to trash
// ============================================================================

/**
 * Soft-delete: metakinei entity ston kado (status='deleted').
 * DEN svini data — mono allazei status.
 *
 * @throws ApiError(404) an to document den vre8ike
 * @throws ApiError(403) an den anikei sto company
 * @throws ApiError(409) an einai idi ston kado
 */
export async function softDelete(
  db: FirebaseFirestore.Firestore,
  entityType: SoftDeletableEntityType,
  entityId: string,
  deletedBy: string,
  companyId: string
): Promise<{ success: true; entityId: string }> {
  const config = SOFT_DELETE_CONFIG[entityType];
  const docRef = db.collection(config.collection).doc(entityId);
  const docSnap = await docRef.get();

  if (!docSnap.exists) {
    throw new ApiError(404, `${config.labelEn} not found`);
  }

  const data = docSnap.data();

  // Tenant isolation
  if (data?.companyId && data.companyId !== companyId) {
    throw new ApiError(403, `Unauthorized: ${config.labelEn} belongs to different company`);
  }

  // Idempotency guard
  if (data?.status === 'deleted') {
    throw new ApiError(409, `${config.labelEn} is already in trash`);
  }

  const previousStatus = (data?.status as string) ?? config.defaultRestoreStatus;

  logger.info(`Soft-deleting ${entityType}`, { entityId, companyId, previousStatus });

  await docRef.update({
    status: 'deleted',
    previousStatus,
    deletedAt: FieldValue.serverTimestamp(),
    deletedBy,
    updatedAt: FieldValue.serverTimestamp(),
  });

  // Audit trail (fire-and-forget)
  EntityAuditService.recordChange({
    entityType,
    entityId,
    entityName: extractEntityName(data),
    action: 'soft_deleted',
    changes: [
      { field: 'status', oldValue: previousStatus, newValue: 'deleted', label: 'Metafora ston kado' },
    ],
    performedBy: deletedBy,
    performedByName: null,
    companyId,
  }).catch((err) => {
    logger.error('Audit trail failed (non-blocking)', { entityType, entityId, error: getErrorMessage(err) });
  });

  logger.info(`${entityType} soft-deleted`, { entityId });
  return { success: true, entityId };
}

// ============================================================================
// RESTORE — Bring back from trash
// ============================================================================

/**
 * Restore: epanaferei entity apo ton kado sto proigoumeno status.
 *
 * @throws ApiError(404) an den vre8ike
 * @throws ApiError(403) tenant isolation
 * @throws ApiError(409) an DEN einai ston kado
 */
export async function restoreFromTrash(
  db: FirebaseFirestore.Firestore,
  entityType: SoftDeletableEntityType,
  entityId: string,
  restoredBy: string,
  companyId: string
): Promise<{ success: true; entityId: string; restoredStatus: string }> {
  const config = SOFT_DELETE_CONFIG[entityType];
  const docRef = db.collection(config.collection).doc(entityId);
  const docSnap = await docRef.get();

  if (!docSnap.exists) {
    throw new ApiError(404, `${config.labelEn} not found`);
  }

  const data = docSnap.data();

  if (data?.companyId && data.companyId !== companyId) {
    throw new ApiError(403, `Unauthorized: ${config.labelEn} belongs to different company`);
  }

  if (data?.status !== 'deleted') {
    throw new ApiError(409, `${config.labelEn} is not in trash`);
  }

  const restoredStatus = (data.previousStatus as string) || config.defaultRestoreStatus;

  logger.info(`Restoring ${entityType} from trash`, { entityId, restoredStatus });

  await docRef.update({
    status: restoredStatus,
    previousStatus: FieldValue.delete(),
    deletedAt: FieldValue.delete(),
    deletedBy: FieldValue.delete(),
    restoredAt: FieldValue.serverTimestamp(),
    restoredBy,
    updatedAt: FieldValue.serverTimestamp(),
  });

  // Audit trail (fire-and-forget)
  EntityAuditService.recordChange({
    entityType,
    entityId,
    entityName: extractEntityName(data),
    action: 'restored',
    changes: [
      { field: 'status', oldValue: 'deleted', newValue: restoredStatus, label: 'Epanafora apo kado' },
    ],
    performedBy: restoredBy,
    performedByName: null,
    companyId,
  }).catch((err) => {
    logger.error('Audit trail failed (non-blocking)', { entityType, entityId, error: getErrorMessage(err) });
  });

  return { success: true, entityId, restoredStatus };
}

// ============================================================================
// PERMANENT DELETE — Hard delete from trash only
// ============================================================================

/**
 * Permanent delete: MONO apo ton kado (status='deleted').
 * Trexei to plires ADR-226 dependency check + cascade + hard delete.
 *
 * @throws ApiError(409) an DEN einai ston kado
 * @throws ApiError(409) an exei blocking dependencies
 */
export async function permanentDelete(
  db: FirebaseFirestore.Firestore,
  entityType: SoftDeletableEntityType,
  entityId: string,
  deletedBy: string,
  companyId: string
): Promise<{ success: true; entityId: string }> {
  const config = SOFT_DELETE_CONFIG[entityType];
  const docRef = db.collection(config.collection).doc(entityId);
  const docSnap = await docRef.get();

  if (!docSnap.exists) {
    throw new ApiError(404, `${config.labelEn} not found`);
  }

  const data = docSnap.data();

  if (data?.companyId && data.companyId !== companyId) {
    throw new ApiError(403, `Unauthorized: ${config.labelEn} belongs to different company`);
  }

  // MUST be in trash
  if (data?.status !== 'deleted') {
    throw new ApiError(409, `${config.labelEn} must be in trash before permanent deletion`);
  }

  logger.info(`Permanently deleting ${entityType}`, { entityId });

  // Delegate to ADR-226 engine (dependency check + cascade + hard delete + audit)
  await executeDeletion(db, entityType, entityId, deletedBy, companyId);

  logger.info(`${entityType} permanently deleted`, { entityId });
  return { success: true, entityId };
}

// ============================================================================
// BATCH OPERATIONS
// ============================================================================

export async function batchSoftDelete(
  db: FirebaseFirestore.Firestore,
  entityType: SoftDeletableEntityType,
  entityIds: string[],
  deletedBy: string,
  companyId: string
): Promise<{ succeeded: string[]; failed: Array<{ id: string; error: string }> }> {
  const succeeded: string[] = [];
  const failed: Array<{ id: string; error: string }> = [];

  await Promise.all(entityIds.map(async (id) => {
    try {
      await softDelete(db, entityType, id, deletedBy, companyId);
      succeeded.push(id);
    } catch (err) {
      failed.push({ id, error: getErrorMessage(err) });
    }
  }));

  return { succeeded, failed };
}

export async function batchRestore(
  db: FirebaseFirestore.Firestore,
  entityType: SoftDeletableEntityType,
  entityIds: string[],
  restoredBy: string,
  companyId: string
): Promise<{ succeeded: string[]; failed: Array<{ id: string; error: string }> }> {
  const succeeded: string[] = [];
  const failed: Array<{ id: string; error: string }> = [];

  await Promise.all(entityIds.map(async (id) => {
    try {
      await restoreFromTrash(db, entityType, id, restoredBy, companyId);
      succeeded.push(id);
    } catch (err) {
      failed.push({ id, error: getErrorMessage(err) });
    }
  }));

  return { succeeded, failed };
}

// ============================================================================
// HELPERS
// ============================================================================

function extractEntityName(data: FirebaseFirestore.DocumentData | undefined): string {
  if (!data) return 'Unknown';
  // Try common name patterns
  return (
    data.name ??
    data.title ??
    (data.firstName ? `${data.firstName} ${data.lastName ?? ''}`.trim() : null) ??
    data.companyName ??
    data.number ??
    data.code ??
    'Unknown'
  );
}
```

---

#### Arxeio 4: `src/app/api/trash/[entityType]/[entityId]/restore/route.ts` (~60 grammes)

```typescript
/**
 * POST /api/trash/{entityType}/{entityId}/restore
 *
 * Centralized restore endpoint gia OLA ta soft-deletable entities.
 *
 * @module api/trash/[entityType]/[entityId]/restore
 * @enterprise ADR-281 — SSOT Soft-Delete System
 */

import { NextRequest } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withAuth, logAuditEvent } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { ApiError, apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { restoreFromTrash } from '@/lib/firestore/soft-delete-engine';
import { isSoftDeletableEntity, SOFT_DELETE_CONFIG } from '@/lib/firestore/soft-delete-config';
import type { SoftDeletableEntityType } from '@/types/soft-deletable';

interface RestoreResponse {
  entityType: string;
  entityId: string;
  restoredStatus: string;
}

export const POST = withStandardRateLimit(
  withAuth<ApiSuccessResponse<RestoreResponse>>(
    async (
      _request: NextRequest,
      ctx: AuthContext,
      _cache: PermissionCache,
      segmentData?: { params: Promise<{ entityType: string; entityId: string }> }
    ) => {
      const { entityType, entityId } = await segmentData!.params;

      if (!isSoftDeletableEntity(entityType)) {
        throw new ApiError(400, `Invalid entity type: ${entityType}`);
      }

      const typedEntityType = entityType as SoftDeletableEntityType;
      const adminDb = getAdminFirestore();

      const result = await restoreFromTrash(
        adminDb, typedEntityType, entityId, ctx.uid, ctx.companyId
      );

      await logAuditEvent(ctx, 'data_updated', entityType, 'api', {
        newValue: { type: 'status', value: { entityId, restoredStatus: result.restoredStatus } },
        metadata: { reason: `${SOFT_DELETE_CONFIG[typedEntityType].labelEn} restored from trash` },
      });

      return apiSuccess<RestoreResponse>(
        { entityType, entityId, restoredStatus: result.restoredStatus },
        `${SOFT_DELETE_CONFIG[typedEntityType].labelEn} restored from trash`
      );
    },
    // Permission: dynamically resolved inside handler — use most permissive here
    { permissions: 'crm:contacts:delete' }
  )
);
```

**SIMEIOSI GIA IMPLEMENTATION**: To `withAuth` pairnei static permission. Gia dynamic permission ana entity type, prepei na ginei manual check mesa sto handler me `ctx.permissions.includes(config.permission)`. H alternative einai na xrisimopoi8ei `{ permissions: undefined }` kai na ginei manual check. Opoios tropos epilege8ei, prepei na einai consistent.

---

#### Arxeio 5: `src/app/api/trash/[entityType]/[entityId]/permanent-delete/route.ts` (~60 grammes)

Akrivws opws to restore, alla:
- Method: DELETE (anti POST)
- Kalei: `permanentDelete()` anti `restoreFromTrash()`
- Audit reason: "permanently deleted from trash"

---

#### Arxeio 6: `src/app/api/cron/purge-deleted-entities/route.ts` (~120 grammes)

```typescript
/**
 * GET /api/cron/purge-deleted-entities
 *
 * Daily cleanup gia OLA ta soft-deletable entities.
 * Antikathista to purge-deleted-contacts (mono contacts).
 *
 * @module api/cron/purge-deleted-entities
 * @enterprise ADR-281 — SSOT Soft-Delete System
 */

import { NextResponse } from 'next/server';
import { createModuleLogger } from '@/lib/telemetry';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { executeDeletion } from '@/lib/firestore/deletion-guard';
import { SOFT_DELETE_CONFIG } from '@/lib/firestore/soft-delete-config';
import { getErrorMessage } from '@/lib/error-utils';
import type { SoftDeletableEntityType } from '@/types/soft-deletable';

const logger = createModuleLogger('CronPurgeDeletedEntities');

export const maxDuration = 60;

/** 30 days in milliseconds */
const TRASH_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

/** Max documents per entity type per cron run (avoid Vercel timeout) */
const PER_TYPE_LIMIT = 20;

export async function GET() {
  const startTime = Date.now();
  const db = getAdminFirestore();
  const cutoffDate = new Date(Date.now() - TRASH_RETENTION_MS);

  const results: Record<string, { purged: number; skipped: number; checked: number }> = {};

  const entityTypes = Object.keys(SOFT_DELETE_CONFIG) as SoftDeletableEntityType[];

  for (const entityType of entityTypes) {
    const config = SOFT_DELETE_CONFIG[entityType];
    let purged = 0;
    let skipped = 0;

    try {
      const snapshot = await db
        .collection(config.collection)
        .where('status', '==', 'deleted')
        .where('deletedAt', '<=', cutoffDate)
        .limit(PER_TYPE_LIMIT)
        .get();

      if (!snapshot.empty) {
        for (const doc of snapshot.docs) {
          try {
            const docData = doc.data();
            const docCompanyId = (docData.companyId as string) ?? '';
            await executeDeletion(db, entityType, doc.id, 'system:cron-purge', docCompanyId);
            purged++;
          } catch (error) {
            skipped++;
            logger.warn(`Skipped purge for ${entityType}`, {
              entityId: doc.id, error: getErrorMessage(error),
            });
          }
        }
      }

      results[entityType] = { purged, skipped, checked: snapshot.size };
    } catch (error) {
      logger.error(`Failed to purge ${entityType}`, { error: getErrorMessage(error) });
      results[entityType] = { purged: 0, skipped: 0, checked: 0 };
    }
  }

  const totalPurged = Object.values(results).reduce((sum, r) => sum + r.purged, 0);
  const totalSkipped = Object.values(results).reduce((sum, r) => sum + r.skipped, 0);

  logger.info('Entity purge complete', { results, totalPurged, totalSkipped, durationMs: Date.now() - startTime });

  return NextResponse.json({
    success: true,
    results,
    totalPurged,
    totalSkipped,
    durationMs: Date.now() - startTime,
  });
}
```

---

### 3.2 NEA Arxeia — Frontend

---

#### Arxeio 7: `src/services/trash.service.ts` (~80 grammes)

```typescript
/**
 * TrashService — Client-side service gia centralized trash operations
 *
 * @module services/trash
 * @enterprise ADR-281 — SSOT Soft-Delete System
 */

import { apiClient } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';
import type { SoftDeletableEntityType } from '@/types/soft-deletable';

interface RestoreResponse {
  entityType: string;
  entityId: string;
  restoredStatus: string;
}

interface PermanentDeleteResponse {
  entityType: string;
  entityId: string;
  deleted: boolean;
}

export class TrashService {
  /** Restore single entity from trash */
  static async restore(entityType: SoftDeletableEntityType, entityId: string): Promise<RestoreResponse> {
    return apiClient.post<RestoreResponse>(API_ROUTES.TRASH.RESTORE(entityType, entityId));
  }

  /** Restore multiple entities from trash */
  static async bulkRestore(entityType: SoftDeletableEntityType, ids: string[]): Promise<void> {
    await Promise.all(ids.map(id => TrashService.restore(entityType, id)));
  }

  /** Permanently delete single entity (must be in trash) */
  static async permanentDelete(entityType: SoftDeletableEntityType, entityId: string): Promise<PermanentDeleteResponse> {
    return apiClient.delete<PermanentDeleteResponse>(API_ROUTES.TRASH.PERMANENT_DELETE(entityType, entityId));
  }

  /** Permanently delete multiple entities */
  static async bulkPermanentDelete(entityType: SoftDeletableEntityType, ids: string[]): Promise<void> {
    await Promise.all(ids.map(id => TrashService.permanentDelete(entityType, id)));
  }
}
```

---

#### Arxeio 8: `src/hooks/useSoftDelete.ts` (~90 grammes)

```typescript
/**
 * useSoftDelete — Hook me undo toast pattern (Google-level)
 *
 * Kalei to existing DELETE endpoint tou entity (pou tora kanei soft-delete),
 * kai parexei 5-second undo window.
 *
 * @module hooks/useSoftDelete
 * @enterprise ADR-281 — SSOT Soft-Delete System
 */

'use client';

import { useCallback, useState } from 'react';
import { useNotifications } from '@/hooks/useNotifications';
import { useTranslation } from 'react-i18next';
import { TrashService } from '@/services/trash.service';
import type { SoftDeletableEntityType } from '@/types/soft-deletable';

interface UseSoftDeleteOptions {
  entityType: SoftDeletableEntityType;
  /** Delete function — kalei to entity-specific DELETE endpoint */
  deleteFn: (id: string) => Promise<void>;
  /** Callback meta apo epitiximeni diagrafi i undo */
  onSuccess?: () => void;
}

interface UseSoftDeleteReturn {
  /** Soft-delete single entity + show undo toast */
  softDelete: (id: string) => Promise<void>;
  /** Soft-delete multiple entities + show undo toast */
  softDeleteMultiple: (ids: string[]) => Promise<void>;
  /** True while a delete/restore is in progress */
  loading: boolean;
}

export function useSoftDelete({ entityType, deleteFn, onSuccess }: UseSoftDeleteOptions): UseSoftDeleteReturn {
  const [loading, setLoading] = useState(false);
  const { notify } = useNotifications();
  const { t } = useTranslation('trash');

  const softDelete = useCallback(async (id: string) => {
    setLoading(true);
    try {
      await deleteFn(id);
      onSuccess?.();

      // Undo toast — 5 second window
      notify(t('deleteSuccess'), {
        type: 'success',
        duration: 5000,
        actions: [{
          label: t('undo'),
          onClick: async () => {
            try {
              await TrashService.restore(entityType, id);
              notify(t('undoSuccess'), { type: 'info', duration: 2000 });
              onSuccess?.();
            } catch {
              notify(t('undoFailed'), { type: 'error' });
            }
          },
        }],
      });
    } finally {
      setLoading(false);
    }
  }, [deleteFn, entityType, notify, onSuccess, t]);

  const softDeleteMultiple = useCallback(async (ids: string[]) => {
    setLoading(true);
    try {
      await Promise.all(ids.map(id => deleteFn(id)));
      onSuccess?.();

      notify(t('deleteSuccessMultiple', { count: ids.length }), {
        type: 'success',
        duration: 5000,
        actions: [{
          label: t('undo'),
          onClick: async () => {
            try {
              await TrashService.bulkRestore(entityType, ids);
              notify(t('undoSuccess'), { type: 'info', duration: 2000 });
              onSuccess?.();
            } catch {
              notify(t('undoFailed'), { type: 'error' });
            }
          },
        }],
      });
    } finally {
      setLoading(false);
    }
  }, [deleteFn, entityType, notify, onSuccess, t]);

  return { softDelete, softDeleteMultiple, loading };
}
```

---

#### Arxeio 9: `src/hooks/useTrashView.ts` (~50 grammes)

```typescript
/**
 * useTrashView — Generic trash/active toggle hook
 *
 * Filtrirei items se active (status != 'deleted') kai trashed (status == 'deleted').
 * Parexei toggle, count, selection.
 *
 * @module hooks/useTrashView
 * @enterprise ADR-281 — SSOT Soft-Delete System
 */

'use client';

import { useMemo, useState, useCallback } from 'react';

interface TrashableItem {
  id: string;
  status?: string;
  [key: string]: unknown;
}

interface UseTrashViewReturn<T extends TrashableItem> {
  showTrash: boolean;
  toggleTrash: () => void;
  setShowTrash: (show: boolean) => void;
  activeItems: T[];
  trashedItems: T[];
  trashCount: number;
  /** Currently visible items (based on showTrash) */
  visibleItems: T[];
}

export function useTrashView<T extends TrashableItem>(items: T[]): UseTrashViewReturn<T> {
  const [showTrash, setShowTrash] = useState(false);

  const toggleTrash = useCallback(() => setShowTrash(prev => !prev), []);

  const activeItems = useMemo(
    () => items.filter(item => item.status !== 'deleted'),
    [items]
  );

  const trashedItems = useMemo(
    () => items.filter(item => item.status === 'deleted'),
    [items]
  );

  const trashCount = trashedItems.length;

  const visibleItems = showTrash ? trashedItems : activeItems;

  return { showTrash, toggleTrash, setShowTrash, activeItems, trashedItems, trashCount, visibleItems };
}
```

---

#### Arxeio 10: `src/components/shared/trash/TrashActionsBar.tsx` (~80 grammes)

```typescript
/**
 * TrashActionsBar — Generic toolbar gia trash view
 *
 * Reusable across OLA ta entities: contacts, properties, buildings, etc.
 *
 * @component
 * @enterprise ADR-281 — SSOT Soft-Delete System
 */

'use client';

import { Button } from '@/components/ui/button';
import { ArrowLeft, RotateCcw, Trash2, AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useIconSizes, useSemanticColors } from '@/hooks/useDesignTokens';

interface TrashActionsBarProps {
  /** Selected entity IDs in trash view */
  selectedIds: string[];
  /** Navigate back to active view */
  onBack: () => void;
  /** Restore selected items */
  onRestore: (ids: string[]) => void;
  /** Permanently delete selected items */
  onPermanentDelete: (ids: string[]) => void;
  /** Total number of items in trash */
  trashCount: number;
  /** Entity type label for display (e.g., "Contacts", "Properties") */
  entityLabel?: string;
}

export function TrashActionsBar({
  selectedIds,
  onBack,
  onRestore,
  onPermanentDelete,
  trashCount,
}: TrashActionsBarProps) {
  const { t } = useTranslation('trash');
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();

  return (
    <section
      className="flex flex-col gap-2 px-3 py-2 border-b"
      role="toolbar"
      aria-label={t('trashView')}
    >
      {/* Warning banner */}
      <div className={`flex items-center gap-2 px-3 py-2 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-sm ${colors.text.muted}`}>
        <AlertTriangle className={`${iconSizes.sm} text-amber-500 shrink-0`} />
        <p>{t('autoDeleteWarning')}</p>
      </div>

      {/* Action buttons */}
      <nav className="flex items-center gap-2 flex-wrap">
        <Button size="sm" variant="outline" onClick={onBack} className="gap-1.5">
          <ArrowLeft className={iconSizes.xs} />
          {t('backToList')}
        </Button>

        <span className={`text-sm ${colors.text.muted} px-2`}>
          {t('trashCount', { count: trashCount })}
        </span>

        <div className="flex-1" />

        <Button
          size="sm"
          variant="outline"
          onClick={() => onRestore(selectedIds)}
          disabled={selectedIds.length === 0}
          className="gap-1.5"
        >
          <RotateCcw className={iconSizes.xs} />
          {t('restoreSelected')}
          {selectedIds.length > 0 && ` (${selectedIds.length})`}
        </Button>

        <Button
          size="sm"
          variant="destructive"
          onClick={() => onPermanentDelete(selectedIds)}
          disabled={selectedIds.length === 0}
          className="gap-1.5"
        >
          <Trash2 className={iconSizes.xs} />
          {t('permanentDelete')}
        </Button>
      </nav>
    </section>
  );
}
```

---

### 3.3 TROPOPOIIMENA Arxeia

---

#### 3.3.1 Status Union Updates (5 arxeia)

**Property** — `src/constants/domains/property-status-core.ts`:
- Prosthese `'deleted'` sto `PropertyStatus` union
- Prosthese entry sto `PROPERTY_STATUS_LABELS`: `deleted: 'Diagrammeno'`
- Prosthese entry sto `PROPERTY_STATUS_COLORS`: `deleted: 'gray'` (i opoia xroma)
- KRIFSE to 'deleted' apo filter dropdowns (mi to emfanizeis san epilogi)

**Building** — `src/types/building/contracts.ts`:
- Allaxe: `status: 'planning' | 'construction' | 'completed' | 'active'`
- Se: `status: 'planning' | 'construction' | 'completed' | 'active' | 'deleted'`
- Prosthese `& SoftDeletableFields` sto Building interface

**Project** — `src/types/project.ts`:
- Allaxe: `ProjectStatus` (5 values)
- Prosthese: `| 'deleted'`
- Prosthese sto `PROJECT_STATUS_LABELS`: `deleted: 'Diagrammeno'`
- Prosthese `& SoftDeletableFields` sto Project interface

**ParkingSpot** — `src/types/parking.ts`:
- Prosthese `| 'deleted'` sto `ParkingSpotStatus`
- Prosthese labels/colors
- Prosthese `& SoftDeletableFields`

**Storage** — `src/types/storage/contracts.ts` + `constants.ts`:
- Prosthese `| 'deleted'` sto `StorageStatus`
- Prosthese labels
- Prosthese `& SoftDeletableFields`

---

#### 3.3.2 API DELETE Routes — Hard to Soft (5 arxeia)

**Pattern** — SE KATHE arxeio:

**PRIN:**
```typescript
await executeDeletion(adminDb, 'property', id, ctx.uid, ctx.companyId);
```

**META:**
```typescript
import { softDelete } from '@/lib/firestore/soft-delete-engine';
// ...
await softDelete(adminDb, 'property', id, ctx.uid, ctx.companyId);
```

**Akrivs arxeia kai grammes:**

| Arxeio | Grammi | Allagi |
|--------|--------|--------|
| `src/app/api/properties/[id]/route.ts` | 256 | `executeDeletion()` → `softDelete()` |
| `src/app/api/buildings/[buildingId]/route.ts` | 66 | `executeDeletion()` → `softDelete()` |
| `src/app/api/projects/[projectId]/project-mutations.service.ts` | 153 | `executeDeletion()` → `softDelete()` |
| `src/app/api/parking/[id]/route.ts` | 195 | `executeDeletion()` → `softDelete()` |
| `src/app/api/storages/[id]/route.ts` | 188 | `executeDeletion()` → `softDelete()` |

Episis, allaxe ta messages: `'Property deleted'` → `'Property moved to trash'`

---

#### 3.3.3 List API Routes — Filtrisma deleted records (5 arxeia)

**Pattern** — SE KATHE list route:

**PRIN:**
```typescript
let unitsQuery = db.collection(COLLECTIONS.PROPERTIES);
unitsQuery = unitsQuery.where(FIELDS.COMPANY_ID, '==', companyId);
```

**META:**
```typescript
let unitsQuery = db.collection(COLLECTIONS.PROPERTIES);
unitsQuery = unitsQuery.where(FIELDS.COMPANY_ID, '==', companyId);
// ADR-281: Exclude soft-deleted records from normal list
unitsQuery = unitsQuery.where('status', '!=', 'deleted');
```

**PROSOXH**: Firestore `!=` dimiourgei auto-index. An yparxoun idi composite indexes me to `status` field, isws xreiaste8ei manual prosthiki sto `firestore.indexes.json`.

**EALLAKTIKA** (an to `!=` dimiourgei provlima me existing indexes):
- Perase `?includeDeleted=true` query param gia trash view
- Default: filtare deleted client-side sto API response

**Akriva arxeia:**

| Arxeio | Allagi |
|--------|--------|
| `src/app/api/properties/route.ts` | Prosthiki `.where('status', '!=', 'deleted')` sto query |
| `src/app/api/buildings/route.ts` | Prosthiki `.where('status', '!=', 'deleted')` sto query |
| `src/app/api/projects/list/route.ts` | Prosthiki `.where('status', '!=', 'deleted')` sto query |
| `src/app/api/parking/route.ts` | Prosthiki `.where('status', '!=', 'deleted')` sto query |
| `src/app/api/storages/route.ts` | Prosthiki `.where('status', '!=', 'deleted')` sto query |

---

#### 3.3.4 API_ROUTES Update

**Arxeio**: `src/config/domain-constants.ts`

**Prosthiki (meta to CONTACTS section ~grammi 644):**
```typescript
  // ── Trash (SSOT Soft-Delete) ──────────────────────────────────────────
  TRASH: {
    RESTORE: (entityType: string, entityId: string) =>
      `/api/trash/${entityType}/${entityId}/restore` as const,
    PERMANENT_DELETE: (entityType: string, entityId: string) =>
      `/api/trash/${entityType}/${entityId}/permanent-delete` as const,
  },
```

---

#### 3.3.5 Vercel Cron Update

**Arxeio**: `vercel.json`

**PRIN:**
```json
{
  "path": "/api/cron/purge-deleted-contacts",
  "schedule": "0 3 * * *"
}
```

**META:**
```json
{
  "path": "/api/cron/purge-deleted-entities",
  "schedule": "0 3 * * *"
}
```

---

#### 3.3.6 Firestore Indexes

**Arxeio**: `firestore.indexes.json`

Prosthiki composite indexes gia to purge cron query:
```json
{
  "collectionGroup": "properties",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "status", "order": "ASCENDING" },
    { "fieldPath": "deletedAt", "order": "ASCENDING" }
  ]
},
{
  "collectionGroup": "buildings",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "status", "order": "ASCENDING" },
    { "fieldPath": "deletedAt", "order": "ASCENDING" }
  ]
},
{
  "collectionGroup": "projects",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "status", "order": "ASCENDING" },
    { "fieldPath": "deletedAt", "order": "ASCENDING" }
  ]
},
{
  "collectionGroup": "parking_spots",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "status", "order": "ASCENDING" },
    { "fieldPath": "deletedAt", "order": "ASCENDING" }
  ]
},
{
  "collectionGroup": "storage_units",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "status", "order": "ASCENDING" },
    { "fieldPath": "deletedAt", "order": "ASCENDING" }
  ]
}
```

---

#### 3.3.7 i18n — Centralized Trash Strings

**NEO ARXEIO**: `src/i18n/locales/en/trash.json`
```json
{
  "trashView": "Trash",
  "backToList": "Back to List",
  "trashCount": "{{count}} in trash",
  "trashCount_one": "1 in trash",
  "deleteSuccess": "Moved to trash",
  "deleteSuccessMultiple": "{{count}} items moved to trash",
  "moveToTrash": "Move to Trash",
  "undo": "Undo",
  "undoSuccess": "Restored",
  "undoFailed": "Failed to undo",
  "restoreSelected": "Restore selected",
  "restoreSuccess": "{{count}} items restored",
  "restoreSuccess_one": "Item restored",
  "restoreFailed": "Failed to restore",
  "permanentDelete": "Permanently delete",
  "permanentDeleteConfirm": "This action cannot be undone.",
  "permanentDeleteSuccess": "Permanently deleted",
  "autoDeleteWarning": "Items deleted over 30 days ago are automatically permanently deleted.",
  "softDeleteDialog": {
    "title": "Move to Trash",
    "description": "The item will be removed from active lists but can be restored from trash.",
    "body": "This does not permanently delete the item. All data remains available for recovery.",
    "confirm": "Move to Trash"
  },
  "permanentDeleteDialog": {
    "title": "Permanently Delete",
    "description": "The item will be permanently removed if no blocking dependencies exist.",
    "body": "Permanent deletion cannot be undone.",
    "confirm": "Permanently Delete"
  }
}
```

**NEO ARXEIO**: `src/i18n/locales/el/trash.json`
```json
{
  "trashView": "Kados",
  "backToList": "Pisw stin lista",
  "trashCount": "{{count}} ston kado",
  "trashCount_one": "1 ston kado",
  "deleteSuccess": "Metafer8ike ston kado",
  "deleteSuccessMultiple": "{{count}} antikeimena metafer8ikan ston kado",
  "moveToTrash": "Metafora ston kado",
  "undo": "Anairesi",
  "undoSuccess": "Epanafertike",
  "undoFailed": "Apotyxia anairesis",
  "restoreSelected": "Epanafora epilegmenon",
  "restoreSuccess": "{{count}} antikeimena epanafer8ikan",
  "restoreSuccess_one": "To antikeimeno epanafer8ike",
  "restoreFailed": "Apotyxia epanaforas",
  "permanentDelete": "Oristiki diagrafi",
  "permanentDeleteConfirm": "Afti i energeia den mpori na anaire8ei.",
  "permanentDeleteSuccess": "Diagraftike oristika",
  "autoDeleteWarning": "Osa exoun diagraftei prin apo 30 imeres diagrafontai oristika aftomata.",
  "softDeleteDialog": {
    "title": "Metafora ston Kado",
    "description": "To antikeimeno 8a afaire8ei apo tis energes listes alla mporei na epanafertei apo ton kado.",
    "body": "Afto den diagrafei oristika to antikeimeno. Ola ta dedomena paramenoun diathesima gia anaktisi.",
    "confirm": "Metafora ston Kado"
  },
  "permanentDeleteDialog": {
    "title": "Oristiki Diagrafi",
    "description": "To antikeimeno 8a afaire8ei oristika an den exei exartiseis.",
    "body": "I oristiki diagrafi den anairetai.",
    "confirm": "Oristiki Diagrafi"
  }
}
```

---

### 3.4 Contact Migration (Phase 5)

Oi existing contact-specific routes paramenoun os **thin proxies** gia backward compatibility:

**`src/app/api/contacts/[contactId]/route.ts` DELETE handler:**
```typescript
// PRIN: inline logic (lines 152-158)
// META:
import { softDelete } from '@/lib/firestore/soft-delete-engine';
await softDelete(adminDb, 'contact', contactId, ctx.uid, ctx.companyId);
```

**`src/app/api/contacts/[contactId]/restore/route.ts`:**
```typescript
// PRIN: inline logic (lines 69-77)
// META:
import { restoreFromTrash } from '@/lib/firestore/soft-delete-engine';
const result = await restoreFromTrash(adminDb, 'contact', contactId, ctx.uid, ctx.companyId);
```

**`src/app/api/contacts/[contactId]/permanent-delete/route.ts`:**
```typescript
// PRIN: inline executeDeletion (line 67)
// META:
import { permanentDelete } from '@/lib/firestore/soft-delete-engine';
await permanentDelete(adminDb, 'contact', contactId, ctx.uid, ctx.companyId);
```

---

## 4. Implementation Batches

### Batch 1: Foundation (ZERO behavior changes)
1. `src/types/soft-deletable.ts` — NEO
2. `src/lib/firestore/soft-delete-config.ts` — NEO
3. `src/lib/firestore/soft-delete-engine.ts` — NEO
4. Status union updates (5 type files) — ADD `'deleted'`
5. `src/i18n/locales/{en,el}/trash.json` — NEO
6. `src/config/domain-constants.ts` — ADD TRASH routes
7. `src/services/trash.service.ts` — NEO
8. `src/hooks/useSoftDelete.ts` — NEO
9. `src/hooks/useTrashView.ts` — NEO
10. `src/components/shared/trash/TrashActionsBar.tsx` — NEO

### Batch 2: Leaf entity conversion
1. Storage DELETE → softDelete()
2. Parking DELETE → softDelete()
3. Property DELETE → softDelete()
4. List routes: filter deleted

### Batch 3: Structural entity conversion
1. Building DELETE → softDelete()
2. Project DELETE → softDelete()
3. List routes: filter deleted

### Batch 4: Centralized routes + cron
1. `/api/trash/[entityType]/[entityId]/restore` — NEO
2. `/api/trash/[entityType]/[entityId]/permanent-delete` — NEO
3. `/api/cron/purge-deleted-entities` — NEO
4. `vercel.json` update
5. `firestore.indexes.json` update

### Batch 5: Contact migration + cleanup
1. Contact DELETE → uses engine
2. Contact restore → uses engine
3. Contact permanent-delete → uses engine
4. Remove old purge cron route

---

## 5. Firestore Composite Indexes

Gia to purge cron query (`status='deleted' AND deletedAt <= cutoff`), xreiazontai composite indexes. Prosthiki sto `firestore.indexes.json` kai deploy me:
```bash
firebase deploy --only firestore:indexes --project pagonis-87766
```

Index building pairnei 2-5 lepta — katholos blocking.

---

## 6. Risk Mitigation

| Risk | Mitigation |
|------|------------|
| PropertyStatus union explosion | Hide 'deleted' apo filter dropdowns, only show in trash view |
| Search index stale data | search_documents prepei na filtraroun deleted entities |
| Existing dependent queries | `!=` operator dimiourgei auto-index, alla xreiazetai testing |
| Vercel cron timeout | 20 docs per entity type, 60s max duration |
| Backward compat | Contact routes paramenoun as proxies |

---

## 7. Verification Checklist

- [ ] Soft-delete entity → status='deleted', data intact
- [ ] Soft-deleted entity DEN emfanizetai sti lista
- [ ] Restore → entity emfanizetai pali me original status
- [ ] Undo toast → restore within 5 seconds
- [ ] Permanent delete enos entity me exartiseis → BLOCKED (ADR-226)
- [ ] Permanent delete enos entity xoris exartiseis → hard deleted
- [ ] Cron purge → entities >30 days auto-purged
- [ ] `npx tsc --noEmit` — zero new errors
- [ ] Contact routes xrisimopoioun centralized engine

---

## Changelog

| Date | Author | Change |
|------|--------|--------|
| 2026-04-03 | Claude Code | Initial ADR creation |
| 2026-04-03 | Claude Code | Batch 2: Leaf entity conversion — properties/parking/storages DELETE→softDelete + LIST filtering |
