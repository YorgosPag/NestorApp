'use client';

import { collection, doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface BuildingFloorplanData {
  buildingId: string;
  type: 'building' | 'storage';
  scene: any; // DXF scene data
  fileName: string;
  timestamp: number;
}

export class BuildingFloorplanService {
  private static COLLECTION = 'building_floorplans';

  /**
   * Save building floorplan data to Firestore
   */
  static async saveFloorplan(buildingId: string, type: 'building' | 'storage', data: BuildingFloorplanData): Promise<boolean> {
    try {
      const docId = `${buildingId}_${type}`;
      // Debug logging removed //(`💾 Saving ${type} floorplan to Firestore:`, docId);
      
      await setDoc(doc(db, this.COLLECTION, docId), {
        buildingId,
        type,
        scene: data.scene,
        fileName: data.fileName,
        timestamp: data.timestamp,
        updatedAt: new Date().toISOString()
      });

      // Debug logging removed //(`✅ Successfully saved ${type} floorplan for building:`, buildingId);
      return true;
    } catch (error) {
      // Error logging removed //(`❌ Error saving ${type} floorplan:`, error);
      return false;
    }
  }

  /**
   * Load building floorplan data from Firestore
   */
  static async loadFloorplan(buildingId: string, type: 'building' | 'storage'): Promise<BuildingFloorplanData | null> {
    try {
      const docId = `${buildingId}_${type}`;
      // Debug logging removed //(`📖 Loading ${type} floorplan from Firestore:`, docId);
      
      const docSnap = await getDoc(doc(db, this.COLLECTION, docId));
      
      if (docSnap.exists()) {
        const data = docSnap.data() as BuildingFloorplanData;
        // Debug logging removed //(`✅ Successfully loaded ${type} floorplan for building:`, buildingId);
        return data;
      } else {
        // Debug logging removed //(`ℹ️ No ${type} floorplan found for building:`, buildingId);
        return null;
      }
    } catch (error) {
      // Error logging removed //(`❌ Error loading ${type} floorplan:`, error);
      return null;
    }
  }

  /**
   * Check if building floorplan exists
   */
  static async hasFloorplan(buildingId: string, type: 'building' | 'storage'): Promise<boolean> {
    try {
      const docId = `${buildingId}_${type}`;
      const docSnap = await getDoc(doc(db, this.COLLECTION, docId));
      return docSnap.exists();
    } catch (error) {
      // Error logging removed //(`❌ Error checking ${type} floorplan:`, error);
      return false;
    }
  }

  /**
   * Delete building floorplan
   */
  static async deleteFloorplan(buildingId: string, type: 'building' | 'storage'): Promise<boolean> {
    try {
      const docId = `${buildingId}_${type}`;
      // Debug logging removed //(`🗑️ Deleting ${type} floorplan from Firestore:`, docId);
      
      // Note: We could use deleteDoc here, but for now just mark as deleted
      await setDoc(doc(db, this.COLLECTION, docId), {
        deleted: true,
        deletedAt: new Date().toISOString()
      });

      // Debug logging removed //(`✅ Successfully deleted ${type} floorplan for building:`, buildingId);
      return true;
    } catch (error) {
      // Error logging removed //(`❌ Error deleting ${type} floorplan:`, error);
      return false;
    }
  }
}