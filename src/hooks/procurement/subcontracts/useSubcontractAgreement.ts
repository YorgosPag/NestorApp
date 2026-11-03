'use client';

/**
 * **Ένα συμφωνητικό υπεργολαβίας, ζωντανά** — η πηγή της σελίδας λεπτομέρειας και του επεξεργαστή (ADR-928 Φ3γ).
 *
 * 🔑 Ζωντανή ανάγνωση (`subscribeDoc`): η αλλαγή άλλου φτάνει αμέσως — καθαρό πρόχειρο την ακολουθεί, βρώμικο τη
 *    δείχνει ως «άλλαξε από άλλον» (`useRevisionedDraft`, πολιτική `hold`).
 * 🔑 Fail-closed: ανύπαρκτο, ξένου χώρου (ο κανόνας αρνείται ⇒ σφάλμα, ή — ζώνη και τιράντες — `companyId` άλλου) ⇒
 *    `missing`. Ξένο και ανύπαρκτο **δεν ξεχωρίζουν** (ADR-742).
 * 🔑 Αποτέλεσμα άλλου id δεν φαίνεται ποτέ (κλειδί ανά id — κανένας αγώνας στην πλοήγηση από έγγραφο σε έγγραφο).
 * @module hooks/procurement/subcontracts/useSubcontractAgreement
 */

import { useEffect, useState } from 'react';
import { useCompanyId } from '@/hooks/useCompanyId';
import { createModuleLogger } from '@/lib/telemetry';
import { firestoreQueryService } from '@/services/firestore/firestore-query.service';
import type { SubcontractAgreement } from '@/subapps/procurement/subcontracts/types/agreement';

const logger = createModuleLogger('useSubcontractAgreement');

export type SubcontractAgreementRead =
  | { readonly state: 'loading'; readonly agreement: null }
  | { readonly state: 'missing'; readonly agreement: null }
  | { readonly state: 'ready'; readonly agreement: SubcontractAgreement };

const LOADING: SubcontractAgreementRead = { state: 'loading', agreement: null };
const MISSING: SubcontractAgreementRead = { state: 'missing', agreement: null };

export function useSubcontractAgreement(agreementId: string): SubcontractAgreementRead {
  const companyId = useCompanyId()?.companyId ?? null;
  const [read, setRead] = useState<{ readonly id: string; readonly value: SubcontractAgreementRead } | null>(null);

  useEffect(() => {
    if (!companyId) return undefined;
    return firestoreQueryService.subscribeDoc<SubcontractAgreement & Record<string, unknown>>(
      'SUBCONTRACT_AGREEMENTS',
      agreementId,
      (doc) => setRead({ id: agreementId, value: doc && doc.companyId === companyId ? { state: 'ready', agreement: doc } : MISSING }),
      (error) => {
        logger.warn('Subcontract agreement subscription error', { agreementId, error: error.message });
        setRead({ id: agreementId, value: MISSING });
      },
    );
  }, [agreementId, companyId]);

  return read !== null && read.id === agreementId ? read.value : LOADING;
}
