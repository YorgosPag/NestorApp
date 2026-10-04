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
import { isDraftEntityId } from '@/lib/draft-entity-id';
import type { ProjectDraftAddresses } from '@/components/projects/draft/useProjectDraftAddresses';
import type { Project } from '@/types/project';
import type { ProjectAddress } from '@/types/project/addresses';
import {
  migrateLegacyAddress,
  createProjectAddress,
} from '@/types/project/address-helpers';
import { updateProjectWithPolicy } from '@/services/projects/project-mutation-gateway';
import { useProjectNotifications } from '@/hooks/notifications/useProjectNotifications';
import type { PinDrop } from '@/components/shared/addresses/pin-drop';
import type { AddressPositionDrift } from '@/lib/geocoding/address-position';
import { applyPinDrop, type DragApplyMode } from './location-converters';
import { useLocationAddFlow, useLocationEditFlow, type AddressOp } from './useLocationFlows';

import { revealInScroll } from '@/lib/a11y/reveal-in-scroll';
import { useAddressPositionSettlement } from '@/hooks/useAddressPositionSettlement';
import { getProjectAddresses } from '@/components/building-management/building-services';
import { RealtimeService, type ProjectUpdatedPayload } from '@/services/realtime';

/** Οι διευθύνσεις του έργου όπως είναι **τώρα** στον διακομιστή (ο ένας αναγνώστης, κοινός με τα κτίρια). */
async function readProjectAddresses(projectId: string): Promise<ProjectAddress[]> {
  return (await getProjectAddresses(projectId)).addresses;
}

function initialAddresses(project: Project): ProjectAddress[] {
  if (project.addresses) return project.addresses;
  return project.address && project.city ? migrateLegacyAddress(project.address, project.city) : [];
}

// =============================================================================
// HOOK
// =============================================================================

/**
 * @param draft Το πρόχειρο του «Fill then Create» (`useProjectDraftAddresses`). Όσο το έργο δεν
 *   έχει αποθηκευτεί, κάθε πράξη γράφει **εκεί** και όχι στον διακομιστή — οι διευθύνσεις
 *   φεύγουν μαζί με τη δημιουργία, σε μία πράξη.
 */
export function useProjectLocations(project: Project, draft?: ProjectDraftAddresses) {
  const projectNotifications = useProjectNotifications();
  const isDraft = isDraftEntityId(project.id);

  // Derive addresses from project prop
  // Το πρόχειρο προηγείται όσο ΑΝΗΚΕΙ σε αυτή την ταυτότητα: στο ίδιο το «Νέο», και αμέσως μετά
  // τη δημιουργία (η «Γενικά» το μεταβιβάζει με ό,τι ΕΓΡΑΨΕ ο διακομιστής — η σύνοψη της λίστας
  // δεν έχει ακόμη διευθύνσεις, και η καρτέλα θα άδειαζε τη στιγμή που το έργο αποθηκεύτηκε).
  const readAddresses = () =>
    draft?.belongsTo(project.id) ? draft.get() : initialAddresses(project);

  const [localAddresses, setLocalAddresses] = useState<ProjectAddress[]>(readAddresses);

  // Sync when project changes (forceMount keeps component alive)
  useEffect(() => {
    setLocalAddresses(readAddresses());
  }, [project.id]);

  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTargetIndex, setDeleteTargetIndex] = useState<number | null>(null);
  /** Φ2β — κρατημένες ανθρώπινες πινέζες που απέχουν από τη νέα τους διεύθυνση (τελευταία αποθήκευση). */
  const [positionAdvisories, setPositionAdvisories] = useState<readonly AddressPositionDrift[]>([]);

  // ---------------------------------------------------------------------------
  // ΘΕΣΗ ΠΟΥ ΟΛΟΚΛΗΡΩΝΕΤΑΙ ΜΕΤΑ ΤΗΝ ΑΠΟΘΗΚΕΥΣΗ (ADR-332 D29)
  // ---------------------------------------------------------------------------

  /**
   * Ο διακομιστής απάντησε μέσα στην προθεσμία και συνεχίζει να εντοπίζει τη θέση. Μόλις γραφτεί,
   * υιοθετείται εδώ — και διαδίδεται, ώστε η μνήμη του έργου και οι άλλες σελίδες να συμφωνούν.
   */
  const adoptSettledAddresses = useCallback((settled: ProjectAddress[]) => {
    setLocalAddresses(settled);
    if (draft?.belongsTo(project.id)) draft.set(settled);
    if (!project.id) return;
    RealtimeService.dispatch('PROJECT_UPDATED', {
      projectId: project.id,
      updates: { addresses: settled } as ProjectUpdatedPayload['updates'],
      timestamp: Date.now(),
    });
  }, [draft, project.id]);

  const pendingPositions = useAddressPositionSettlement({
    entityId: isDraft ? undefined : project.id,
    addresses: localAddresses,
    read: readProjectAddresses,
    onSettled: adoptSettledAddresses,
  });

  // ---------------------------------------------------------------------------
  // PERSISTENCE HELPER
  // ---------------------------------------------------------------------------

  async function persistAddresses(
    newAddresses: ProjectAddress[],
    op: AddressOp,
    relocateAddressIds: readonly string[] = [],
  ) {
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
    // «Fill then Create»: το έργο δεν υπάρχει ακόμη ⇒ δεν υπάρχει τι να ενημερωθεί. Η πράξη
    // γράφεται στο πρόχειρο και φεύγει ΜΑΖΙ με τη δημιουργία. Χωρίς ειδοποίηση «αποθηκεύτηκε»:
    // δεν αποθηκεύτηκε — το λέει η μόνιμη σήμανση της καρτέλας.
    if (isDraft) {
      draft?.set(newAddresses);
      setLocalAddresses(newAddresses);
      return true;
    }
    try {
      const result = await updateProjectWithPolicy({
        projectId: project.id!,
        updates: {
          // ADR-332 D27 Β11: το κάτοπτρο `address`/`city` το παράγει ο διακομιστής από ό,τι ΓΡΑΦΕΙ
          // (`legacyAddressMirror`). Εδώ φτιαχνόταν από τη γραφή ΠΡΙΝ το `trim` του συνόρου.
          addresses: newAddresses,
          ...(relocateAddressIds.length > 0 ? { relocateAddressIds: [...relocateAddressIds] } : {}),
        },
      });
      if (result.success) {
        // 🔴 ADR-332 D27 Βήμα Β (Β5): υιοθετείται ό,τι ΕΓΡΑΨΕ ο διακομιστής (μοτίβο Apollo / Relay).
        // Με το αντίγραφο του πελάτη η κάρτα έμενε «Στον δρόμο» ως την επαναφόρτωση — ο γραφέας
        // θέσης είχε ήδη σβήσει το `geocodingMetadata` που κρατούσε εδώ το `{...addr}`.
        const written = result.addresses ?? newAddresses;
        setLocalAddresses(written);
        // Αν το πρόχειρο κατέχει ακόμη αυτή την ταυτότητα (έργο που μόλις γεννήθηκε), μένει
        // συγχρονισμένο — αλλιώς ένα remount της καρτέλας θα έδειχνε τη στιγμή της δημιουργίας.
        if (draft?.belongsTo(project.id)) draft.set(written);
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
    /** Το έργο δεν αποθηκεύτηκε ακόμη — οι διευθύνσεις ζουν στο πρόχειρο. */
    isDraft,
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

    // ADR-332 D29 — θέσεις που εντοπίζονται ακόμη (ή αναβλήθηκαν) μετά την αποθήκευση
    pendingPositions,

    // Delete dialog
    deleteDialogOpen,
    setDeleteDialogOpen,
  };
}

export type ProjectLocationsState = ReturnType<typeof useProjectLocations>;
