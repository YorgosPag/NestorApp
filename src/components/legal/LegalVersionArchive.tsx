'use client';

/**
 * **Όλες οι εκδόσεις** ενός νομικού εγγράφου — πρότυπο Google `policies/…/archive` και GitHub
 * site-policy, με δύο πράγματα που εκείνα δεν δίνουν: **αποτύπωμα** ανά έκδοση και ρητή κρίση
 * «ουσιώδης / μη ουσιώδης» γραμμένη από άνθρωπο τη στιγμή του παγώματος (ADR-861 Φ3).
 *
 * @module components/legal/LegalVersionArchive
 * @see ADR-861 §7
 */

import React from 'react';

import { useFrozenText } from '@/components/legal/LegalDocumentBody';
import type { LegalDocumentId } from '@/constants/legal-documents';
import { ShellSurface } from '@/core/containers/ShellSurface';
import { calendarDayOf } from '@/constants/platform-operator';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { resolveHumanLanguage } from '@/i18n/languages';
import { formatCalendarDay } from '@/lib/intl-formatting';
import {
  legalDocumentInForce,
  legalDocumentVersions,
  type LegalDocumentVersion,
} from '@/lib/legal/legal-document-versions';
import { legalDocumentVersionHref } from '@/lib/routes/legalRoutes';
import { Link } from '@/lib/workspace/navigation';

export const VERSION_STATUSES = ['inForce', 'superseded', 'scheduled'] as const;

export type VersionStatus = (typeof VERSION_STATUSES)[number];

/** Η **μία** κρίση κατάστασης μιας έκδοσης — τη ρωτούν και η λίστα και η σελίδα της έκδοσης. */
export function versionStatusOf(document: LegalDocumentId, version: number, today: string): VersionStatus {
  const lookup = legalDocumentInForce(document, today);
  if (lookup.kind === 'in-force' && lookup.version.frozen.version === version) return 'inForce';
  return lookup.kind === 'in-force' && version < lookup.version.frozen.version ? 'superseded' : 'scheduled';
}

/**
 * Η **μία** γραμμή γεγονότων μιας έκδοσης: ισχύς · κατάσταση · ουσιώδης/μη — ίδια στη λίστα και
 * στη σελίδα της έκδοσης.
 *
 * ⚠️ Κάθε κλειδί γράφεται **ρητά** σε `t('…')`: ο σαρωτής του route slice (ADR-744) βλέπει μόνο
 * στατικές κλήσεις — μια αναζήτηση σε χάρτη κλειδιών τον κάνει να αρνηθεί να εκπέμψει το slice.
 */
export function VersionFactsLine({
  document,
  frozen,
}: {
  readonly document: LegalDocumentId;
  readonly frozen: LegalDocumentVersion['frozen'];
}): React.JSX.Element {
  const { t } = useTranslation('legal');
  const status = versionStatusOf(document, frozen.version, calendarDayOf(new Date()));
  const statusLabel =
    status === 'inForce'
      ? t('versions.status.inForce')
      : status === 'superseded'
        ? t('versions.status.superseded')
        : t('versions.status.scheduled');
  const changeLabel = frozen.material ? t('versions.material') : t('versions.minor');
  return (
    <>
      {t('versions.effectiveFrom', { date: formatCalendarDay(frozen.effectiveFrom, true) })}
      {' · '}
      {statusLabel}
      {frozen.version > 1 ? ` · ${changeLabel}` : null}
    </>
  );
}

function VersionItem({
  document,
  version,
}: {
  readonly document: LegalDocumentId;
  readonly version: LegalDocumentVersion;

}): React.JSX.Element {
  const { t, i18n } = useTranslation('legal');
  const { frozen } = version;
  const note = frozen.changeNote === null ? null : frozen.changeNote[resolveHumanLanguage(i18n.language)];
  return (
    <li>
      <p>
        <Link href={legalDocumentVersionHref(document, frozen.version)} className="font-medium underline underline-offset-4">
          {t('versions.open', { version: frozen.version })}
        </Link>
        {' · '}
        <VersionFactsLine document={document} frozen={frozen} />
      </p>
      {note === null ? <p>{t('versions.firstVersion')}</p> : <p>{note}</p>}
    </li>
  );
}

export function LegalVersionArchive({ document }: { readonly document: LegalDocumentId }): React.JSX.Element {
  const { t } = useTranslation('legal');
  const versions = legalDocumentVersions(document);
  const latest = versions.at(-1);
  if (latest === undefined) return <p>{t('versions.absent')}</p>;
  return <ArchiveContent document={document} latest={latest} versions={versions} />;
}

function ArchiveContent({
  document,
  latest,
  versions,
}: {
  readonly document: LegalDocumentId;
  readonly latest: LegalDocumentVersion;
  readonly versions: readonly LegalDocumentVersion[];
}): React.JSX.Element {
  const { t } = useTranslation('legal');
  const text = useFrozenText(latest);
  return (
    <>
      <h1>{t('versions.archiveTitle', { title: text.title })}</h1>
      <p>{t('versions.archiveIntro')}</p>
      <ol reversed>
        {[...versions].reverse().map((version) => (
          <VersionItem key={version.frozen.version} document={document} version={version} />
        ))}
      </ol>
    </>
  );
}

/**
 * Η **σελίδα** `/<έγγραφο>/versions` — ζει εδώ και όχι σε κοινό module διαδρομών, ώστε το route slice
 * της να μην πληρώνει τα κλειδιά της σελίδας μίας έκδοσης (μετρημένο: 2.550 → ~1.780 bytes, ADR-744 §18).
 */
export function LegalVersionsRoute({ document }: { readonly document: LegalDocumentId }): React.JSX.Element {
  return (
    <ShellSurface measure="prose">
      <LegalVersionArchive document={document} />
    </ShellSurface>
  );
}
