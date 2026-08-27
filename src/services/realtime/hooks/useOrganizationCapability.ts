'use client';

/**
 * @fileoverview **Η ΚΑΤΑΣΤΑΣΗ ΤΗΣ ΙΚΑΝΟΤΗΤΑΣ, ΖΩΝΤΑΝΑ** — για την οθόνη, ποτέ ως φρουρός.
 * @related ADR-824 §8 Κ5 · lib/auth/brokerage-authority.ts
 * @module services/realtime/hooks/useOrganizationCapability
 *
 * ⛔ **ΔΕΝ ΕΙΝΑΙ Ο ΦΡΟΥΡΟΣ, ΚΑΙ ΔΕΝ ΠΡΕΠΕΙ ΝΑ ΓΙΝΕΙ ΠΟΤΕ.** Ο φρουρός είναι ο τύπος
 * {@link BrokerageAuthority} στον διακομιστή: μια διαδρομή που ξεχνά τον έλεγχο **δεν
 * μεταγλωττίζεται**. Αυτό εδώ απαντά **άλλο** ερώτημα — *«τι να δείξω στον άνθρωπο;»*
 * — και το OWASP το γράφει κατά λέξη: *«Developers must **never** rely on client-side
 * access control checks … they should never be the decisive factor»*.
 *
 * 🔑 **Ζωντανά, όχι εφάπαξ**: μια ανάκληση την ώρα που ο μεσίτης συμπληρώνει τη φόρμα
 * οφείλει να φανεί **αμέσως** — αλλιώς θα πατούσε «Αποθήκευση» και θα έπαιρνε 403 από
 * πόρτα που πριν από ένα λεπτό ήταν ανοιχτή. Ίδιο ιδίωμα με το `usePublicListing`.
 *
 * 🔴 **Κάθε αστοχία ⇒ `unrequested`, δηλαδή «μη διαθέσιμο».** Fail-closed **και στην
 * οθόνη**: το χειρότερο που μπορεί να κάνει είναι να κρύψει μια δυνατότητα που
 * υπάρχει — ποτέ να προσφέρει μία που δεν υπάρχει.
 */

import { doc, onSnapshot } from 'firebase/firestore';
import { useEffect, useState } from 'react';

import { COLLECTIONS } from '@/config/firestore-collections';
import { db } from '@/lib/firebase';
import { createModuleLogger } from '@/lib/telemetry';
import {
  capabilityStatusOf,
  type CapabilityStatus,
  type OrganizationCapabilities,
  type OrganizationCapability,
} from '@/types/organization-capability';

const logger = createModuleLogger('useOrganizationCapability');

/**
 * **Η κατάσταση της ικανότητας του οργανισμού.**
 *
 * @param companyId `null` ⇒ ο άνθρωπος δεν έχει οργανισμό ⇒ `unrequested`.
 */
export function useOrganizationCapability(
  companyId: string | null,
  capability: OrganizationCapability,
): CapabilityStatus {
  const [status, setStatus] = useState<CapabilityStatus>('unrequested');

  useEffect(() => {
    const tenant = companyId?.trim() ?? '';

    if (tenant === '') {
      setStatus('unrequested');
      return;
    }

    // tenant-scope-exempt: ανάγνωση **ενός** εγγράφου κατά ταυτότητα, και ο κανόνας
    // `companies/{id}` απαιτεί ήδη `getUserCompanyId() == companyId` — δεν υπάρχει
    // ερώτημα να φιλτραριστεί.
    const unsubscribe = onSnapshot(
      doc(db, COLLECTIONS.COMPANIES, tenant),
      (snapshot) => {
        const capabilities = (snapshot.data() as { capabilities?: OrganizationCapabilities } | undefined)
          ?.capabilities;
        setStatus(capabilityStatusOf(capabilities, capability));
      },
      (error: Error) => {
        logger.error('Η ικανότητα του οργανισμού δεν διαβάστηκε — η οθόνη ΚΡΥΒΕΙ', {
          data: { companyId: tenant, capability },
          error: error.message,
        });
        setStatus('unrequested');
      },
    );

    return () => unsubscribe();
  }, [companyId, capability]);

  return status;
}
