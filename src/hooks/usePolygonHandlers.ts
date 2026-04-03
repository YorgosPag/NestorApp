'use client';

import type { Property } from '@/types/property-viewer';
import { updatePropertyWithPolicy } from '@/services/property/property-mutation-gateway';
import { createModuleLogger } from '@/lib/telemetry';
import { useNotifications } from '@/providers/NotificationProvider';
import { useTranslation } from '@/i18n/hooks/useTranslation';

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
  selectedFloorId: _selectedFloorId,
  isConnecting,
  firstConnectionPoint,
  setIsConnecting,
  setFirstConnectionPoint,
}: UsePolygonHandlersProps) {
  void _selectedFloorId;

  const { error: notifyError, warning } = useNotifications();
  const { t } = useTranslation('properties');

  const handlePolygonCreated = (_newPropertyData: Omit<Property, 'id'>) => {
    warning(t('viewer.messages.createBlocked', {
      defaultValue: 'Property creation from the floorplan viewer is blocked until the guarded server flow is completed.',
    }));
    logger.warn('Blocked viewer property creation until guarded create flow is implemented.');
  };

  const handlePolygonUpdated = (polygonId: string, vertices: Array<{ x: number; y: number }>) => {
    const description = `Updated vertices for property ${polygonId}`;
    setProperties(
      properties.map((property) => (property.id === polygonId ? { ...property, vertices } : property)),
      description,
    );
  };

  const handleDuplicate = (propertyId: string) => {
    warning(t('viewer.messages.duplicateBlocked', {
      defaultValue: 'Property duplication from the floorplan viewer is blocked until the guarded create flow is completed.',
    }));
    logger.warn('Blocked viewer property duplication until guarded duplicate flow is implemented.', { propertyId });
  };

  const handleDelete = (propertyId: string) => {
    const description = `Deleted property ${propertyId}`;
    setProperties(
      properties.filter((property) => property.id !== propertyId),
      description,
    );
  };

  const handlePolygonSelect = (propertyId: string, isShiftClick: boolean) => {
    setSelectedProperties((previous) => {
      if (!propertyId) {
        return [];
      }
      if (isShiftClick) {
        return previous.includes(propertyId)
          ? previous.filter((id) => id !== propertyId)
          : [...previous, propertyId];
      }
      return previous.length === 1 && previous[0] === propertyId ? [] : [propertyId];
    });

    if (isConnecting && !isShiftClick) {
      const property = properties.find((item) => item.id === propertyId);
      if (!property) {
        return;
      }
      if (!firstConnectionPoint) {
        setFirstConnectionPoint(property);
      } else {
        if (firstConnectionPoint.id === property.id) {
          return;
        }
        logger.info('Connecting properties', { fromId: firstConnectionPoint.id, toId: property.id });
        setFirstConnectionPoint(null);
        setIsConnecting(false);
      }
    }
  };

  const handleUpdateProperty = async (propertyId: string, updates: Partial<Property>) => {
    const description = `Updated details for property ${propertyId}`;
    const currentProperty = properties.find((property) => property.id === propertyId);
    if (!currentProperty) {
      throw new Error(`Property ${propertyId} not found.`);
    }

    setProperties(
      properties.map((property) => (property.id === propertyId ? { ...property, ...updates } : property)),
      description,
    );

    try {
      await updatePropertyWithPolicy({
        propertyId,
        currentProperty,
        updates,
      });
    } catch (error) {
      logger.error('Failed to persist property update to Firestore', { error });
      notifyError(t('viewer.messages.updateFailed', {
        defaultValue: 'The property update could not be saved. Refresh and try again.',
      }));
    }
  };

  return {
    handlePolygonCreated,
    handlePolygonUpdated,
    handleDuplicate,
    handleDelete,
    handlePolygonSelect,
    handleUpdateProperty,
  };
}
