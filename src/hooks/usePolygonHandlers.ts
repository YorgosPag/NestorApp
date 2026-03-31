
'use client';

import type { Property } from '@/types/property-viewer';
import { BUILDING_IDS } from '@/config/building-ids-config';
// 🏢 ENTERPRISE: Firestore persistence for property updates
import { updateProperty } from '@/services/properties.service';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('usePolygonHandlers');

interface UsePolygonHandlersProps {
  properties: Property[];
  setProperties: (newState: Property[], description: string) => void;
  setSelectedProperties: React.Dispatch<React.SetStateAction<string[]>>;
  selectedFloorId: string;
  isConnecting: boolean;
  firstConnectionPoint: Property | null;
  setIsConnecting: (isConnecting: boolean) => void;
  setFirstConnectionPoint: (property: Property | null) => void;
}

export function usePolygonHandlers({
  properties,
  setProperties,
  setSelectedProperties,
  selectedFloorId,
  isConnecting,
  firstConnectionPoint,
  setIsConnecting,
  setFirstConnectionPoint,
}: UsePolygonHandlersProps) {

  const handlePolygonCreated = (newPropertyData: Omit<Property, 'id'>) => {
    const newProperty: Property = {
      ...newPropertyData,
      id: `prop_${Date.now()}`,
      floorId: selectedFloorId,
      name: newPropertyData.name || `Νέο Ακίνητο ${properties.length + 1}`,
      type: newPropertyData.type || 'Διαμέρισμα 2Δ',
      status: newPropertyData.status || 'for-sale',
      building: newPropertyData.building || 'Κτίριο Alpha',
      floor: newPropertyData.floor || 1,
      project: newPropertyData.project || 'Έργο Κέντρο',
      buildingId: newPropertyData.buildingId || BUILDING_IDS.LEGACY_BUILDING_1,
    };
    const description = `Created property ${newProperty.name}`;
    setProperties([...properties, newProperty], description);
  };
  
  const handlePolygonUpdated = (polygonId: string, vertices: Array<{ x: number; y: number }>) => {
    const description = `Updated vertices for property ${polygonId}`;
    setProperties(
      properties.map(p => p.id === polygonId ? { ...p, vertices } : p),
      description
    );
  };

  const handleDuplicate = (propertyId: string) => {
    const propertyToDuplicate = properties.find(p => p.id === propertyId);
    if (!propertyToDuplicate) return;

    const newProperty: Property = {
        ...propertyToDuplicate,
        id: `prop_${Date.now()}`,
        name: `${propertyToDuplicate.name} (Αντίγραφο)`,
        vertices: propertyToDuplicate.vertices.map(v => ({ x: v.x + 20, y: v.y + 20 })),
    };
    
    const description = `Duplicated property ${propertyToDuplicate.name}`;
    setProperties([...properties, newProperty], description);
  };

  const handleDelete = (propertyId: string) => {
    const description = `Deleted property ${propertyId}`;
    setProperties(
      properties.filter(p => p.id !== propertyId),
      description
    );
  };
  
  const handlePolygonSelect = (propertyId: string, isShiftClick: boolean) => {
    setSelectedProperties(prev => {
        if (!propertyId) return [];
        if (isShiftClick) {
            return prev.includes(propertyId)
                ? prev.filter(id => id !== propertyId)
                : [...prev, propertyId];
        }
        return prev.length === 1 && prev[0] === propertyId ? [] : [propertyId];
    });

    if (isConnecting && !isShiftClick) {
        const property = properties.find(p => p.id === propertyId);
        if (!property) return;
        if (!firstConnectionPoint) {
            setFirstConnectionPoint(property);
        } else {
            if (firstConnectionPoint.id === property.id) return;
            // setConnections is not available here, it should be handled where the state lives
            logger.info('Connecting properties', { fromId: firstConnectionPoint.id, toId: property.id });
            setFirstConnectionPoint(null);
            setIsConnecting(false);
        }
    }
  };
  
  const handleUpdateProperty = async (propertyId: string, updates: Partial<Property>) => {
      const description = `Updated details for property ${propertyId}`;
      // 🏢 ENTERPRISE: Update local state immediately for responsive UI
      setProperties(
          properties.map(p => p.id === propertyId ? { ...p, ...updates } : p),
          description
      );

      // 🏢 ENTERPRISE: Persist to Firestore for data durability
      try {
          await updateProperty(propertyId, updates);
      } catch (error) {
          logger.error('Failed to persist property update to Firestore', { error });
          // Note: Local state is already updated for optimistic UI
          // Consider adding rollback or notification here if needed
      }
  };


  return { handlePolygonCreated, handlePolygonUpdated, handleDuplicate, handleDelete, handlePolygonSelect, handleUpdateProperty };
}
