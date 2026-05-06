/**
 * Storage Showcase Snapshot Builder (ADR-315 + ADR-321 pattern).
 *
 * Delegates orchestration to `createShowcaseSnapshotBuilder` factory.
 * Owns only the storage-specific field mapping (`buildInfo`) and the
 * building-name relation loader.
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

function pickString(v: unknown): string | null {
  if (typeof v === 'string' && v.trim().length > 0) return v.trim();
  return null;
}

function pickNumber(v: unknown): number | null {
  if (typeof v === 'number' && isFinite(v)) return v;
  return null;
}

export const buildStorageShowcaseSnapshot = createShowcaseSnapshotBuilder<
  StorageShowcaseInfo,
  StorageRelations,
  StorageShowcaseSnapshot
>({
  collection: COLLECTIONS.STORAGE,
  entityLabel: 'Storage',
  loadRelations: async (adminDb, _storageId, raw) => {
    const buildingId = pickString(raw.buildingId);
    if (!buildingId) return { buildingName: null };
    const snap = await adminDb.collection(COLLECTIONS.BUILDINGS).doc(buildingId).get();
    if (!snap.exists) return { buildingName: null };
    const bRaw = snap.data() ?? {};
    return { buildingName: pickString(bRaw.name) };
  },
  buildInfo: ({ entityId, raw, relations, locale }) => ({
    id:          entityId,
    code:        pickString(raw.code),
    name:        pickString(raw.name) ?? entityId,
    description: pickString(raw.description),
    typeLabel:   translateStorageType(pickString(raw.type) ?? undefined, locale) ?? null,
    statusLabel: translateStorageStatus(pickString(raw.status) ?? undefined, locale) ?? null,
    area:        pickNumber(raw.area),
    price:       pickNumber(raw.price),
    floor:       pickString(raw.floor),
    buildingName: relations.buildingName,
  }),
  wrapSnapshot: (storage, company) => ({ storage, company }),
});
