'use client';

import { collection, doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import pako from 'pako';

export interface FloorplanData {
  projectId: string;
  buildingId?: string; // For building-level floorplans
  type: 'project' | 'parking' | 'building' | 'storage';
  scene: any; // DXF scene data
  fileName: string;
  timestamp: number;
}

interface CompressedFloorplanData {
  projectId: string;
  buildingId?: string;
  type: 'project' | 'parking' | 'building' | 'storage';
  compressedScene: string; // Compressed and base64 encoded scene data
  fileName: string;
  timestamp: number;
  compressed: boolean;
  originalSize: number;
  compressedSize: number;
}

export class FloorplanService {
  private static COLLECTION = 'project_floorplans';

  /**
   * Compress scene data using gzip
   */
  private static compressScene(scene: any): { compressedData: string; originalSize: number; compressedSize: number } {
    try {
      const jsonString = JSON.stringify(scene);
      const originalSize = new TextEncoder().encode(jsonString).length;
      
      // Compress using pako (gzip)
      const compressed = pako.gzip(jsonString);
      
      // Convert to base64 for storage
      const compressedData = btoa(String.fromCharCode(...compressed));
      const compressedSize = compressedData.length;
      
      // Debug logging removed
      
      return { compressedData, originalSize, compressedSize };
    } catch (error) {
      // Error logging removed
      throw error;
    }
  }

  /**
   * Decompress scene data
   */
  private static decompressScene(compressedData: string): any {
    try {
      // Convert from base64
      const binaryString = atob(compressedData);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      // Decompress using pako
      const decompressed = pako.ungzip(bytes, { to: 'string' });
      
      // Parse JSON
      return JSON.parse(decompressed);
    } catch (error) {
      // Error logging removed
      throw error;
    }
  }

  /**
   * Save floorplan data to Firestore
   */
  static async saveFloorplan(projectId: string, type: 'project' | 'parking' | 'building' | 'storage', data: FloorplanData): Promise<boolean> {
    try {
      const docId = `${projectId}_${type}`;
      // Debug logging removed //(`💾 Saving ${type} floorplan to Firestore:`, docId);
      
      // Compress scene data
      const { compressedData, originalSize, compressedSize } = this.compressScene(data.scene);
      
      const docData: CompressedFloorplanData = {
        projectId,
        type,
        compressedScene: compressedData,
        fileName: data.fileName,
        timestamp: data.timestamp,
        compressed: true,
        originalSize,
        compressedSize,
        updatedAt: new Date().toISOString()
      } as any;

      // Only include buildingId if it's defined
      if (data.buildingId !== undefined) {
        docData.buildingId = data.buildingId;
      }

      // Debug logging removed
      // console.log(`🗂️ Document data being saved:`, {
      //   docId,
      //   fileName: docData.fileName,
      //   timestamp: docData.timestamp,
      //   updatedAt: docData.updatedAt,
      //   compressed: docData.compressed,
      //   originalSize: docData.originalSize,
      //   compressedSize: docData.compressedSize,
      //   compressionRatio: `${((1 - docData.compressedSize/docData.originalSize) * 100).toFixed(1)}%`,
      //   entitiesCount: data.scene?.entities?.length || 0
      // });

      await setDoc(doc(db, this.COLLECTION, docId), docData);

      // Debug logging removed //(`✅ Successfully saved ${type} floorplan for project:`, projectId);
      return true;
    } catch (error) {
      // Error logging removed //(`❌ Error saving ${type} floorplan:`, error);
      return false;
    }
  }

  /**
   * Load floorplan data from Firestore
   */
  static async loadFloorplan(projectId: string, type: 'project' | 'parking' | 'building' | 'storage'): Promise<FloorplanData | null> {
    try {
      const docId = `${projectId}_${type}`;
      // Debug logging removed //(`📖 Loading ${type} floorplan from Firestore:`, docId);
      
      const docSnap = await getDoc(doc(db, this.COLLECTION, docId));
      
      if (docSnap.exists()) {
        const rawData = docSnap.data();
        
        // Check if data is compressed
        if (rawData.compressed && rawData.compressedScene) {
          // Debug logging removed //(`🗜️ Decompressing ${type} floorplan data...`);
          const compressedData = rawData as CompressedFloorplanData;
          
          // Decompress scene
          const scene = this.decompressScene(compressedData.compressedScene);
          
          // Return as standard FloorplanData
          const data: FloorplanData = {
            projectId: compressedData.projectId,
            buildingId: compressedData.buildingId,
            type: compressedData.type,
            scene: scene,
            fileName: compressedData.fileName,
            timestamp: compressedData.timestamp
          };
          
          // Debug logging removed //(`✅ Successfully loaded ${type} floorplan for project:`, projectId, {
            fileName: data.fileName,
            timestamp: data.timestamp,
            updatedAt: rawData.updatedAt,
            compressed: true,
            originalSize: compressedData.originalSize,
            compressedSize: compressedData.compressedSize,
            entitiesCount: data.scene?.entities?.length || 0
          });
          
          return data;
        } else {
          // Legacy uncompressed data
          const data = rawData as FloorplanData;
          // Debug logging removed //(`✅ Successfully loaded ${type} floorplan for project:`, projectId, {
            fileName: data.fileName,
            timestamp: data.timestamp,
            updatedAt: rawData.updatedAt,
            compressed: false,
            entitiesCount: data.scene?.entities?.length || 0,
            sceneExists: !!data.scene
          });
          return data;
        }
      } else {
        // Debug logging removed //(`ℹ️ No ${type} floorplan found for project:`, projectId);
        return null;
      }
    } catch (error) {
      // Error logging removed //(`❌ Error loading ${type} floorplan:`, error);
      return null;
    }
  }

  /**
   * Check if floorplan exists
   */
  static async hasFloorplan(projectId: string, type: 'project' | 'parking' | 'building' | 'storage'): Promise<boolean> {
    try {
      const docId = `${projectId}_${type}`;
      const docSnap = await getDoc(doc(db, this.COLLECTION, docId));
      return docSnap.exists();
    } catch (error) {
      // Error logging removed //(`❌ Error checking ${type} floorplan:`, error);
      return false;
    }
  }

  /**
   * Delete floorplan
   */
  static async deleteFloorplan(projectId: string, type: 'project' | 'parking' | 'building' | 'storage'): Promise<boolean> {
    try {
      const docId = `${projectId}_${type}`;
      // Debug logging removed //(`🗑️ Deleting ${type} floorplan from Firestore:`, docId);
      
      // Note: We could use deleteDoc here, but for now just mark as deleted
      await setDoc(doc(db, this.COLLECTION, docId), {
        deleted: true,
        deletedAt: new Date().toISOString()
      });

      // Debug logging removed //(`✅ Successfully deleted ${type} floorplan for project:`, projectId);
      return true;
    } catch (error) {
      // Error logging removed //(`❌ Error deleting ${type} floorplan:`, error);
      return false;
    }
  }
}