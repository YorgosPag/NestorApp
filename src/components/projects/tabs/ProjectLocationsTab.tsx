/* eslint-disable design-system/prefer-design-system-imports */
'use client';

import React, { useEffect } from 'react';
import type { Project } from '@/types/project';
import { SharedAddressActionCard } from '@/components/shared/addresses/SharedAddressActionCard';
import { AddressMap } from '@/components/shared/addresses/AddressMap';
import { Button } from '@/components/ui/button';
import { MapPin, Plus } from 'lucide-react';
import { DeleteConfirmDialog } from '@/components/ui/ConfirmDialog';
import { getPrimaryAddress } from '@/types/project/address-helpers';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTypography } from '@/hooks/useTypography';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useFullscreen } from '@/hooks/useFullscreen';
import { FullscreenOverlay, FullscreenToggleButton } from '@/core/containers/FullscreenOverlay';
import { cn } from '@/lib/utils';
import { LocationInlineForm } from './locations/LocationInlineForm';
import { useProjectLocations } from './locations/useProjectLocations';

// =============================================================================
// TYPES
// =============================================================================

interface ProjectLocationsTabProps {
  data: Project;
  projectId?: string;
  isEditing?: boolean;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function ProjectLocationsTab({ data: project, isEditing = false }: ProjectLocationsTabProps) {
  const { t } = useTranslation('addresses');
  const { t: tProjects } = useTranslation(['projects', 'projects-data', 'projects-ika']);
  const iconSizes = useIconSizes();
  const typography = useTypography();
  const spacing = useSpacingTokens();
  const colors = useSemanticColors();
  const fullscreen = useFullscreen();

  const loc = useProjectLocations(project);
  const _primary = getPrimaryAddress(loc.localAddresses);

  // Close open forms when global edit mode ends
  useEffect(() => {
    if (!isEditing) {
      loc.handleCancelAdd();
      loc.handleCancelEdit();
    }
  }, [isEditing]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <FullscreenOverlay
      isFullscreen={fullscreen.isFullscreen}
      onToggle={fullscreen.toggle}
      ariaLabel={t('locations.title')}
      className="grid grid-cols-1 lg:grid-cols-2 gap-2"
      fullscreenClassName="grid grid-cols-1 lg:grid-cols-2 gap-2 p-2 overflow-auto"
    >
      {/* LEFT: Toolbar + forms + address cards */}
      <div className={spacing.spaceBetween.sm}>

        {/* Toolbar: fullscreen toggle (left) + add button (right) */}
        <div className="flex items-center justify-between">
          <FullscreenToggleButton isFullscreen={fullscreen.isFullscreen} onToggle={fullscreen.toggle} />
          {isEditing && !loc.isAddFormOpen && loc.editingIndex === null && (
            <Button onClick={() => loc.setIsAddFormOpen(true)} variant="default" size="sm">
              <Plus className={cn(iconSizes.sm, spacing.margin.right.sm)} />
              {t('locations.newAddress')}
            </Button>
          )}
        </div>

        {/* Inline Add Form */}
        {isEditing && loc.isAddFormOpen && (
          <LocationInlineForm
            mode="add"
            hierarchy={loc.addHierarchy}
            onHierarchyChange={loc.setAddHierarchy}
            type={loc.addType}
            blockSide={loc.addBlockSide}
            label={loc.addLabel}
            isPrimary={loc.addIsPrimary}
            onTypeChange={loc.setAddType}
            onBlockSideChange={loc.setAddBlockSide}
            onLabelChange={loc.setAddLabel}
            onIsPrimaryChange={loc.setAddIsPrimary}
            isSaving={loc.isSaving}
            onSave={loc.handleSaveNewAddress}
            onCancel={loc.handleCancelAdd}
            t={t}
            tProjects={tProjects}
          />
        )}

        {/* Inline Edit Form */}
        {isEditing && loc.editingIndex !== null && !loc.isAddFormOpen && (
          <LocationInlineForm
            mode="edit"
            hierarchy={loc.editHierarchy}
            onHierarchyChange={loc.setEditHierarchy}
            type={loc.editType}
            blockSide={loc.editBlockSide}
            label={loc.editLabel}
            isPrimary={loc.editIsPrimary}
            onTypeChange={loc.setEditType}
            onBlockSideChange={loc.setEditBlockSide}
            onLabelChange={loc.setEditLabel}
            onIsPrimaryChange={loc.handleEditIsPrimaryChange}
            isSaving={loc.isSaving}
            onSave={loc.handleSaveEdit}
            onCancel={loc.handleCancelEdit}
            contactId={loc.localAddresses[loc.editingIndex]?.id}
            t={t}
            tProjects={tProjects}
          />
        )}

        {/* Address Cards (view mode) */}
        {!loc.isInlineFormActive && (
          <>
            {loc.localAddresses.length === 0 ? (
              <div className={cn('text-center border-2 border-dashed rounded-lg', spacing.padding.y['2xl'])}>
                <MapPin className={cn(iconSizes.xl, 'mx-auto', colors.text.muted, spacing.margin.bottom.md)} />
                <h3 className={cn(typography.heading.md, spacing.margin.bottom.sm)}>{t('locations.noAddresses')}</h3>
                <p className={cn(typography.body.sm, colors.text.muted)}>
                  {t('locations.noAddressesHint')}
                </p>
              </div>
            ) : (
              <aside className={spacing.spaceBetween.md}>
                <h3 className={typography.heading.md}>
                  {t('locations.projectAddresses')} ({loc.localAddresses.length})
                </h3>
                {loc.localAddresses.map((address, index) => {
                  const streetLine = [address.street, address.number, address.city, address.postalCode]
                    .filter(Boolean)
                    .join(', ');
                  const typeLabel = t(`types.${address.type}`);
                  const isPrimary = address.isPrimary;

                  return (
                    <SharedAddressActionCard
                      key={address.id}
                      id={address.id}
                      streetLine={streetLine}
                      typeLabel={typeLabel}
                      isPrimary={isPrimary}
                      isEditing={isEditing}
                      onEdit={() => loc.handleStartEdit(index)}
                      onSetPrimary={!isPrimary ? () => loc.handleSetPrimary(index) : undefined}
                      onClear={index === 0 ? loc.handleClearPrimaryAddress : undefined}
                      onDelete={index !== 0 ? () => loc.handleRequestDelete(index) : undefined}
                      editLabel={t('card.edit')}
                      clearLabel={tProjects('locations.clearAddress')}
                      deleteLabel={t('deleteDialog.confirm')}
                      setPrimaryLabel={tProjects('common.setAsPrimary')}
                      primaryLabel={tProjects('common.primary')}
                    />
                  );
                })}
              </aside>
            )}
          </>
        )}
      </div>

      {/* RIGHT: Map — always visible, draggable in edit mode */}
      <aside className="lg:sticky lg:top-0 lg:self-start lg:h-[calc(100vh-7rem)]">
        <AddressMap
          addresses={loc.localAddresses}
          highlightPrimary
          showGeocodingStatus
          enableClickToFocus
          onMarkerClick={loc.handleMarkerClick}
          draggableMarkers={isEditing}
          onAddressDragUpdate={loc.handleAddressDragUpdate}
          heightPreset="viewerFullscreen"
          className="rounded-lg border shadow-sm !h-full"
        />
      </aside>

      {/* Delete Confirmation */}
      <DeleteConfirmDialog
        open={loc.deleteDialogOpen}
        onOpenChange={loc.setDeleteDialogOpen}
        title={t('deleteDialog.title')}
        description={t('deleteDialog.description')}
        onConfirm={loc.handleConfirmDelete}
        confirmText={t('deleteDialog.confirm')}
        cancelText={t('deleteDialog.cancel')}
      />
    </FullscreenOverlay>
  );
}

export default ProjectLocationsTab;
