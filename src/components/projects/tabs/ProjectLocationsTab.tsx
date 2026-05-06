/* eslint-disable design-system/prefer-design-system-imports */
'use client';

import React, { useCallback, useMemo, useRef, useState } from 'react';
import type { Project } from '@/types/project';
import type { ProjectAddress, PartialProjectAddress, ProjectAddressType } from '@/types/project/addresses';
import { SharedAddressActionCard } from '@/components/shared/addresses/SharedAddressActionCard';
import { ADDRESS_TYPE_KEYS, isUniqueAddressType } from './locations/address-constants';
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
import { AddressDragConfirmDialog } from '@/components/shared/addresses/editor';
import type { AddressEditorHandle, ResolvedAddressFields } from '@/components/shared/addresses/editor';

// =============================================================================
// HELPERS
// =============================================================================

function toResolvedFields(addr: Partial<PartialProjectAddress>): ResolvedAddressFields {
  return {
    street: addr.street || undefined,
    number: addr.number || undefined,
    postalCode: addr.postalCode || undefined,
    city: addr.city || undefined,
    neighborhood: addr.neighborhood || undefined,
    region: addr.region || undefined,
  };
}

interface PendingViewDrag {
  addressData: Partial<PartialProjectAddress>;
  originalIndex: number;
}

// =============================================================================
// TYPES
// =============================================================================

interface ProjectLocationsTabProps {
  data: Project;
  projectId?: string;
  /** Ignored — this tab uses always-on inline editing (no global edit toggle). */
  isEditing?: boolean;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function ProjectLocationsTab({ data: project }: ProjectLocationsTabProps) {
  // Inline-only editing: New Address button and per-card actions are always
  // available. The header Edit toggle is hidden for this tab (project-details).
  const isEditing = true;
  const { t } = useTranslation('addresses');
  const { t: tProjects } = useTranslation(['projects', 'projects-data', 'projects-ika']);
  const iconSizes = useIconSizes();
  const typography = useTypography();
  const spacing = useSpacingTokens();
  const colors = useSemanticColors();
  const fullscreen = useFullscreen();

  const loc = useProjectLocations(project);
  const _primary = getPrimaryAddress(loc.localAddresses);

  // ADR-332 Phase 7: editor refs for drag → confirm dialog
  const addEditorRef = useRef<AddressEditorHandle>(null);
  const editEditorRef = useRef<AddressEditorHandle>(null);
  const [pendingViewDrag, setPendingViewDrag] = useState<PendingViewDrag | null>(null);
  const [undoRedoCount, setUndoRedoCount] = useState(0);
  const handleUndoRedo = useCallback(() => setUndoRedoCount(n => n + 1), []);

  // Ghost addresses (street='' AND city='') are produced by handleClearPrimaryAddress
  // to preserve the isPrimary slot. Filter them out of view-mode list AND map —
  // otherwise edit mode places a fallback pin at the Athens default center.
  const visibleAddresses = useMemo(
    () => loc.localAddresses
      .map((address, originalIndex) => ({ address, originalIndex }))
      .filter(({ address }) => !((address.street ?? '') === '' && (address.city ?? '') === '')),
    [loc.localAddresses],
  );

  // Unique address types already in use. `other` is excluded from this set so
  // that it can be picked multiple times.
  const usedUniqueTypes = useMemo(
    () => new Set(
      visibleAddresses
        .map(({ address }) => address.type)
        .filter(isUniqueAddressType),
    ),
    [visibleAddresses],
  );

  // Add form: drop unique types already used. `other` always remains.
  const availableTypesForAdd = useMemo<readonly ProjectAddressType[]>(
    () => ADDRESS_TYPE_KEYS.filter(t => !isUniqueAddressType(t) || !usedUniqueTypes.has(t)),
    [usedUniqueTypes],
  );

  // Edit form: drop unique types already used by OTHER addresses, but always
  // keep the type currently assigned to the address being edited so the
  // dropdown can render its current selection.
  const editingType = loc.editingIndex !== null
    ? loc.localAddresses[loc.editingIndex]?.type
    : undefined;
  const availableTypesForEdit = useMemo<readonly ProjectAddressType[]>(
    () => ADDRESS_TYPE_KEYS.filter(t =>
      !isUniqueAddressType(t) || !usedUniqueTypes.has(t) || t === editingType,
    ),
    [usedUniqueTypes, editingType],
  );

  // Pending address: draggable preview pin shown while the add form is open.
  // Appended to the real (non-ghost) addresses so AddressMap renders it as a pulsating draggable marker.
  const PENDING_ID = '__pending_new__';

  // The address whose pin shows amber + bounce (the one currently in the form).
  const activeEditingAddressId = useMemo<string | undefined>(() => {
    if (loc.isAddFormOpen) return PENDING_ID;
    if (loc.editingIndex !== null) return loc.localAddresses[loc.editingIndex]?.id;
    return undefined;
  }, [loc.isAddFormOpen, loc.editingIndex, loc.localAddresses]);

  // When a form is open, freeze every pin except the one being worked on.
  // Add form → only PENDING_ID is draggable; real pins are locked.
  // Edit form → only the address being edited is draggable; others are locked.
  // View mode (no form) → all draggable (existing view-drag + confirm flow).
  const readOnlyAddressIds = useMemo<Set<string> | undefined>(() => {
    if (loc.isAddFormOpen) {
      return new Set(visibleAddresses.map(({ address }) => address.id));
    }
    if (loc.editingIndex !== null) {
      const editingId = loc.localAddresses[loc.editingIndex]?.id;
      if (!editingId) return undefined;
      return new Set(
        visibleAddresses
          .filter(({ address }) => address.id !== editingId)
          .map(({ address }) => address.id),
      );
    }
    return undefined;
  }, [loc.isAddFormOpen, loc.editingIndex, loc.localAddresses, visibleAddresses]);
  const mapAddresses = useMemo<ProjectAddress[]>(() => {
    const real = visibleAddresses.map(({ address }) => address);
    if (!loc.isAddFormOpen || !loc.pendingDragCoords) return real;
    return [
      ...real,
      {
        id: PENDING_ID,
        street: '',
        city: '',
        postalCode: '',
        country: 'Greece',
        type: 'site' as const,
        isPrimary: false,
        coordinates: loc.pendingDragCoords,
      },
    ];
  }, [loc.isAddFormOpen, loc.pendingDragCoords, visibleAddresses]);

  // ADR-332 Phase 7: drag → AddressDragConfirmDialog (no silent overwrite).
  // Pending pin → update coords only + show add-form confirm dialog.
  // Real pin + edit form open → show edit-form confirm dialog.
  // Real pin + view mode → local confirm dialog via pendingViewDrag state.
  const handleCombinedDragUpdate = useCallback(async (
    addressData: Partial<PartialProjectAddress>,
    index: number,
  ) => {
    const realCount = visibleAddresses.length;
    if (loc.isAddFormOpen && index >= realCount) {
      // Update pin position only (not form fields — confirmed by dialog)
      loc.handlePendingDragUpdate({ coordinates: addressData.coordinates });
      addEditorRef.current?.setPendingDrag(toResolvedFields(addressData));
      return;
    }
    const originalIndex = visibleAddresses[index]?.originalIndex ?? index;
    if (loc.editingIndex !== null) {
      editEditorRef.current?.setPendingDrag(toResolvedFields(addressData));
    } else {
      setPendingViewDrag({ addressData, originalIndex });
    }
  }, [loc.isAddFormOpen, loc.editingIndex, visibleAddresses, loc.handlePendingDragUpdate]);

  const handleViewDragConfirm = useCallback(async () => {
    if (!pendingViewDrag) return;
    await loc.handleAddressDragUpdate(pendingViewDrag.addressData, pendingViewDrag.originalIndex);
    setPendingViewDrag(null);
  }, [pendingViewDrag, loc.handleAddressDragUpdate]);

  const handleViewDragCancel = useCallback(() => {
    setPendingViewDrag(null);
    setUndoRedoCount(n => n + 1);
  }, []);

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
            <Button onClick={loc.handleOpenAddForm} variant="default" size="sm">
              <Plus className={cn(iconSizes.sm, spacing.margin.right.sm)} />
              {t('locations.newAddress')}
            </Button>
          )}
        </div>

        {/* Inline Add Form — ref routes map drag to confirm dialog */}
        {isEditing && loc.isAddFormOpen && (
          <LocationInlineForm
            ref={addEditorRef}
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
            onUndoRedo={handleUndoRedo}
            t={t}
            tProjects={tProjects}
            availableTypes={availableTypesForAdd}
          />
        )}

        {/* Inline Edit Form — ref routes map drag to confirm dialog */}
        {isEditing && loc.editingIndex !== null && !loc.isAddFormOpen && (
          <LocationInlineForm
            ref={editEditorRef}
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
            onUndoRedo={handleUndoRedo}
            t={t}
            availableTypes={availableTypesForEdit}
            tProjects={tProjects}
          />
        )}

        {/* Address Cards (view mode) */}
        {!loc.isInlineFormActive && (
          <>
            {visibleAddresses.length === 0 ? (
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
                  {t('locations.projectAddresses')} ({visibleAddresses.length})
                </h3>
                {visibleAddresses.map(({ address, originalIndex }) => {
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
                      onEdit={() => loc.handleStartEdit(originalIndex)}
                      onSetPrimary={!isPrimary ? () => loc.handleSetPrimary(originalIndex) : undefined}
                      onClear={originalIndex === 0 ? loc.handleClearPrimaryAddress : undefined}
                      onDelete={originalIndex !== 0 ? () => loc.handleRequestDelete(originalIndex) : undefined}
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

      {/* RIGHT: Map — always visible, draggable in edit mode.
          Draggable only when there is something to drag (real address or pending add).
          Disables AddressMap's empty-list fallback marker so no ghost Athens pin
          appears when entering edit mode with zero addresses. */}
      <aside className="lg:sticky lg:top-0 lg:self-start lg:h-[calc(100vh-7rem)]">
        <AddressMap
          addresses={mapAddresses}
          highlightPrimary
          showGeocodingStatus
          enableClickToFocus
          onMarkerClick={loc.handleMarkerClick}
          draggableMarkers={isEditing && mapAddresses.length > 0}
          onAddressDragUpdate={handleCombinedDragUpdate}
          readOnlyAddressIds={readOnlyAddressIds}
          activeEditingAddressId={activeEditingAddressId}
          dragResetKey={undoRedoCount}
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

      {/* View-mode drag confirm — fires when real pin dragged with no form open */}
      {pendingViewDrag !== null && (
        <AddressDragConfirmDialog
          open
          currentAddress={toResolvedFields(
            visibleAddresses.find(({ originalIndex }) => originalIndex === pendingViewDrag.originalIndex)?.address ?? {},
          )}
          newAddress={toResolvedFields(pendingViewDrag.addressData)}
          onConfirm={() => { void handleViewDragConfirm(); }}
          onCancel={handleViewDragCancel}
        />
      )}
    </FullscreenOverlay>
  );
}

export default ProjectLocationsTab;
