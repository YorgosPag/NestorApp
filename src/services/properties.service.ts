'use client';

import {
  where,
  orderBy,
} from 'firebase/firestore';
import type { DocumentData } from 'firebase/firestore';
import { COLLECTIONS } from '@/config/firestore-collections';
import { normalizeToISO, nowISO } from '@/lib/date-local';
import type { Property } from '@/types/property-viewer';
// 🏢 ENTERPRISE: Centralized real-time service for cross-page sync
import { RealtimeService } from '@/services/realtime';
// 🏢 ENTERPRISE: Centralized API client (Fortune-500 pattern)
import { apiClient, ApiClientError } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import { firestoreQueryService } from '@/services/firestore/firestore-query.service';

const logger = createModuleLogger('PropertiesService');

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
): Promise<{ success: boolean; propertyId?: string; error?: string; errorCode?: string }> {
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
      error: getErrorMessage(error),
      errorCode: ApiClientError.isApiClientError(error) ? error.errorCode : undefined,
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
  const saleDate = nowISO();

  await Promise.all(
    propertyIds.map(async (propertyId) => {
      await apiClient.patch(API_ROUTES.PROPERTIES.BY_ID(propertyId), {
        soldTo: contactId,
        status: 'sold',
        saleDate,
      });

      RealtimeService.dispatch('UNIT_UPDATED', {
        propertyId,
        updates: {
          soldTo: contactId,
          status: 'sold',
        },
        timestamp: Date.now(),
      });
    }),
  );
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
  await apiClient.patch(API_ROUTES.PROPERTIES.BY_ID(propertyId), {
    'propertyCoverage.hasPhotos': coverage.hasPhotos,
    'propertyCoverage.hasFloorplans': coverage.hasFloorplans,
    'propertyCoverage.hasDocuments': coverage.hasDocuments,
    'propertyCoverage.updatedAt': nowISO(),
  });
  return { success: true };
}

