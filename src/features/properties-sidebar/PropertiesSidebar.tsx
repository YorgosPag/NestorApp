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

import { PropertiesList } from '@/components/properties/PropertiesList';
// 🏢 ENTERPRISE: Direct imports to avoid barrel (reduces module graph)
// UniversalTabsRenderer from generic (renderer only, no mappings)
import { UniversalTabsRenderer, convertToUniversalConfig } from '@/components/generic/UniversalTabsRenderer';
// PROPERTIES_COMPONENT_MAPPING from domain-scoped file (not master barrel)
import { PROPERTIES_COMPONENT_MAPPING } from '@/components/generic/mappings/propertiesMappings';
import { getSortedPropertiesTabs } from '@/config/properties-tabs-config';
import { MobileDetailsSlideIn } from '@/core/layouts';
import { DetailsContainer } from '@/core/containers';
import { TRANSITION_PRESETS, INTERACTIVE_PATTERNS } from '@/components/ui/effects';

import { usePropertiesSidebar } from './hooks/usePropertiesSidebar';
import { PropertyDetailsHeader } from './components/PropertyDetailsHeader';
import type { PropertiesSidebarProps } from './types';
import '@/lib/design-system';

export function PropertiesSidebar({
  units,
  selectedProperty,
  viewerProps,
  setShowHistoryPanel,
  floors = [],
  onSelectProperty,
  selectedPropertyIds,
  onAssignmentSuccess,
  onNewProperty,
  onDeleteProperty,
  isCreatingNewUnit = false,
  onPropertyCreated,
  onCancelCreate,
  defaultTab,
}: PropertiesSidebarProps) {
  // 🗨️ ENTERPRISE: Centralized systems
  const { t } = useTranslation('properties');
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
  } = usePropertiesSidebar(floors, viewerProps);

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
  const { checkBeforeDelete, BlockedDialog } = useDeletionGuard('property');

  // Confirmation state for centered AlertDialog (NOT toast)
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const handleDeleteProperty = useCallback(async () => {
    if (!selectedProperty || !onDeleteProperty) return;
    const allowed = await checkBeforeDelete(selectedProperty.id);
    if (allowed) {
      setConfirmDelete(true);
    }
  }, [selectedProperty, onDeleteProperty, checkBeforeDelete]);

  const handleConfirmDelete = useCallback(async () => {
    if (!selectedProperty || !onDeleteProperty) return;
    setDeleteLoading(true);
    try {
      await onDeleteProperty(selectedProperty.id);
    } finally {
      setDeleteLoading(false);
      setConfirmDelete(false);
    }
  }, [selectedProperty, onDeleteProperty]);

  // Get units tabs from centralized config
  const propertiesTabs = getSortedPropertiesTabs();

  // Details content component using centralized DetailsContainer
  const detailsContent = (
    <DetailsContainer
      selectedItem={selectedProperty}
      header={<PropertyDetailsHeader unit={selectedProperty} isEditMode={effectiveEditMode} isCreatingNewUnit={isCreatingNewUnit} onToggleEditMode={handleToggleEditMode} onExitEditMode={handleExitEditMode} onNewProperty={onNewProperty} onDeleteProperty={handleDeleteProperty} />}
      tabsRenderer={
        <UniversalTabsRenderer
          tabs={propertiesTabs.map(convertToUniversalConfig)}
          data={selectedProperty}
          componentMapping={PROPERTIES_COMPONENT_MAPPING}
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
            onPropertyCreated,
          }}
          globalProps={{
            propertyId: selectedProperty?.id
          }}
        />
      }
      onCreateAction={onNewProperty}
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
        <PropertiesList
          units={units}
          selectedPropertyIds={selectedPropertyIds}
          onSelectProperty={onSelectProperty}
          onAssignmentSuccess={onAssignmentSuccess}
          onNewProperty={onNewProperty}
          onEditProperty={handleToggleEditMode}
          onDeleteProperty={handleDeleteProperty}
        />
        {/* 🏢 ENTERPRISE: Render details on desktop — DetailsContainer handles empty state */}
        {!isMobile && detailsContent}
      </div>

      {/* 📱 MOBILE: Show only UnitsList when no unit is selected */}
      <div className={`md:hidden w-full ${selectedProperty ? 'hidden' : 'block'}`}>
        <PropertiesList
          units={units}
          selectedPropertyIds={selectedPropertyIds}
          onSelectProperty={onSelectProperty}
          onAssignmentSuccess={onAssignmentSuccess}
          onNewProperty={onNewProperty}
          onEditProperty={handleToggleEditMode}
          onDeleteProperty={handleDeleteProperty}
        />
      </div>

      {/* 📱 MOBILE: Slide-in UnitDetails when unit is selected */}
      {/* 🏢 ENTERPRISE: Render details ONLY on mobile — prevents duplicate mount */}
      <MobileDetailsSlideIn
        isOpen={isMobile && !!selectedProperty}
        onClose={() => onSelectProperty('__none__', false)}
        title={selectedProperty?.name || t('mobile.unitDetails')}
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
        {isMobile && selectedProperty && detailsContent}
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
            {t('navigation.actions.delete.confirmMessage', { name: selectedProperty?.name })}{' '}
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

