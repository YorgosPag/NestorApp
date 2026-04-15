
'use client';

import React, { useState, useCallback, useRef } from 'react';
// [ENTERPRISE] Using centralized entity config for Building icon
import { NAVIGATION_ENTITIES } from '@/components/navigation/config/navigation-entities';
import { useEmptyStateMessages } from '@/hooks/useEnterpriseMessages';
import type { Building } from './BuildingsPageContent';
import { BuildingDetailsHeader } from './BuildingDetails/BuildingDetailsHeader';
import { BuildingTabs } from './BuildingDetails/BuildingTabs';
import { DetailsContainer } from '@/core/containers';


interface BuildingDetailsProps {
  building: Building | null;
  /** Callback to create a new building */
  onNewBuilding?: () => void;
  /** Callback to delete the current building */
  onDeleteBuilding?: () => void;
  /** Start in edit mode (for inline creation) */
  startInEditMode?: boolean;
  /** Lifted edit state from parent */
  isEditing?: boolean;
  /** Callback to update lifted edit state */
  onSetEditing?: (editing: boolean) => void;
  /** 🏢 ENTERPRISE: "Fill then Create" — form is in create mode, building not yet in Firestore */
  isCreateMode?: boolean;
  /** Callback after successful creation — receives real Firestore building ID */
  onBuildingCreated?: (buildingId: string) => void;
  /** Callback to cancel create mode — deselects the temp building */
  onCancelCreate?: () => void;
  /** Trash mode — hides edit/new/delete controls (items in trash are read-only) */
  isTrashMode?: boolean;
}

export const BuildingDetails = React.memo(function BuildingDetails({
  building,
  onNewBuilding,
  onDeleteBuilding,
  startInEditMode,
  isEditing: externalIsEditing,
  onSetEditing,
  isCreateMode,
  onBuildingCreated,
  onCancelCreate,
  isTrashMode = false,
}: BuildingDetailsProps) {
  // [ENTERPRISE] Centralized messages system
  const emptyStateMessages = useEmptyStateMessages();

  // Inline editing state — use lifted state if available, otherwise local
  const [localIsEditing, setLocalIsEditing] = useState(false);
  const isEditing = externalIsEditing ?? localIsEditing;
  const setIsEditing = onSetEditing ?? setLocalIsEditing;
  const [isSaving, setIsSaving] = useState(false);

  // Save delegation ref — GeneralTabContent registers its handleSave here
  const saveRef = useRef<(() => Promise<boolean>) | null>(null);

  const handleStartEdit = useCallback(() => {
    setIsEditing(true);
  }, []);

  const handleSave = useCallback(async () => {
    if (!saveRef.current) return;
    setIsSaving(true);
    try {
      await saveRef.current();
    } finally {
      setIsSaving(false);
    }
  }, []);

  const handleCancel = useCallback(() => {
    if (isCreateMode) {
      // 🏢 ENTERPRISE: Cancel in create mode — discard temp building entirely
      onCancelCreate?.();
    } else {
      setIsEditing(false);
    }
  }, [isCreateMode, onCancelCreate]);

  // Reset or activate edit mode when building selection changes
  React.useEffect(() => {
    setIsEditing(!!startInEditMode);
  }, [building?.id, startInEditMode]);

  return (
    <DetailsContainer
      selectedItem={building}
      header={
        <BuildingDetailsHeader
          building={building!}
          isEditing={isEditing}
          isSaving={isSaving}
          onStartEdit={isTrashMode ? undefined : handleStartEdit}
          onSave={handleSave}
          onCancel={handleCancel}
          onNewBuilding={isTrashMode ? undefined : onNewBuilding}
          onDeleteBuilding={isTrashMode ? undefined : onDeleteBuilding}
        />
      }
      tabsRenderer={
        <BuildingTabs
          building={building!}
          isEditing={isEditing}
          onEditingChange={setIsEditing}
          saveRef={saveRef}
          isCreateMode={isCreateMode}
          onBuildingCreated={onBuildingCreated}
        />
      }
      onCreateAction={onNewBuilding}
      emptyStateProps={{
        icon: NAVIGATION_ENTITIES.building.icon,
        ...emptyStateMessages.building
      }}
    />
  );
}, (prev, next) => {
  // [PERF] Re-render when building changes (including entity links), edit state, or create mode
  return prev.building === next.building
    && prev.isEditing === next.isEditing
    && prev.isCreateMode === next.isCreateMode;
});
