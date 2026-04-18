/**
 * =============================================================================
 * 🏢 PROPERTY SHOWCASE — SSoT Snapshot Builder (ADR-312 Phase 4)
 * =============================================================================
 *
 * Single source of truth for the read-only snapshot surfaced by the public
 * `/api/showcase/[token]` endpoint AND the branded PDF generator. Produces a
 * rich `PropertyShowcaseSnapshot` covering EVERY field visible in the
 * `/spaces/properties` → Πληροφορίες tab (identity, commercial, hierarchy,
 * areas, layout, orientation/views, condition, energy, systems, finishes,
 * features, linked spaces, project name/address).
 *
 * Rationale
 * ---------
 * Before Phase 4 both the public API route and `buildPdfData()` re-mapped the
 * raw Firestore document into two near-identical snapshots — inevitable drift
 * followed (missing fields, divergent enum labels, dead code referencing a
 * non-existent `p.features` array). This module centralises the mapping so
 * web + PDF always display the same payload with identical locale labels.
 *
 * SRP split — per-field mapping lives in ./snapshot-field-builders.
 *
 * @module services/property-showcase/snapshot-builder
 */

import type { Firestore } from 'firebase-admin/firestore';
import { COLLECTIONS } from '@/config/firestore-collections';
import {
  translatePropertyType,
  translateOrientations,
  type EnumLocale,
} from '@/services/property-enum-labels/property-enum-labels.service';
import type { ShowcaseCompanyBranding } from '@/services/company/company-branding-resolver';
import {
  buildAreas,
  buildCommercial,
  buildCondition,
  buildEnergy,
  buildFeatures,
  buildFinishes,
  buildLayout,
  buildLinkedSpaces,
  buildProject,
  buildSystems,
  buildViews,
  pickString,
} from './snapshot-field-builders';

// =============================================================================
// 🏢 SNAPSHOT TYPES (wire format shared by web API + PDF renderer)
// =============================================================================

export interface ShowcaseProjectInfo {
  id?: string;
  name?: string;
  /** Συγκεντρωτική διεύθυνση — primary address ή legacy `address, city`. */
  address?: string;
}

export interface ShowcaseCommercialInfo {
  status?: string;
  statusLabel?: string;
  operationalStatus?: string;
  operationalStatusLabel?: string;
  askingPrice?: number;
}

export interface ShowcaseAreas {
  gross?: number;
  net?: number;
  balcony?: number;
  terrace?: number;
  garden?: number;
  /** Χιλιοστά ιδιοκτησίας (ανά χίλια). */
  millesimalShares?: number;
}

export interface ShowcaseLayout {
  bedrooms?: number;
  bathrooms?: number;
  wc?: number;
  totalRooms?: number;
  balconies?: number;
}

export interface ShowcaseConditionInfo {
  condition?: string;
  conditionLabel?: string;
  renovationYear?: number;
  /** ISO date string (YYYY-MM-DD) after normalization. */
  deliveryDate?: string;
}

export interface ShowcaseEnergyInfo {
  class?: string;
  certificateId?: string;
  certificateDate?: string;
  validUntil?: string;
}

export interface ShowcaseSystemsInfo {
  heatingType?: string;
  heatingLabel?: string;
  heatingFuel?: string;
  coolingType?: string;
  coolingLabel?: string;
  waterHeating?: string;
}

export interface ShowcaseFinishesInfo {
  flooring?: string[];
  flooringLabels?: string[];
  windowFrames?: string;
  windowFramesLabel?: string;
  glazing?: string;
  glazingLabel?: string;
}

export interface ShowcaseFeaturesInfo {
  interior?: string[];
  interiorLabels?: string[];
  security?: string[];
  securityLabels?: string[];
  amenities?: string[];
}

export interface ShowcaseLinkedSpace {
  spaceType: 'parking' | 'storage';
  allocationCode?: string;
  area?: number;
  floor?: string;
  type?: string;
  inclusion?: string;
  quantity?: number;
  description?: string;
}

export interface ShowcaseViewInfo {
  type: string;
  quality?: string;
}

export interface PropertyShowcaseSnapshot {
  property: {
    id: string;
    code?: string;
    name: string;
    type?: string;
    typeLabel?: string;
    building?: string;
    floor?: number;
    description?: string;
    project?: ShowcaseProjectInfo;
    commercial?: ShowcaseCommercialInfo;
    areas?: ShowcaseAreas;
    layout?: ShowcaseLayout;
    orientations?: string[];
    orientationLabels?: string[];
    views?: ShowcaseViewInfo[];
    condition?: ShowcaseConditionInfo;
    energy?: ShowcaseEnergyInfo;
    systems?: ShowcaseSystemsInfo;
    finishes?: ShowcaseFinishesInfo;
    features?: ShowcaseFeaturesInfo;
    linkedSpaces?: ShowcaseLinkedSpace[];
  };
  company: ShowcaseCompanyBranding;
}

// =============================================================================
// 🏢 CONTEXT LOADER — one Firestore read pass for every join the snapshot needs
// =============================================================================

export interface PropertyShowcaseContext {
  propertyId: string;
  property: Record<string, unknown>;
  branding: ShowcaseCompanyBranding;
  project?: Record<string, unknown>;
  storages: Map<string, Record<string, unknown>>;
  parkingSpots: Map<string, Record<string, unknown>>;
  /**
   * Floor docs indexed by floorId, pre-loaded once per project for cheap
   * `(buildingId, floor)` → floorId resolution (Phase 7.5). Empty when the
   * property has no `projectId`.
   */
  floors: Map<string, Record<string, unknown>>;
}

export interface LoadContextParams {
  adminDb: Firestore;
  propertyId: string;
  property: Record<string, unknown>;
  branding: ShowcaseCompanyBranding;
}

export async function loadShowcaseRelations(
  params: LoadContextParams,
): Promise<PropertyShowcaseContext> {
  const { adminDb, propertyId, property, branding } = params;

  const projectId = property.projectId as string | undefined;
  const linkedSpaces = Array.isArray(property.linkedSpaces)
    ? (property.linkedSpaces as Array<{ spaceId?: string; spaceType?: string }>)
    : [];

  const storageIds = linkedSpaces
    .filter((s) => s?.spaceType === 'storage' && typeof s?.spaceId === 'string')
    .map((s) => s.spaceId as string);
  const parkingIds = linkedSpaces
    .filter((s) => s?.spaceType === 'parking' && typeof s?.spaceId === 'string')
    .map((s) => s.spaceId as string);

  const [project, storages, parkingSpots, floors] = await Promise.all([
    projectId
      ? adminDb
          .collection(COLLECTIONS.PROJECTS)
          .doc(projectId)
          .get()
          .then((s) => (s.exists ? (s.data() ?? {}) : undefined))
          .catch(() => undefined)
      : Promise.resolve(undefined),
    loadDocsByIds(adminDb, COLLECTIONS.STORAGE, storageIds),
    loadDocsByIds(adminDb, COLLECTIONS.PARKING_SPACES, parkingIds),
    projectId ? loadFloorsByProjectId(adminDb, projectId) : Promise.resolve(new Map()),
  ]);

  return {
    propertyId,
    property,
    branding,
    project,
    storages,
    parkingSpots,
    floors,
  };
}

/**
 * Load every floor doc for a given project in a single Firestore read, keyed
 * by floorId. Cheap (small collection, typically ≤ dozens of floors per
 * project). Powers the `resolveFloorId` SSoT so parking spots without an
 * explicit `floorId` FK can still be matched to their floor via
 * `(buildingId, floor number)`.
 */
async function loadFloorsByProjectId(
  adminDb: Firestore,
  projectId: string,
): Promise<Map<string, Record<string, unknown>>> {
  const map = new Map<string, Record<string, unknown>>();
  try {
    const snap = await adminDb
      .collection(COLLECTIONS.FLOORS)
      .where('projectId', '==', projectId)
      .get();
    for (const d of snap.docs) map.set(d.id, d.data() ?? {});
  } catch {
    // Non-fatal: resolver will return undefined and the UI simply omits the
    // floor section for that entity.
  }
  return map;
}

/**
 * SSoT floor-id resolver — single rule for every surface that needs to map
 * a property/parking/storage doc to its floor:
 *  1. Explicit `floorId` FK → use it.
 *  2. Else, match `(buildingId, floor)` against the preloaded floors map
 *     (`floor` can be number or string; compared as integers).
 *  3. Else, undefined.
 *
 * Exported so the showcase API + PDF helpers can share the exact same
 * resolution; never reimplement in consumer code (Giorgio rule: ZERO
 * duplicates).
 */
export function resolveFloorId(
  doc: Record<string, unknown>,
  floors: Map<string, Record<string, unknown>>,
): string | undefined {
  const explicit = doc.floorId;
  if (typeof explicit === 'string' && explicit.trim().length > 0) return explicit;

  const buildingId = typeof doc.buildingId === 'string' ? doc.buildingId : undefined;
  if (!buildingId) return undefined;

  const rawFloor = doc.floor;
  const floorNumber = typeof rawFloor === 'number'
    ? rawFloor
    : typeof rawFloor === 'string' && rawFloor.trim().length > 0
      ? Number.parseInt(rawFloor, 10)
      : NaN;
  if (!Number.isFinite(floorNumber)) return undefined;

  for (const [id, f] of floors.entries()) {
    if (f.buildingId !== buildingId) continue;
    const n = typeof f.number === 'number'
      ? f.number
      : typeof f.number === 'string'
        ? Number.parseInt(f.number, 10)
        : NaN;
    if (n === floorNumber) return id;
  }
  return undefined;
}

/**
 * Pick the best human label for a floor doc — prefers the localized `name`
 * ("1ος Όροφος") over the raw number. Used for the κάτοψη ορόφου sub-header
 * in the showcase web + PDF.
 */
export function pickFloorLabel(floor: Record<string, unknown> | undefined): string | undefined {
  if (!floor) return undefined;
  const name = typeof floor.name === 'string' ? floor.name.trim() : '';
  if (name.length > 0) return name;
  const n = floor.number;
  if (typeof n === 'number') return String(n);
  if (typeof n === 'string' && n.trim().length > 0) return n.trim();
  return undefined;
}

async function loadDocsByIds(
  adminDb: Firestore,
  collection: string,
  ids: readonly string[],
): Promise<Map<string, Record<string, unknown>>> {
  const map = new Map<string, Record<string, unknown>>();
  if (ids.length === 0) return map;
  const unique = Array.from(new Set(ids));
  const snaps = await Promise.all(
    unique.map((id) =>
      adminDb
        .collection(collection)
        .doc(id)
        .get()
        .catch(() => null),
    ),
  );
  for (const snap of snaps) {
    if (snap?.exists) map.set(snap.id, snap.data() ?? {});
  }
  return map;
}

// =============================================================================
// 🏢 SNAPSHOT BUILDER — composes field builders, no I/O
// =============================================================================

export function buildPropertyShowcaseSnapshot(
  context: PropertyShowcaseContext,
  locale: EnumLocale = 'el',
): PropertyShowcaseSnapshot {
  const { property: p, propertyId, branding, project, storages, parkingSpots } = context;

  const rawType = (p.type as string) || undefined;
  const rawOrientations = Array.isArray(p.orientations) ? (p.orientations as string[]) : undefined;

  return {
    property: {
      id: propertyId,
      code: pickString(p.code),
      name: pickString(p.name) || propertyId,
      type: rawType,
      typeLabel: translatePropertyType(rawType, locale),
      building: pickString(p.building),
      floor: typeof p.floor === 'number' ? (p.floor as number) : undefined,
      description: pickString(p.description),
      project: buildProject(project),
      commercial: buildCommercial(p, locale),
      areas: buildAreas(p),
      layout: buildLayout(p),
      orientations: rawOrientations,
      orientationLabels: translateOrientations(rawOrientations, locale),
      views: buildViews(p),
      condition: buildCondition(p, locale),
      energy: buildEnergy(p),
      systems: buildSystems(p, locale),
      finishes: buildFinishes(p, locale),
      features: buildFeatures(p, locale),
      linkedSpaces: buildLinkedSpaces(p, storages, parkingSpots),
    },
    company: branding,
  };
}
