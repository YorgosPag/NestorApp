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
import type { ProjectAddress, ProjectAddressType, BlockSideDirection } from '@/types/project/addresses';
import type { AddressWithHierarchyValue } from '@/components/shared/addresses/AddressWithHierarchy';
import { SELECT_CLEAR_VALUE } from '@/config/domain-constants';
import {
  migrateLegacyAddress,
  extractLegacyFields,
  createProjectAddress,
} from '@/types/project/address-helpers';
import { updateProjectClient } from '@/services/projects-client.service';
import { useNotifications } from '@/providers/NotificationProvider';
import { toHierarchyValue, fromHierarchyValue, EMPTY_HIERARCHY } from './location-converters';

// =============================================================================
// HOOK
// =============================================================================

export function useProjectLocations(project: Project) {
  const { success, error } = useNotifications();

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

  async function persistAddresses(newAddresses: ProjectAddress[], successMsg: string, errorMsg: string) {
    const legacy = extractLegacyFields(newAddresses);
    try {
      const result = await updateProjectClient(project.id!, {
        addresses: newAddresses,
        address: legacy.address,
        city: legacy.city,
      });
      if (result.success) {
        setLocalAddresses(newAddresses);
        success(successMsg);
        return true;
      }
      error(result.error || errorMsg);
      return false;
    } catch {
      error(errorMsg);
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
    await persistAddresses(newAddresses, 'Η κύρια διεύθυνση ενημερώθηκε επιτυχώς!', 'Σφάλμα ενημέρωσης διεύθυνσης');
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
    const ok = await persistAddresses(newAddresses, 'Η διεύθυνση διαγράφηκε επιτυχώς!', 'Σφάλμα διαγραφής διεύθυνσης');
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
    await persistAddresses(newAddresses, 'Η διεύθυνση καθαρίστηκε επιτυχώς!', 'Σφάλμα καθαρισμού διεύθυνσης');
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
      error('Παρακαλώ συμπληρώστε τουλάχιστον τον Οικισμό/Πόλη');
      return;
    }

    setIsSaving(true);
    try {
      const newAddress = createProjectAddress({
        ...addressFields,
        city: addressFields.city,
        type: addType,
        isPrimary: localAddresses.length === 0 || addIsPrimary,
        ...(addBlockSide !== SELECT_CLEAR_VALUE ? { blockSide: addBlockSide as BlockSideDirection } : {}),
        ...(addLabel ? { label: addLabel } : {}),
      });

      const newAddresses = [...localAddresses, newAddress];
      const ok = await persistAddresses(newAddresses, 'Η διεύθυνση προστέθηκε επιτυχώς!', 'Σφάλμα αποθήκευσης διεύθυνσης');
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
      error('Παρακαλώ συμπληρώστε τουλάχιστον τον Οικισμό/Πόλη');
      return;
    }

    setIsSaving(true);
    try {
      const newAddresses = localAddresses.map((addr, i) => {
        if (i !== editingIndex) return addr;
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

      const ok = await persistAddresses(newAddresses, 'Η διεύθυνση ενημερώθηκε επιτυχώς!', 'Σφάλμα ενημέρωσης διεύθυνσης');
      if (ok) handleCancelEdit();
    } finally {
      setIsSaving(false);
    }
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
    handleStartEdit,
    handleSaveEdit,
    handleCancelEdit,

    // Actions
    handleSetPrimary,
    handleMarkerClick,
    handleClearPrimaryAddress,
    handleRequestDelete,
    handleConfirmDelete,

    // Delete dialog
    deleteDialogOpen,
    setDeleteDialogOpen,
  };
}
