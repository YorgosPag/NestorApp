/**
 * Parking Showcase Snapshot Builder (ADR-315 + ADR-321 pattern, ADR-700 primitives).
 *
 * Delegates orchestration to `createShowcaseSnapshotBuilder` and the raw-value
 * pickers / floor formatter / building-name loader to
 * `showcase-core/snapshot-field-primitives`. This file owns only the
 * parking-specific field mapping.
 *
 * @module services/parking-showcase/snapshot-builder
 */

import 'server-only';

import { COLLECTIONS } from '@/config/firestore-collections';
import {
  createShowcaseSnapshotBuilder,
  ShowcaseEntityNotFoundError,
  ShowcaseTenantMismatchError,
} from '@/services/showcase-core/snapshot-builder-factory';
import {
  buildShowcaseMetricFields,
  createShowcaseRelationLoader,
  pickShowcaseString,
} from '@/services/showcase-core/snapshot-field-primitives';
import { translateParkingType, translateParkingStatus, translateParkingZone } from './labels';
import type { ShowcaseCompanyBranding } from '@/services/company/company-branding-resolver';

export type { ShowcaseCompanyBranding };

export interface ParkingShowcaseInfo {
  id: string;
  number: string;
  code: string | null;
  description: string | null;
  typeLabel: string | null;
  statusLabel: string | null;
  locationZoneLabel: string | null;
  area: number | null;
  price: number | null;
  floor: string | null;
  buildingName: string | null;
}

export interface ParkingShowcaseSnapshot {
  parking: ParkingShowcaseInfo;
  company: ShowcaseCompanyBranding;
}

export class ParkingNotFoundError extends ShowcaseEntityNotFoundError {
  constructor(parkingId: string) {
    super('ParkingSpot', parkingId);
    this.name = 'ParkingNotFoundError';
  }
}

export class ParkingTenantMismatchError extends ShowcaseTenantMismatchError {
  constructor(parkingId: string) {
    super('ParkingSpot', parkingId);
  }
}

interface ParkingRelations {
  buildingName: string | null;
}

export const buildParkingShowcaseSnapshot = createShowcaseSnapshotBuilder<
  ParkingShowcaseInfo,
  ParkingRelations,
  ParkingShowcaseSnapshot
>({
  collection: COLLECTIONS.PARKING_SPACES,
  entityLabel: 'ParkingSpot',
  loadRelations: createShowcaseRelationLoader({
    foreignKeyField: 'buildingId',
    collection: COLLECTIONS.BUILDINGS,
    resultKey: 'buildingName',
    nameFields: ['name'],
  }),
  buildInfo: ({ entityId, raw, relations, locale }) => ({
    id:               entityId,
    number:           pickShowcaseString(raw.number) ?? entityId,
    code:             pickShowcaseString(raw.code),
    description:      pickShowcaseString(raw.description),
    typeLabel:        translateParkingType(pickShowcaseString(raw.type) ?? undefined, locale) ?? null,
    statusLabel:      translateParkingStatus(pickShowcaseString(raw.status) ?? undefined, locale) ?? null,
    locationZoneLabel:translateParkingZone(pickShowcaseString(raw.locationZone) ?? undefined, locale) ?? null,
    ...buildShowcaseMetricFields(raw, locale),
    buildingName:     relations.buildingName,
  }),
  wrapSnapshot: (parking, company) => ({ parking, company }),
});
