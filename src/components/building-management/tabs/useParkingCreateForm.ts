/**
 * useParkingCreateForm — η φόρμα «νέα θέση» της καρτέλας θέσεων: πεδία, πρόταση ονόματος, υποβολή.
 *
 * Εξήχθη από το `useParkingTabState` (507 γρ. > 500, N.7.1 · ADR-898 §21.6 Ε3). Η αποτυχία της υποβολής ΔΕΝ καταπίνεται:
 * πηγαίνει στον ΕΝΑ βοηθό (`MutationFailureReporter`) — π.χ. `POLICY_DUPLICATE_CODE` ⇒ μεταφρασμένο toast.
 *
 * @module components/building-management/tabs/useParkingCreateForm
 * @see ADR-184 (Building Spaces Tabs)
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useEntityNameSuggestion } from '@/hooks/useEntityNameSuggestion';
import type { MutationFailureReporter } from '@/hooks/useMutationFailureFeedback';
import type { Translate } from '@/i18n/hooks/useTranslation';
import { RealtimeService } from '@/services/realtime/RealtimeService';
import { createParkingWithPolicy } from '@/services/parking-mutation-gateway';
import { NEW_SPACE_OPERATIONAL_STATUS, type OperationalStatusDraft } from '@/lib/spaces/space-operational-draft';
import type { ParkingSpotType, ParkingLocationZone } from '@/types/parking';
import type { ParkingCreateResult } from './parking-tab-config';

interface UseParkingCreateFormParams {
  buildingId: string;
  projectId: string;
  /** Το `t` του namespace `parking` (ονόματα τύπων, μηνύματα). */
  t: Translate;
  /** Μετά από επιτυχή δημιουργία: ξαναδιάβασε τη λίστα. */
  onCreated: () => Promise<void>;
  reportFailure: MutationFailureReporter;
}

export function useParkingCreateForm({ buildingId, projectId, t, onCreated, reportFailure }: UseParkingCreateFormParams) {
  const buildName = useEntityNameSuggestion();
  const createNameManuallyChanged = useRef(false);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createNumber, setCreateNumber] = useState('');
  const [createType, setCreateType] = useState<ParkingSpotType>('standard');
  const [createStatus, setCreateStatus] = useState<OperationalStatusDraft>(NEW_SPACE_OPERATIONAL_STATUS);
  // ADR-903 §6 — ο όροφος-φιλοξενών (`''` = κανένας)· αριθμός/είδος τα παράγει ο server.
  const [createFloorId, setCreateFloorId] = useState('');
  const [createLocation, setCreateLocation] = useState('');
  const [createArea, setCreateArea] = useState('');
  const [createNotes, setCreateNotes] = useState('');
  const [createLocationZone, setCreateLocationZone] = useState<ParkingLocationZone | ''>('');
  const [creating, setCreating] = useState(false);

  // Set initial name when form opens; reset manual flag when form closes
  useEffect(() => {
    if (showCreateForm && !createNameManuallyChanged.current) {
      setCreateNumber(buildName(t('types.standard'), 0));
    }
    if (!showCreateForm) {
      createNameManuallyChanged.current = false;
    }
  // buildName is stable (useCallback inside hook); t changes only on locale switch
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCreateForm]);

  const handleCreateNumberChange = useCallback((value: string) => {
    setCreateNumber(value);
    createNameManuallyChanged.current = true;
  }, []);

  const handleCreateTypeChange = useCallback((v: ParkingSpotType) => {
    setCreateType(v);
    if (!createNameManuallyChanged.current) {
      setCreateNumber(buildName(t(`types.${v}`), parseFloat(createArea) || 0));
    }
  }, [buildName, t, createArea]);

  const handleCreateAreaChange = useCallback((value: string) => {
    setCreateArea(value);
    if (!createNameManuallyChanged.current) {
      setCreateNumber(buildName(t(`types.${createType}`), parseFloat(value) || 0));
    }
  }, [buildName, t, createType]);

  const resetCreateForm = useCallback(() => {
    setShowCreateForm(false);
    setCreateNumber('');
    createNameManuallyChanged.current = false;
    setCreateType('standard');
    setCreateStatus(NEW_SPACE_OPERATIONAL_STATUS);
    setCreateFloorId('');
    setCreateLocation('');
    setCreateArea('');
    setCreateNotes('');
    setCreateLocationZone('');
  }, []);

  const handleCreate = useCallback(async () => {
    if (!createNumber.trim()) return;
    setCreating(true);
    try {
      const result = await createParkingWithPolicy<ParkingCreateResult>({ payload: {
        number: createNumber.trim(),
        type: createType,
        operationalStatus: createStatus || undefined,
        floorId: createFloorId || undefined,
        location: createLocation.trim() || undefined,
        area: createArea ? parseFloat(createArea) : undefined,
        notes: createNotes.trim() || undefined,
        locationZone: createLocationZone || undefined,
        buildingId,
        projectId,
      }});
      if (result?.parkingSpotId) {
        RealtimeService.dispatch('PARKING_CREATED', {
          parkingSpotId: result.parkingSpotId,
          parkingSpot: {
            number: createNumber.trim(),
            buildingId,
            type: createType,
            operationalStatus: createStatus || undefined,
          },
          timestamp: Date.now(),
        });
        resetCreateForm();
        await onCreated();
      }
    } catch (err) {
      reportFailure(err, 'create', t('messages.createError'));
    } finally {
      setCreating(false);
    }
  }, [
    createNumber, createType, createStatus, createFloorId, createLocation,
    createArea, createNotes, createLocationZone,
    buildingId, projectId, resetCreateForm, onCreated, reportFailure, t,
  ]);

  return {
    showCreateForm,
    setShowCreateForm,
    createNumber, setCreateNumber,
    handleCreateNumberChange,
    handleCreateTypeChange,
    handleCreateAreaChange,
    createType, setCreateType,
    createStatus, setCreateStatus,
    createFloorId, setCreateFloorId,
    createLocation, setCreateLocation,
    createArea, setCreateArea,
    createNotes, setCreateNotes,
    createLocationZone, setCreateLocationZone,
    creating,
    resetCreateForm,
    handleCreate,
  } as const;
}
