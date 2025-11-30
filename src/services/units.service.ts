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
import type { Property } from '@/types/property-viewer';

const UNITS_COLLECTION = 'units';

const transformUnit = (doc: any): Property => {
    const data = doc.data();
    const unit: any = { id: doc.id };

    for (const key in data) {
        if (data[key] instanceof Timestamp) {
            unit[key] = data[key].toDate().toISOString();
        } else {
            unit[key] = data[key];
        }
    }
    return unit as Property;
};

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
    
    return querySnapshot.docs.map(transformUnit);
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
    return querySnapshot.docs.map(transformUnit);
  } catch (error) {
    // Error logging removed
    throw error;
  }
}

// Get units by building ID
export async function getUnitsByBuilding(buildingId: string): Promise<Property[]> {
    try {
      if (!buildingId) {
          return [];
      }
      const q = query(collection(db, UNITS_COLLECTION), where('buildingId', '==', buildingId));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(transformUnit);
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