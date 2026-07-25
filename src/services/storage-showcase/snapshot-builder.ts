/**
 * Storage Showcase Snapshot Builder (ADR-315 + ADR-321 pattern, ADR-701 primitives).
 *
 * Delegates orchestration to `createShowcaseSnapshotBuilder` and the raw-value
 * pickers / floor formatter / building-name loader to
 * `showcase-core/snapshot-field-primitives`. This file owns only the
 * storage-specific field mapping.
 *
 * @module services/storage-showcase/snapshot-builder
 */

import 'server-only';

import { COLLECTIONS } from '@/config/firestore-collections';
import {
  createShowcaseSnapshotBuilder,
  ShowcaseEntityNotFoundError,
  ShowcaseTenantMismatchError,
} from '@/services/showcase-core/snapshot-builder-factory';
import {
  buildShowcaseIdentityFields,
  buildShowcaseMetricFields,
  createShowcaseRelationLoader,
  pickShowcaseString,
} from '@/services/showcase-core/snapshot-field-primitives';
import { translateStorageType, translateStorageStatus } from './labels';
import type { ShowcaseCompanyBranding } from '@/services/company/company-branding-resolver';

export type { ShowcaseCompanyBranding };

export interface StorageShowcaseInfo {
  id: string;
  code: string | null;
  name: string;
  description: string | null;
  typeLabel: string | null;
  statusLabel: string | null;
  area: number | null;
  price: number | null;
  floor: string | null;
  buildingName: string | null;
}

export interface StorageShowcaseSnapshot {
  storage: StorageShowcaseInfo;
  company: ShowcaseCompanyBranding;
}

export class StorageNotFoundError extends ShowcaseEntityNotFoundError {
  constructor(storageId: string) {
    super('Storage', storageId);
    this.name = 'StorageNotFoundError';
  }
}

export class StorageTenantMismatchError extends ShowcaseTenantMismatchError {
  constructor(storageId: string) {
    super('Storage', storageId);
  }
}

interface StorageRelations {
  buildingName: string | null;
}

export const buildStorageShowcaseSnapshot = createShowcaseSnapshotBuilder<
  StorageShowcaseInfo,
  StorageRelations,
  StorageShowcaseSnapshot
>({
  collection: COLLECTIONS.STORAGE,
  entityLabel: 'Storage',
  loadRelations: createShowcaseRelationLoader({
    foreignKeyField: 'buildingId',
    collection: COLLECTIONS.BUILDINGS,
    resultKey: 'buildingName',
    nameFields: ['name'],
  }),
  buildInfo: ({ entityId, raw, relations, locale }) => ({
    ...buildShowcaseIdentityFields(entityId, raw),
    typeLabel:   translateStorageType(pickShowcaseString(raw.type) ?? undefined, locale) ?? null,
    statusLabel: translateStorageStatus(pickShowcaseString(raw.status) ?? undefined, locale) ?? null,
    ...buildShowcaseMetricFields(raw, locale),
    buildingName: relations.buildingName,
  }),
  wrapSnapshot: (storage, company) => ({ storage, company }),
});
