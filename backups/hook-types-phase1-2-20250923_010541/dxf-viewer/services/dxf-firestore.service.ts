import { db } from '../../../lib/firebase';
import { doc, setDoc, getDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import type { SceneModel } from '../types/scene';

export interface DxfFileRecord {
  id: string;
  fileName: string;
  scene: SceneModel;
  lastModified: Timestamp;
  version: number;
  checksum?: string;
}

export class DxfFirestoreService {
  private static readonly COLLECTION_NAME = 'dxf_files';
  
  /**
   * Auto-save scene to Firestore
   */
  static async autoSave(fileId: string, fileName: string, scene: SceneModel): Promise<boolean> {
    try {
      console.log(`💾 [DxfFirestore] Auto-saving DXF scene: ${fileName}`);
      
      // Get current version
      const currentDoc = await this.getFile(fileId);
      const newVersion = (currentDoc?.version || 0) + 1;
      
      const record: DxfFileRecord = {
        id: fileId,
        fileName,
        scene,
        lastModified: serverTimestamp() as Timestamp,
        version: newVersion,
        checksum: this.generateSceneChecksum(scene)
      };
      
      const docRef = doc(db, this.COLLECTION_NAME, fileId);
      await setDoc(docRef, record);
      
      console.log(`✅ [DxfFirestore] Scene saved successfully (v${newVersion}):`, {
        fileId,
        fileName,
        entityCount: scene.entities.length,
        layerCount: Object.keys(scene.layers).length
      });
      
      return true;
    } catch (error) {
      console.error('❌ [DxfFirestore] Auto-save failed:', error);
      return false;
    }
  }
  
  /**
   * Load scene from Firestore
   */
  static async loadFile(fileId: string): Promise<DxfFileRecord | null> {
    try {
      console.log(`📂 [DxfFirestore] Loading DXF scene: ${fileId}`);
      return await this.getFile(fileId);
    } catch (error) {
      console.error('❌ [DxfFirestore] Load failed:', error);
      return null;
    }
  }
  
  /**
   * Check if file exists in Firestore
   */
  static async fileExists(fileId: string): Promise<boolean> {
    try {
      const docRef = doc(db, this.COLLECTION_NAME, fileId);
      const docSnap = await getDoc(docRef);
      return docSnap.exists();
    } catch (error) {
      console.error('❌ [DxfFirestore] File existence check failed:', error);
      return false;
    }
  }
  
  /**
   * Generate a simple checksum for change detection
   */
  private static generateSceneChecksum(scene: SceneModel): string {
    const data = {
      entityCount: scene.entities.length,
      layerCount: Object.keys(scene.layers).length,
      bounds: scene.bounds,
      units: scene.units
    };
    return btoa(JSON.stringify(data)).substring(0, 16);
  }
  
  /**
   * Internal method to get document
   */
  private static async getFile(fileId: string): Promise<DxfFileRecord | null> {
    const docRef = doc(db, this.COLLECTION_NAME, fileId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return docSnap.data() as DxfFileRecord;
    }
    
    return null;
  }
  
  /**
   * Generate file ID from filename
   */
  static generateFileId(fileName: string): string {
    // Remove extension and sanitize for Firestore document ID
    const baseName = fileName.replace(/\.[^/.]+$/, '');
    return baseName
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '_')
      .replace(/_+/g, '_')
      .substring(0, 100); // Firestore ID limit
  }
}