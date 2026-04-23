/**
 * =============================================================================
 * useProjectLocations — State & Handlers for Project Addresses
 * =============================================================================
 *
 * Manages address CRUD, inline form state (add/edit), and persistence.
 *
 * @module components/projects/tabs/locations/useProjectLocations
 * @enterprise ADR-167
 */

import { useState, useCallback, useEffect } from 'react';
import type { Project } from '@/types/project';
import type { ProjectAddress, PartialProjectAddress, ProjectAddressType, BlockSideDirection } from '@/types/project/addresses';
import type { AddressWithHierarchyValue } from '@/components/shared/addresses/AddressWithHierarchy';
import { SELECT_CLEAR_VALUE } from '@/config/domain-constants';
import {
  migrateLegacyAddress,
  extractLegacyFields,
  createProjectAddress,
} from '@/types/project/address-helpers';
import { updateProjectWithPolicy } from '@/services/projects/project-mutation-gateway';
import { useProjectNotifications } from '@/hooks/notifications/useProjectNotifications';
import { toHierarchyValue, fromHierarchyValue, EMPTY_HIERARCHY } from './location-converters';

type AddressOp = 'added' | 'updated' | 'deleted' | 'cleared' | 'primaryUpdated';

// =============================================================================
// HOOK
// =============================================================================

export function useProjectLocations(project: Project) {
  const projectNotifications = useProjectNotifications();

  // Derive addresses from project prop
  const [localAddresses, setLocalAddresses] = useState<ProjectAddress[]>(() =>
    project.addresses ||
      (project.address && project.city
        ? migrateLegacyAddress(project.address, project.city)
        : [])
  );

  // Sync when project changes (forceMount keeps component alive)
  useEffect(() => {
    const addresses = project.addresses ||
      (project.address && project.city
        ? migrateLegacyAddress(project.address, project.city)
        : []);
    setLocalAddresses(addresses);
  }, [project.id]);

  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTargetIndex, setDeleteTargetIndex] = useState<number | null>(null);

  // Add form state
  const [isAddFormOpen, setIsAddFormOpen] = useState(false);
  const [addHierarchy, setAddHierarchy] = useState<Partial<AddressWithHierarchyValue>>({});
  const [addType, setAddType] = useState<ProjectAddressType>('site');
  const [addBlockSide, setAddBlockSide] = useState<BlockSideDirection | typeof SELECT_CLEAR_VALUE>(SELECT_CLEAR_VALUE);
  const [addLabel, setAddLabel] = useState('');
  const [addIsPrimary, setAddIsPrimary] = useState(false);

  // Edit form state
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editHierarchy, setEditHierarchy] = useState<Partial<AddressWithHierarchyValue>>({});
  const [editType, setEditType] = useState<ProjectAddressType>('site');
  const [editBlockSide, setEditBlockSide] = useState<BlockSideDirection | typeof SELECT_CLEAR_VALUE>(SELECT_CLEAR_VALUE);
  const [editLabel, setEditLabel] = useState('');
  const [editIsPrimary, setEditIsPrimary] = useState(false);

  const isInlineFormActive = isAddFormOpen || editingIndex !== null;

  // ---------------------------------------------------------------------------
  // PERSISTENCE HELPER
  // ---------------------------------------------------------------------------

  async function persistAddresses(newAddresses: ProjectAddress[], op: AddressOp) {
    const legacy = extractLegacyFields(newAddresses);
    const fireSuccess = () => {
      switch (op) {
        case 'added': return projectNotifications.address.added();
        case 'updated': return projectNotifications.address.updated();
        case 'deleted': return projectNotifications.address.deleted();
        case 'cleared': return projectNotifications.address.cleared();
        case 'primaryUpdated': return projectNotifications.address.primaryUpdated();
      }
    };
    const fireError = (serverMessage?: string) => {
      switch (op) {
        case 'added': return projectNotifications.address.saveError(serverMessage);
        case 'deleted': return projectNotifications.address.deleteError(serverMessage);
        case 'cleared': return projectNotifications.address.clearError(serverMessage);
        case 'updated':
        case 'primaryUpdated':
          return projectNotifications.address.updateError(serverMessage);
      }
    };
    try {
      const result = await updateProjectWithPolicy({
        projectId: project.id!,
        updates: {
          addresses: newAddresses,
          address: legacy.address,
          city: legacy.city,
        },
      });
      if (result.success) {
        setLocalAddresses(newAddresses);
        fireSuccess();
        return true;
      }
      fireError(result.error);
      return false;
    } catch {
      fireError();
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // SET PRIMARY
  // ---------------------------------------------------------------------------

  const handleSetPrimary = async (index: number) => {
    const newAddresses = localAddresses.map((addr, i) => ({
      ...addr,
      isPrimary: i === index,
    }));
    await persistAddresses(newAddresses, 'primaryUpdated');
  };

  // ---------------------------------------------------------------------------
  // MARKER CLICK (scroll to card)
  // ---------------------------------------------------------------------------

  const handleMarkerClick = useCallback((address: ProjectAddress) => {
    const cardElement = document.getElementById(`address-card-${address.id}`);
    if (cardElement) {
      cardElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      cardElement.classList.add('ring-2', 'ring-primary');
      setTimeout(() => {
        cardElement.classList.remove('ring-2', 'ring-primary');
      }, 2000);
    }
  }, []);

  // ---------------------------------------------------------------------------
  // DELETE
  // ---------------------------------------------------------------------------

  const handleRequestDelete = (index: number) => {
    setDeleteTargetIndex(index);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (deleteTargetIndex === null) return;
    const newAddresses = localAddresses.filter((_, i) => i !== deleteTargetIndex);
    if (localAddresses[deleteTargetIndex]?.isPrimary && newAddresses.length > 0) {
      newAddresses[0].isPrimary = true;
    }
    const ok = await persistAddresses(newAddresses, 'deleted');
    if (ok) {
      setDeleteDialogOpen(false);
      setDeleteTargetIndex(null);
    }
  };

  // ---------------------------------------------------------------------------
  // CLEAR PRIMARY
  // ---------------------------------------------------------------------------

  const handleClearPrimaryAddress = async () => {
    const clearedAddress = createProjectAddress({
      city: '',
      street: '',
      type: localAddresses[0]?.type || 'site',
      isPrimary: true,
    });
    clearedAddress.id = localAddresses[0].id;
    const newAddresses = [clearedAddress, ...localAddresses.slice(1)];
    await persistAddresses(newAddresses, 'cleared');
  };

  // ---------------------------------------------------------------------------
  // ADD FORM
  // ---------------------------------------------------------------------------

  const handleCancelAdd = useCallback(() => {
    setIsAddFormOpen(false);
    setAddHierarchy({});
    setAddType('site');
    setAddBlockSide(SELECT_CLEAR_VALUE);
    setAddLabel('');
    setAddIsPrimary(false);
  }, []);

  const handleSaveNewAddress = async () => {
    const addressFields = fromHierarchyValue({ ...EMPTY_HIERARCHY, ...addHierarchy } as AddressWithHierarchyValue);
    if (!addressFields.city) {
      projectNotifications.address.cityRequired();
      return;
    }

    setIsSaving(true);
    try {
      const isNewPrimary = localAddresses.length === 0 || addIsPrimary;
      const newAddress = createProjectAddress({
        ...addressFields,
        city: addressFields.city,
        type: addType,
        isPrimary: isNewPrimary,
        ...(addBlockSide !== SELECT_CLEAR_VALUE ? { blockSide: addBlockSide as BlockSideDirection } : {}),
        ...(addLabel ? { label: addLabel } : {}),
      });

      // Demote existing primaries if new address is primary (prevents "Exactly one primary" violation)
      const baseAddresses = isNewPrimary
        ? localAddresses.map(a => ({ ...a, isPrimary: false }))
        : localAddresses;
      const newAddresses = [...baseAddresses, newAddress];
      const ok = await persistAddresses(newAddresses, 'added');
      if (ok) handleCancelAdd();
    } finally {
      setIsSaving(false);
    }
  };

  // ---------------------------------------------------------------------------
  // EDIT FORM
  // ---------------------------------------------------------------------------

  const handleStartEdit = (index: number) => {
    const addr = localAddresses[index];
    setEditingIndex(index);
    setEditHierarchy(toHierarchyValue(addr));
    setEditType(addr.type || 'site');
    setEditBlockSide(addr.blockSide || SELECT_CLEAR_VALUE);
    setEditLabel(addr.label || '');
    setEditIsPrimary(addr.isPrimary ?? false);
  };

  const handleCancelEdit = useCallback(() => {
    setEditingIndex(null);
    setEditHierarchy({});
    setEditType('site');
    setEditBlockSide(SELECT_CLEAR_VALUE);
    setEditLabel('');
    setEditIsPrimary(false);
  }, []);

  const handleSaveEdit = async () => {
    if (editingIndex === null) return;
    const addressFields = fromHierarchyValue({ ...EMPTY_HIERARCHY, ...editHierarchy } as AddressWithHierarchyValue);
    if (!addressFields.city) {
      projectNotifications.address.cityRequired();
      return;
    }

    // Guard: cannot un-mark primary when no other address exists to promote
    const otherAddressExists = localAddresses.some((_, i) => i !== editingIndex);
    if (!editIsPrimary && !otherAddressExists) {
      projectNotifications.address.soleAddressMustBePrimary();
      return;
    }

    setIsSaving(true);
    try {
      let newAddresses = localAddresses.map((addr, i) => {
        if (i !== editingIndex) {
          // Demote other primaries if edited address becomes primary
          return editIsPrimary ? { ...addr, isPrimary: false } : addr;
        }
        const { blockSide: _bs, label: _lb, ...rest } = addr;
        return {
          ...rest,
          ...addressFields,
          city: addressFields.city!,
          type: editType,
          isPrimary: editIsPrimary,
          ...(editBlockSide !== SELECT_CLEAR_VALUE ? { blockSide: editBlockSide as BlockSideDirection } : {}),
          ...(editLabel ? { label: editLabel } : {}),
        };
      });

      // Safety: if user un-marked the only primary, auto-promote first other address
      if (!newAddresses.some(a => a.isPrimary) && newAddresses.length > 0) {
        const promoteIdx = newAddresses.findIndex((_, i) => i !== editingIndex);
        const target = promoteIdx >= 0 ? promoteIdx : 0;
        newAddresses = newAddresses.map((a, i) => i === target ? { ...a, isPrimary: true } : a);
      }

      const ok = await persistAddresses(newAddresses, 'updated');
      if (ok) handleCancelEdit();
    } finally {
      setIsSaving(false);
    }
  };

  // Intercepts primary-change for edit form: blocks unchecking when this is the sole address
  const handleEditIsPrimaryChange = (val: boolean) => {
    if (!val && localAddresses.length <= 1) {
      projectNotifications.address.soleAddressMustBePrimary();
      return;
    }
    setEditIsPrimary(val);
  };

  // ---------------------------------------------------------------------------
  // MAP DRAG UPDATE — pin drag → reverse geocode → auto-save
  // ---------------------------------------------------------------------------
  const handleAddressDragUpdate = async (
    addressData: Partial<PartialProjectAddress>,
    addressIndex: number
  ) => {
    if (addressIndex < 0 || addressIndex >= localAddresses.length) return;
    const newAddresses = localAddresses.map((addr, i) =>
      i !== addressIndex ? addr : {
        ...addr,
        street: addressData.street ?? addr.street,
        city: addressData.city ?? addr.city,
        postalCode: addressData.postalCode ?? addr.postalCode,
        coordinates: addressData.coordinates ?? addr.coordinates,
        // Drag provides only reverse-geocoded coordinates — clear admin hierarchy
        region: addressData.region ?? '',
        regionalUnit: undefined,
        municipality: undefined,
        neighborhood: addressData.neighborhood ?? undefined,
      }
    );
    await persistAddresses(newAddresses, 'updated');
  };

  return {
    localAddresses,
    isSaving,
    isInlineFormActive,

    // Add
    isAddFormOpen,
    setIsAddFormOpen,
    addHierarchy,
    setAddHierarchy,
    addType,
    setAddType,
    addBlockSide,
    setAddBlockSide,
    addLabel,
    setAddLabel,
    addIsPrimary,
    setAddIsPrimary,
    handleSaveNewAddress,
    handleCancelAdd,

    // Edit
    editingIndex,
    editHierarchy,
    setEditHierarchy,
    editType,
    setEditType,
    editBlockSide,
    setEditBlockSide,
    editLabel,
    setEditLabel,
    editIsPrimary,
    setEditIsPrimary,
    handleEditIsPrimaryChange,
    handleStartEdit,
    handleSaveEdit,
    handleCancelEdit,

    // Actions
    handleSetPrimary,
    handleMarkerClick,
    handleClearPrimaryAddress,
    handleRequestDelete,
    handleConfirmDelete,
    handleAddressDragUpdate,

    // Delete dialog
    deleteDialogOpen,
    setDeleteDialogOpen,
  };
}
