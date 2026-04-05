'use client';

import type { Property } from '@/types/property-viewer';
import {
  createPropertyWithPolicy,
  deletePropertyWithPolicy,
  updatePropertyWithPolicy,
} from '@/services/property/property-mutation-gateway';
import { translatePropertyMutationError } from '@/services/property/property-mutation-feedback';
import { createModuleLogger } from '@/lib/telemetry';
import { useNotifications } from '@/providers/NotificationProvider';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { usePropertyDeletionGuard } from '@/hooks/usePropertyDeletionGuard';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';

const logger = createModuleLogger('usePolygonHandlers');

interface ViewerFloorContext {
  id: string;
  name: string;
  level: number;
  buildingId: string;
}

interface UsePolygonHandlersProps {
  properties: Property[];
  floors: ViewerFloorContext[];
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
  floors,
  setProperties,
  setSelectedProperties,
  selectedFloorId,
  isConnecting,
  firstConnectionPoint,
  setIsConnecting,
  setFirstConnectionPoint,
}: UsePolygonHandlersProps) {
  const { success: notifySuccess, error: notifyError, warning } = useNotifications();
  const { t } = useTranslation('properties');
  const { requestDelete, Dialogs: PropertyDeletionDialogs } = usePropertyDeletionGuard();

  const selectedFloor = floors.find((floor) => floor.id === selectedFloorId) ?? null;

  /**
   * ADR-284 Batch 7: Client-side resolution του Project μέσω Building.projectId.
   * Mirror του server-side helper `resolveProjectIdFromBuilding` στο Batch 2.
   */
  const resolveProjectIdFromBuilding = async (buildingId: string): Promise<string | null> => {
    try {
      const snap = await getDoc(doc(db, COLLECTIONS.BUILDINGS, buildingId));
      if (!snap.exists()) return null;
      const projectId = (snap.data()?.projectId as string) ?? null;
      return projectId && projectId.trim().length > 0 ? projectId : null;
    } catch (err) {
      logger.warn('Failed to resolve projectId from Building', { buildingId, error: err });
      return null;
    }
  };

  const handlePolygonCreated = async (newPropertyData: Omit<Property, 'id'>) => {
    const floorContext = properties.find((property) => property.floorId === selectedFloorId) ?? null;
    const resolvedBuildingId = selectedFloor?.buildingId ?? floorContext?.buildingId ?? '';

    if (!selectedFloorId || !resolvedBuildingId) {
      warning(t('viewer.messages.selectFloorBeforeCreate'));
      logger.warn('Blocked viewer property creation because floor context is incomplete.', {
        selectedFloorId,
      });
      return;
    }

    // ADR-284 Batch 7: Resolve projectId from Building (required by server policy).
    const resolvedProjectId = await resolveProjectIdFromBuilding(resolvedBuildingId);
    if (!resolvedProjectId) {
      warning(t('viewer.messages.orphanBuildingBlocked'));
      logger.warn('Blocked viewer property creation: orphan Building (no projectId)', {
        buildingId: resolvedBuildingId,
      });
      return;
    }

    try {
      const result = await createPropertyWithPolicy({
        propertyData: {
          name: t('viewer.defaults.newPropertyName'),
          type: floorContext?.type ?? 'apartment',
          status: floorContext?.status ?? 'reserved',
          operationalStatus: floorContext?.operationalStatus ?? 'draft',
          // ADR-284 Batch 7: Hierarchy fields (Family A — DXF viewer is always in-building)
          projectId: resolvedProjectId,
          buildingId: resolvedBuildingId,
          building: floorContext?.building ?? '',
          floorId: selectedFloorId,
          floor: selectedFloor?.level ?? floorContext?.floor ?? 0,
          project: floorContext?.project ?? '',
          vertices: newPropertyData.vertices,
        },
      });

      if (!result.success || !result.propertyId) {
        notifyError(t('viewer.messages.createFailed'));
        return;
      }

      setSelectedProperties([result.propertyId]);
      notifySuccess(t('viewer.messages.createSuccess'));
    } catch (error) {
      notifyError(
        translatePropertyMutationError(
          error,
          t,
          'viewer.messages.createFailed',
        ),
      );
      logger.error('Failed to create property from viewer', { error });
    }
  };

  const handlePolygonUpdated = async (polygonId: string, vertices: Array<{ x: number; y: number }>) => {
    const currentProperty = properties.find((property) => property.id === polygonId);
    if (!currentProperty) {
      logger.warn('Cannot update polygon vertices because property was not found.', { polygonId });
      return;
    }

    const description = `Updated vertices for property ${polygonId}`;
    const nextProperties = properties.map((property) => (
      property.id === polygonId ? { ...property, vertices } : property
    ));

    setProperties(nextProperties, description);

    try {
      await updatePropertyWithPolicy({
        propertyId: polygonId,
        currentProperty,
        updates: { vertices },
      });
    } catch (error) {
      setProperties(properties, `Reverted vertices for property ${polygonId}`);
      notifyError(
        translatePropertyMutationError(
          error,
          t,
          'viewer.messages.updateFailed',
        ),
      );
      logger.error('Failed to persist polygon vertices', { error, polygonId });
    }
  };

  const handleDuplicate = async (propertyId: string) => {
    const sourceProperty = properties.find((property) => property.id === propertyId);
    if (!sourceProperty) {
      logger.warn('Cannot duplicate property because source property was not found.', { propertyId });
      return;
    }

    const offsetVertices = sourceProperty.vertices.map((vertex) => ({
      x: vertex.x + 12,
      y: vertex.y + 12,
    }));

    // ADR-284 Batch 7: Resolve projectId from source Building (required by server policy).
    const resolvedProjectId = sourceProperty.buildingId
      ? await resolveProjectIdFromBuilding(sourceProperty.buildingId)
      : null;
    if (!resolvedProjectId) {
      notifyError(t('viewer.messages.orphanBuildingBlocked'));
      return;
    }

    try {
      const result = await createPropertyWithPolicy({
        propertyData: {
          name: t('viewer.defaults.duplicatePropertyName', {
            name: sourceProperty.name,
          }),
          type: sourceProperty.type,
          status: 'reserved',
          operationalStatus: 'draft',
          // ADR-284 Batch 7: Hierarchy fields (Family A)
          projectId: resolvedProjectId,
          buildingId: sourceProperty.buildingId,
          building: sourceProperty.building,
          floorId: sourceProperty.floorId,
          floor: sourceProperty.floor,
          project: sourceProperty.project,
          description: sourceProperty.description,
          vertices: offsetVertices,
          area: sourceProperty.area,
          areas: sourceProperty.areas,
          layout: sourceProperty.layout,
          orientations: sourceProperty.orientations,
          condition: sourceProperty.condition,
          energy: sourceProperty.energy,
          systemsOverride: sourceProperty.systemsOverride,
          finishes: sourceProperty.finishes,
          interiorFeatures: sourceProperty.interiorFeatures,
          securityFeatures: sourceProperty.securityFeatures,
          isMultiLevel: sourceProperty.isMultiLevel,
          levels: sourceProperty.levels,
          levelData: sourceProperty.levelData,
          parentPropertyId: sourceProperty.parentPropertyId,
        },
      });

      if (!result.success || !result.propertyId) {
        notifyError(t('viewer.messages.duplicateFailed'));
        return;
      }

      setSelectedProperties([result.propertyId]);
      notifySuccess(t('viewer.messages.duplicateSuccess'));
    } catch (error) {
      notifyError(
        translatePropertyMutationError(
          error,
          t,
          'viewer.messages.duplicateFailed',
        ),
      );
      logger.error('Failed to duplicate property from viewer', { error, propertyId });
    }
  };

  const handleDelete = async (propertyId: string) => {
    const targetProperty = properties.find((property) => property.id === propertyId);
    if (!targetProperty) {
      logger.warn('Cannot delete property because target property was not found.', { propertyId });
      return;
    }

    await requestDelete(
      {
        id: targetProperty.id,
        name: targetProperty.name,
      },
      async () => {
        await deletePropertyWithPolicy({ propertyId: targetProperty.id });
        setProperties(
          properties.filter((property) => property.id !== targetProperty.id),
          `Deleted property ${targetProperty.id}`,
        );
        setSelectedProperties((previous) => previous.filter((id) => id !== targetProperty.id));
        notifySuccess(t('viewer.messages.deleteSuccess'));
      },
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
      notifyError(t('viewer.messages.updateFailed'));
    }
  };

  return {
    handlePolygonCreated,
    handlePolygonUpdated,
    handleDuplicate,
    handleDelete,
    handlePolygonSelect,
    handleUpdateProperty,
    PropertyDeletionDialogs,
  };
}
