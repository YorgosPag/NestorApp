/**
 * property-deletion-guard — Pre-delete BOQ-reference check + soft archive (ADR-329 §3.9)
 *
 * Properties referenced by BOQ items (as linkedUnitId or member of
 * linkedUnitIds[]) cannot be hard-deleted. The guard returns a structured
 * report grouped by status; the UI shows it and offers a soft-archive escape
 * (sets `archivedAt` + `archivedBy`).
 *
 * @module services/property/property-deletion-guard
 * @see ADR-329 §3.9
 */

import { doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import { boqService } from '@/services/measurements';
import { createModuleLogger } from '@/lib/telemetry';
import type { BOQItem } from '@/types/boq';
import type { Property } from '@/types/property';

const logger = createModuleLogger('property-deletion-guard');

export interface PropertyDeletionReport {
  propertyId: string;
  blocked: boolean;
  totalRefs: number;
  draftRefs: number;
  /** submitted | approved | certified */
  submittedRefs: number;
  lockedRefs: number;
  items: BOQItem[];
}

/**
 * Returns BOQ items that reference `propertyId` either via `linkedUnitId`
 * or as a member of `linkedUnitIds[]`. Scans the property's building only,
 * so callers must pass `companyId` + the property's `buildingId`.
 */
export async function checkBOQReferences(
  companyId: string,
  buildingId: string,
  propertyId: string,
): Promise<PropertyDeletionReport> {
  const items = await boqService.getByBuilding(companyId, buildingId);
  const refs = items.filter((it) =>
    it.linkedUnitId === propertyId
    || (it.linkedUnitIds?.includes(propertyId) ?? false),
  );

  const draftRefs = refs.filter((it) => it.status === 'draft').length;
  const lockedRefs = refs.filter((it) => it.status === 'locked').length;
  const submittedRefs = refs.length - draftRefs - lockedRefs;

  return {
    propertyId,
    blocked: refs.length > 0,
    totalRefs: refs.length,
    draftRefs,
    submittedRefs,
    lockedRefs,
    items: refs,
  };
}

/**
 * Soft-archive a property — sets `archivedAt` + `archivedBy`. The property
 * stays readable so existing BOQ refs continue to resolve.
 */
export async function archiveProperty(propertyId: string, userId: string): Promise<void> {
  if (!propertyId) {
    throw new Error('VALIDATION_ERROR: propertyId required');
  }
  const ref = doc(db, COLLECTIONS.PROPERTIES, propertyId);
  await updateDoc(ref, {
    archivedAt: serverTimestamp(),
    archivedBy: userId,
  });
  logger.info('Property archived', { propertyId, userId });
}

/** Reverse of archive — clears the archive fields. */
export async function restoreProperty(propertyId: string): Promise<void> {
  if (!propertyId) {
    throw new Error('VALIDATION_ERROR: propertyId required');
  }
  const ref = doc(db, COLLECTIONS.PROPERTIES, propertyId);
  await updateDoc(ref, {
    archivedAt: null,
    archivedBy: null,
  });
  logger.info('Property restored from archive', { propertyId });
}

/** Convenience: load property to extract `buildingId` + `companyId` for the guard. */
export async function loadPropertyContext(
  propertyId: string,
): Promise<{ companyId: string; buildingId: string; property: Property } | null> {
  const ref = doc(db, COLLECTIONS.PROPERTIES, propertyId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const data = snap.data() as Property & { companyId?: string };
  if (!data.buildingId) return null;
  return {
    companyId: data.companyId ?? '',
    buildingId: data.buildingId,
    property: { ...data, id: snap.id },
  };
}
