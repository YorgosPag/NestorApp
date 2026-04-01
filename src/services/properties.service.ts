'use client';

import { db } from '@/lib/firebase'; // Αλλαγή σε client-side db
import {
  doc,
  updateDoc,
  writeBatch,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import type { DocumentData, QueryConstraint } from 'firebase/firestore';
import { COLLECTIONS } from '@/config/firestore-collections';
import { normalizeToISO } from '@/lib/date-local';
import type { Property } from '@/types/property-viewer';
import type { PropertyDoc, PropertyModel } from '@/types/property';
// 🏢 ENTERPRISE: Centralized real-time service for cross-page sync
import { RealtimeService } from '@/services/realtime';
// 🏢 ENTERPRISE: Centralized API client (Fortune-500 pattern)
import { apiClient } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';
import { normalizeProperty } from '@/utils/property-normalizer';
import { generatePropertyId } from '@/services/enterprise-id.service';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import { firestoreQueryService } from '@/services/firestore/firestore-query.service';

const logger = createModuleLogger('PropertiesService');
const PROPERTIES_COLLECTION = COLLECTIONS.PROPERTIES;

// ============================================================================
// POST-QUERY NORMALIZATION (replaces DocumentSnapshot-based transformers)
// ============================================================================

/**
 * Convert raw Firestore document data (plain object with `id`) to Property type.
 * Handles Timestamp → ISO string conversion for all fields.
 * Replaces the old `transformUnit(doc: DocumentSnapshot)` function.
 */
function toProperty(raw: DocumentData): Property {
  const property: Record<string, unknown> = { id: raw.id };
  for (const key in raw) {
    if (key === 'id') continue;
    const iso = normalizeToISO(raw[key]);
    property[key] = iso ?? raw[key];
  }
  return property as unknown as Property;
}

/**
 * Convert raw Firestore document data to PropertyModel via normalizeProperty.
 * Replaces the old `normalizeUnitSnapshot(doc: DocumentSnapshot)` function.
 */
function toPropertyModel(raw: DocumentData): PropertyModel {
  const data = raw as PropertyDoc;
  return normalizeProperty({ ...data, id: raw.id as string });
}

// addUnit() DELETED — was dead code (0 consumers).
// Client-side setDoc blocked by Firestore rules (allow create: if false).
// All property creation goes through createProperty() → server API + Admin SDK.

/**
 * 🏢 ENTERPRISE: Create property via server-side API (Admin SDK)
 *
 * 🔒 SECURITY: Firestore rules block client-side writes (allow create: if false)
 *              Uses API endpoint with Admin SDK to bypass rules with proper auth
 *
 * @see src/app/api/properties/create/route.ts (POST handler)
 * @see ADR-078
 */
export async function createProperty(
  propertyData: Record<string, unknown>
): Promise<{ success: boolean; propertyId?: string; error?: string }> {
  try {
    logger.info('Creating new property via API');

    interface PropertyCreateResult {
      propertyId: string;
    }
    const result = await apiClient.post<PropertyCreateResult>(API_ROUTES.PROPERTIES.CREATE, propertyData);

    const propertyId = result?.propertyId;
    logger.info(`Property created with ID: ${propertyId}`);

    // 🏢 ENTERPRISE: Centralized Real-time Service (cross-page sync)
    RealtimeService.dispatch('UNIT_CREATED',{
      propertyId,
      property: {
        name: propertyData.name as string,
        type: propertyData.type as string,
        buildingId: (propertyData.buildingId as string) ?? null,
      },
      timestamp: Date.now()
    });

    return { success: true, propertyId };

  } catch (error) {
    logger.error('Error creating property', { error });
    return {
      success: false,
      error: getErrorMessage(error)
    };
  }
}

// Get all properties
export async function getProperties(): Promise<Property[]> {
  const result = await firestoreQueryService.getAll<DocumentData>('PROPERTIES', {
    constraints: [orderBy('name', 'asc')],
    tenantOverride: 'skip',
  });
  return result.documents.map(toProperty);
}

// Get properties by owner ID
export async function getPropertiesByOwner(ownerId: string): Promise<Property[]> {
  if (!ownerId) return [];
  const result = await firestoreQueryService.getAll<DocumentData>('PROPERTIES', {
    constraints: [where('soldTo', '==', ownerId)],
    tenantOverride: 'skip',
  });
  return result.documents.map(toProperty);
}

// Get properties by building ID as PropertyModel (NEW)
export async function getPropertiesByBuildingAsModels(buildingId: string): Promise<PropertyModel[]> {
  if (!buildingId) return [];
  const result = await firestoreQueryService.getAll<DocumentData>('PROPERTIES', {
    constraints: [where('buildingId', '==', buildingId)],
    tenantOverride: 'skip',
  });
  return result.documents.map(toPropertyModel);
}

// Get properties by building ID (LEGACY: Returns Property[])
/**
 * @deprecated Use getPropertiesByBuildingAsModels for new code
 */
export async function getPropertiesByBuilding(buildingId: string): Promise<Property[]> {
  if (!buildingId) return [];
  const result = await firestoreQueryService.getAll<DocumentData>('PROPERTIES', {
    constraints: [where('buildingId', '==', buildingId)],
    tenantOverride: 'skip',
  });
  return result.documents.map(toProperty);
}

// Update a property via Admin SDK API (server-side validation + audit trail)
export async function updateProperty(propertyId: string, updates: Partial<Property>): Promise<{ success: boolean }> {
  await apiClient.patch(API_ROUTES.PROPERTIES.BY_ID(propertyId), updates);

  // 🏢 ENTERPRISE: Centralized Real-time Service (cross-page sync)
  // Dispatch event for all components to update their local state
  RealtimeService.dispatch('UNIT_UPDATED',{
    propertyId,
    updates: {
      name: updates.name,
      type: updates.type,
      status: updates.status,
      area: updates.area,
      floor: updates.floor,
      buildingId: updates.buildingId,
      soldTo: updates.soldTo,
    },
    timestamp: Date.now()
  });

  return { success: true };
}

// NEW: Update multiple properties' owner
export async function updateMultiplePropertiesOwner(propertyIds: string[], contactId: string): Promise<{ success: boolean }> {
  const batch = writeBatch(db);

  propertyIds.forEach(propertyId => {
    const propertyRef = doc(db, PROPERTIES_COLLECTION, propertyId);
    batch.update(propertyRef, {
      soldTo: contactId,
      status: 'sold',
      saleDate: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  await batch.commit();
  return { success: true };
}


// 🔒 SECURITY: Delete property via Admin SDK API (client-side Firestore deletes are blocked)
export async function deleteProperty(propertyId: string): Promise<{ success: boolean }> {
  await apiClient.delete(API_ROUTES.PROPERTIES.BY_ID(propertyId));

  // 🏢 ENTERPRISE: Centralized Real-time Service (cross-page sync)
  RealtimeService.dispatch('UNIT_DELETED', {
    propertyId,
    timestamp: Date.now()
  });

  return { success: true };
}

// =============================================================================
// 🏢 ENTERPRISE: NEW TYPE-SAFE METHODS FOR EXTENDED FIELDS
// =============================================================================

/**
 * Get properties with specific features
 * @param featureCodes Array of interior feature codes to filter by
 */
export async function getPropertiesByFeatures(featureCodes: string[]): Promise<PropertyModel[]> {
  if (!featureCodes || featureCodes.length === 0) return [];
  const result = await firestoreQueryService.getAll<DocumentData>('PROPERTIES', {
    constraints: [where('interiorFeatures', 'array-contains-any', featureCodes)],
    tenantOverride: 'skip',
  });
  return result.documents.map(toPropertyModel);
}

/**
 * Get properties by operational status
 * @param status Operational status to filter by
 */
export async function getPropertiesByOperationalStatus(status: string): Promise<PropertyModel[]> {
  const result = await firestoreQueryService.getAll<DocumentData>('PROPERTIES', {
    constraints: [where('operationalStatus', '==', status)],
    tenantOverride: 'skip',
  });
  return result.documents.map(toPropertyModel);
}

/**
 * Get properties with incomplete documentation
 * Returns properties missing photos, floorplans, or documents
 */
export async function getIncompleteProperties(): Promise<PropertyModel[]> {
  const queries: QueryConstraint[][] = [
      [where('unitCoverage.hasPhotos', '==', false)],
      [where('unitCoverage.hasFloorplans', '==', false)],
      [where('unitCoverage.hasDocuments', '==', false)],
    ];

    const results = await Promise.all(
      queries.map(constraints =>
        firestoreQueryService.getAll<DocumentData>('PROPERTIES', {
          constraints,
          tenantOverride: 'skip',
        })
      )
    );

    // Deduplicate properties (a property might be missing multiple things)
    const propertyMap = new Map<string, PropertyModel>();
    for (const result of results) {
      for (const raw of result.documents) {
        const id = raw.id as string;
        if (!propertyMap.has(id)) {
          propertyMap.set(id, toPropertyModel(raw));
        }
      }
    }

    return Array.from(propertyMap.values());
}

/**
 * Update property coverage status
 * @param propertyId Property ID to update
 * @param coverage Coverage updates
 */
/**
 * Update property entity links (company, project, building) via Admin SDK API
 * @param propertyId Property ID to update
 * @param updates Link fields to update
 */
export async function updatePropertyLink(
  propertyId: string,
  updates: {
    companyId?: string | null;
    companyName?: string;
    projectId?: string | null;
    projectName?: string;
    buildingId?: string | null;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    await apiClient.patch(API_ROUTES.PROPERTIES.BY_ID(propertyId), updates);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, 'Failed to update property link'),
    };
  }
}

/**
 * Get list of buildings for entity linking
 */
export async function getBuildingsList(): Promise<Array<{ id: string; name: string }>> {
  try {
    interface BuildingFromAPI {
      id: string;
      name?: string;
    }
    interface BuildingsResponse {
      buildings: BuildingFromAPI[];
    }

    const result = await apiClient.get<BuildingsResponse>(API_ROUTES.BUILDINGS.LIST);
    if (!result?.buildings) return [];

    return result.buildings.map(b => ({
      id: b.id,
      name: b.name || b.id,
    }));
  } catch {
    return [];
  }
}

export async function updatePropertyCoverage(
  propertyId: string,
  coverage: Partial<{
    hasPhotos: boolean;
    hasFloorplans: boolean;
    hasDocuments: boolean;
  }>
): Promise<{ success: boolean }> {
  const propertyRef = doc(db, PROPERTIES_COLLECTION, propertyId);
  await updateDoc(propertyRef, {
    'unitCoverage.hasPhotos': coverage.hasPhotos,
    'unitCoverage.hasFloorplans': coverage.hasFloorplans,
    'unitCoverage.hasDocuments': coverage.hasDocuments,
    'unitCoverage.updatedAt': serverTimestamp()
  });
  return { success: true };
}

// Batch add properties (for seeding)
export async function seedProperties(properties: Omit<Property, 'id'>[]): Promise<{ success: boolean; count: number }> {
  const batch = writeBatch(db);
  properties.forEach(propertyData => {
    const docRef = doc(db, PROPERTIES_COLLECTION, generatePropertyId());
    batch.set(docRef, propertyData);
  });

  await batch.commit();
  return { success: true, count: properties.length };
}
