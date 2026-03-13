// 🌐 i18n: All labels converted to i18n keys - 2026-01-18
'use client';

import React, { useState, useCallback } from 'react';
import { Edit, Trash2 } from 'lucide-react';
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
import { useEmptyStateMessages } from '@/hooks/useEnterpriseMessages';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useLayoutClasses } from '@/hooks/useLayoutClasses';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
// 🏢 ENTERPRISE: Centralized spacing tokens
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
// 🏢 ENTERPRISE: Viewport detection for conditional rendering (avoid duplicate mount)
import { useIsMobile } from '@/hooks/useMobile';
import { useTranslation } from 'react-i18next';
// 🛡️ ADR-226: Deletion Guard (pre-check + blocked dialog)
import { useDeletionGuard } from '@/hooks/useDeletionGuard';
// 🏢 ENTERPRISE: Centralized confirmation dialog (AlertDialog, centered)
import { BuildingSpaceConfirmDialog } from '@/components/building-management/shared/BuildingSpaceConfirmDialog';

import { UnitsList } from '@/components/units/UnitsList';
// 🏢 ENTERPRISE: Direct imports to avoid barrel (reduces module graph)
// UniversalTabsRenderer from generic (renderer only, no mappings)
import { UniversalTabsRenderer, convertToUniversalConfig } from '@/components/generic/UniversalTabsRenderer';
// UNITS_COMPONENT_MAPPING from domain-scoped file (not master barrel)
import { UNITS_COMPONENT_MAPPING } from '@/components/generic/mappings/unitsMappings';
import { getSortedUnitsTabs } from '@/config/units-tabs-config';
import { MobileDetailsSlideIn } from '@/core/layouts';
import { DetailsContainer } from '@/core/containers';
import { TRANSITION_PRESETS, INTERACTIVE_PATTERNS } from '@/components/ui/effects';

import { useUnitsSidebar } from './hooks/useUnitsSidebar';
import { UnitDetailsHeader } from './components/UnitDetailsHeader';
import type { UnitsSidebarProps } from './types';

export function UnitsSidebar({
  units,
  selectedUnit,
  viewerProps,
  setShowHistoryPanel,
  floors = [],
  onSelectUnit,
  selectedUnitIds,
  onAssignmentSuccess,
  onNewUnit,
  onDeleteUnit,
  isCreatingNewUnit = false,
  onUnitCreated,
  onCancelCreate,
  defaultTab,
}: UnitsSidebarProps) {
  // 🗨️ ENTERPRISE: Centralized systems
  const { t } = useTranslation('units');
  const { quick } = useBorderTokens();
  const colors = useSemanticColors();
  const emptyStateMessages = useEmptyStateMessages();
  const iconSizes = useIconSizes();
  const layout = useLayoutClasses();
  const spacing = useSpacingTokens();

  // 🏢 ENTERPRISE: Viewport detection — render detailsContent in ONE place only
  // Without this, both Desktop and Mobile paths mount the same component tree,
  // causing duplicate API calls (BuildingSelectorCard, LinkedSpacesCard, etc.)
  const isMobile = useIsMobile();

  const {
    safeFloors,
    currentFloor,
    safeViewerPropsWithFloors,
    safeViewerProps,
  } = useUnitsSidebar(floors, viewerProps);

  // 🏢 ENTERPRISE: Edit mode state - lifted to sidebar level (Pattern A)
  const [isEditMode, setIsEditMode] = useState(false);
  // Auto-enter edit mode when creating new unit
  const effectiveEditMode = isEditMode || isCreatingNewUnit;
  const handleToggleEditMode = useCallback(() => setIsEditMode(prev => !prev), []);
  const handleExitEditMode = useCallback(() => {
    setIsEditMode(false);
    // If we were creating, cancel the creation
    if (isCreatingNewUnit && onCancelCreate) {
      onCancelCreate();
    }
  }, [isCreatingNewUnit, onCancelCreate]);

  // 🛡️ ADR-226: Deletion Guard — pre-check dependencies before allowing delete
  const { checkBeforeDelete, BlockedDialog } = useDeletionGuard('unit');

  // Confirmation state for centered AlertDialog (NOT toast)
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const handleDeleteUnit = useCallback(async () => {
    if (!selectedUnit || !onDeleteUnit) return;
    const allowed = await checkBeforeDelete(selectedUnit.id);
    if (allowed) {
      setConfirmDelete(true);
    }
  }, [selectedUnit, onDeleteUnit, checkBeforeDelete]);

  const handleConfirmDelete = useCallback(async () => {
    if (!selectedUnit || !onDeleteUnit) return;
    setDeleteLoading(true);
    try {
      await onDeleteUnit(selectedUnit.id);
    } finally {
      setDeleteLoading(false);
      setConfirmDelete(false);
    }
  }, [selectedUnit, onDeleteUnit]);

  // Get units tabs from centralized config
  const unitsTabs = getSortedUnitsTabs();

  // Details content component using centralized DetailsContainer
  const detailsContent = (
    <DetailsContainer
      selectedItem={selectedUnit}
      header={<UnitDetailsHeader unit={selectedUnit} isEditMode={effectiveEditMode} isCreatingNewUnit={isCreatingNewUnit} onToggleEditMode={handleToggleEditMode} onExitEditMode={handleExitEditMode} onNewUnit={onNewUnit} onDeleteUnit={handleDeleteUnit} />}
      tabsRenderer={
        <UniversalTabsRenderer
          tabs={unitsTabs.map(convertToUniversalConfig)}
          data={selectedUnit}
          componentMapping={UNITS_COMPONENT_MAPPING}
          defaultTab={defaultTab || "info"}
          theme="default"
          // 🏢 ENTERPRISE: i18n - Use building namespace for tab labels
          translationNamespace="building"
          additionalData={{
            safeFloors,
            currentFloor,
            safeViewerProps,
            safeViewerPropsWithFloors,
            setShowHistoryPanel,
            units,
            // 🏢 ENTERPRISE: Pass onUpdateProperty directly for PropertyDetailsContent
            // UniversalTabsRenderer spreads additionalData as props, so this is the correct pattern
            onUpdateProperty: safeViewerPropsWithFloors.handleUpdateProperty,
            // 🏢 ENTERPRISE: Edit mode state lifted to sidebar level (Pattern A - entity header)
            isEditMode: effectiveEditMode,
            onToggleEditMode: handleToggleEditMode,
            onExitEditMode: handleExitEditMode,
            // 🏢 ENTERPRISE: Inline new unit creation props
            isCreatingNewUnit,
            onUnitCreated,
          }}
          globalProps={{
            unitId: selectedUnit?.id
          }}
        />
      }
      emptyStateProps={{
        icon: NAVIGATION_ENTITIES.unit.icon,
        ...emptyStateMessages.unit
      }}
    />
  );

  return (
    <>
      {/* 🖥️ DESKTOP: Standard split layout */}
      <div className={`hidden md:flex flex-1 ${layout.listItemsGap} min-h-0 min-w-0 overflow-hidden`}>
        <UnitsList
          units={units}
          selectedUnitIds={selectedUnitIds}
          onSelectUnit={onSelectUnit}
          onAssignmentSuccess={onAssignmentSuccess}
          onNewUnit={onNewUnit}
          onEditUnit={handleToggleEditMode}
          onDeleteUnit={handleDeleteUnit}
        />
        {/* 🏢 ENTERPRISE: Render details on desktop — DetailsContainer handles empty state */}
        {!isMobile && detailsContent}
      </div>

      {/* 📱 MOBILE: Show only UnitsList when no unit is selected */}
      <div className={`md:hidden w-full ${selectedUnit ? 'hidden' : 'block'}`}>
        <UnitsList
          units={units}
          selectedUnitIds={selectedUnitIds}
          onSelectUnit={onSelectUnit}
          onAssignmentSuccess={onAssignmentSuccess}
          onNewUnit={onNewUnit}
          onEditUnit={handleToggleEditMode}
          onDeleteUnit={handleDeleteUnit}
        />
      </div>

      {/* 📱 MOBILE: Slide-in UnitDetails when unit is selected */}
      {/* 🏢 ENTERPRISE: Render details ONLY on mobile — prevents duplicate mount */}
      <MobileDetailsSlideIn
        isOpen={isMobile && !!selectedUnit}
        onClose={() => onSelectUnit('__none__', false)}
        title={selectedUnit?.name || t('mobile.unitDetails')}
        actionButtons={
          <>
            <button
              onClick={() => {/* TODO: Edit unit handler */}}
              className={`${spacing.padding.sm} rounded-md ${quick.input} ${colors.bg.primary} ${INTERACTIVE_PATTERNS.ACCENT_HOVER} ${TRANSITION_PRESETS.FAST_COLORS}`}
              aria-label={t('mobile.editUnit')}
            >
              <Edit className={iconSizes.sm} />
            </button>
            <button
              onClick={() => {/* TODO: Delete unit handler */}}
              className={`${spacing.padding.sm} rounded-md ${quick.error} ${colors.bg.primary} text-destructive ${INTERACTIVE_PATTERNS.ACCENT_HOVER} ${TRANSITION_PRESETS.FAST_COLORS}`}
              aria-label={t('mobile.deleteUnit')}
            >
              <Trash2 className={iconSizes.sm} />
            </button>
          </>
        }
      >
        {isMobile && selectedUnit && detailsContent}
      </MobileDetailsSlideIn>

      {/* 🛡️ ADR-226: Deletion Guard blocked dialog */}
      {BlockedDialog}

      {/* Centered confirmation dialog (NOT toast) */}
      <BuildingSpaceConfirmDialog
        open={confirmDelete}
        onOpenChange={(open) => { if (!open) setConfirmDelete(false); }}
        title={t('navigation.actions.delete.confirmTitle', { defaultValue: 'Διαγραφή Μονάδας' })}
        description={
          <>
            {t('navigation.actions.delete.confirmMessage', { name: selectedUnit?.name })}{' '}
            <br /><br />
            {t('navigation.actions.delete.confirmWarning', { defaultValue: 'Αυτή η ενέργεια δεν μπορεί να αναιρεθεί.' })}
          </>
        }
        confirmLabel={t('navigation.actions.delete.label', { defaultValue: 'Διαγραφή' })}
        onConfirm={handleConfirmDelete}
        loading={deleteLoading}
        variant="destructive"
      />
    </>
  );
}

