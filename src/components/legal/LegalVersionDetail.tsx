'use client';

/**
 * **Μία** έκδοση νομικού εγγράφου: το κείμενο όπως πάγωσε, το αποτύπωμά του, τα ακριβή bytes για
 * λήψη, και **τι άλλαξε** σε σχέση με την προηγούμενη — πριν από το πλήρες κείμενο, γιατί αυτό
 * ψάχνει όποιος ήδη διάβασε την παλιά (ADR-861 Φ3).
 *
 * 🏆 Τα bytes της λήψης είναι **τα ίδια** που υπογράφει το αποτύπωμα (άγκυρα
 * `legal-document-versions.test.ts`)· ο αναγνώστης επαληθεύει με οποιοδήποτε εργαλείο SHA-256,
 * χωρίς να εμπιστευτεί εμάς.
 *
 * @module components/legal/LegalVersionDetail
 * @see ADR-861 §7
 */

import React from 'react';
import { notFound, useParams } from 'next/navigation';

import {
  LegalDocumentBody,
  LegalSectionContent,
  instantOfDay,
  useFrozenText,
} from '@/components/legal/LegalDocumentBody';
import { VersionFactsLine } from '@/components/legal/LegalVersionArchive';
import type { LegalDocumentId } from '@/constants/legal-documents';
import { ShellSurface } from '@/core/containers/ShellSurface';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { resolveHumanLanguage } from '@/i18n/languages';
import { legalDocumentVersion, type LegalDocumentVersion } from '@/lib/legal/legal-document-versions';
import { sectionChangesBetween, type SectionChange } from '@/lib/legal/section-changes';
import { legalDocumentVersionsHref } from '@/lib/routes/legalRoutes';
import { Link } from '@/lib/workspace/navigation';

interface VersionProps {
  readonly document: LegalDocumentId;
  readonly version: LegalDocumentVersion;
}

/** Ρητές κλήσεις `t('…')` — ο σαρωτής του route slice (ADR-744) δεν βλέπει αναζητήσεις σε χάρτη. */
function ChangeLabel({ kind }: { readonly kind: SectionChange['kind'] }): React.JSX.Element {
  const { t } = useTranslation('legal');
  switch (kind) {
    case 'added':
      return <strong>{t('versions.change.added')}</strong>;
    case 'removed':
      return <strong>{t('versions.change.removed')}</strong>;
    case 'changed':
      return <strong>{t('versions.change.changed')}</strong>;
    case 'unchanged':
      return <strong>{t('versions.change.unchanged')}</strong>;
  }
}

function VersionFacts({ document, version }: VersionProps): React.JSX.Element {
  const { t, i18n } = useTranslation('legal');
  const { frozen } = version;
  const note = frozen.changeNote === null ? null : frozen.changeNote[resolveHumanLanguage(i18n.language)];
  const href = `data:application/json;charset=utf-8,${encodeURIComponent(version.bytes)}`;
  return (
    <>
      <p>
        <VersionFactsLine document={document} frozen={frozen} />
        {' · '}
        <Link href={legalDocumentVersionsHref(document)} className="underline underline-offset-4">
          {t('versions.archiveLink')}
        </Link>
      </p>
      {note === null ? null : (
        <p>
          <strong>{t('versions.noteTitle')}:</strong> {note}
        </p>
      )}
      <dl>
        <dt>{t('versions.digestLabel')}</dt>
        <dd>
          <code className="break-all">{version.digest}</code>
        </dd>
      </dl>
      <p>
        <a href={href} download={`${document}-v${frozen.version}.json`} className="font-medium underline underline-offset-4">
          {t('versions.download')}
        </a>
        <br />
        <small>{t('versions.downloadHint')}</small>
      </p>
    </>
  );
}

interface ChangeItemProps {
  readonly change: SectionChange;
  readonly asOf: Date;
  readonly previousAsOf: Date;
}

function ChangedSection({ change, asOf, previousAsOf }: ChangeItemProps & { readonly change: Extract<SectionChange, { kind: 'changed' }> }): React.JSX.Element {
  const { t } = useTranslation('legal');
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <figure className="m-0">
        <figcaption>{t('versions.previousText')}</figcaption>
        <LegalSectionContent section={change.previous} asOf={previousAsOf} idPrefix="change-previous" headingLevel="h3" />
      </figure>
      <figure className="m-0">
        <figcaption>{t('versions.nextText')}</figcaption>
        <LegalSectionContent section={change.next} asOf={asOf} idPrefix="change-next" headingLevel="h3" />
      </figure>
    </div>
  );
}

function ChangeItem({ change, asOf, previousAsOf }: ChangeItemProps): React.JSX.Element {
  const label = (
    <p>
      <ChangeLabel kind={change.kind} />
    </p>
  );
  switch (change.kind) {
    case 'unchanged':
      return <li>{label}<p>{change.next.heading}</p></li>;
    case 'added':
      return <li>{label}<LegalSectionContent section={change.next} asOf={asOf} idPrefix="change-added" headingLevel="h3" /></li>;
    case 'removed':
      return <li>{label}<LegalSectionContent section={change.previous} asOf={previousAsOf} idPrefix="change-removed" headingLevel="h3" /></li>;
    case 'changed':
      return <li>{label}<ChangedSection change={change} asOf={asOf} previousAsOf={previousAsOf} /></li>;
  }
}

function ChangesSince({ document, version }: VersionProps): React.JSX.Element | null {
  const { t, i18n } = useTranslation('legal');
  const previous = legalDocumentVersion(document, version.frozen.version - 1);
  if (previous.kind === 'absent') return null;
  const locale = resolveHumanLanguage(i18n.language);
  const changes = sectionChangesBetween(previous.version.frozen.locales[locale], version.frozen.locales[locale]);
  const asOf = instantOfDay(version.frozen.effectiveFrom);
  const previousAsOf = instantOfDay(previous.version.frozen.effectiveFrom);
  return (
    <section aria-labelledby="legal-version-changes">
      <h2 id="legal-version-changes">{t('versions.changesTitle', { version: previous.version.frozen.version })}</h2>
      <ul>
        {changes.map((change) => (
          <ChangeItem key={`${change.kind}-${change.id}`} change={change} asOf={asOf} previousAsOf={previousAsOf} />
        ))}
      </ul>
    </section>
  );
}

function PublishedVersion({ document, version }: VersionProps): React.JSX.Element {
  const { t } = useTranslation('legal');
  const text = useFrozenText(version);
  return (
    <>
      <h1>{t('versions.versionTitle', { title: text.title, version: version.frozen.version })}</h1>
      <VersionFacts document={document} version={version} />
      <ChangesSince document={document} version={version} />
      <LegalDocumentBody version={version} />
    </>
  );
}

export function LegalVersionDetail({ document, version }: { readonly document: LegalDocumentId; readonly version: number }): React.JSX.Element {
  const { t } = useTranslation('legal');
  const lookup = legalDocumentVersion(document, version);
  if (lookup.kind === 'absent') return <p>{t('versions.absent')}</p>;
  return <PublishedVersion document={document} version={lookup.version} />;
}

/** Μόνο θετικός ακέραιος χωρίς μηδενικά μπροστά — το «01» και το «1.0» δεν είναι εκδόσεις. */
export const VERSION_SEGMENT = /^[1-9]\d*$/;

/** Η **σελίδα** `/<έγγραφο>/versions/[version]`. Άκυρο τμήμα ⇒ 404 — ποτέ «κάποια» έκδοση στη θέση της. */
export function LegalVersionRoute({ document }: { readonly document: LegalDocumentId }): React.JSX.Element {
  const { version } = useParams<{ version: string }>();
  if (!VERSION_SEGMENT.test(version)) notFound();
  return (
    <ShellSurface measure="prose">
      <LegalVersionDetail document={document} version={Number(version)} />
    </ShellSurface>
  );
}
