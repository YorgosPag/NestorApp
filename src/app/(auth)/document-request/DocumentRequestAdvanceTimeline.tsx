'use client';

/**
 * @fileoverview ADR-943 Φ5β — **το χρονολόγιο των χρημάτων** στη σελίδα της προκαταβολής: πληρώθηκε → αυτοψία →
 *   αντίρρηση → αποδέσμευση/επιστροφή, με ώρες και ποσά (πρότυπο Airbnb/Upwork «payment activity»).
 * @related lib/document-validity/issuance-advance.ts (`advanceTimelineOf` — η μία πηγή) · DocumentRequestAdvance.tsx
 * @module app/(auth)/document-request/DocumentRequestAdvanceTimeline
 *
 * 🔑 Από τα **γεγονότα** του τομέα, όπως τα έστειλε ο διακομιστής — καμία κατάσταση που η σελίδα «συμπεραίνει».
 * ⚠️ Κυριολεκτικά κλειδιά (CHECK 3.34), ποτέ `${kind}`.
 */

import React from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { AdvanceTimelineEntry } from '@/lib/document-validity/issuance-advance';
import { formatMinor } from '@/lib/money/money';
import { formatOperatorDateTime } from '@/lib/operator-time-format';

type Translate = ReturnType<typeof useTranslation>['t'];

function entryText(t: Translate, entry: AdvanceTimelineEntry): string {
  switch (entry.kind) {
    case 'funded': return t('document-request:advance.timeline.funded', { amount: formatMinor(entry.amountMinor) });
    case 'work-started': return t('document-request:advance.timeline.workStarted');
    case 'start-objected':
      return entry.by === 'owner-link'
        ? t('document-request:advance.timeline.objectedByOwner')
        : t('document-request:advance.timeline.objectedByOffice');
    case 'released': return t('document-request:advance.timeline.released', { amount: formatMinor(entry.amountMinor) });
    case 'refunded': return t('document-request:advance.timeline.refunded', { amount: formatMinor(entry.amountMinor) });
  }
}

export function DocumentRequestAdvanceTimeline({ timeline }: { readonly timeline: readonly AdvanceTimelineEntry[] }): React.ReactElement | null {
  const { t, i18n } = useTranslation(['document-request']);
  if (timeline.length === 0) return null;
  return (
    <section aria-labelledby="advance-timeline-heading" className="flex flex-col gap-1">
      <h2 id="advance-timeline-heading" className="m-0 text-sm font-semibold text-card-foreground">{t('document-request:advance.timeline.heading')}</h2>
      <ol className="m-0 flex list-none flex-col gap-1 p-0">
        {timeline.map((entry) => (
          <li key={`${entry.kind}:${entry.at}`} className="flex flex-col text-sm text-card-foreground">
            <time dateTime={entry.at} className="text-xs text-muted-foreground">{formatOperatorDateTime(entry.at, i18n.language)}</time>
            <span>{entryText(t, entry)}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
