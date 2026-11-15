'use client';

/**
 * @fileoverview ADR-915 §43 — **το κουμπί της εξωτερικής υπηρεσίας** (myAADE · e-ΕΦΚΑ): «Έκδοση από <αρχή>», σε νέα
 *   καρτέλα. ΕΝΑ σημείο για την κάρτα («Επόμενο βήμα») και για τον πίνακα (ενέργεια της γραμμής).
 * @related RegistryNextStep.tsx · RegistryRowAction.tsx · config/document-validity/document-issuers.ts (`AUTHORITY_SERVICE_SPECS`)
 * @module components/document-registry/RegistryAuthorityLink
 *
 * 🔑 Ζει σε **δικό του** αρχείο: ο πίνακας (πρώτο καρέ) δεν σέρνει την κάρτα ανάθεσης στην κλειστότητα (CHECK 3.34).
 * ⚠️ Εξωτερική πύλη ⇒ `target="_blank"` + `rel="noopener noreferrer"` + δήλωση για τους αναγνώστες οθόνης (ίδιο ιδίωμα
 *    με το `LicenceStatement`) + ορατό εικονίδιο. `useId`: το ίδιο είδος εμφανίζεται σε ΠΟΛΛΕΣ γραμμές.
 */

import React from 'react';
import { ExternalLink } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { AUTHORITY_SERVICE_SPECS, type AuthorityService } from '@/config/document-validity/document-issuers';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  ISSUER_AUTHORITY_LABEL_KEYS,
  NEXT_STEP_KEYS,
  REGISTRY_NS,
} from '@/components/document-registry/document-registry-labels';

export function RegistryAuthorityLink({ service }: { readonly service: AuthorityService }): React.ReactElement {
  const { t } = useTranslation([REGISTRY_NS]);
  const hintId = React.useId();
  const { authority, entryUrl } = AUTHORITY_SERVICE_SPECS[service];
  return (
    <>
      <Button asChild variant="outline" size="sm" className="w-fit">
        <a href={entryUrl} target="_blank" rel="noopener noreferrer" aria-describedby={hintId}>
          {t(NEXT_STEP_KEYS.selfService, { authority: t(ISSUER_AUTHORITY_LABEL_KEYS[authority]) })}
          <ExternalLink className="size-3" aria-hidden="true" />
        </a>
      </Button>
      <span id={hintId} className="sr-only">{t(NEXT_STEP_KEYS.opensInNewTab)}</span>
    </>
  );
}
