'use client';

/**
 * =============================================================================
 * SPEC-237D: Floorplan Import State Machine
 * =============================================================================
 *
 * 6-step wizard: Company → Project → Building → Floor → Unit → Upload
 *
 * Steps 2-4 offer a "shortcut" floorplan card: user can upload a floorplan
 * at project/building/floor level without going deeper. Clicking the card
 * sets floorplanType and jumps to step 6 (upload).
 *
 * Step 5 is the unit selector (with level radio for multi-level units).
 *
 * Οι λίστες των βημάτων 1-4 ζουν στο `useFloorplanImportCascade`· η ρύθμιση ανεβάσματος στο
 * `utils/floorplan-upload-config` (split N.7.1, ADR-914 §8.18).
 *
 * @module features/floorplan-import/hooks/useFloorplanImportState
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '@/auth/hooks/useAuth';
import { useFirestoreProperties } from '@/hooks/useFirestoreProperties';
import type { FloorplanUploadConfig } from '@/hooks/useFloorplanUpload';
import { useFloorplanImportCascade } from './useFloorplanImportCascade';
import { buildFloorplanUploadConfig } from '../utils/floorplan-upload-config';
import { propertiesOnFloor } from '@/lib/properties/floor-helpers';

import {
  type FloorplanType,
  type FloorplanImportSelection,
  type EntityOption,
  type UseFloorplanImportStateReturn,
  type UseFloorplanImportStateOptions,
  type PropertyItem,
  INITIAL_SELECTION,
  TOTAL_STEPS,
} from './floorplan-import-types';

// Re-export types for backward compatibility
export type { FloorplanType, FloorplanImportSelection, EntityOption, UseFloorplanImportStateReturn };

// =============================================================================
// HOOK
// =============================================================================

export function useFloorplanImportState(
  options: UseFloorplanImportStateOptions
): UseFloorplanImportStateReturn {
  const { isOpen } = options;
  const { user, loading: authLoading } = useAuth();

  // ── Step state ──
  const [step, setStep] = useState(1);
  const [selection, setSelection] = useState<FloorplanImportSelection>(INITIAL_SELECTION);

  // ── Open epoch: increments each time wizard opens → forces fresh data fetch ──
  const [openEpoch, setOpenEpoch] = useState(0);
  const prevOpenRef = useRef(false);

  // ── Λίστες των βημάτων 1-4 (auth + open guard: καμία κλήση πριν γίνει γνωστός ο χρήστης) ──
  const isReady = isOpen && !authLoading && !!user;
  const { items: stepItems, loading: stepLoading, clearAll } = useFloorplanImportCascade({
    isReady, step, selection, openEpoch,
  });

  // Detect open transitions: closed→open increments epoch and resets state
  useEffect(() => {
    if (isOpen && !prevOpenRef.current) {
      setOpenEpoch((e) => e + 1);
      setStep(1);
      setSelection(INITIAL_SELECTION);
      clearAll();
    }
    prevOpenRef.current = isOpen;
  }, [isOpen, clearAll]);

  // ── Units via existing hook (step 5) ──
  // ADR-914 §2.20 — τα ακίνητα του ΚΤΙΡΙΟΥ, και «ποια πιάνουν τον όροφο» το απαντά ο ένας κανόνας
  // (`propertiesOnFloor`, ADR-329 §3.7.1). Το `floorId ==` του διακομιστή ταιριάζει μόνο τον ΚΥΡΙΟ
  // όροφο: ο όροφος του δεύτερου επιπέδου μιας μεζονέτας έβγαινε άδειος.
  const { properties: buildingUnits, loading: unitLoading } = useFirestoreProperties({
    buildingId: selection.buildingId ?? undefined,
    autoFetch: !!selection.buildingId && step === 5,
  });

  const rawUnits = useMemo(
    () => (selection.floorId ? propertiesOnFloor(selection.floorId, buildingUnits) : buildingUnits),
    [selection.floorId, buildingUnits],
  );

  const unitItems: EntityOption[] = rawUnits.map((u: PropertyItem) => ({
    id: u.id,
    label: u.name,
  }));

  // ── Multi-level unit detection (ADR-236) ──
  const selectedProperty = rawUnits.find((u: PropertyItem) => u.id === selection.propertyId) as PropertyItem | undefined;
  const selectedPropertyIsMultiLevel = !!(selectedProperty?.isMultiLevel && selectedProperty.levels && selectedProperty.levels.length >= 2);

  const unitLevelItems: EntityOption[] = useMemo(() => {
    if (!selectedPropertyIsMultiLevel || !selectedProperty?.levels) return [];
    return [...selectedProperty.levels]
      .sort((a, b) => a.floorNumber - b.floorNumber)
      .map((level) => ({
        id: level.floorId,
        label: level.name,
      }));
  }, [selectedPropertyIsMultiLevel, selectedProperty?.levels]);

  // ===========================================================================
  // SELECTION HANDLERS
  // ===========================================================================

  const handleSelectEntity = useCallback((id: string) => {
    // Η λίστα είναι πάντα του τρέχοντος βήματος — το όνομα διαβάζεται από εκεί.
    const label = stepItems.find((item) => item.id === id)?.label ?? null;
    setSelection((prev) => {
      switch (step) {
        case 1:
          return { ...INITIAL_SELECTION, companyId: id, companyName: label };
        case 2:
          return {
            ...prev, projectId: id, projectName: label,
            buildingId: null, buildingName: null, floorId: null, floorName: null,
            floorplanType: null, propertyId: null, propertyName: null, levelFloorId: null, levelName: null,
          };
        case 3:
          return {
            ...prev, buildingId: id, buildingName: label,
            floorId: null, floorName: null, floorplanType: null,
            propertyId: null, propertyName: null, levelFloorId: null, levelName: null,
          };
        case 4:
          return {
            ...prev, floorId: id, floorName: label,
            floorplanType: null, propertyId: null, propertyName: null, levelFloorId: null, levelName: null,
          };
        default:
          return prev;
      }
    });
  }, [step, stepItems]);

  const selectProperty = useCallback((id: string) => {
    const property = rawUnits.find((u) => u.id === id);
    setSelection((prev) => {
      // Πολυεπίπεδη μονάδα: ο άνθρωπος διάλεξε ήδη όροφο στο βήμα 4 — το επίπεδό της εκεί είναι
      // η προεπιλογή, όχι δεύτερη ερώτηση. Μπορεί να την αλλάξει.
      const levelOnFloor = property?.isMultiLevel
        ? property.levels?.find((level) => level.floorId === prev.floorId)
        : undefined;
      return {
        ...prev, propertyId: id, propertyName: property?.name ?? null,
        floorplanType: 'property',
        levelFloorId: levelOnFloor?.floorId ?? null, levelName: levelOnFloor?.name ?? null,
      };
    });
  }, [rawUnits]);

  const selectLevel = useCallback((floorId: string) => {
    const label = unitLevelItems.find((l) => l.id === floorId)?.label ?? null;
    setSelection((prev) => ({ ...prev, levelFloorId: floorId, levelName: label }));
  }, [unitLevelItems]);

  // ===========================================================================
  // SHORTCUT: Jump to upload from steps 2-4
  // ===========================================================================

  const jumpToUpload = useCallback((type: FloorplanType) => {
    setSelection((prev) => ({
      ...prev,
      floorplanType: type,
      ...(type === 'project' ? { buildingId: null, buildingName: null, floorId: null, floorName: null, propertyId: null, propertyName: null } : {}),
      ...(type === 'building' ? { floorId: null, floorName: null, propertyId: null, propertyName: null } : {}),
      ...(type === 'floor' ? { propertyId: null, propertyName: null } : {}),
      levelFloorId: null, levelName: null,
    }));
    setStep(6);
  }, []);

  // ===========================================================================
  // CONTINUE DEEPER (load mode: step 6 → next entity level)
  // ===========================================================================

  const continueDeeper = useCallback(() => {
    if (step !== 6) return;
    const nextStep = ((): number | null => {
      switch (selection.floorplanType) {
        case 'project': return 3;
        case 'building': return 4;
        case 'floor': return 5;
        default: return null;
      }
    })();
    if (nextStep === null) return;
    setSelection((prev) => ({ ...prev, floorplanType: null }));
    setStep(nextStep);
  }, [step, selection.floorplanType]);

  const canContinueDeeper =
    step === 6 &&
    (selection.floorplanType === 'project' ||
      selection.floorplanType === 'building' ||
      selection.floorplanType === 'floor');

  // ===========================================================================
  // NAVIGATION
  // ===========================================================================

  const canProceed = (() => {
    switch (step) {
      case 1: return !!selection.companyId;
      case 2: return !!selection.projectId;
      case 3: return !!selection.buildingId;
      case 4: return !!selection.floorId;
      case 5: {
        if (!selection.propertyId) return false;
        if (selectedPropertyIsMultiLevel && !selection.levelFloorId) return false;
        return true;
      }
      case 6: return true;
      default: return false;
    }
  })();

  const handleNext = useCallback(() => {
    if (canProceed && step < TOTAL_STEPS) {
      if (step === 5) {
        setSelection((prev) => ({ ...prev, floorplanType: 'property' }));
      }
      setStep((prev) => prev + 1);
    }
  }, [canProceed, step]);

  const handleBack = useCallback(() => {
    if (step > 1) {
      if (step === 6 && selection.floorplanType === 'project') {
        setStep(2);
      } else if (step === 6 && selection.floorplanType === 'building') {
        setStep(3);
      } else if (step === 6 && selection.floorplanType === 'floor') {
        setStep(4);
      } else {
        setStep((prev) => prev - 1);
      }
    }
  }, [step, selection.floorplanType]);

  const goToStep = useCallback((targetStep: number) => {
    if (targetStep >= 1 && targetStep < step) {
      setStep(targetStep);
    }
  }, [step]);

  // ===========================================================================
  // UPLOAD CONFIG (step 6)
  // ===========================================================================

  const uploadConfig: FloorplanUploadConfig | null = step === 6 ? buildFloorplanUploadConfig(selection, user) : null;

  // ===========================================================================
  // RESET
  // ===========================================================================

  const reset = useCallback(() => {
    setStep(1);
    setSelection(INITIAL_SELECTION);
    clearAll();
  }, [clearAll]);

  // ===========================================================================
  // RETURN
  // ===========================================================================

  return {
    step,
    handleNext,
    handleBack,
    goToStep,
    canProceed,

    selection,
    selectEntity: handleSelectEntity,
    selectProperty,
    jumpToUpload,
    continueDeeper,
    canContinueDeeper,

    currentStepItems: stepItems,
    currentStepLoading: stepLoading,
    currentStepEmpty: !stepLoading && stepItems.length === 0 && step <= 4,

    uploadConfig,
    reset,

    unitItems,
    unitLoading,

    selectedPropertyIsMultiLevel,
    unitLevelItems,
    selectLevel,
  };
}
