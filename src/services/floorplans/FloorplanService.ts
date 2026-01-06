'use client';

import { collection, doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
// ✅ ENTERPRISE: Pako compression library with type assertion
// @ts-ignore - Pako module lacks TypeScript definitions
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
      // ✅ ENTERPRISE DEBUG: Verify floorplan save operation
      console.log('💾 FloorplanService.saveFloorplan called:', {
        projectId,
        type,
        docId,
        fileName: data.fileName,
        hasScene: !!data.scene,
        entitiesCount: data.scene?.entities?.length || 0
      });
      
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

      // ✅ ENTERPRISE DEBUG: Confirm successful save
      console.log('✅ FloorplanService: Successfully saved floorplan to Firestore:', {
        docId,
        collection: this.COLLECTION,
        compressionRatio: `${((1 - compressedSize/originalSize) * 100).toFixed(1)}%`
      });
      return true;
    } catch (error) {
      // ✅ ENTERPRISE DEBUG: Log error details
      console.error('❌ FloorplanService.saveFloorplan FAILED:', {
        projectId,
        type,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  /**
   * Load floorplan data from Firestore
   */
  static async loadFloorplan(projectId: string, type: 'project' | 'parking' | 'building' | 'storage'): Promise<FloorplanData | null> {
    try {
      const docId = `${projectId}_${type}`;
      // ✅ ENTERPRISE DEBUG: Log load attempt
      console.log('📖 FloorplanService.loadFloorplan called:', { projectId, type, docId });
      
      const docSnap = await getDoc(doc(db, this.COLLECTION, docId));
      
      if (docSnap.exists()) {
        const rawData = docSnap.data();
        
        // Check if data is compressed
        if (rawData.compressed && rawData.compressedScene) {
          // Debug logging removed - Decompressing floorplan data
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
          
          // Debug logging removed - Successfully loaded compressed floorplan
          
          return data;
        } else {
          // Legacy uncompressed data
          const data = rawData as FloorplanData;
          // Debug logging removed - Successfully loaded uncompressed floorplan
          return data;
        }
      } else {
        // ✅ ENTERPRISE DEBUG: Document not found
        console.log('⚠️ FloorplanService: No floorplan found:', { projectId, type, docId });
        return null;
      }
    } catch (error) {
      // ✅ ENTERPRISE DEBUG: Log load error
      console.error('❌ FloorplanService.loadFloorplan FAILED:', {
        projectId,
        type,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
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
      // Debug logging removed - Deleting floorplan from Firestore
      
      // Note: We could use deleteDoc here, but for now just mark as deleted
      await setDoc(doc(db, this.COLLECTION, docId), {
        deleted: true,
        deletedAt: new Date().toISOString()
      });

      // Debug logging removed - Successfully deleted floorplan
      return true;
    } catch (error) {
      // Error logging removed //(`❌ Error deleting ${type} floorplan:`, error);
      return false;
    }
  }
}