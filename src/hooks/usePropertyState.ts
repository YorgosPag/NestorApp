'use client';

import { useState, useCallback } from "react";
import { useSharedProperties } from '@/contexts/SharedPropertiesProvider';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('usePropertyState');

interface Floor {
  id: string;
  name: string;
  level: number;
  buildingId: string;
  properties: string[];
}

export function usePropertyState() {
  // Ξ§ΟΞ·ΟƒΞΉΞΌΞΏΟ€ΞΏΞΉΞΏΟΞΌΞµ ΞΞΞΞ Ο„Ξ± Ξ΄ΞµΞ΄ΞΏΞΌΞ­Ξ½Ξ± Ξ±Ο€Ο Ο„ΞΏ SharedPropertiesProvider
  // Ξ³ΞΉΞ± Ξ½Ξ± ΞµΞ―Ξ½Ξ±ΞΉ ΟƒΟ…Ξ³Ο‡ΟΞΏΞ½ΞΉΟƒΞΌΞ­Ξ½Ξ± ΞΊΞ±ΞΉ Ο„Ξ± Ξ΄ΟΞΏ systems
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

  // Dummy undo/redo Ξ³ΞΉΞ± backwards compatibility (ΞΈΞ± Ο„Ξ± Ο†Ο„ΞΉΞ¬ΞΎΞΏΟ…ΞΌΞµ ΞΌΞµΟ„Ξ¬)
  const [canUndoState, setCanUndoState] = useState(false);
  const [canRedoState, setCanRedoState] = useState(false);
  
  const undo = useCallback(() => {
    logger.info('Undo not yet implemented with Firestore sync');
  }, []);

  const redo = useCallback(() => {
    logger.info('Redo not yet implemented with Firestore sync');
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
