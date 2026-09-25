
'use client';

import React, { useState, useCallback, useMemo } from 'react';
// [ENTERPRISE] Using centralized entity config for Building icon
import { NAVIGATION_ENTITIES } from '@/components/navigation/config/navigation-entities';
import { useEmptyStateMessages } from '@/hooks/useEnterpriseMessages';
import type { Building } from './BuildingsPageContent';
import { BuildingDetailsHeader } from './BuildingDetails/BuildingDetailsHeader';
import { BuildingTabs } from './BuildingDetails/BuildingTabs';
import { DetailsContainer } from '@/core/containers';
import { useAuth } from '@/auth/hooks/useAuth';
import { UnifiedShareDialog } from '@/components/sharing/UnifiedShareDialog';
import { createShowcasePdfPreSubmit } from '@/components/sharing/showcase-pdf-pre-submit';
import { useDelegatedSave } from '@/hooks/useDelegatedSave';
import { useShowcaseDialog } from '@/hooks/useShowcaseDialog';


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
  /** BUG #5 deep-link — floor id to open on the Floors tab and highlight. */
  focusFloorId?: string | null;
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
  focusFloorId,
}: BuildingDetailsProps) {
  // [ENTERPRISE] Centralized messages system
  const emptyStateMessages = useEmptyStateMessages();
  const { user } = useAuth();

  // Active tab — used to hide header actions irrelevant to certain tabs.
  // A `?floor=` deep-link (BUG #5) opens the Floors tab directly.
  const [activeTab, setActiveTab] = useState(focusFloorId ? 'floors' : 'general');

  // Inline editing state — use lifted state if available, otherwise local
  const [localIsEditing, setLocalIsEditing] = useState(false);
  const isEditing = externalIsEditing ?? localIsEditing;
  const setIsEditing = onSetEditing ?? setLocalIsEditing;
  // Save delegation — GeneralTabContent registers its handleSave in saveRef
  const { saveRef, isSaving, handleSave } = useDelegatedSave();
  const showcase = useShowcaseDialog();

  const handleStartEdit = useCallback(() => {
    setIsEditing(true);
  }, []);

  const buildingShowcasePdfPreSubmit = useMemo(
    () => createShowcasePdfPreSubmit(`/api/buildings/${building?.id}/showcase/pdf`),
    [building?.id],
  );

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
    <>
      <DetailsContainer
        selectedItem={building}
        header={
          <BuildingDetailsHeader
            building={building!}
            isEditing={isEditing}
            isSaving={isSaving}
            onStartEdit={isTrashMode || activeTab !== 'general' ? undefined : handleStartEdit}
            onSave={handleSave}
            onCancel={handleCancel}
            onNewBuilding={isTrashMode ? undefined : onNewBuilding}
            onDeleteBuilding={isTrashMode ? undefined : onDeleteBuilding}
            onShowcaseBuilding={isTrashMode || !building?.id ? undefined : showcase.openDialog}
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
            onActiveTabChange={setActiveTab}
            focusFloorId={focusFloorId}
          />
        }
        onCreateAction={onNewBuilding}
        emptyStateProps={{
          icon: NAVIGATION_ENTITIES.building.icon,
          ...emptyStateMessages.building,
        }}
      />
      {building?.id && user?.companyId && user?.uid && (
        <UnifiedShareDialog
          open={showcase.open}
          onOpenChange={showcase.setOpen}
          entityType="building_showcase"
          entityId={building.id}
          entityTitle={building.name}
          companyId={user.companyId}
          preSubmit={buildingShowcasePdfPreSubmit}
        />
      )}
    </>
  );
}, (prev, next) => {
  // [PERF] Re-render when building changes (including entity links), edit state,
  // create mode, or the deep-link focus floor (BUG #5 — drives the Floors tab).
  return prev.building === next.building
    && prev.isEditing === next.isEditing
    && prev.isCreateMode === next.isCreateMode
    && prev.focusFloorId === next.focusFloorId;
});
