'use client';

import { db } from '@/lib/firebase'; // Αλλαγή σε client-side db
import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  writeBatch,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { COLLECTIONS } from '@/config/firestore-collections';
import type { Property } from '@/types/property-viewer';
import type { UnitModel } from '@/types/unit';
import type { DocumentSnapshot, QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
// 🏢 ENTERPRISE: Centralized real-time service for cross-page sync
import { RealtimeService } from '@/services/realtime';

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
    return unit as Property;
};

/**
 * 🏢 ENTERPRISE: Alias for backward compatibility
 * @deprecated Use transformUnit directly
 */
const transformUnitToProperty = transformUnit;

// Add a single unit
export async function addUnit(unitData: Omit<Property, 'id'>): Promise<{ id: string; success: boolean }> {
  try {
    const docRef = await addDoc(collection(db, UNITS_COLLECTION), {
      ...unitData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return { id: docRef.id, success: true };
  } catch (error) {
    // Error logging removed
    throw error;
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
      return querySnapshot.docs.map(transformUnit);
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

// Update a unit
export async function updateUnit(unitId: string, updates: Partial<Property>): Promise<{ success: boolean }> {
  try {
    const unitRef = doc(db, UNITS_COLLECTION, unitId);
    await updateDoc(unitRef, {
      ...updates,
      updatedAt: serverTimestamp()
    });

    // 🏢 ENTERPRISE: Centralized Real-time Service (cross-page sync)
    // Dispatch event for all components to update their local state
    RealtimeService.dispatchUnitUpdated({
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
    // Error logging removed
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


// Delete a unit
export async function deleteUnit(unitId: string): Promise<{ success: boolean }> {
  try {
    await deleteDoc(doc(db, UNITS_COLLECTION, unitId));
    return { success: true };
  } catch (error) {
    // Error logging removed
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
    return querySnapshot.docs.map(transformUnit);
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
    return querySnapshot.docs.map(transformUnit);
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
          unitMap.set(doc.id, transformUnit(doc));
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