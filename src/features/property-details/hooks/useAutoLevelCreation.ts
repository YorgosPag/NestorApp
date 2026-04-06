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
  /** Call when property type changes to check if auto-creation is needed */
  triggerAutoLevelCreation: (newType: string) => void;
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
  const { t } = useTranslation(['properties']);
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
  const createLevelsForCurrentAndNext = useCallback(() => {
    const floors = floorsRef.current;
    if (!currentFloorId || currentFloorNumber == null || floors.length === 0) {
      info(t('properties:multiLevel.noBuildingOrFloor'));
      return;
    }

    const currentIdx = floors.findIndex((f) => f.id === currentFloorId);
    if (currentIdx === -1) {
      info(t('properties:multiLevel.noBuildingOrFloor'));
      return;
    }

    const nextFloor = floors[currentIdx + 1];

    if (!nextFloor) {
      // Last floor — show warning dialog
      setDialogState({ type: 'warning', pendingType: null });
      return;
    }

    // Build 2 levels: current (primary) + next
    const currentFloor = floors[currentIdx];
    const levels = buildLevelsFromSelection(
      [currentFloor, nextFloor],
      currentFloorId
    );
    const derived = deriveMultiLevelFields(levels);

    onUpdateProperty({
      levels: derived.levels,
      isMultiLevel: derived.isMultiLevel,
      floor: derived.floor,
      floorId: derived.floorId,
    });

    info(t('properties:multiLevel.autoCreated', { count: 2 }));
  }, [currentFloorId, currentFloorNumber, info, onUpdateProperty, t]);

  // ── Trigger: called on type change ──
  const triggerAutoLevelCreation = useCallback(
    (newType: string) => {
      // Don't auto-create if levels already exist
      if (hasExistingLevels) return;

      // No building/floor → can't auto-create, just inform
      if (!buildingId || !currentFloorId) {
        if (isAlwaysMultiLevelType(newType) || isOptionallyMultiLevelType(newType)) {
          info(t('properties:multiLevel.noBuildingOrFloor'));
        }
        return;
      }

      if (isAlwaysMultiLevelType(newType)) {
        createLevelsForCurrentAndNext();
      } else if (isOptionallyMultiLevelType(newType)) {
        setDialogState({ type: 'confirm', pendingType: newType });
      }
    },
    [buildingId, createLevelsForCurrentAndNext, currentFloorId, hasExistingLevels, info, t]
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
