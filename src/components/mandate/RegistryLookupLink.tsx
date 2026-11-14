'use client';

/**
 * @fileoverview **«Έλεγχος στο μητρώο»** — ο σύνδεσμος της δημόσιας αναζήτησης μιας άδειας (ADR-915 §21 · §40.5).
 * @related config/professional-licences.ts (`registryLookupUrl`) · LicenceStatement.tsx (βιτρίνα) ·
 *   components/contacts/ContactLicenceProvenanceList.tsx (επαφή)
 * @module components/mandate/RegistryLookupLink
 *
 * 🔑 Χωρίς δημόσιο μητρώο (ηλεκτρολόγος, ADR-915 §34) ⇒ **τίποτα** — ποτέ σύνδεσμος που δεν απαντά στο ερώτημα.
 * 🏆 Πέρα από το «Verified License» του Houzz: ο αναγνώστης ελέγχει τον αριθμό ο ίδιος, σε ένα κλικ (ADR-841 Α9.2).
 */

import React from 'react';
import { ExternalLink } from 'lucide-react';

import { PROFESSIONAL_LICENCE_SPECS, type ProfessionalLicence } from '@/config/professional-licences';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';

import { AGENCY_PUBLIC_NS, CREDIBILITY_KEYS } from './agency-directory-labels';

export interface RegistryLookupLinkProps {
  readonly licence: ProfessionalLicence;
  readonly className?: string;
}

export function RegistryLookupLink({ licence, className }: RegistryLookupLinkProps): React.JSX.Element | null {
  const { t } = useTranslation([AGENCY_PUBLIC_NS]);
  // `useId`: η ίδια άδεια εμφανίζεται σε ΠΟΛΛΕΣ κάρτες της λίστας — σταθερό id θα συγκρουόταν.
  const hintId = React.useId();
  const url = PROFESSIONAL_LICENCE_SPECS[licence].registryLookupUrl;
  if (url === null) return null;
  return (
    <>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        aria-describedby={hintId}
        className={cn('inline-flex w-fit items-center gap-1 text-xs text-foreground underline underline-offset-2', className)}
      >
        {t(CREDIBILITY_KEYS.licenceLookup)}
        <ExternalLink className="size-3" aria-hidden="true" />
      </a>
      <span id={hintId} className="sr-only">
        {t(CREDIBILITY_KEYS.licenceLookupHint)}
      </span>
    </>
  );
}
