/**
 * Building Showcase Snapshot Builder — SSoT (ADR-320 + ADR-321 Phase 2).
 *
 * Delegates orchestration to `createShowcaseSnapshotBuilder` (Phase 1.1);
 * this file now owns only the Building-specific field mapping (`buildInfo`)
 * + the project-name relation loader. Tenant isolation + branding resolution
 * move into the core factory (belt-and-suspenders).
 *
 * @module services/building-showcase/snapshot-builder
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import {
  createShowcaseSnapshotBuilder,
  ShowcaseEntityNotFoundError,
  ShowcaseTenantMismatchError,
} from '@/services/showcase-core/snapshot-builder-factory';
import type {
  BuildingShowcaseInfo,
  BuildingShowcaseSnapshot,
} from '@/types/building-showcase';
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

// Legacy error aliases kept so downstream catches keep working unchanged.
export class BuildingNotFoundError extends ShowcaseEntityNotFoundError {
  constructor(buildingId: string) {
    super('Building', buildingId);
    this.name = 'BuildingNotFoundError';
  }
}

export class TenantMismatchError extends ShowcaseTenantMismatchError {
  constructor(buildingId: string) {
    super('Building', buildingId);
  }
}

interface BuildingRelations {
  projectName: string | null;
}

export const buildBuildingShowcaseSnapshot = createShowcaseSnapshotBuilder<
  BuildingShowcaseInfo,
  BuildingRelations,
  BuildingShowcaseSnapshot
>({
  collection: COLLECTIONS.BUILDINGS,
  entityLabel: 'Building',
  loadRelations: async (adminDb, _buildingId, raw) => {
    const projectId = pickString(raw.projectId);
    if (!projectId) return { projectName: null };
    const snap = await adminDb.collection(COLLECTIONS.PROJECTS).doc(projectId).get();
    if (!snap.exists) return { projectName: null };
    const pRaw = snap.data() ?? {};
    return {
      projectName: pickString(pRaw.name) ?? pickString(pRaw.title),
    };
  },
  buildInfo: ({ entityId, raw, relations, locale }) => ({
    id:                entityId,
    code:              pickString(raw.code),
    name:              pickString(raw.name) ?? entityId,
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
    projectId:         pickString(raw.projectId),
    projectName:       relations.projectName,
    linkedCompanyName: pickString(raw.linkedCompanyName),
  }),
  wrapSnapshot: (building, company) => ({ building, company }),
});
