'use client';

/**
 * @fileoverview ADR-915 §26 — οι **ενέργειες** του ορισμού υπευθύνου, για όποια γραμμή τις χρειαστεί (έγγραφο ή κενό),
 *   χωρίς να περνούν από τρία επίπεδα props.
 * @related hooks/document-registry/useObligorDesignation.ts (ο πάροχος) · RegistryObligorLeadPicker.tsx (ο καταναλωτής)
 * @module components/document-registry/obligor-designation-context
 *
 * `null` ⇒ καμία δυνατότητα ορισμού (άλλη επιφάνεια · test): η γραμμή λέει τον υπεύθυνο, απλώς **χωρίς** κουμπί.
 */

import { createContext, useContext } from 'react';

export interface ObligorDesignationActions {
  readonly designate: (propertyId: string, contactId: string | null) => void;
  readonly pending: ReadonlySet<string>;
  /** Εργονομία, όχι ασφάλεια (ADR-801): ο διακομιστής κρίνει ξανά το `properties:properties:update`. */
  readonly canDesignate: boolean;
}

const ObligorDesignationContext = createContext<ObligorDesignationActions | null>(null);

export const ObligorDesignationProvider = ObligorDesignationContext.Provider;

export function useObligorDesignationActions(): ObligorDesignationActions | null {
  return useContext(ObligorDesignationContext);
}
