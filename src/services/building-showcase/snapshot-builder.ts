/**
 * Building Showcase Snapshot Builder — SSoT (ADR-320).
 *
 * Builds a `BuildingShowcaseSnapshot` from a Firestore building document.
 * Used by: PDF API route, public showcase API route.
 *
 * Tenant isolation enforced: throws if `building.companyId !== companyId`.
 *
 * @module services/building-showcase/snapshot-builder
 */

import type { Firestore } from 'firebase-admin/firestore';
import { COLLECTIONS } from '@/config/firestore-collections';
import { resolveShowcaseCompanyBranding } from '@/services/company/company-branding-resolver';
import type {
  BuildingShowcaseInfo,
  BuildingShowcaseSnapshot,
} from '@/types/building-showcase';
import type { EnumLocale } from '@/services/property-enum-labels/property-enum-labels.service';
import {
  translateBuildingType,
  translateBuildingStatus,
  translateRenovationStatus,
} from './labels';

function pickString(v: unknown): string | null {
  if (typeof v === 'string' && v.trim().length > 0) return v.trim();
  return null;
}

function pickNumber(v: unknown): number | null {
  if (typeof v === 'number' && isFinite(v)) return v;
  return null;
}

export class BuildingNotFoundError extends Error {
  constructor(buildingId: string) {
    super(`Building not found: ${buildingId}`);
    this.name = 'BuildingNotFoundError';
  }
}

export class TenantMismatchError extends Error {
  constructor(buildingId: string) {
    super(`Tenant isolation violation for building: ${buildingId}`);
    this.name = 'TenantMismatchError';
  }
}

async function loadProjectName(
  adminDb: Firestore,
  projectId: string,
): Promise<string | null> {
  const snap = await adminDb.collection(COLLECTIONS.PROJECTS).doc(projectId).get();
  if (!snap.exists) return null;
  const raw = snap.data() ?? {};
  return pickString(raw.name) ?? pickString(raw.title);
}

export async function buildBuildingShowcaseSnapshot(
  buildingId: string,
  locale: EnumLocale,
  adminDb: Firestore,
  companyId: string,
): Promise<BuildingShowcaseSnapshot> {
  const buildingSnap = await adminDb.collection(COLLECTIONS.BUILDINGS).doc(buildingId).get();

  if (!buildingSnap.exists) {
    throw new BuildingNotFoundError(buildingId);
  }

  const raw = buildingSnap.data() ?? {};

  if ((raw.companyId as string | undefined) !== companyId) {
    throw new TenantMismatchError(buildingId);
  }

  const projectId = pickString(raw.projectId);
  const projectName = projectId ? await loadProjectName(adminDb, projectId) : null;

  const building: BuildingShowcaseInfo = {
    id:                buildingId,
    code:              pickString(raw.code),
    name:              pickString(raw.name) ?? buildingId,
    description:       pickString(raw.description),
    typeLabel:         translateBuildingType(pickString(raw.type) ?? undefined, locale) ?? null,
    statusLabel:       translateBuildingStatus(pickString(raw.status) ?? undefined, locale) ?? null,
    energyClassLabel:  pickString(raw.energyClass),
    renovationLabel:   translateRenovationStatus(pickString(raw.renovation) ?? undefined, locale) ?? null,
    progress:          pickNumber(raw.progress) ?? 0,
    totalValue:        pickNumber(raw.totalValue),
    totalArea:         pickNumber(raw.totalArea),
    builtArea:         pickNumber(raw.builtArea),
    floors:            pickNumber(raw.floors),
    units:             pickNumber(raw.units),
    constructionYear:  pickNumber(raw.constructionYear),
    startDate:         pickString(raw.startDate),
    completionDate:    pickString(raw.completionDate),
    address:           pickString(raw.address),
    city:              pickString(raw.city),
    location:          pickString(raw.location),
    projectId,
    projectName,
    linkedCompanyName: pickString(raw.linkedCompanyName),
  };

  const company = await resolveShowcaseCompanyBranding({
    adminDb,
    propertyData: projectId ? { projectId } : {},
    companyId,
    brandingSource: 'tenant',
  });

  return { building, company };
}
