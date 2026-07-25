/**
 * Building Showcase Snapshot Builder — SSoT (ADR-320 + ADR-321 Phase 2, ADR-701 primitives).
 *
 * Delegates orchestration to `createShowcaseSnapshotBuilder` and the raw-value
 * pickers / project-name loader to `showcase-core/snapshot-field-primitives`;
 * this file owns only the Building-specific field mapping. Tenant isolation +
 * branding resolution live in the core factory (belt-and-suspenders).
 *
 * @module services/building-showcase/snapshot-builder
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import {
  createShowcaseSnapshotBuilder,
  ShowcaseEntityNotFoundError,
  ShowcaseTenantMismatchError,
} from '@/services/showcase-core/snapshot-builder-factory';
import {
  buildShowcaseIdentityFields,
  createShowcaseRelationLoader,
  pickShowcaseNumber,
  pickShowcaseString,
} from '@/services/showcase-core/snapshot-field-primitives';
import type {
  BuildingShowcaseInfo,
  BuildingShowcaseSnapshot,
} from '@/types/building-showcase';
import {
  translateBuildingType,
  translateBuildingStatus,
  translateRenovationStatus,
} from './labels';

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
  loadRelations: createShowcaseRelationLoader({
    foreignKeyField: 'projectId',
    collection: COLLECTIONS.PROJECTS,
    resultKey: 'projectName',
    nameFields: ['name', 'title'],
  }),
  buildInfo: ({ entityId, raw, relations, locale }) => ({
    ...buildShowcaseIdentityFields(entityId, raw),
    typeLabel:         translateBuildingType(pickShowcaseString(raw.type) ?? undefined, locale) ?? null,
    statusLabel:       translateBuildingStatus(pickShowcaseString(raw.status) ?? undefined, locale) ?? null,
    energyClassLabel:  pickShowcaseString(raw.energyClass),
    renovationLabel:   translateRenovationStatus(pickShowcaseString(raw.renovation) ?? undefined, locale) ?? null,
    progress:          pickShowcaseNumber(raw.progress) ?? 0,
    totalValue:        pickShowcaseNumber(raw.totalValue),
    totalArea:         pickShowcaseNumber(raw.totalArea),
    builtArea:         pickShowcaseNumber(raw.builtArea),
    floors:            pickShowcaseNumber(raw.floors),
    units:             pickShowcaseNumber(raw.units),
    constructionYear:  pickShowcaseNumber(raw.constructionYear),
    startDate:         pickShowcaseString(raw.startDate),
    completionDate:    pickShowcaseString(raw.completionDate),
    address:           pickShowcaseString(raw.address),
    city:              pickShowcaseString(raw.city),
    location:          pickShowcaseString(raw.location),
    projectId:         pickShowcaseString(raw.projectId),
    projectName:       relations.projectName,
    linkedCompanyName: pickShowcaseString(raw.linkedCompanyName),
  }),
  wrapSnapshot: (building, company) => ({ building, company }),
});
