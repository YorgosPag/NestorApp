/**
 * =============================================================================
 * useAutoLevelCreation — ADR-236 Phase 4
 * =============================================================================
 *
 * Auto-creates multi-level floors when property type changes to a multi-level
 * capable type. Queries building floors from Firestore and applies levels
 * automatically (always-multi-level types) or after user confirmation
 * (optionally-multi-level types).
 *
 * @module features/property-details/hooks/useAutoLevelCreation
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import type { QueryConstraint } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import { formatFloorLabel } from '@/lib/intl-utils';
import { useAuth } from '@/auth/contexts/AuthContext';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useNotifications } from '@/providers/NotificationProvider';
import {
  isAlwaysMultiLevelType,
  isOptionallyMultiLevelType,
} from '@/config/domain-constants';
import {
  buildLevelsFromSelection,
  deriveMultiLevelFields,
} from '@/services/multi-level.service';
import type { FloorOption } from '@/services/multi-level.service';
import type { Property } from '@/types/property';

// =============================================================================
// TYPES
// =============================================================================

interface UseAutoLevelCreationParams {
  buildingId: string | null | undefined;
  currentFloorId: string | null | undefined;
  currentFloorNumber: number | null | undefined;
  /** Whether levels already exist on this property */
  hasExistingLevels: boolean;
  onUpdateProperty: (updates: Partial<Property>) => void;
}

interface AutoLevelDialogState {
  type: 'warning' | 'confirm' | null;
  pendingType: string | null;
}

interface UseAutoLevelCreationReturn {
  /** Call when property type changes to check if auto-creation is needed.
   *  Pass fresh values to avoid stale closure issues during creation. */
  triggerAutoLevelCreation: (newType: string, freshFloorId?: string | null, freshFloorNumber?: number | null) => void;
  /** Dialog state for rendering ConfirmDialog */
  dialogState: AutoLevelDialogState;
  /** Handle dialog confirm */
  handleDialogConfirm: () => void;
  /** Handle dialog dismiss */
  handleDialogDismiss: () => void;
}

// =============================================================================
// HOOK
// =============================================================================

export function useAutoLevelCreation({
  buildingId,
  currentFloorId,
  currentFloorNumber,
  hasExistingLevels,
  onUpdateProperty,
}: UseAutoLevelCreationParams): UseAutoLevelCreationReturn {
  const { t } = useTranslation(['properties-detail']);
  const { info, warning } = useNotifications();
  const { user } = useAuth();

  const [buildingFloors, setBuildingFloors] = useState<FloorOption[]>([]);
  const [dialogState, setDialogState] = useState<AutoLevelDialogState>({
    type: null,
    pendingType: null,
  });

  // Ref to prevent stale closure issues
  const floorsRef = useRef(buildingFloors);
  floorsRef.current = buildingFloors;

  // ── Firestore subscription: building floors ──
  useEffect(() => {
    if (!buildingId || !user) {
      setBuildingFloors([]);
      return;
    }

    const floorsCol = collection(db, COLLECTIONS.FLOORS);
    const constraints: QueryConstraint[] = [
      where('buildingId', '==', buildingId),
    ];

    const isSuperAdmin = user.globalRole === 'super_admin';
    if (!isSuperAdmin && user.companyId) {
      constraints.push(where('companyId', '==', user.companyId));
    }

    const q = query(floorsCol, ...constraints);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const options: FloorOption[] = snapshot.docs
          .map((doc) => {
            const data = doc.data();
            const num = typeof data.number === 'number' ? data.number : 0;
            return {
              id: doc.id,
              number: num,
              name: (data.name as string) || formatFloorLabel(num),
            };
          })
          .sort((a, b) => a.number - b.number);

        setBuildingFloors(options);
      },
      () => {
        setBuildingFloors([]);
      }
    );

    return () => unsubscribe();
  }, [buildingId, user]);

  // ── Core: create levels from current + next floor ──
  // Accepts optional fresh overrides to avoid stale closure issues during creation.
  const createLevelsForCurrentAndNext = useCallback((
    freshFloorId?: string | null,
    freshFloorNumber?: number | null,
  ) => {
    const floors = floorsRef.current;
    const effectiveFloorId = freshFloorId ?? currentFloorId;
    const effectiveFloorNumber = freshFloorNumber ?? currentFloorNumber;

    if (!effectiveFloorId || effectiveFloorNumber == null || floors.length === 0) {
      info(t('multiLevel.noBuildingOrFloor'));
      return;
    }

    const currentIdx = floors.findIndex((f) => f.id === effectiveFloorId);
    if (currentIdx === -1) {
      info(t('multiLevel.noBuildingOrFloor'));
      return;
    }

    const nextFloor = floors[currentIdx + 1];
    if (!nextFloor) {
      setDialogState({ type: 'warning', pendingType: null });
      return;
    }

    const levels = buildLevelsFromSelection(
      [floors[currentIdx], nextFloor],
      effectiveFloorId
    );
    const derived = deriveMultiLevelFields(levels);

    onUpdateProperty({
      levels: derived.levels,
      isMultiLevel: derived.isMultiLevel,
      floor: derived.floor,
      floorId: derived.floorId,
    });

    const levelsCount = levels.length;
    const msg = t('multiLevel.autoCreated', { count: levelsCount });
    // Fallback: if t() returns raw template, resolve manually
    info(msg.includes('{{') ? msg.replace('{{count}}', String(levelsCount)) : msg);
  }, [currentFloorId, currentFloorNumber, info, onUpdateProperty, t]);

  // ── Trigger: called on type/floor change ──
  // Fresh args bypass stale closures — critical for creation flow.
  const triggerAutoLevelCreation = useCallback(
    (newType: string, freshFloorId?: string | null, freshFloorNumber?: number | null) => {
      if (hasExistingLevels) return;

      const effectiveFloorId = freshFloorId ?? currentFloorId;
      if (!buildingId || !effectiveFloorId) {
        if (isAlwaysMultiLevelType(newType) || isOptionallyMultiLevelType(newType)) {
          info(t('multiLevel.noBuildingOrFloor'));
        }
        return;
      }

      if (isAlwaysMultiLevelType(newType)) {
        createLevelsForCurrentAndNext(freshFloorId, freshFloorNumber);
      } else if (isOptionallyMultiLevelType(newType)) {
        setDialogState({ type: 'confirm', pendingType: newType });
      }
    },
    [buildingId, createLevelsForCurrentAndNext, currentFloorId, hasExistingLevels, info]
  );

  // ── Dialog handlers ──
  const handleDialogConfirm = useCallback(() => {
    setDialogState({ type: null, pendingType: null });
    if (dialogState.type === 'confirm') {
      createLevelsForCurrentAndNext();
    }
    // For 'warning' type, confirm just dismisses
  }, [createLevelsForCurrentAndNext, dialogState.type]);

  const handleDialogDismiss = useCallback(() => {
    setDialogState({ type: null, pendingType: null });
  }, []);

  return {
    triggerAutoLevelCreation,
    dialogState,
    handleDialogConfirm,
    handleDialogDismiss,
  };
}
