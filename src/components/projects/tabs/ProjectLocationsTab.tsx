/* eslint-disable design-system/prefer-design-system-imports */
'use client';

/**
 * =============================================================================
 * ProjectLocationsTab — Project address management (ADR-167)
 * =============================================================================
 *
 * Dedicated tab for managing project locations and addresses.
 * Pattern: Procore, Salesforce, SAP Real Estate (INLINE EDITING)
 *
 * Address action buttons (add/edit/delete) are gated by the global
 * "Επεξεργασία" button via the isEditing prop — same pattern as contacts.
 *
 * @module components/projects/tabs/ProjectLocationsTab
 * @enterprise Fortune 500-grade locations management
 */

import React from 'react';
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

  const loc = useProjectLocations(project);
  const _primary = getPrimaryAddress(loc.localAddresses);

  return (
    <section className={spacing.spaceBetween.lg}>
      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <h2 className={cn(typography.heading.lg, 'flex items-center', spacing.gap.sm)}>
            <MapPin className={iconSizes.lg} />
            {t('locations.title')}
          </h2>
          <p className={cn(typography.body.sm, colors.text.muted, spacing.margin.top.xs)}>
            {t('locations.subtitle')}
          </p>
        </div>
        {isEditing && !loc.isAddFormOpen && (
          <Button onClick={() => loc.setIsAddFormOpen(true)} variant="default">
            <Plus className={cn(iconSizes.sm, spacing.margin.right.sm)} />
            {t('locations.newAddress')}
          </Button>
        )}
      </header>

      {/* Inline Add Form — only accessible when isEditing */}
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

      {/* Inline Edit Form — only accessible when isEditing */}
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

      {/* Address Cards + Map (view mode) */}
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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
              {/* LEFT: Address Cards */}
              <aside className={spacing.spaceBetween.md}>
                <div className="flex items-center justify-between">
                  <h3 className={typography.heading.md}>
                    {t('locations.projectAddresses')} ({loc.localAddresses.length})
                  </h3>
                </div>

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

              {/* RIGHT: Map (desktop) */}
              <aside className="hidden lg:block">
                <div className="sticky top-0 h-[calc(100vh-12rem)]">
                  <AddressMap
                    addresses={loc.localAddresses}
                    highlightPrimary
                    showGeocodingStatus
                    enableClickToFocus
                    onMarkerClick={loc.handleMarkerClick}
                    heightPreset="viewerFullscreen"
                    className="rounded-lg border shadow-sm !h-full"
                  />
                </div>
              </aside>

              {/* Map (mobile) */}
              <div className="lg:hidden">
                <AddressMap
                  addresses={loc.localAddresses}
                  highlightPrimary
                  showGeocodingStatus
                  enableClickToFocus
                  onMarkerClick={loc.handleMarkerClick}
                  heightPreset="viewerStandard"
                  className="rounded-lg border shadow-sm"
                />
              </div>
            </div>
          )}
        </>
      )}

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
    </section>
  );
}

export default ProjectLocationsTab;
