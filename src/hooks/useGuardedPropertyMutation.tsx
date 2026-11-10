'use client';

/**
 * useGuardedPropertyMutation — οι φυλαγμένες πράξεις ακινήτου πάνω στον φύλακα επιπτώσεων.
 *
 * 🔗 ADR-777 §8.69.13 — κάθε μέθοδος επιστρέφει `GuardResult` **αφού** τελειώσει η πράξη
 * (ή ο άνθρωπος αποφασίσει). Κανόνας καλούντα: επιτυχία **μόνο** σε `'completed'` — δες
 * `outcomeOrThrow` (`hooks/impact-guard/guard-result.ts`).
 */

import { useCallback } from 'react';
import { usePropertyMutationImpactGuard } from '@/hooks/usePropertyMutationImpactGuard';
import { GUARD_BLOCKED, type GuardResult } from '@/hooks/impact-guard/guard-result';
import { useVersionedSave } from '@/hooks/useVersionedSave';
import {
  updatePropertyWithPolicy,
  revertPropertySaleWithPolicy,
} from '@/services/property/property-mutation-gateway';

interface PropertyMutationPreviewTarget {
  readonly id: string;
  /** Η έκδοση του εγγράφου όπως φορτώθηκε (SPEC-256A) — τη χρειάζεται μόνο το {@link runVersionedPropertyUpdate}. */
  readonly _v?: unknown;
}

interface PropertyMutationCurrentState {
  readonly commercialStatus?: string | null;
  readonly buildingId?: string | null;
  readonly floorId?: string | null;
  readonly name?: string | null;
}

export function useGuardedPropertyMutation(
  property?: PropertyMutationPreviewTarget | null,
) {
  const { checking, previewBeforeMutate, reset, ImpactDialog } = usePropertyMutationImpactGuard(property);

  const runPreviewedMutation = useCallback(
    async (updates: Record<string, unknown>, action: () => Promise<void>): Promise<GuardResult> => {
      // Χωρίς ακίνητο-στόχο δεν υπάρχει τι να φυλαχτεί ΟΥΤΕ τι να γραφτεί.
      if (!property?.id) {
        return GUARD_BLOCKED;
      }

      return previewBeforeMutate(updates, action);
    },
    [previewBeforeMutate, property?.id],
  );

  const runExistingPropertyUpdate = useCallback(
    async (
      currentProperty: PropertyMutationCurrentState,
      updates: Record<string, unknown>,
      postUpdateAction?: () => Promise<void>,
    ): Promise<GuardResult> => {
      return runPreviewedMutation(updates, async () => {
        await updatePropertyWithPolicy({
          propertyId: property!.id,
          currentProperty,
          updates,
        });

        if (postUpdateAction) {
          await postUpdateAction();
        }
      });
    },
    [property, runPreviewedMutation],
  );

  // SPEC-256A — το SSoT της έκδοσης: στέλνει `_v`, την ανεβάζει στην επιτυχία, σε 409 ξαναστέλνει σιωπηλά χωρίς αυτό.
  // Με σώμα που κρατά ΜΟΝΟ ό,τι άλλαξε (ADR-249 §7), η επανάληψη είναι «τελευταία εγγραφή κερδίζει» ΑΝΑ ΠΕΔΙΟ (Figma).
  const { save: saveVersioned } = useVersionedSave<{ currentProperty: PropertyMutationCurrentState; updates: Record<string, unknown> }>({
    initialVersion: typeof property?._v === 'number' ? property._v : undefined,
    entityId: property?.id,
    saveFn: async ({ currentProperty, updates, _v }) => updatePropertyWithPolicy({
      propertyId: property!.id,
      currentProperty,
      updates: _v === undefined ? updates : { ...updates, _v },
    }),
  });

  const runVersionedPropertyUpdate = useCallback(
    async (
      currentProperty: PropertyMutationCurrentState,
      updates: Record<string, unknown>,
      postUpdateAction?: () => Promise<void>,
    ): Promise<GuardResult> => runPreviewedMutation(updates, async () => {
      await saveVersioned({ currentProperty, updates });
      if (postUpdateAction) await postUpdateAction();
    }),
    [runPreviewedMutation, saveVersioned],
  );

  const runRevertUpdate = useCallback(
    async (
      currentProperty: PropertyMutationCurrentState,
      updates: Record<string, unknown>,
      postUpdateAction?: () => Promise<void>,
    ): Promise<GuardResult> => {
      return runPreviewedMutation(updates, async () => {
        await revertPropertySaleWithPolicy({
          propertyId: property!.id,
          currentProperty,
          updates,
        });

        if (postUpdateAction) {
          await postUpdateAction();
        }
      });
    },
    [property, runPreviewedMutation],
  );

  return {
    checking,
    reset,
    ImpactDialog,
    runPreviewedMutation,
    runExistingPropertyUpdate,
    runVersionedPropertyUpdate,
    runRevertUpdate,
  };
}
