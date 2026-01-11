import React from 'react';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import { 
  collection, 
  doc, 
  onSnapshot, 
  updateDoc, 
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
  writeBatch,
  getDocs
} from 'firebase/firestore';
import type { Layer, LayerEvent } from '@/types/layers';

/**
 * Layer Sync Utility για τη διαχείριση real-time συγχρονισμού
 * μεταξύ της μητρικής περιοχής (Units) και της θυγατρικής (Properties)
 * 
 * Λειτουργίες:
 * - Real-time sync από Units → Properties
 * - Event logging για debugging
 * - Batch operations για performance
 * - Error handling και retry logic
 */

export interface LayerSyncOptions {
  enableRealtime?: boolean;
  enableLogging?: boolean;
  retryAttempts?: number;
  batchSize?: number;
}

export interface LayerSyncState {
  isConnected: boolean;
  lastSyncTime: string | null;
  pendingOperations: number;
  errors: string[];
  syncedLayers: number;
}

export type LayerSyncCallback = (state: LayerSyncState) => void;

export class LayerSyncManager {
  private floorId: string;
  private buildingId: string;
  private options: Required<LayerSyncOptions>;
  private unsubscribers: (() => void)[] = [];
  private state: LayerSyncState;
  private callbacks: Set<LayerSyncCallback> = new Set();

  constructor(
    floorId: string, 
    buildingId: string, 
    options: LayerSyncOptions = {}
  ) {
    this.floorId = floorId;
    this.buildingId = buildingId;
    this.options = {
      enableRealtime: true,
      enableLogging: false,
      retryAttempts: 3,
      batchSize: 10,
      ...options
    };
    
    this.state = {
      isConnected: false,
      lastSyncTime: null,
      pendingOperations: 0,
      errors: [],
      syncedLayers: 0
    };
  }

  /**
   * Ξεκινά τον real-time συγχρονισμό
   */
  public startSync(): void {
    if (!this.options.enableRealtime) {
      return;
    }

    this.log('Starting layer sync for floor:', this.floorId);

    try {
      // Listen to layer changes in Units collection
      const layersQuery = query(
        collection(db, COLLECTIONS.LAYERS),
        where('floorId', '==', this.floorId),
        orderBy('zIndex', 'asc')
      );

      const unsubscribe = onSnapshot(
        layersQuery,
        (snapshot) => {
          this.handleLayerSnapshot(snapshot);
        },
        (error) => {
          this.handleError('Layer sync error', error);
        }
      );

      this.unsubscribers.push(unsubscribe);
      
      this.updateState({
        isConnected: true,
        lastSyncTime: new Date().toISOString()
      });

    } catch (error) {
      this.handleError('Failed to start sync', error);
    }
  }

  /**
   * Σταματά τον συγχρονισμό
   */
  public stopSync(): void {
    this.log('Stopping layer sync');
    
    this.unsubscribers.forEach(unsubscribe => unsubscribe());
    this.unsubscribers = [];
    
    this.updateState({
      isConnected: false
    });
  }

  /**
   * Προσθέτει callback για ενημερώσεις state
   */
  public onStateChange(callback: LayerSyncCallback): () => void {
    this.callbacks.add(callback);
    
    // Return unsubscribe function
    return () => {
      this.callbacks.delete(callback);
    };
  }

  /**
   * Επιστρέφει την τρέχουσα κατάσταση
   */
  public getState(): LayerSyncState {
    return { ...this.state };
  }

  /**
   * Συγχρονίζει ένα συγκεκριμένο layer
   */
  public async syncLayer(layer: Layer): Promise<void> {
    try {
      this.updateState({ pendingOperations: this.state.pendingOperations + 1 });
      
      // Create mirror document in properties collection
      const propertyLayerDoc = doc(db, COLLECTIONS.PROPERTY_LAYERS, layer.id);
      
      // Create a read-only version of the layer
      const readOnlyLayer = {
        ...layer,
        // Remove sensitive administrative data
        createdBy: undefined,
        // Mark as read-only
        isReadOnly: true,
        // Add sync metadata
        syncedAt: new Date().toISOString(),
        syncedFrom: 'units'
      };

      await updateDoc(propertyLayerDoc, readOnlyLayer);
      
      this.log('Layer synced:', layer.id, layer.name);
      
      this.updateState({
        pendingOperations: this.state.pendingOperations - 1,
        lastSyncTime: new Date().toISOString(),
        syncedLayers: this.state.syncedLayers + 1
      });

    } catch (error) {
      this.updateState({ pendingOperations: this.state.pendingOperations - 1 });
      await this.retryOperation(() => this.syncLayer(layer), `sync layer ${layer.id}`);
    }
  }

  /**
   * Συγχρονίζει πολλαπλά layers με batch operation
   */
  public async syncLayersBatch(layers: Layer[]): Promise<void> {
    const batch = writeBatch(db);
    const chunks = this.chunkArray(layers, this.options.batchSize);

    try {
      for (const chunk of chunks) {
        this.updateState({ pendingOperations: this.state.pendingOperations + chunk.length });
        
        for (const layer of chunk) {
          const propertyLayerDoc = doc(db, COLLECTIONS.PROPERTY_LAYERS, layer.id);
          const readOnlyLayer = {
            ...layer,
            createdBy: undefined,
            isReadOnly: true,
            syncedAt: new Date().toISOString(),
            syncedFrom: 'units'
          };
          
          batch.set(propertyLayerDoc, readOnlyLayer);
        }
        
        await batch.commit();
        
        this.updateState({
          pendingOperations: this.state.pendingOperations - chunk.length,
          lastSyncTime: new Date().toISOString(),
          syncedLayers: this.state.syncedLayers + chunk.length
        });
        
        this.log('Batch synced:', chunk.length, 'layers');
      }
    } catch (error) {
      this.handleError('Batch sync failed', error);
    }
  }

  /**
   * Διαγράφει layer από την properties collection
   */
  public async deleteLayerFromProperties(layerId: string): Promise<void> {
    try {
      const propertyLayerDoc = doc(db, COLLECTIONS.PROPERTY_LAYERS, layerId);
      await deleteDoc(propertyLayerDoc);
      
      this.log('Layer deleted from properties:', layerId);
    } catch (error) {
      await this.retryOperation(
        () => this.deleteLayerFromProperties(layerId), 
        `delete layer ${layerId}`
      );
    }
  }

  /**
   * Logs events (αν είναι ενεργοποιημένο)
   */
  public logEvent(event: Omit<LayerEvent, 'timestamp'>): void {
    if (!this.options.enableLogging) return;

    const fullEvent: LayerEvent = {
      ...event,
      timestamp: new Date().toISOString()
    };

    // Αποθήκευση στο Firestore για debugging
    const eventsCollection = collection(db, COLLECTIONS.LAYER_EVENTS);
    try {
      // Fire and forget - δεν θέλουμε να μπλοκάρει η εφαρμογή
      doc(eventsCollection).set(fullEvent);
    } catch (error) {
      // Warning logging removed
    }
  }

  // Private methods

  private handleLayerSnapshot(snapshot: any): void {
    const layers: Layer[] = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    this.log('Received layer snapshot:', layers.length, 'layers');

    // Sync all layers to properties collection
    this.syncLayersBatch(layers);
  }

  private handleError(message: string, error: any): void {
    const errorMessage = `${message}: ${error?.message || error}`;
    // Error logging removed
    
    this.updateState({
      errors: [...this.state.errors.slice(-4), errorMessage], // Keep last 5 errors
      isConnected: false
    });
  }

  private async retryOperation(
    operation: () => Promise<void>, 
    operationName: string
  ): Promise<void> {
    for (let attempt = 1; attempt <= this.options.retryAttempts; attempt++) {
      try {
        await operation();
        this.log(`Retry successful for ${operationName} (attempt ${attempt})`);
        return;
      } catch (error) {
        if (attempt === this.options.retryAttempts) {
          this.handleError(`Max retries exceeded for ${operationName}`, error);
          throw error;
        }
        
        const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
        this.log(`Retry ${attempt} failed for ${operationName}, retrying in ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  private updateState(updates: Partial<LayerSyncState>): void {
    this.state = { ...this.state, ...updates };
    this.callbacks.forEach(callback => callback(this.state));
  }

  private log(message: string, ...args: any[]): void {
    if (this.options.enableLogging) {
      // Debug logging removed
    }
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    this.stopSync();
    this.callbacks.clear();
  }
}

/**
 * Hook για εύκολη χρήση του LayerSyncManager
 */
export function useLayerSync(
  floorId: string, 
  buildingId: string, 
  options?: LayerSyncOptions
) {
  const [syncManager] = React.useState(() => 
    new LayerSyncManager(floorId, buildingId, options)
  );
  
  const [syncState, setSyncState] = React.useState<LayerSyncState>(
    syncManager.getState()
  );

  React.useEffect(() => {
    const unsubscribe = syncManager.onStateChange(setSyncState);
    syncManager.startSync();
    
    return () => {
      unsubscribe();
      syncManager.destroy();
    };
  }, [syncManager]);

  return {
    syncState,
    syncManager
  };
}

// Helper functions για εξωτερική χρήση

/**
 * Δημιουργεί ένα global sync manager για όλο το application
 */
export function createGlobalLayerSync(options?: LayerSyncOptions) {
  const managers = new Map<string, LayerSyncManager>();
  
  return {
    getManager(floorId: string, buildingId: string): LayerSyncManager {
      const key = `${buildingId}:${floorId}`;
      
      if (!managers.has(key)) {
        managers.set(key, new LayerSyncManager(floorId, buildingId, options));
      }
      
      return managers.get(key)!;
    },
    
    destroyManager(floorId: string, buildingId: string): void {
      const key = `${buildingId}:${floorId}`;
      const manager = managers.get(key);
      
      if (manager) {
        manager.destroy();
        managers.delete(key);
      }
    },
    
    destroyAll(): void {
      managers.forEach(manager => manager.destroy());
      managers.clear();
    }
  };
}

/**
 * Utility για manual sync operations
 */
export async function forceSyncLayers(
  floorId: string, 
  buildingId: string
): Promise<void> {
  const syncManager = new LayerSyncManager(floorId, buildingId, {
    enableRealtime: false,
    enableLogging: true
  });
  
  try {
    // Get all layers for this floor
    const layersQuery = query(
      collection(db, COLLECTIONS.LAYERS),
      where('floorId', '==', floorId)
    );
    
    const snapshot = await getDocs(layersQuery);
    const layers = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Layer));
    
    await syncManager.syncLayersBatch(layers);
    // Debug logging removed
    
  } catch (error) {
    // Error logging removed
    throw error;
  } finally {
    syncManager.destroy();
  }
}