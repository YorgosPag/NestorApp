'use client';

import * as React from 'react';
import type { Property } from '@/types/property-viewer';
import type { FloorData, ViewerPassthroughProps } from '../types';
import { useGuardedPropertyMutation } from '@/hooks/useGuardedPropertyMutation';
import { createModuleLogger } from '@/lib/telemetry';
import { useNotifications } from '@/providers/NotificationProvider';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { translatePropertyMutationError } from '@/services/property/property-mutation-feedback';

const logger = createModuleLogger('usePropertiesSidebar');

export function usePropertiesSidebar(
  floors: FloorData[] | undefined,
  viewerProps: ViewerPassthroughProps | null | undefined,
  selectedProperty: Property | null | undefined,
) {
  const { t } = useTranslation('properties');
  const { success, error: notifyError } = useNotifications();
  const safeFloors = Array.isArray(floors) ? floors : [];
  const safeViewerProps = viewerProps || {};
  const safeProperties = Array.isArray(safeViewerProps.properties)
    ? safeViewerProps.properties as Property[]
    : [];
  const safeSelectedFloorId = safeViewerProps.selectedFloorId as string | undefined;
  const { runExistingPropertyUpdate, ImpactDialog } = useGuardedPropertyMutation(selectedProperty);

  const currentFloor = React.useMemo(
    () => safeFloors.find((floor) => floor.id === safeSelectedFloorId) || null,
    [safeFloors, safeSelectedFloorId],
  );

  const handleUpdateProperty = React.useCallback(async (propertyId: string, updates: Partial<Property>) => {
    try {
      logger.info('[DEBUG ADR-232] handleUpdateProperty CALLED', {
        propertyId,
        updateKeys: Object.keys(updates),
        hasFloorId: 'floorId' in updates,
      });

      const currentProperty = safeProperties.find((property) => property.id === propertyId);
      if (!currentProperty) {
        throw new Error(`Property ${propertyId} not found in sidebar context.`);
      }

      await runExistingPropertyUpdate(currentProperty, updates);
      success(t('viewer.messages.updateSuccess', {
        defaultValue: 'Property changes were saved.',
      }));
      logger.info(`Property ${propertyId} updated in Firestore:`, { data: Object.keys(updates) });
    } catch (error) {
      logger.error(`Failed to persist property update to Firestore: ${error instanceof Error ? error.message : String(error)}`);
      notifyError(translatePropertyMutationError(error, t));
      throw error;
    }
  }, [notifyError, runExistingPropertyUpdate, safeProperties, success, t]);

  const safeViewerPropsWithFloors = React.useMemo(() => ({
    ...safeViewerProps,
    floors: safeFloors,
    currentFloor,
    handleUpdateProperty,
  }), [currentFloor, handleUpdateProperty, safeFloors, safeViewerProps]);

  return {
    safeFloors,
    currentFloor,
    safeViewerPropsWithFloors,
    safeViewerProps,
    handleUpdateProperty,
    ImpactDialog,
  };
}
