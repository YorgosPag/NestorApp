'use client';

import { db } from '@/lib/firebase'; // Αλλαγή σε client-side db
import {
  collection,
  setDoc,
  getDocs,
  doc,
  updateDoc,
  writeBatch,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { COLLECTIONS } from '@/config/firestore-collections';
import type { Property } from '@/types/property-viewer';
import type { UnitDoc, UnitModel } from '@/types/unit';
import type { DocumentSnapshot, QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
// 🏢 ENTERPRISE: Centralized real-time service for cross-page sync
import { RealtimeService } from '@/services/realtime';
// 🏢 ENTERPRISE: Centralized API client (Fortune-500 pattern)
import { apiClient } from '@/lib/api/enterprise-api-client';
import { normalizeUnit } from '@/utils/unit-normalizer';
import { generateUnitId } from '@/services/enterprise-id.service';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('UnitsService');
const UNITS_COLLECTION = COLLECTIONS.UNITS;

/**
 * 🏢 ENTERPRISE: Transform Firestore document to Property type
 * Handles Timestamp conversion and passes through all fields including new Unit Fields
 */
const transformUnit = (doc: DocumentSnapshot<DocumentData> | QueryDocumentSnapshot<DocumentData>): Property => {
    const data = doc.data();
    const unit: Record<string, unknown> = { id: doc.id };

    for (const key in data) {
        if (data[key] instanceof Timestamp) {
            unit[key] = data[key].toDate().toISOString();
        } else {
            unit[key] = data[key];
        }
    }
    return unit as unknown as Property;
};

const normalizeUnitSnapshot = (
  doc: DocumentSnapshot<DocumentData> | QueryDocumentSnapshot<DocumentData>
): UnitModel => {
  const data = doc.data() as UnitDoc;
  return normalizeUnit({ ...data, id: doc.id });
};

/**
 * 🏢 ENTERPRISE: Alias for backward compatibility
 * @deprecated Use transformUnit directly
 */
const transformUnitToProperty = transformUnit;

// Add a single unit
export async function addUnit(unitData: Omit<Property, 'id'>): Promise<{ id: string; success: boolean }> {
  try {
    // 🏢 ADR-210: Enterprise ID generation — setDoc with pre-generated ID
    const id = generateUnitId();
    await setDoc(doc(db, UNITS_COLLECTION, id), {
      ...unitData,
      id,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // 🏢 ENTERPRISE: Centralized Real-time Service (cross-page sync)
    // Dispatch event for all components to add the unit to their local state
    RealtimeService.dispatch('UNIT_CREATED',{
      unitId: id,
      unit: {
        name: unitData.name,
        type: unitData.type,
        buildingId: unitData.buildingId ?? null,
      },
      timestamp: Date.now()
    });

    return { id, success: true };
  } catch (error) {
    // Error logging removed
    throw error;
  }
}

/**
 * 🏢 ENTERPRISE: Create unit via server-side API (Admin SDK)
 *
 * 🔒 SECURITY: Firestore rules block client-side writes (allow create: if false)
 *              Uses API endpoint with Admin SDK to bypass rules with proper auth
 *
 * @see src/app/api/units/create/route.ts (POST handler)
 * @see ADR-078
 */
export async function createUnit(
  unitData: Record<string, unknown>
): Promise<{ success: boolean; unitId?: string; error?: string }> {
  try {
    logger.info('Creating new unit via API');

    interface UnitCreateResult {
      unitId: string;
    }
    const result = await apiClient.post<UnitCreateResult>('/api/units/create', unitData);

    const unitId = result?.unitId;
    logger.info(`Unit created with ID: ${unitId}`);

    // 🏢 ENTERPRISE: Centralized Real-time Service (cross-page sync)
    RealtimeService.dispatch('UNIT_CREATED',{
      unitId,
      unit: {
        name: unitData.name as string,
        type: unitData.type as string,
        buildingId: (unitData.buildingId as string) ?? null,
      },
      timestamp: Date.now()
    });

    return { success: true, unitId };

  } catch (error) {
    logger.error('Error creating unit', { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Get all units
export async function getUnits(): Promise<Property[]> {
  try {
    const q = query(collection(db, UNITS_COLLECTION), orderBy('name', 'asc'));
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(transformUnitToProperty);
  } catch (error) {
    // Error logging removed
    throw error;
  }
}

// Get units by owner ID
export async function getUnitsByOwner(ownerId: string): Promise<Property[]> {
  try {
    if (!ownerId) {
        return [];
    }
    const q = query(collection(db, UNITS_COLLECTION), where('soldTo', '==', ownerId));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(transformUnitToProperty);
  } catch (error) {
    // Error logging removed
    throw error;
  }
}

// Get units by building ID as UnitModel (NEW)
export async function getUnitsByBuildingAsModels(buildingId: string): Promise<UnitModel[]> {
    try {
      if (!buildingId) {
          return [];
      }
      const q = query(collection(db, UNITS_COLLECTION), where('buildingId', '==', buildingId));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(normalizeUnitSnapshot);
    } catch (error) {
      throw error;
    }
}

// Get units by building ID (LEGACY: Returns Property[])
/**
 * @deprecated Use getUnitsByBuildingAsModels for new code
 */
export async function getUnitsByBuilding(buildingId: string): Promise<Property[]> {
    try {
      if (!buildingId) {
          return [];
      }
      const q = query(collection(db, UNITS_COLLECTION), where('buildingId', '==', buildingId));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(transformUnitToProperty);
    } catch (error) {
      // Error logging removed
      throw error;
    }
  }

// Update a unit via Admin SDK API (server-side validation + audit trail)
export async function updateUnit(unitId: string, updates: Partial<Property>): Promise<{ success: boolean }> {
  try {
    await apiClient.patch(`/api/units/${unitId}`, updates);

    // 🏢 ENTERPRISE: Centralized Real-time Service (cross-page sync)
    // Dispatch event for all components to update their local state
    RealtimeService.dispatch('UNIT_UPDATED',{
      unitId,
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
  } catch (error) {
    throw error;
  }
}

// NEW: Update multiple units' owner
export async function updateMultipleUnitsOwner(unitIds: string[], contactId: string): Promise<{ success: boolean }> {
    const batch = writeBatch(db);
    
    unitIds.forEach(unitId => {
        const unitRef = doc(db, UNITS_COLLECTION, unitId);
        batch.update(unitRef, {
            soldTo: contactId,
            status: 'sold',
            saleDate: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });
    });

    try {
        await batch.commit();
        return { success: true };
    } catch (error) {
        // Error logging removed
        throw error;
    }
}


// 🔒 SECURITY: Delete unit via Admin SDK API (client-side Firestore deletes are blocked)
export async function deleteUnit(unitId: string): Promise<{ success: boolean }> {
  try {
    await apiClient.delete(`/api/units/${unitId}`);

    // 🏢 ENTERPRISE: Centralized Real-time Service (cross-page sync)
    RealtimeService.dispatch('UNIT_DELETED', {
      unitId,
      timestamp: Date.now()
    });

    return { success: true };
  } catch (error) {
    throw error;
  }
}

// =============================================================================
// 🏢 ENTERPRISE: NEW TYPE-SAFE METHODS FOR EXTENDED FIELDS
// =============================================================================

/**
 * Get units with specific features
 * @param featureCodes Array of interior feature codes to filter by
 */
export async function getUnitsByFeatures(featureCodes: string[]): Promise<UnitModel[]> {
  try {
    if (!featureCodes || featureCodes.length === 0) {
      return [];
    }
    const q = query(
      collection(db, UNITS_COLLECTION),
      where('interiorFeatures', 'array-contains-any', featureCodes)
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(normalizeUnitSnapshot);
  } catch (error) {
    throw error;
  }
}

/**
 * Get units by operational status
 * @param status Operational status to filter by
 */
export async function getUnitsByOperationalStatus(status: string): Promise<UnitModel[]> {
  try {
    const q = query(
      collection(db, UNITS_COLLECTION),
      where('operationalStatus', '==', status)
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(normalizeUnitSnapshot);
  } catch (error) {
    throw error;
  }
}

/**
 * Get units with incomplete documentation
 * Returns units missing photos, floorplans, or documents
 */
export async function getIncompleteUnits(): Promise<UnitModel[]> {
  try {
    // Query for units missing any documentation
    const queries = [
      query(collection(db, UNITS_COLLECTION), where('unitCoverage.hasPhotos', '==', false)),
      query(collection(db, UNITS_COLLECTION), where('unitCoverage.hasFloorplans', '==', false)),
      query(collection(db, UNITS_COLLECTION), where('unitCoverage.hasDocuments', '==', false))
    ];

    const results = await Promise.all(queries.map(q => getDocs(q)));

    // Deduplicate units (a unit might be missing multiple things)
    const unitMap = new Map<string, UnitModel>();
    results.forEach(snapshot => {
      snapshot.docs.forEach(doc => {
        if (!unitMap.has(doc.id)) {
          unitMap.set(doc.id, normalizeUnitSnapshot(doc));
        }
      });
    });

    return Array.from(unitMap.values());
  } catch (error) {
    throw error;
  }
}

/**
 * Update unit coverage status
 * @param unitId Unit ID to update
 * @param coverage Coverage updates
 */
/**
 * Update unit entity links (company, project, building) via Admin SDK API
 * @param unitId Unit ID to update
 * @param updates Link fields to update
 */
export async function updateUnitLink(
  unitId: string,
  updates: {
    companyId?: string | null;
    companyName?: string;
    projectId?: string | null;
    projectName?: string;
    buildingId?: string | null;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    await apiClient.patch(`/api/units/${unitId}`, updates);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update unit link',
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

    const result = await apiClient.get<BuildingsResponse>('/api/buildings');
    if (!result?.buildings) return [];

    return result.buildings.map(b => ({
      id: b.id,
      name: b.name || b.id,
    }));
  } catch {
    return [];
  }
}

export async function updateUnitCoverage(
  unitId: string,
  coverage: Partial<{
    hasPhotos: boolean;
    hasFloorplans: boolean;
    hasDocuments: boolean;
  }>
): Promise<{ success: boolean }> {
  try {
    const unitRef = doc(db, UNITS_COLLECTION, unitId);
    await updateDoc(unitRef, {
      'unitCoverage.hasPhotos': coverage.hasPhotos,
      'unitCoverage.hasFloorplans': coverage.hasFloorplans,
      'unitCoverage.hasDocuments': coverage.hasDocuments,
      'unitCoverage.updatedAt': serverTimestamp()
    });
    return { success: true };
  } catch (error) {
    throw error;
  }
}

// Batch add units (for seeding)
export async function seedUnits(units: Omit<Property, 'id'>[]): Promise<{ success: boolean; count: number }> {
    const batch = writeBatch(db);
    units.forEach(unitData => {
        const docRef = doc(collection(db, UNITS_COLLECTION));
        batch.set(docRef, unitData);
    });

    try {
        await batch.commit();
        return { success: true, count: units.length };
    } catch(error) {
        // Error logging removed
        throw error;
    }
}
