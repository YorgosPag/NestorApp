'use client';

/**
 * @fileoverview **Η ανεξάρτητη οδός** — πώς επαληθεύει ο τρίτος **χωρίς** να εμπιστευτεί εμάς (ADR-916 Φ-Γ2 Σ6).
 * @module components/handover-protocol-verify/ProtocolIndependentCheck
 *
 * 🔑 Η πόρτα είναι ευκολία, όχι μονοπώλιο: η σφραγίδα ελέγχεται σε οποιονδήποτε επικυρωτή eIDAS, τα αρχεία με
 *    `sha256sum`, οι όροι στη δημόσια σελίδα της έκδοσης. Ίδια οδηγία με την ενότητα «Πώς επαληθεύεται» του κειμένου v1.
 */

import React from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { legalDocumentVersionsHref } from '@/lib/routes/legalRoutes';
import { HANDOVER_PROTOCOL_LEGAL_DOCUMENT } from '@/lib/property-handover/handover-protocol-terms';
import { Link } from '@/lib/workspace/navigation';

export function ProtocolIndependentCheck() {
  const { t } = useTranslation('legal');
  const titleId = React.useId();
  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-2 text-sm">
      <h2 id={titleId} className="m-0 text-base font-semibold text-foreground">{t('handoverVerify.independent.title')}</h2>
      <ul className="m-0 flex list-disc flex-col gap-1 pl-5 text-foreground">
        <li>{t('handoverVerify.independent.seal')}</li>
        <li>{t('handoverVerify.independent.files')}</li>
        <li>{t('handoverVerify.independent.digest')}</li>
        <li>
          <Link href={legalDocumentVersionsHref(HANDOVER_PROTOCOL_LEGAL_DOCUMENT)} className="underline underline-offset-4">
            {t('handoverVerify.independent.legalText')}
          </Link>
        </li>
      </ul>
    </section>
  );
}
