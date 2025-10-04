'use client';

import { useState, useEffect, useMemo, useCallback } from "react";
import { useSharedProperties } from '@/contexts/SharedPropertiesProvider';
import type { Property } from '@/types/property-viewer';

interface Floor {
  id: string;
  name: string;
  level: number;
  buildingId: string;
  properties: string[];
}

export function usePropertyState() {
  // Χρησιμοποιούμε ΜΟΝΟ τα δεδομένα από το SharedPropertiesProvider
  // για να είναι συγχρονισμένα και τα δύο systems
  const { 
    properties, 
    setProperties, 
    floors, 
    isLoading, 
    forceDataRefresh 
  } = useSharedProperties();
  
  const [selectedPropertyIds, setSelectedPropertyIds] = useState<string[]>([]);
  const [hoveredPropertyId, setHoveredPropertyId] = useState<string | null>(null);
  const [selectedFloorId, setSelectedFloorId] = useState<string | null>("floor-2");

  // Dummy undo/redo για backwards compatibility (θα τα φτιάξουμε μετά)
  const [canUndoState, setCanUndoState] = useState(false);
  const [canRedoState, setCanRedoState] = useState(false);
  
  const undo = useCallback(() => {
    console.log('Undo not yet implemented with Firestore sync');
  }, []);

  const redo = useCallback(() => {
    console.log('Redo not yet implemented with Firestore sync');
  }, []);
  
  const onHoverProperty = useCallback((propertyId: string | null) => {
    setHoveredPropertyId(propertyId);
  }, []);

  const onSelectFloor = useCallback((floorId: string | null) => {
    setSelectedFloorId(floorId);
  }, []);

  return {
    properties: properties || [],
    setProperties,
    floors: floors || [],
    isLoading,
    selectedPropertyIds,
    hoveredPropertyId,
    selectedFloorId,
    setSelectedProperties: setSelectedPropertyIds,
    onHoverProperty,
    onSelectFloor,
    undo,
    redo,
    canUndo: canUndoState,
    canRedo: canRedoState,
    forceDataRefresh,
  };
}

// Mock data για testing
export const mockProperties = [
  {
    name: "Διαμέρισμα Α1",
    type: "Διαμέρισμα 2Δ",
    status: "for-sale",
    building: "Κτίριο Alpha",
    floor: 1,
    project: "Έργο Κέντρο",
    buildingId: "building-1",
    floorId: "floor-1",
    price: 150000,
    area: 75,
    vertices: [
      { x: 100, y: 100 },
      { x: 200, y: 100 },
      { x: 200, y: 150 },
      { x: 100, y: 150 }
    ]
  },
  {
    name: "Διαμέρισμα Α2",
    type: "Διαμέρισμα 3Δ",
    status: "for-sale",
    building: "Κτίριο Alpha",
    floor: 1,
    project: "Έργο Κέντρο",
    buildingId: "building-1",
    floorId: "floor-1",
    price: 180000,
    area: 95,
    vertices: [
      { x: 220, y: 100 },
      { x: 320, y: 100 },
      { x: 320, y: 150 },
      { x: 220, y: 150 }
    ]
  },
  {
    name: "Διαμέρισμα Β1",
    type: "Διαμέρισμα 2Δ",
    status: "for-sale",
    building: "Κτίριο Alpha",
    floor: 2,
    project: "Έργο Κέντρο",
    buildingId: "building-1",
    floorId: "floor-2",
    price: 160000,
    area: 80,
    vertices: [
      { x: 100, y: 200 },
      { x: 200, y: 200 },
      { x: 200, y: 250 },
      { x: 100, y: 250 }
    ]
  }
];