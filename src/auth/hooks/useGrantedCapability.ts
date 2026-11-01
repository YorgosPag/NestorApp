'use client';

/**
 * *«Να δείξω αυτή την πράξη;»* — η ερώτηση προς τον ΕΝΑ PEP, μεταφρασμένη σε «δείξε / μη δείξεις».
 *
 * Ανέβηκε από το `usePropertyEditCapability` όταν απέκτησε δεύτερο πόρο (κτίρια · όροφοι, ADR-829 §7.1).
 * ⚠️ Εργονομία, όχι ασφάλεια: τον έλεγχο τον ξανακάνει ο διακομιστής, πάντα.
 *
 * @module auth/hooks/useGrantedCapability
 */

import { useMemo } from 'react';

import { useCapability } from '@/auth/hooks/useCapability';
import type { PermissionId } from '@/lib/auth/types';
import { isGranted, type CapabilityVerdict } from '@/types/capability-authority';

export interface GrantedCapability {
  readonly granted: boolean;
  readonly verdict: CapabilityVerdict;
  /** Η ταυτότητα δεν έχει φορτώσει ⇒ η άρνηση δεν είναι τελική. */
  readonly pending: boolean;
}

export function useGrantedCapability(permission: PermissionId): GrantedCapability {
  const gate = useCapability(permission);

  return useMemo(
    () => ({
      // fail-closed όσο εκκρεμεί: το `pending` δίνει `denied-unauthenticated`, άρα η κατεύθυνση είναι «κλειστό →
      // ανοιχτό» και ποτέ το αντίστροφο — κουμπί που εμφανίζεται και μετά εξαφανίζεται είναι χειρότερο από κουμπί που αργεί.
      granted: isGranted(gate.verdict),
      verdict: gate.verdict,
      pending: gate.pending,
    }),
    [gate],
  );
}
