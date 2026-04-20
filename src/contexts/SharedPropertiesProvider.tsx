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
import { firestoreQueryService } from '@/services/firestore/firestore-query.service';
import { useAuth } from '@/auth/hooks/useAuth';
import type { Property } from '@/types/property-viewer';

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
  const { user, loading: authLoading } = useAuth();
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

  // Local-only state update — Firestore writes happen via API routes (Admin SDK).
  // The onSnapshot listener below picks up changes automatically.
  // Legacy callers (usePolygonHandlers, usePropertiesViewerState) still call this
  // for optimistic local updates; Firestore sync happens through the listener.
  const setProperties = useCallback((newProperties: Property[], description: string) => {
    if (DEBUG_SHARED_PROPERTIES_PROVIDER) logger.info(`Local state update: ${description}`);
    setPropertiesState(newProperties);
  }, []);

  // 🏢 ENTERPRISE: Only set up listener when activated + authenticated
  useEffect(() => {
    // Skip if not activated (lazy initialization)
    if (!activated) {
      return;
    }

    // 🔐 AUTH-READY GATING: Wait for auth state before setting up Firestore listener
    if (authLoading) {
      return;
    }

    if (!user?.companyId) {
      logger.warn('[SharedProperties] No authenticated user or missing companyId — skipping listener');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    logger.info('[SharedProperties] Setting up Firestore listener (activated)...');

    // 🏢 ADR-214 (C.5.34): subscribe via firestoreQueryService SSoT.
    // companyId auto-injected via buildTenantConstraints.
    const unsubscribe = firestoreQueryService.subscribe<Property>(
      'PROPERTIES',
      (result) => {
        if (DEBUG_SHARED_PROPERTIES_PROVIDER) logger.info('Firestore snapshot received', { docsCount: result.size });

        // ADR-281: Exclude soft-deleted properties from the live SSoT snapshot.
        // Trash view uses its own endpoint (/api/properties/trash) — never this provider.
        const propertiesData: Property[] = result.documents.filter(
          (p) => (p.status as string | undefined) !== 'deleted',
        );

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
        setError('FIRESTORE_LISTENER_ERROR');
        setIsLoading(false);
      },
    );

    unsubscribeRef.current = unsubscribe;

    return () => {
      logger.info('[SharedProperties] Unsubscribing from Firestore listener');
      unsubscribe();
      unsubscribeRef.current = null;
    };
  }, [activated, refreshKey, authLoading, user?.companyId]);

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