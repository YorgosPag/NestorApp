'use client';

/**
 * @fileoverview **Μια άδεια της βιτρίνας** — όνομα, ισχυρισμός, και ο δρόμος να τον ελέγξεις (ADR-915 §21).
 * @related config/professional-licences.ts · CredibilityStatement.tsx (`ClaimLines`, οι ίδιες λέξεις) · AgencyCard.tsx
 * @module components/mandate/LicenceStatement
 *
 * 🔑 **Ο ισχυρισμός λέγεται με τις ΙΔΙΕΣ γραμμές με τα επαγγέλματα** (`ClaimLines`): «Μητρώο … · αρ. μητρώου 12345» +
 *    «Δήλωση του ίδιου. Δεν την έχουμε ελέγξει.» — ποτέ «επαληθευμένο» χωρίς να ρωτήθηκε η αρχή (ADR-798 §7).
 * 🏆 **Πέρα από τους μεγάλους**: το Houzz δείχνει σήμα «Verified License» χωρίς να λέει πώς· εδώ ο επισκέπτης παίρνει
 *    τον **σύνδεσμο του δημόσιου μητρώου** και ελέγχει τον αριθμό ο ίδιος σε ένα κλικ (ADR-841 Α9.2).
 */

import React from 'react';
import { ExternalLink } from 'lucide-react';

import { PROFESSIONAL_LICENCE_SPECS } from '@/config/professional-licences';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { ShowcaseLicence } from '@/types/agency-profile';

import { AGENCY_PUBLIC_NS, CREDIBILITY_KEYS } from './agency-directory-labels';
import { ClaimLines } from './CredibilityStatement';

export interface LicenceStatementProps {
  readonly licence: ShowcaseLicence;
}

export function LicenceStatement({ licence }: LicenceStatementProps): React.JSX.Element {
  const { t } = useTranslation([AGENCY_PUBLIC_NS]);
  const spec = PROFESSIONAL_LICENCE_SPECS[licence.licence];
  // `useId`: η ίδια άδεια εμφανίζεται σε ΠΟΛΛΕΣ κάρτες της λίστας — σταθερό id θα συγκρουόταν.
  const hintId = React.useId();
  return (
    <section className="flex flex-col gap-1">
      <p className="m-0 text-sm font-medium text-foreground">{t(spec.nameKey)}</p>
      <ClaimLines claim={licence.attestation} />
      <a
        href={spec.registryLookupUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-describedby={hintId}
        className="ml-5 inline-flex w-fit items-center gap-1 text-xs text-foreground underline underline-offset-2"
      >
        {t(CREDIBILITY_KEYS.licenceLookup)}
        <ExternalLink className="size-3" aria-hidden="true" />
      </a>
      <span id={hintId} className="sr-only">
        {t(CREDIBILITY_KEYS.licenceLookupHint)}
      </span>
    </section>
  );
}
