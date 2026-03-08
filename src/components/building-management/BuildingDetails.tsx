
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
}

export const BuildingDetails = React.memo(function BuildingDetails({
  building,
  onNewBuilding,
  onDeleteBuilding,
  startInEditMode,
  isEditing: externalIsEditing,
  onSetEditing,
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
    setIsEditing(false);
  }, []);

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
          onStartEdit={handleStartEdit}
          onSave={handleSave}
          onCancel={handleCancel}
          onNewBuilding={onNewBuilding}
          onDeleteBuilding={onDeleteBuilding}
        />
      }
      tabsRenderer={
        <BuildingTabs
          building={building!}
          isEditing={isEditing}
          onEditingChange={setIsEditing}
          saveRef={saveRef}
        />
      }
      emptyStateProps={{
        icon: NAVIGATION_ENTITIES.building.icon,
        ...emptyStateMessages.building
      }}
    />
  );
}, (prev, next) => {
  // [PERF] Only re-render when building identity changes — avoids
  // re-rendering the heavy BuildingTabs panel on unrelated parent updates.
  return prev.building?.id === next.building?.id;
});
