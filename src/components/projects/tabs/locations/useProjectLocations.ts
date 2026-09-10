/**
 * =============================================================================
 * useProjectLocations — State & Handlers for Project Addresses
 * =============================================================================
 *
 * Manages address CRUD, inline form state (add/edit), and persistence.
 *
 * 🔑 ADR-332 D27 Βήμα Β: οι δύο φόρμες ζουν στο `useLocationFlows` (η καθεμιά με **δική της**
 * ανθρώπινη θέση, `useFormPlacedPoint`). Εδώ μένουν η λίστα, η αποθήκευση και οι πράξεις
 * πάνω σε κάρτες — και η **ίδια** διεπαφή προς τους καταναλωτές.
 *
 * @module components/projects/tabs/locations/useProjectLocations
 * @enterprise ADR-167, ADR-332
 */

import { useState, useCallback, useEffect } from 'react';
import type { Project } from '@/types/project';
import type { ProjectAddress } from '@/types/project/addresses';
import {
  migrateLegacyAddress,
  extractLegacyFields,
  createProjectAddress,
} from '@/types/project/address-helpers';
import { updateProjectWithPolicy } from '@/services/projects/project-mutation-gateway';
import { useProjectNotifications } from '@/hooks/notifications/useProjectNotifications';
import type { PinDrop } from '@/components/shared/addresses/pin-drop';
import type { AddressPositionDrift } from '@/lib/geocoding/address-position';
import { applyPinDrop, type DragApplyMode } from './location-converters';
import { useLocationAddFlow, useLocationEditFlow, type AddressOp } from './useLocationFlows';

import { revealInScroll } from '@/lib/a11y/reveal-in-scroll';

function initialAddresses(project: Project): ProjectAddress[] {
  if (project.addresses) return project.addresses;
  return project.address && project.city ? migrateLegacyAddress(project.address, project.city) : [];
}

// =============================================================================
// HOOK
// =============================================================================

export function useProjectLocations(project: Project) {
  const projectNotifications = useProjectNotifications();

  // Derive addresses from project prop
  const [localAddresses, setLocalAddresses] = useState<ProjectAddress[]>(() => initialAddresses(project));

  // Sync when project changes (forceMount keeps component alive)
  useEffect(() => {
    setLocalAddresses(initialAddresses(project));
  }, [project.id]);

  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTargetIndex, setDeleteTargetIndex] = useState<number | null>(null);
  /** Φ2β — κρατημένες ανθρώπινες πινέζες που απέχουν από τη νέα τους διεύθυνση (τελευταία αποθήκευση). */
  const [positionAdvisories, setPositionAdvisories] = useState<readonly AddressPositionDrift[]>([]);

  // ---------------------------------------------------------------------------
  // PERSISTENCE HELPER
  // ---------------------------------------------------------------------------

  async function persistAddresses(
    newAddresses: ProjectAddress[],
    op: AddressOp,
    relocateAddressIds: readonly string[] = [],
  ) {
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
          ...(relocateAddressIds.length > 0 ? { relocateAddressIds: [...relocateAddressIds] } : {}),
        },
      });
      if (result.success) {
        // 🔴 ADR-332 D27 Βήμα Β (Β5): υιοθετείται ό,τι ΕΓΡΑΨΕ ο διακομιστής (μοτίβο Apollo / Relay).
        // Με το αντίγραφο του πελάτη η κάρτα έμενε «Στον δρόμο» ως την επαναφόρτωση — ο γραφέας
        // θέσης είχε ήδη σβήσει το `geocodingMetadata` που κρατούσε εδώ το `{...addr}`.
        setLocalAddresses(result.addresses ?? newAddresses);
        setPositionAdvisories(result.positionAdvisories ?? []);
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
  // FORMS — ADR-332 D27 Βήμα Β (βλ. `useLocationFlows`)
  // ---------------------------------------------------------------------------

  const flowDeps = {
    localAddresses,
    persistAddresses,
    setIsSaving,
    notify: {
      cityRequired: () => { projectNotifications.address.cityRequired(); },
      soleAddressMustBePrimary: () => { projectNotifications.address.soleAddressMustBePrimary(); },
    },
  };
  const add = useLocationAddFlow(flowDeps);
  const edit = useLocationEditFlow(flowDeps);

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
      revealInScroll(cardElement, { urgency: 'requested', block: 'center' });
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
  // MAP DRAG (view mode) — σύρσιμο → διάλογος → αποθήκευση
  // ---------------------------------------------------------------------------

  /** ADR-332 D27 Βήμα Β: δέχεται **ολόκληρο** το σύρσιμο — και χωρίς κείμενο (⇒ μόνο θέση). */
  const handleAddressDragUpdate = async (
    drop: PinDrop,
    addressIndex: number,
    mode: DragApplyMode = 'adopt-address',
  ) => {
    if (addressIndex < 0 || addressIndex >= localAddresses.length) return;
    const newAddresses = localAddresses.map((addr, i) =>
      i !== addressIndex ? addr : applyPinDrop(addr, drop, mode)
    );
    await persistAddresses(newAddresses, 'updated');
  };

  // ---------------------------------------------------------------------------
  // ΑΠΟΚΛΙΣΗ ΠΙΝΕΖΑΣ (Φ2β) — ο άνθρωπος αποφασίζει, ο διακομιστής μόνο μετρά
  // ---------------------------------------------------------------------------

  /** «Μετακίνησε στη θέση της διεύθυνσης» — ρητή δήλωση `relocate` για ΑΥΤΗ τη διεύθυνση. */
  const handleRelocateAddress = async (addressId: string) => {
    setIsSaving(true);
    try {
      await persistAddresses(localAddresses, 'updated', [addressId]);
    } finally {
      setIsSaving(false);
    }
  };

  /** «Κράτα την πινέζα» — ο άνθρωπος ξέρει καλύτερα· η συμβουλή φεύγει, η πινέζα μένει. */
  const handleKeepAddressPin = useCallback((addressId: string) => {
    setPositionAdvisories((prev) => prev.filter((a) => a.addressId !== addressId));
  }, []);

  /**
   * 🔑 **ΤΟ ΣΗΜΕΙΟ ΠΟΥ ΤΟΠΟΘΕΤΗΣΕ Ο ΑΝΘΡΩΠΟΣ** στη φόρμα προσθήκης — μία απάντηση, δύο
   * καταναλωτές (αποθήκευση + αφετηρία εγγύτητας, ADR-332 D25).
   *
   * ⚠️ **`null` όσο η πινέζα κάθεται στη μαντεμένη θέση** — κεντροειδές, μετατόπιση 150 m, ή
   * προεπιλεγμένο κέντρο Αθήνας — **και** όσο ο άνθρωπος δεν έχει επιβεβαιώσει το σύρσιμο στον
   * διάλογο (Βήμα Β: το «Άκυρο» δεν αφήνει πια ίχνος).
   */
  const humanPlacedPoint = add.placed.point;

  return {
    localAddresses,
    isSaving,
    isInlineFormActive: add.isOpen || edit.editingIndex !== null,

    // Add
    isAddFormOpen: add.isOpen,
    handleOpenAddForm: add.open,
    pendingDragCoords: add.pendingPin,
    humanPlacedPoint,
    addPlacement: add.placed.placement,
    addHierarchy: add.form.hierarchy,
    setAddHierarchy: add.form.setHierarchy,
    addType: add.form.type,
    setAddType: add.form.setType,
    addBlockSide: add.form.blockSide,
    setAddBlockSide: add.form.setBlockSide,
    addLabel: add.form.label,
    setAddLabel: add.form.setLabel,
    addIsPrimary: add.form.isPrimary,
    setAddIsPrimary: add.form.setIsPrimary,
    handleSaveNewAddress: add.save,
    handleCancelAdd: add.cancel,

    // Edit
    editingIndex: edit.editingIndex,
    editPlacement: edit.placed.placement,
    editPlacedPoint: edit.placed.point,
    editHierarchy: edit.form.hierarchy,
    setEditHierarchy: edit.form.setHierarchy,
    editType: edit.form.type,
    setEditType: edit.form.setType,
    editBlockSide: edit.form.blockSide,
    setEditBlockSide: edit.form.setBlockSide,
    editLabel: edit.form.label,
    setEditLabel: edit.form.setLabel,
    editIsPrimary: edit.form.isPrimary,
    setEditIsPrimary: edit.form.setIsPrimary,
    handleEditIsPrimaryChange: edit.changeIsPrimary,
    handleStartEdit: edit.start,
    handleSaveEdit: edit.save,
    handleCancelEdit: edit.cancel,

    // Actions
    handleSetPrimary,
    handleMarkerClick,
    handleClearPrimaryAddress,
    handleRequestDelete,
    handleConfirmDelete,
    handleAddressDragUpdate,

    // Φ2β — απόκλιση κρατημένης πινέζας
    positionAdvisories,
    handleRelocateAddress,
    handleKeepAddressPin,

    // Delete dialog
    deleteDialogOpen,
    setDeleteDialogOpen,
  };
}

export type ProjectLocationsState = ReturnType<typeof useProjectLocations>;
