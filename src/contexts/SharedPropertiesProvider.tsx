'use client';

/**
 * 🏢 ENTERPRISE: SharedPropertiesProvider with LAZY INITIALIZATION
 *
 * PERF-001 Optimization: Firestore listener is NOT set up on mount.
 * It only activates when a component calls useSharedProperties().
 *
 * This prevents the global layout from loading units data on ALL routes.
 * Only /properties and /units routes (that use the hook) trigger the listener.
 *
 * @module contexts/SharedPropertiesProvider
 * @version 2.0.0 - Lazy initialization
 */

// 🎯 PRODUCTION: Debug disabled για καθαρότερα logs
const DEBUG_SHARED_PROPERTIES_PROVIDER = false;

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Property } from '@/types/property-viewer';
import { COLLECTIONS } from '@/config/firestore-collections';

import { createModuleLogger } from '@/lib/telemetry';
const logger = createModuleLogger('SharedPropertiesProvider');

interface Floor {
  id: string;
  name: string;
  level: number;
  buildingId: string;
  properties: Property[];
}

interface SharedPropertiesContextType {
  properties: Property[];
  floors: Floor[];
  setProperties: (properties: Property[], description: string) => void;
  isLoading: boolean;
  error: string | null;
  forceDataRefresh: () => void;
  /** 🏢 ENTERPRISE: Activate listener (called by useSharedProperties) */
  activate: () => void;
}

const SharedPropertiesContext = createContext<SharedPropertiesContextType | null>(null);

const getFloorLabel = (floor?: number): string => {
    const level = typeof floor === 'number' ? floor : 0;
    if (level === -1) return 'Υπόγειο';
    if (level === 0) return 'Ισόγειο';
    return `${level}ος Όροφος`;
};

export function SharedPropertiesProvider({ children }: { children: React.ReactNode }) {
  const [properties, setPropertiesState] = useState<Property[]>([]);
  const [floors, setFloors] = useState<Floor[]>([]);
  const [isLoading, setIsLoading] = useState(false); // 🏢 CHANGE: Start false (lazy)
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // 🏢 ENTERPRISE: Lazy activation flag
  const [activated, setActivated] = useState(false);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const forceDataRefresh = useCallback(() => {
    setRefreshKey(prev => prev + 1);
  }, []);

  // 🏢 ENTERPRISE: Activate function - called by useSharedProperties
  const activate = useCallback(() => {
    if (!activated) {
      logger.info('[SharedProperties] Lazy activation triggered');
      setActivated(true);
    }
  }, [activated]);

  // Νέα συνάρτηση που αποθηκεύει στο Firestore
  const setProperties = useCallback(async (newProperties: Property[], description: string) => {
    try {
      if (DEBUG_SHARED_PROPERTIES_PROVIDER) logger.info(`Updating Firestore: ${description}`);

      // Βρίσκουμε τις διαφορές μεταξύ παλιών και νέων properties
      const oldIds = new Set(properties.map(p => p.id));
      const newIds = new Set(newProperties.map(p => p.id));

      // Properties προς διαγραφή
      const toDelete = properties.filter(p => !newIds.has(p.id));

      // Properties προς ενημέρωση/δημιουργία
      const toUpdate = newProperties.filter(p => {
        const oldProperty = properties.find(old => old.id === p.id);
        return !oldProperty || JSON.stringify(oldProperty) !== JSON.stringify(p);
      });

      // Διαγραφή
      for (const property of toDelete) {
        await deleteDoc(doc(db, COLLECTIONS.UNITS, property.id));
        logger.info(`Deleted: ${property.id}`);
      }

      // Ενημέρωση/Δημιουργία
      for (const property of toUpdate) {
        const { id, ...propertyData } = property;
        await setDoc(doc(db, COLLECTIONS.UNITS, id), propertyData);
        if (DEBUG_SHARED_PROPERTIES_PROVIDER) logger.info(`Updated/Created: ${id}`);
      }

      if (DEBUG_SHARED_PROPERTIES_PROVIDER) logger.info(`Firestore sync complete: ${description}`);
    } catch (err) {
      logger.error('Error syncing to Firestore', { error: err });
      setError('Failed to sync changes to Firestore');
    }
  }, [properties]);

  // 🏢 ENTERPRISE: Only set up listener when activated
  useEffect(() => {
    // Skip if not activated (lazy initialization)
    if (!activated) {
      return;
    }

    setIsLoading(true);
    setError(null);

    const unitsCollection = collection(db, COLLECTIONS.UNITS);
    logger.info('[SharedProperties] Setting up Firestore listener (activated)...');

    const unsubscribe = onSnapshot(
      unitsCollection,
      (snapshot) => {
        if (DEBUG_SHARED_PROPERTIES_PROVIDER) logger.info('Firestore snapshot received', { docsCount: snapshot.size });

        const propertiesData: Property[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          propertiesData.push({ id: docSnap.id, ...data } as Property);
        });

        if (propertiesData.length > 0) {
          setPropertiesState(propertiesData);

          const floorsMap = new Map<string, Floor>();
          propertiesData.forEach(property => {
            if (!property.floorId) return;
            const floorKey = property.floorId;
            if (!floorsMap.has(floorKey)) {
              const level = typeof property.floor === 'number' ? property.floor : 0;
              floorsMap.set(floorKey, {
                id: floorKey,
                name: getFloorLabel(level),
                level: level,
                buildingId: property.buildingId,
                properties: []
              });
            }
            floorsMap.get(floorKey)!.properties.push(property);
          });

          const floorsArray = Array.from(floorsMap.values()).sort((a, b) => a.level - b.level);
          setFloors(floorsArray);

          setError(null);
        } else {
          logger.warn('No properties found in Firestore snapshot');
          setPropertiesState([]);
          setFloors([]);
        }

        setIsLoading(false);
      },
      (listenerError) => {
        logger.error('Firestore listener error', { error: listenerError });
        setError('Failed to load data from Firestore.');
        setIsLoading(false);
      }
    );

    unsubscribeRef.current = unsubscribe;

    return () => {
      logger.info('[SharedProperties] Unsubscribing from Firestore listener');
      unsubscribe();
      unsubscribeRef.current = null;
    };
  }, [activated, refreshKey]);

  return (
    <SharedPropertiesContext.Provider value={{
      properties: properties || [],
      floors,
      setProperties,
      isLoading,
      error,
      forceDataRefresh,
      activate,
    }}>
      {children}
    </SharedPropertiesContext.Provider>
  );
}

/**
 * 🏢 ENTERPRISE: Hook with lazy activation
 *
 * When called, triggers the Firestore listener to activate.
 * Routes that don't use this hook won't have the listener running.
 */
export function useSharedProperties() {
  const context = useContext(SharedPropertiesContext);
  if (!context) {
    throw new Error('useSharedProperties must be used within a SharedPropertiesProvider');
  }

  // 🏢 ENTERPRISE: Trigger activation on first use
  useEffect(() => {
    context.activate();
  }, [context]);

  // Return without the activate function (internal use only)
  const { activate: _activate, ...publicContext } = context;
  return publicContext;
}