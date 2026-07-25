/**
 * =============================================================================
 * SHOWCASE SHARE RESOLVERS — all five surfaces, as declarations (ADR-699)
 * =============================================================================
 *
 * Replaces `{property,project,building,storage,parking}-showcase.resolver.ts`.
 *
 * Each surface used to be its own file: property and project carried a full
 * hand-written copy of resolve/projection/validate/canShare (338 duplicate
 * tokens between the two); building, storage and parking called the ADR-321
 * factory but passed it the same object literal with renamed keys, and storage
 * and parking additionally re-typed `validateCreateInput` just to drop one
 * check.
 *
 * With the factory taking data instead of callbacks (ADR-699), nothing is left
 * per file but the declaration — so they live together, and adding a sixth
 * surface is one entry rather than one file.
 *
 * The exported type aliases keep the old names: `PropertyShowcaseResolvedData`
 * and friends are consumed outside this folder.
 *
 * @module services/sharing/resolvers/showcase-surfaces.resolvers
 * @see adrs/ADR-699-share-resolver-declarations.md
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import {
  createShowcaseShareResolver,
  type ShowcaseResolvedData,
} from '@/services/showcase-core/share-resolver-factory';
import type { ShareEntityDefinition } from '@/types/sharing';

// ============================================================================
// RESOLVED-DATA SHAPES
// ============================================================================

export type PropertyShowcaseResolvedData = ShowcaseResolvedData<
  'propertyId',
  'propertyTitle'
>;
export type ProjectShowcaseResolvedData = ShowcaseResolvedData<
  'projectId',
  'projectTitle'
>;
export type BuildingShowcaseResolvedData = ShowcaseResolvedData<
  'buildingId',
  'buildingTitle'
>;
export type StorageShowcaseResolvedData = ShowcaseResolvedData<
  'storageId',
  'storageTitle'
>;
export type ParkingShowcaseResolvedData = ShowcaseResolvedData<
  'parkingId',
  'parkingTitle'
>;

// ============================================================================
// DECLARATIONS
// ============================================================================

/**
 * `titleSourceFields` order is per-entity vocabulary, not an oversight: a
 * property titles itself with `title`, a project and a building with `name`, a
 * parking space with its `number`, a storage unit with its `name` then `code`.
 *
 * `requiresPdfPath: false` on parking and storage is likewise deliberate —
 * neither surface has a PDF generator yet (ADR-315), and demanding a path would
 * make them unshareable.
 */
export const propertyShowcaseShareResolver: ShareEntityDefinition<PropertyShowcaseResolvedData> =
  createShowcaseShareResolver({
    entityType: 'property_showcase',
    collection: COLLECTIONS.PROPERTIES,
    idField: 'propertyId',
    titleField: 'propertyTitle',
    titleSourceFields: ['title', 'name'],
    requiresPdfPath: true,
  });

export const projectShowcaseShareResolver: ShareEntityDefinition<ProjectShowcaseResolvedData> =
  createShowcaseShareResolver({
    entityType: 'project_showcase',
    collection: COLLECTIONS.PROJECTS,
    idField: 'projectId',
    titleField: 'projectTitle',
    titleSourceFields: ['name', 'title'],
    requiresPdfPath: true,
  });

export const buildingShowcaseShareResolver: ShareEntityDefinition<BuildingShowcaseResolvedData> =
  createShowcaseShareResolver({
    entityType: 'building_showcase',
    collection: COLLECTIONS.BUILDINGS,
    idField: 'buildingId',
    titleField: 'buildingTitle',
    titleSourceFields: ['name', 'title'],
    requiresPdfPath: true,
  });

export const storageShowcaseShareResolver: ShareEntityDefinition<StorageShowcaseResolvedData> =
  createShowcaseShareResolver({
    entityType: 'storage_showcase',
    collection: COLLECTIONS.STORAGE,
    idField: 'storageId',
    titleField: 'storageTitle',
    titleSourceFields: ['name', 'code'],
    requiresPdfPath: false,
  });

export const parkingShowcaseShareResolver: ShareEntityDefinition<ParkingShowcaseResolvedData> =
  createShowcaseShareResolver({
    entityType: 'parking_showcase',
    collection: COLLECTIONS.PARKING_SPACES,
    idField: 'parkingId',
    titleField: 'parkingTitle',
    titleSourceFields: ['number', 'code'],
    requiresPdfPath: false,
  });
