'use client';

/**
 * @fileoverview ADR-943 Φ4 — **ο πίνακας ακύρωσης** μιας προκαταβολής: «αν ακυρώσετε … επιστρέφονται Χ · κρατούνται Υ».
 * @related lib/document-validity/issuance-advance.ts (`cancellationScheduleOf` — οι ΙΔΙΟΙ κανόνες με την πραγματική
 *   επιστροφή) · IssuanceAdvanceFields.tsx (προεπισκόπηση του επαγγελματία) · document-request (ο ιδιοκτήτης πριν εγκρίνει)
 * @module components/document-registry/IssuanceAdvanceSchedule
 *
 * 🔑 **Ποσά, όχι κείμενο πολιτικής** — πέρα από τους μεγάλους: ο Airbnb περιγράφει την πολιτική με λόγια· εδώ ο ιδιοκτήτης
 *    βλέπει **πόσα** παίρνει πίσω σε κάθε περίπτωση, πριν εγκρίνει (ν.2251/1994 άρθρο 3ι §4: ενημέρωση για το ποσό).
 */

import React from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cancellationScheduleOf, type AdvanceTerms } from '@/lib/document-validity/issuance-advance';
import { formatMinor } from '@/lib/money/money';

import { policyHintText, policyText, scheduleWhenText } from './issuance-advance-labels';

export function IssuanceAdvanceSchedule({ terms }: { readonly terms: AdvanceTerms }): React.ReactElement {
  const { t } = useTranslation(['document-registry']);
  const rows = cancellationScheduleOf(terms);
  return (
    <section className="flex flex-col gap-2" aria-label={t('document-registry:issuance.advance.schedule.heading')}>
      <h3 className="m-0 text-sm font-semibold text-foreground">{t('document-registry:issuance.advance.schedule.heading')}</h3>
      <p className="m-0 text-xs text-muted-foreground">
        {t('document-registry:issuance.advance.schedule.summary', {
          amount: formatMinor(terms.amountMinor), policy: policyText(t, terms.policy), inspection: formatMinor(terms.inspectionValueMinor),
        })}
      </p>
      <p className="m-0 text-xs text-muted-foreground">{policyHintText(t, terms.policy)}</p>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="text-left text-xs text-muted-foreground">
            <th scope="col" className="py-1 pr-2 font-medium">{t('document-registry:issuance.advance.schedule.when')}</th>
            <th scope="col" className="py-1 pr-2 font-medium">{t('document-registry:issuance.advance.schedule.refund')}</th>
            <th scope="col" className="py-1 font-medium">{t('document-registry:issuance.advance.schedule.retained')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.when} className="border-t border-border align-top">
              <th scope="row" className="py-1 pr-2 text-left font-normal text-foreground">{scheduleWhenText(t, row.when)}</th>
              <td className="py-1 pr-2 text-foreground">{formatMinor(row.refundMinor)}</td>
              <td className="py-1 text-foreground">{formatMinor(row.retainedMinor)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="m-0 text-xs text-muted-foreground">{t('document-registry:issuance.advance.schedule.escrow')}</p>
    </section>
  );
}
