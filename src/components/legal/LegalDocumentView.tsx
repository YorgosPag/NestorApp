'use client';

/**
 * Η **τρέχουσα** σελίδα ενός νομικού εγγράφου — η έκδοση **σε ισχύ** σήμερα (ADR-861 Φ3).
 *
 * Αντικαθιστά το χειρόγραφο «Τελευταία ενημέρωση: 11 Φεβρουαρίου 2026» που **ψευδόταν** από τις
 * 16/9: η ημερομηνία και ο αριθμός **παράγονται** από το μητρώο εκδόσεων, και το κείμενο είναι
 * τα bytes της έκδοσης — όχι ζωντανά κλειδιά που μπορούν να αλλάξουν χωρίς έκδοση.
 *
 * @module components/legal/LegalDocumentView
 * @see ADR-861 §7
 */

import React from 'react';

import { LegalDocumentBody, useFrozenText } from '@/components/legal/LegalDocumentBody';
import type { LegalDocumentId } from '@/constants/legal-documents';
import { calendarDayOf } from '@/constants/platform-operator';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatCalendarDay } from '@/lib/intl-formatting';
import { legalDocumentInForce, type LegalDocumentVersion } from '@/lib/legal/legal-document-versions';
import { legalDocumentVersionHref, legalDocumentVersionsHref } from '@/lib/routes/legalRoutes';
import { Link } from '@/lib/workspace/navigation';

const LINK_CLASS = 'font-medium text-foreground underline underline-offset-4';

function VersionLine({
  document,
  version,
  upcoming,
}: {
  readonly document: LegalDocumentId;
  readonly version: LegalDocumentVersion;
  readonly upcoming: LegalDocumentVersion | null;
}): React.JSX.Element {
  const { t } = useTranslation('legal');
  const date = (day: string): string => formatCalendarDay(day, true);
  return (
    <p>
      <strong>
        {t('versions.line', { version: version.frozen.version, date: date(version.frozen.effectiveFrom) })}
      </strong>{' '}
      · <Link href={legalDocumentVersionsHref(document)} className={LINK_CLASS}>{t('versions.archiveLink')}</Link>
      {upcoming === null ? null : (
        <>
          {' '}
          ·{' '}
          <Link href={legalDocumentVersionHref(document, upcoming.frozen.version)} className={LINK_CLASS}>
            {t('versions.upcoming', { date: date(upcoming.frozen.effectiveFrom) })}
          </Link>
        </>
      )}
    </p>
  );
}

function InForceDocument({
  document,
  version,
  upcoming,
}: {
  readonly document: LegalDocumentId;
  readonly version: LegalDocumentVersion;
  readonly upcoming: LegalDocumentVersion | null;
}): React.JSX.Element {
  const text = useFrozenText(version);
  return (
    <>
      <h1>{text.title}</h1>
      <VersionLine document={document} version={version} upcoming={upcoming} />
      <LegalDocumentBody version={version} />
    </>
  );
}

export function LegalDocumentView({ document }: { readonly document: LegalDocumentId }): React.JSX.Element {
  const { t } = useTranslation('legal');
  const lookup = legalDocumentInForce(document, calendarDayOf(new Date()));
  // ⚠️ `none-yet` είναι αδύνατο στην παραγωγή όσο η v1 έχει παρελθούσα ημερομηνία (CHECK 3.85 Κ2
  //    απαιτεί έκδοση)· ονομάζεται ρητά αντί να αποδοθεί κενή σελίδα.
  if (lookup.kind === 'none-yet') return <p>{t('versions.absent')}</p>;
  return <InForceDocument document={document} version={lookup.version} upcoming={lookup.upcoming} />;
}
