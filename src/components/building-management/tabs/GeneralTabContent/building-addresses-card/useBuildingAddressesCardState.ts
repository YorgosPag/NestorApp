import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ProjectAddress } from '@/types/project/addresses';
import type { GeoPoint } from '@/types/geo/coordinates';
import { extractLegacyFields } from '@/types/project/address-helpers';
import { useFormPlacedPoint } from '@/components/shared/addresses/useFormPlacedPoint';
import type { AddressEditorPlacementOptions } from '@/components/shared/addresses/editor';
import type { AddressPositionDrift } from '@/lib/geocoding/address-position';
import { useNotifications } from '@/providers/NotificationProvider';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { createModuleLogger } from '@/lib/telemetry';
import { getProjectAddresses } from '../../../building-services';
import { updateBuildingWithPolicy } from '@/services/building/building-mutation-gateway';
import { revealInScroll } from '@/lib/a11y/reveal-in-scroll';
import type {
  BuildingAddressEditorMode,
  BuildingAddressesCardProps,
} from './building-addresses-card-types';
import {
  buildDeletedAddressUpdate,
  buildPrimaryAddressUpdate,
  buildProjectAddressSelection,
  createInitialBuildingAddresses,
  createManualBuildingAddress,
  getBuildingAddressCardId,
  updateManualBuildingAddress,
} from './building-addresses-card-helpers';

const logger = createModuleLogger('BuildingAddressesCard');

type ConfirmDialogProps = ReturnType<typeof useConfirmDialog>['dialogProps'];

interface UseBuildingAddressesCardStateResult {
  hasProject: boolean;
  localAddresses: ProjectAddress[];
  projectAddresses: ProjectAddress[];
  loadingProject: boolean;
  isSaving: boolean;
  selectedCount: number;
  isInlineFormActive: boolean;
  editorMode: BuildingAddressEditorMode | null;
  editorIndex: number | null;
  editorAddress: Partial<ProjectAddress> | null;
  editorDragAddress: Partial<ProjectAddress> | null;
  /** ADR-332 D27 Βήμα Β — ο συντάκτης αποθηκεύει θέση («Μόνο η θέση» + αναίρεση πινέζας). */
  editorPlacement: AddressEditorPlacementOptions;
  /** Η θέση που επιβεβαίωσε άνθρωπος στον συντάκτη — `null` αν δεν έβαλε. */
  editorPlacedPoint: GeoPoint | null;
  dialogProps: ConfirmDialogProps;
  isAddressSelected: (projectAddress: ProjectAddress) => boolean;
  openCreateEditor: () => void;
  openEditEditor: (index: number) => void;
  cancelEditor: () => void;
  setEditorAddress: (address: Partial<ProjectAddress> | null) => void;
  setEditorDragAddress: (address: Partial<ProjectAddress> | null) => void;
  saveEditor: () => Promise<void>;
  toggleProjectAddress: (projectAddress: ProjectAddress) => Promise<void>;
  setProjectPrimaryAddress: (projectAddress: ProjectAddress) => Promise<void>;
  setManualPrimaryAddress: (index: number) => Promise<void>;
  deleteManualAddress: (index: number) => Promise<void>;
  handleMarkerClick: (address: ProjectAddress) => void;
  /** Φ2β — κρατημένες ανθρώπινες πινέζες που απέχουν από τη νέα τους διεύθυνση. */
  positionAdvisories: readonly AddressPositionDrift[];
  relocateAddress: (addressId: string) => Promise<void>;
  keepAddressPin: (addressId: string) => void;
}

export function useBuildingAddressesCardState({
  buildingId,
  projectId,
  addresses,
  legacyAddress,
  legacyCity,
}: BuildingAddressesCardProps): UseBuildingAddressesCardStateResult {
  const { t } = useTranslation(['building', 'building-address', 'building-filters', 'building-storage', 'building-tabs', 'building-timeline']);
  const { success, error: notifyError } = useNotifications();
  const { confirm, dialogProps } = useConfirmDialog();
  const [localAddresses, setLocalAddresses] = useState<ProjectAddress[]>(() =>
    createInitialBuildingAddresses(addresses, legacyAddress, legacyCity)
  );
  const [projectAddresses, setProjectAddresses] = useState<ProjectAddress[]>([]);
  const [loadingProject, setLoadingProject] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editorMode, setEditorMode] = useState<BuildingAddressEditorMode | null>(null);
  const [editorIndex, setEditorIndex] = useState<number | null>(null);
  const [editorAddress, setEditorAddress] = useState<Partial<ProjectAddress> | null>(null);
  const [editorDragAddress, setEditorDragAddress] = useState<Partial<ProjectAddress> | null>(null);
  /**
   * 🔴 ADR-332 D27 Βήμα Β (Β3): ως τις 2026-09-10 το σύρσιμο κτιρίου **δεν αποθήκευε ποτέ**
   * θέση — ο συντάκτης έδινε μόνο κείμενο. Η θέση ζει εδώ επειδή **εδώ γίνεται η αποθήκευση**:
   * όποιος γράφει, κατέχει (ίδια απόφαση με το `useProjectLocations`).
   */
  const placed = useFormPlacedPoint();
  const { reset: resetPlacedPoint } = placed;
  const [positionAdvisories, setPositionAdvisories] = useState<readonly AddressPositionDrift[]>([]);

  const hasProject = Boolean(projectId);
  const selectedCount = localAddresses.length;
  const isInlineFormActive = editorMode !== null;

  useEffect(() => {
    setLocalAddresses(createInitialBuildingAddresses(addresses, legacyAddress, legacyCity));
  }, [addresses, legacyAddress, legacyCity]);

  useEffect(() => {
    if (!projectId) {
      setProjectAddresses([]);
      return;
    }

    let isCancelled = false;

    const fetchProjectAddresses = async () => {
      setLoadingProject(true);
      try {
        const result = await getProjectAddresses(projectId);
        if (!isCancelled) {
          setProjectAddresses(result.addresses);
        }
      } catch (error) {
        logger.error('Failed to fetch project addresses', { error, projectId });
      } finally {
        if (!isCancelled) {
          setLoadingProject(false);
        }
      }
    };

    void fetchProjectAddresses();

    return () => {
      isCancelled = true;
    };
  }, [projectId]);

  const persistAddresses = useCallback(async (
    nextAddresses: ProjectAddress[],
    relocateAddressIds: readonly string[] = [],
  ): Promise<boolean> => {
    const legacyFields = extractLegacyFields(nextAddresses);
    const result = await updateBuildingWithPolicy({
      buildingId,
      updates: {
        addresses: nextAddresses,
        address: legacyFields.address,
        city: legacyFields.city,
        ...(relocateAddressIds.length > 0 ? { relocateAddressIds: [...relocateAddressIds] } : {}),
      },
    });

    if (!result.success) {
      notifyError(result.error || t('address.labels.saveError'));
      return false;
    }

    // ADR-332 D27 Βήμα Β (Β5): υιοθετείται ό,τι ΕΓΡΑΨΕ ο διακομιστής, όχι το αντίγραφο του πελάτη.
    setLocalAddresses(result.addresses ?? nextAddresses);
    setPositionAdvisories(result.positionAdvisories ?? []);
    return true;
  }, [buildingId, notifyError, t]);

  /** Φ2β — «Μετακίνησε στη θέση της διεύθυνσης»: ρητή δήλωση `relocate` για ΑΥΤΗ τη διεύθυνση. */
  const relocateAddress = useCallback(async (addressId: string) => {
    setIsSaving(true);
    try {
      await persistAddresses(localAddresses, [addressId]);
    } finally {
      setIsSaving(false);
    }
  }, [localAddresses, persistAddresses]);

  /** Φ2β — «Κράτα την πινέζα»: η συμβουλή φεύγει, η πινέζα μένει. */
  const keepAddressPin = useCallback((addressId: string) => {
    setPositionAdvisories((prev) => prev.filter((a) => a.addressId !== addressId));
  }, []);

  const isAddressSelected = useCallback((projectAddress: ProjectAddress): boolean => {
    return localAddresses.some((address) => address.id === projectAddress.id);
  }, [localAddresses]);

  const resetEditor = useCallback(() => {
    setEditorMode(null);
    setEditorIndex(null);
    setEditorAddress(null);
    setEditorDragAddress(null);
    resetPlacedPoint();
  }, [resetPlacedPoint]);

  const openCreateEditor = useCallback(() => {
    setEditorMode('create');
    setEditorIndex(null);
    setEditorAddress(null);
    setEditorDragAddress(null);
    resetPlacedPoint();
  }, [resetPlacedPoint]);

  const openEditEditor = useCallback((index: number) => {
    setEditorMode('edit');
    setEditorIndex(index);
    setEditorAddress(localAddresses[index] ? { ...localAddresses[index] } : null);
    setEditorDragAddress(null);
    resetPlacedPoint();
  }, [localAddresses, resetPlacedPoint]);

  const saveEditor = useCallback(async () => {
    if (!editorAddress?.street || !editorAddress.city) {
      notifyError(t('address.validation.streetRequired'));
      return;
    }

    setIsSaving(true);
    try {
      // Θέση ΜΟΝΟ αν την επιβεβαίωσε άνθρωπος — αλλιώς ο διακομιστής λύνει το κείμενο.
      const draft = { ...editorAddress, ...placed.addressPatch };
      if (editorMode === 'create') {
        const nextAddresses = [...localAddresses, createManualBuildingAddress(draft, localAddresses.length)];
        const saved = await persistAddresses(nextAddresses);
        if (saved) {
          success(t('address.labels.addressAdded'));
          resetEditor();
        }
        return;
      }

      if (editorMode === 'edit' && editorIndex !== null) {
        const originalAddress = localAddresses[editorIndex];
        if (!originalAddress) {
          notifyError(t('address.labels.saveError'));
          return;
        }

        const nextAddresses = localAddresses.map((address, index) =>
          index === editorIndex ? updateManualBuildingAddress(originalAddress, draft) : address
        );
        const saved = await persistAddresses(nextAddresses);
        if (saved) {
          success(t('address.labels.addressUpdated'));
          resetEditor();
        }
      }
    } finally {
      setIsSaving(false);
    }
  }, [editorAddress, editorIndex, editorMode, localAddresses, notifyError, persistAddresses, placed.addressPatch, resetEditor, success, t]);

  const toggleProjectAddress = useCallback(async (projectAddress: ProjectAddress) => {
    setIsSaving(true);
    try {
      const isCurrentlySelected = isAddressSelected(projectAddress);
      const nextAddresses = buildProjectAddressSelection(localAddresses, projectAddress);
      const saved = await persistAddresses(nextAddresses);
      if (saved) {
        success(isCurrentlySelected ? t('address.labels.addressRemoved') : t('address.labels.addressLinked'));
      }
    } finally {
      setIsSaving(false);
    }
  }, [isAddressSelected, localAddresses, persistAddresses, success, t]);

  const setProjectPrimaryAddress = useCallback(async (projectAddress: ProjectAddress) => {
    const nextAddresses = buildPrimaryAddressUpdate(localAddresses, (address) => address.id === projectAddress.id);
    const saved = await persistAddresses(nextAddresses);
    if (saved) {
      success(t('address.labels.primaryUpdated'));
    }
  }, [localAddresses, persistAddresses, success, t]);

  const setManualPrimaryAddress = useCallback(async (index: number) => {
    const nextAddresses = buildPrimaryAddressUpdate(localAddresses, (_, addressIndex) => addressIndex === index);
    const saved = await persistAddresses(nextAddresses);
    if (saved) {
      success(t('address.labels.primaryUpdated'));
    }
  }, [localAddresses, persistAddresses, success, t]);

  const deleteManualAddress = useCallback(async (index: number) => {
    if (localAddresses.length === 1) {
      notifyError(t('address.labels.cannotDeleteLast'));
      return;
    }

    const confirmed = await confirm({
      title: t('address.labels.removeAddress'),
      description: t('address.labels.confirmDelete'),
      variant: 'destructive',
    });

    if (!confirmed) {
      return;
    }

    const saved = await persistAddresses(buildDeletedAddressUpdate(localAddresses, index));
    if (saved) {
      success(t('address.labels.addressDeleted'));
    }
  }, [confirm, localAddresses, notifyError, persistAddresses, success, t]);

  const handleMarkerClick = useCallback((address: ProjectAddress) => {
    const element = document.getElementById(getBuildingAddressCardId(address.id));
    if (!element) {
      return;
    }

    revealInScroll(element, { urgency: 'requested', block: 'center' });
    element.classList.add('ring-2', 'ring-primary');
    window.setTimeout(() => {
      element.classList.remove('ring-2', 'ring-primary');
    }, 2000);
  }, []);

  return useMemo(() => ({
    hasProject,
    localAddresses,
    projectAddresses,
    loadingProject,
    isSaving,
    selectedCount,
    isInlineFormActive,
    editorMode,
    editorIndex,
    editorAddress,
    editorDragAddress,
    editorPlacement: placed.placement,
    editorPlacedPoint: placed.point,
    dialogProps,
    isAddressSelected,
    openCreateEditor,
    openEditEditor,
    cancelEditor: resetEditor,
    setEditorAddress,
    setEditorDragAddress,
    saveEditor,
    toggleProjectAddress,
    setProjectPrimaryAddress,
    setManualPrimaryAddress,
    deleteManualAddress,
    handleMarkerClick,
    positionAdvisories,
    relocateAddress,
    keepAddressPin,
  }), [
    positionAdvisories,
    relocateAddress,
    keepAddressPin,
    dialogProps,
    editorAddress,
    editorDragAddress,
    editorIndex,
    editorMode,
    placed.placement,
    placed.point,
    handleMarkerClick,
    hasProject,
    isAddressSelected,
    isInlineFormActive,
    isSaving,
    loadingProject,
    localAddresses,
    openCreateEditor,
    openEditEditor,
    projectAddresses,
    resetEditor,
    saveEditor,
    selectedCount,
    setManualPrimaryAddress,
    setProjectPrimaryAddress,
    toggleProjectAddress,
    deleteManualAddress,
  ]);
}
