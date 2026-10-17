'use client';

/**
 * @fileoverview ADR-915 §27 — οι **ενέργειες** της ανάθεσης έκδοσης, για όποια γραμμή τις χρειαστεί (έγγραφο ή κενό),
 *   χωρίς να περνούν από τρία επίπεδα props (ιδίωμα `obligor-designation-context.ts`).
 * @related hooks/document-registry/useIssuanceAssignment.ts (ο πάροχος) · RegistryIssuanceStep.tsx (ο καταναλωτής)
 * @module components/document-registry/issuance-assignment-context
 *
 * `null` ⇒ καμία δυνατότητα πράξης (άλλη επιφάνεια · test): η γραμμή λέει την κατάσταση, απλώς **χωρίς** κουμπιά.
 */

import { createContext, useContext } from 'react';

import type { IssuanceAssignmentBody } from '@/lib/document-validity/issuance-request';

export interface IssuanceAssignmentActions {
  readonly act: (request: IssuanceAssignmentBody) => void;
  readonly pending: ReadonlySet<string>;
  /** Εργονομία, όχι ασφάλεια (ADR-801): ο διακομιστής κρίνει ξανά το `properties:properties:update`. */
  readonly canAct: boolean;
  /** §28 — ξαναδιάβασε το μητρώο (μετά από αποστολή με σύνδεσμο: η πράξη δεν είναι αισιόδοξη, το αποτέλεσμα τη λέει). */
  readonly revalidate: () => Promise<void>;
}

const IssuanceAssignmentContext = createContext<IssuanceAssignmentActions | null>(null);

export const IssuanceAssignmentProvider = IssuanceAssignmentContext.Provider;

export function useIssuanceAssignmentActions(): IssuanceAssignmentActions | null {
  return useContext(IssuanceAssignmentContext);
}
