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

function formatFloor(raw: unknown, locale: string): string | null {
  const s = pickString(raw);
  if (s === null) return null;
  const num = parseInt(s, 10);
  if (!isNaN(num) && String(num) === s.trim()) {
    if (locale === 'el') {
      if (num === 0)  return 'Ισόγειο';
      if (num === -1) return 'Υπόγειο';
      if (num < -1)   return `${Math.abs(num)}ο Υπόγειο`;
      return `${num}ος Όροφος`;
    }
    if (num === 0)  return 'Ground Floor';
    if (num === -1) return 'Basement';
    if (num < -1)   return `${Math.abs(num)}nd Basement`;
    return `${num}${num === 1 ? 'st' : num === 2 ? 'nd' : num === 3 ? 'rd' : 'th'} Floor`;
  }
  return s;
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
