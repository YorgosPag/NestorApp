'use client';

/**
 * @fileoverview ADR-945 §7.6 — **ο κατάλογος `/pro` ανοιχτός «για» ένα ακίνητο**: ΕΝΑ αίτημα, ΜΙΑ ανάγνωση, ΜΙΑ αποστολή
 *   για όλες τις κάρτες της σελίδας.
 * @related lib/agency/issuance-context-query.ts (το πλαίσιο της διεύθυνσης) · AgencyRequestQuoteButton.tsx (ο αναγνώστης) ·
 *   hooks/document-registry/useIssuanceRequest.ts · hooks/document-registry/useIssuanceRequestAction.ts
 * @module components/mandate/agency-issuance-quote-context
 *
 * 🔑 **Μία ανάγνωση ανά σελίδα, όχι ανά κάρτα**: 30 κάρτες × 1 `GET` θα ήταν 30 ερωτήσεις για την ΙΔΙΑ απάντηση. Ο πάροχος
 *    ρωτά μία φορά· κάθε κουμπί κρίνει **τη δική του** βιτρίνα με τον ΙΔΙΟ μειωτή (`inviteVerdictOf`).
 * 🔑 **Ο φρουρός είναι εδώ**: κλειστός διακόπτης `OWNER_ISSUANCE_REQUESTS` ή διεύθυνση χωρίς πλαίσιο ⇒ ο πάροχος δεν
 *    στήνει τίποτα ⇒ **καμία** κλήση δικτύου, κανένα κουμπί (`useAgencyIssuanceQuote() === null`).
 * 🔑 Ανώνυμος ⇒ καμία κλήση (η ταυτότητα λύνεται πρώτα — `useIdentityGatedResource`)· το κουμπί οδηγεί στη σύνδεση.
 */

import React from 'react';
// 🔴 Το `useSearchParams` δεν ζει στο σύνορο πλοήγησης (ίδια εξαίρεση με το `AgencyDirectoryContent`, CHECK 3.61).
import { useSearchParams } from 'next/navigation';

import { useAuth } from '@/auth/hooks/useAuth';
import { isAppFeatureEnabled } from '@/config/feature-flags';
import { useIssuanceRequest, type IssuanceRequestState } from '@/hooks/document-registry/useIssuanceRequest';
import { parseIssuanceContext, type IssuanceContext } from '@/lib/agency/issuance-context-query';

export interface AgencyIssuanceQuoteApi {
  readonly context: IssuanceContext;
  readonly signedIn: boolean;
  readonly view: IssuanceRequestState;
  /**
   * Ξαναδιάβασμα μετά από πράξη. ⚠️ Η **πράξη** (`useIssuanceRequestAction`) ζει στο κουμπί, όχι εδώ: ο πάροχος εισάγεται
   * στατικά στο `/pro` και ΔΕΝ πρέπει να φέρει κανένα namespace στο πρώτο καρέ (CHECK 3.34 · ADR-744 §27). Ο διακομιστής
   * κρίνει κάθε πρόσκληση (CAS · όριο), άρα δύο κουμπιά σε πτήση δεν χρειάζονται κοινό φρένο.
   */
  readonly revalidate: () => Promise<void>;
}

const AgencyIssuanceQuoteContext = React.createContext<AgencyIssuanceQuoteApi | null>(null);

/** `null` = ο κατάλογος **δεν** ανοίχτηκε για αίτημα (ή ο διακόπτης είναι κλειστός) ⇒ κανένα κουμπί. */
export function useAgencyIssuanceQuote(): AgencyIssuanceQuoteApi | null {
  return React.useContext(AgencyIssuanceQuoteContext);
}

function ActiveProvider({ context, children }: { readonly context: IssuanceContext; readonly children: React.ReactNode }) {
  const { user } = useAuth();
  const { view, revalidate } = useIssuanceRequest(context.propertyId, context.documentKind);
  const value = React.useMemo<AgencyIssuanceQuoteApi>(
    () => ({ context, signedIn: user !== null, view, revalidate }),
    [context, user, view, revalidate],
  );
  return <AgencyIssuanceQuoteContext.Provider value={value}>{children}</AgencyIssuanceQuoteContext.Provider>;
}

/**
 * Ο πάροχος — διαβάζει το πλαίσιο **από τη διεύθυνση** (ο ΙΔΙΟΣ αναγνώστης με τον κατάλογο), και δίνει **σκέτα παιδιά**
 * όταν δεν υπάρχει πλαίσιο ή ο διακόπτης είναι κλειστός (καμία κλήση, κανένα state).
 * ⚠️ `useSearchParams` ⇒ ο καλών τον βάζει κάτω από όριο `<Suspense>` (CHECK 3.55).
 */
export function AgencyIssuanceQuoteProvider({ children }: { readonly children: React.ReactNode }): React.ReactElement {
  const params = useSearchParams();
  const context = React.useMemo(() => parseIssuanceContext(new URLSearchParams(params.toString())), [params]);
  if (context === null || !isAppFeatureEnabled('OWNER_ISSUANCE_REQUESTS')) return <>{children}</>;
  return <ActiveProvider context={context}>{children}</ActiveProvider>;
}
