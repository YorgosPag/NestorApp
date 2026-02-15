
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
}

export function BuildingDetails({ building }: BuildingDetailsProps) {
  // [ENTERPRISE] Centralized messages system
  const emptyStateMessages = useEmptyStateMessages();

  // Inline editing state (lifted from GeneralTabContent for header coordination)
  const [isEditing, setIsEditing] = useState(false);
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

  // Reset editing state when building selection changes
  React.useEffect(() => {
    setIsEditing(false);
  }, [building?.id]);

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
}
