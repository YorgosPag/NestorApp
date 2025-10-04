'use client';

import { collection, doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface UnitFloorplanData {
  unitId: string;
  type: 'unit';
  scene: any; // DXF scene data
  fileName: string;
  timestamp: number;
}

export class UnitFloorplanService {
  private static COLLECTION = 'unit_floorplans';

  /**
   * Save unit floorplan data to Firestore
   */
  static async saveFloorplan(unitId: string, data: UnitFloorplanData): Promise<boolean> {
    try {
      const docId = `${unitId}_unit`;
      console.log(`💾 Saving unit floorplan to Firestore:`, docId);
      
      await setDoc(doc(db, this.COLLECTION, docId), {
        unitId,
        type: 'unit',
        scene: data.scene,
        fileName: data.fileName,
        timestamp: data.timestamp,
        updatedAt: new Date().toISOString()
      });

      console.log(`✅ Successfully saved unit floorplan for unit:`, unitId);
      return true;
    } catch (error) {
      console.error(`❌ Error saving unit floorplan:`, error);
      return false;
    }
  }

  /**
   * Load unit floorplan data from Firestore
   */
  static async loadFloorplan(unitId: string): Promise<UnitFloorplanData | null> {
    try {
      const docId = `${unitId}_unit`;
      console.log(`📖 Loading unit floorplan from Firestore:`, docId);
      
      const docSnap = await getDoc(doc(db, this.COLLECTION, docId));
      
      if (docSnap.exists()) {
        const data = docSnap.data() as UnitFloorplanData;
        console.log(`✅ Successfully loaded unit floorplan for unit:`, unitId);
        return data;
      } else {
        console.log(`ℹ️ No unit floorplan found for unit:`, unitId);
        return null;
      }
    } catch (error) {
      console.error(`❌ Error loading unit floorplan:`, error);
      return null;
    }
  }

  /**
   * Check if unit floorplan exists
   */
  static async hasFloorplan(unitId: string): Promise<boolean> {
    try {
      const docId = `${unitId}_unit`;
      const docSnap = await getDoc(doc(db, this.COLLECTION, docId));
      return docSnap.exists();
    } catch (error) {
      console.error(`❌ Error checking unit floorplan:`, error);
      return false;
    }
  }

  /**
   * Delete unit floorplan
   */
  static async deleteFloorplan(unitId: string): Promise<boolean> {
    try {
      const docId = `${unitId}_unit`;
      console.log(`🗑️ Deleting unit floorplan from Firestore:`, docId);
      
      // Note: We could use deleteDoc here, but for now just mark as deleted
      await setDoc(doc(db, this.COLLECTION, docId), {
        deleted: true,
        deletedAt: new Date().toISOString()
      });

      console.log(`✅ Successfully deleted unit floorplan for unit:`, unitId);
      return true;
    } catch (error) {
      console.error(`❌ Error deleting unit floorplan:`, error);
      return false;
    }
  }
}