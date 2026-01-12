'use client';

import { collection, doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// 🏢 ENTERPRISE: DXF scene data structure
interface DxfSceneData {
  entities?: unknown[];
  layers?: Record<string, unknown>;
  bounds?: { minX: number; minY: number; maxX: number; maxY: number };
  [key: string]: unknown;
}

export interface UnitFloorplanData {
  unitId: string;
  type: 'unit';
  scene: DxfSceneData;
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
      // Debug logging removed //(`💾 Saving unit floorplan to Firestore:`, docId);
      
      await setDoc(doc(db, this.COLLECTION, docId), {
        unitId,
        type: 'unit',
        scene: data.scene,
        fileName: data.fileName,
        timestamp: data.timestamp,
        updatedAt: new Date().toISOString()
      });

      // Debug logging removed //(`✅ Successfully saved unit floorplan for unit:`, unitId);
      return true;
    } catch (error) {
      // Error logging removed //(`❌ Error saving unit floorplan:`, error);
      return false;
    }
  }

  /**
   * Load unit floorplan data from Firestore
   */
  static async loadFloorplan(unitId: string): Promise<UnitFloorplanData | null> {
    try {
      const docId = `${unitId}_unit`;
      // Debug logging removed //(`📖 Loading unit floorplan from Firestore:`, docId);
      
      const docSnap = await getDoc(doc(db, this.COLLECTION, docId));
      
      if (docSnap.exists()) {
        const data = docSnap.data() as UnitFloorplanData;
        // Debug logging removed //(`✅ Successfully loaded unit floorplan for unit:`, unitId);
        return data;
      } else {
        // Debug logging removed //(`ℹ️ No unit floorplan found for unit:`, unitId);
        return null;
      }
    } catch (error) {
      // Error logging removed //(`❌ Error loading unit floorplan:`, error);
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
      // Error logging removed //(`❌ Error checking unit floorplan:`, error);
      return false;
    }
  }

  /**
   * Delete unit floorplan
   */
  static async deleteFloorplan(unitId: string): Promise<boolean> {
    try {
      const docId = `${unitId}_unit`;
      // Debug logging removed //(`🗑️ Deleting unit floorplan from Firestore:`, docId);
      
      // Note: We could use deleteDoc here, but for now just mark as deleted
      await setDoc(doc(db, this.COLLECTION, docId), {
        deleted: true,
        deletedAt: new Date().toISOString()
      });

      // Debug logging removed //(`✅ Successfully deleted unit floorplan for unit:`, unitId);
      return true;
    } catch (error) {
      // Error logging removed //(`❌ Error deleting unit floorplan:`, error);
      return false;
    }
  }
}