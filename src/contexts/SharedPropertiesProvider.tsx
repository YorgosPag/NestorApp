'use client';

// DEBUG FLAG - Set to false to disable performance-heavy logging
const DEBUG_SHARED_PROPERTIES_PROVIDER = false;

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Property } from '@/types/property-viewer';

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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const forceDataRefresh = useCallback(() => {
    setRefreshKey(prev => prev + 1);
  }, []);

  // Νέα συνάρτηση που αποθηκεύει στο Firestore
  const setProperties = useCallback(async (newProperties: Property[], description: string) => {
    try {
      if (DEBUG_SHARED_PROPERTIES_PROVIDER) console.log(`🔄 Updating Firestore: ${description}`);
      
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
        await deleteDoc(doc(db, 'units', property.id));
        console.log(`❌ Deleted: ${property.id}`);
      }

      // Ενημέρωση/Δημιουργία
      for (const property of toUpdate) {
        const { id, ...propertyData } = property;
        await setDoc(doc(db, 'units', id), propertyData);
        if (DEBUG_SHARED_PROPERTIES_PROVIDER) console.log(`✅ Updated/Created: ${id}`);
      }
      
      if (DEBUG_SHARED_PROPERTIES_PROVIDER) console.log(`✅ Firestore sync complete: ${description}`);
    } catch (err) {
      console.error('❌ Error syncing to Firestore:', err);
      setError('Failed to sync changes to Firestore');
    }
  }, [properties]);

  useEffect(() => {
    setIsLoading(true);
    setError(null);

    const unitsCollection = collection(db, 'units');
    if (DEBUG_SHARED_PROPERTIES_PROVIDER) console.log('🔄 Setting up Firestore listener...');

    const unsubscribe = onSnapshot(
      unitsCollection,
      (snapshot) => {
        if (DEBUG_SHARED_PROPERTIES_PROVIDER) console.log('✅ Firestore snapshot received:', snapshot.size, 'docs');

        const propertiesData: Property[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          propertiesData.push({ id: doc.id, ...data } as Property);
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
          console.warn("⚠️ No properties found in Firestore snapshot.");
        }
        
        setIsLoading(false);
      },
      (error) => {
        console.error('❌ Firestore listener error:', error);
        setError('Failed to load data from Firestore.');
        setIsLoading(false);
      }
    );

    return () => {
      if (DEBUG_SHARED_PROPERTIES_PROVIDER) console.log('🔌 Unsubscribing from Firestore listener.');
      unsubscribe();
    };
  }, [refreshKey]);

  return (
    <SharedPropertiesContext.Provider value={{
      properties: properties || [],
      floors,
      setProperties,
      isLoading,
      error,
      forceDataRefresh,
    }}>
      {children}
    </SharedPropertiesContext.Provider>
  );
}

export function useSharedProperties() {
  const context = useContext(SharedPropertiesContext);
  if (!context) {
    throw new Error('useSharedProperties must be used within a SharedPropertiesProvider');
  }
  return context;
}