'use client';

/**
 * @fileoverview **Ο ΕΝΑΣ κάτοχος της ενεργειακής απάντησης στη φόρμα του γραφείου** (ADR-777 §8.102.1) — η αλλαγή
 * λειτουργικής κατάστασης, η χειροκίνητη διόρθωση και η αναίρεση περνούν **όλες** από εδώ, ώστε η μνήμη «αυτόματα»
 * να μην ξεφεύγει ποτέ από την τιμή που περιγράφει.
 * @related `lib/energy-certificate/energy-lifecycle-follow.ts` (ο κανόνας — καθαρή συνάρτηση) ·
 *   `features/property-details/components/PropertyFieldsBlock.tsx` (ο ιδιοκτήτης της φόρμας)
 * @module hooks/energy-certificate/useEnergyLifecycleFollow
 *
 * 🔑 **Μία ενημέρωση φόρμας ανά πράξη**: κατάσταση + ενεργειακό γράφονται στο **ίδιο** `setFormData`, άρα δεν υπάρχει
 * απόδοση όπου η μονάδα λέει «Έτοιμο» και το ενεργειακό ακόμη «υπό κατασκευή».
 * 🔑 **Η αλλαγή κατάστασης είναι γεγονός χρήστη, όχι φόρτωση**: τίποτα δεν παράγεται όταν ανοίγει η φόρμα — εκεί μιλά
 * η υπενθύμιση (`energyConstructionNoticeOf`), που δεν γράφει.
 */

import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react';

import type { OperationalStatus } from '@/constants/operational-statuses';
import type { EnergyCertificatePatch } from '@/lib/energy-certificate/energy-certificate';
import {
  energyFormSliceOf,
  energyOfForm,
  patchedEnergyFormSlice,
  type EnergyFormSlice,
} from '@/lib/energy-certificate/energy-certificate-form';
import {
  energyFollowingOperationalStatus,
  type EnergyLifecycleFollow,
} from '@/lib/energy-certificate/energy-lifecycle-follow';

/** Ό,τι χρειάζεται από τη φόρμα: το κομμάτι του ΠΕΑ και η λειτουργική κατάσταση. */
type LifecycleForm = EnergyFormSlice & { readonly operationalStatus: OperationalStatus };

export interface EnergyLifecycleControl {
  /** `null` = η απάντηση είναι του ανθρώπου· αλλιώς βγήκε αυτόματα, με τον λόγο της. */
  readonly follow: EnergyLifecycleFollow | null;
  readonly changeOperationalStatus: (next: OperationalStatus) => void;
  /** Χειροκίνητη διόρθωση ή εφαρμογή ΠΕΑ — η απάντηση γίνεται του ανθρώπου. */
  readonly applyEnergyPatch: (patch: EnergyCertificatePatch) => void;
  /** Επιστροφή στην απάντηση πριν την αυτόματη — **ακριβώς** αυτή, μαζί με την εκτίμηση της ΜΕΑ. */
  readonly undo: () => void;
}

export function useEnergyLifecycleFollow<F extends LifecycleForm>(
  formData: F,
  setFormData: Dispatch<SetStateAction<F>>,
  isEditing: boolean,
): EnergyLifecycleControl {
  const [follow, setFollow] = useState<EnergyLifecycleFollow | null>(null);

  // Εκτός επεξεργασίας (αποθήκευση · ακύρωση) η φόρμα ξαναγεμίζει από τον server: η μνήμη δεν περιγράφει πια τίποτα.
  useEffect(() => {
    if (!isEditing) setFollow(null);
  }, [isEditing]);

  const changeOperationalStatus = useCallback((next: OperationalStatus) => {
    const outcome = energyFollowingOperationalStatus(energyOfForm(formData), next, follow);
    setFollow(outcome.follow);
    setFormData((prev) => ({ ...prev, operationalStatus: next, ...energyFormSliceOf(outcome.certificate) }));
  }, [follow, formData, setFormData]);

  const applyEnergyPatch = useCallback((patch: EnergyCertificatePatch) => {
    setFollow(null);
    setFormData((prev) => ({ ...prev, ...patchedEnergyFormSlice(prev, patch) }));
  }, [setFormData]);

  const undo = useCallback(() => {
    if (follow === null) return;
    setFollow(null);
    setFormData((prev) => ({ ...prev, ...energyFormSliceOf(follow.before) }));
  }, [follow, setFormData]);

  return { follow, changeOperationalStatus, applyEnergyPatch, undo };
}
