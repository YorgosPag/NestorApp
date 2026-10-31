'use client';

/**
 * @fileoverview **Οι εκδόσεις μιας συνταγής** — κατάσταση, φάση και πρόοδος, σελίδες, λήψη ανά προφίλ, αναφορά ποιότητας
 *   και αιτία αποτυχίας (ADR-923 §5.6.1).
 * @module components/catalog/publishing/PublicationRunList
 *
 * 🔑 Η κατάσταση **λέγεται με λέξη** (CHECK 3.41), ποτέ μόνο με χρώμα. Η αιτία αποτυχίας είναι κλειστό σύνολο
 *    (`PUBLICATION_FAILURES`): το UI τη μεταφράζει — κανένα ελεύθερο κείμενο μηχανής δεν φτάνει στον άνθρωπο.
 * 🔑 Η λήψη είναι **σύνδεσμος** προς τη διαδρομή λήψης: ο διακομιστής κρίνει (`pricingView`) και ο browser κουβαλά τη συνεδρία.
 * 🔑 Η αναφορά λέει ό,τι **δεν** μπήκε ή θέλει προσοχή — μηδενικά μετρητές δεν τυπώνονται (θόρυβος).
 */

import React from 'react';

import { Badge, type BadgeVariantProps } from '@/components/ui/badge';
import { formatDate } from '@/lib/intl-formatting';
import { CATALOG_API } from '@/subapps/catalog/catalog-routes';
import type { PublicationReport, PublicationRunStatus, PublicationRunWire } from '@/subapps/catalog/types/publication';
import { useCatalogText } from '../shared/catalog-ui-hooks';

const STATUS_BADGES: Readonly<Record<PublicationRunStatus, NonNullable<BadgeVariantProps['variant']>>> = {
  queued: 'secondary',
  running: 'info',
  ready: 'success',
  failed: 'destructive',
};

/** Οι γραμμές της αναφοράς με το κλειδί τους — ο πίνακας είναι το μόνο σημείο που ξέρει ποιο πεδίο έχει ποιο κείμενο. */
const REPORT_LINES: readonly { readonly field: keyof PublicationReport; readonly key: string }[] = [
  { field: 'incompleteSkuCount', key: 'publishing.report.incomplete' },
  { field: 'unpricedSkuCount', key: 'publishing.report.unpriced' },
  { field: 'lowResolutionImageCount', key: 'publishing.report.lowResolution' },
  { field: 'nonCmykImageCount', key: 'publishing.report.nonCmyk' },
];

function RunReport({ report }: { readonly report: PublicationReport }) {
  const { t } = useCatalogText();
  const lines = REPORT_LINES.filter((line) => report[line.field] > 0);
  if (lines.length === 0) return null;
  return (
    <section aria-label={t('publishing.report.title')} className="flex flex-col gap-0.5">
      <h4 className="m-0 text-xs font-semibold text-foreground">{t('publishing.report.title')}</h4>
      <ul className="m-0 flex list-disc flex-col gap-0.5 pl-5 text-xs text-muted-foreground">
        {lines.map((line) => <li key={line.field}>{t(line.key, { count: report[line.field] })}</li>)}
      </ul>
    </section>
  );
}

function RunProgress({ run }: { readonly run: PublicationRunWire }) {
  const { t } = useCatalogText();
  const { phase, pagesDone, pagesTotal } = run.progress;
  return (
    <p className="m-0 text-xs text-muted-foreground" aria-live="polite">
      {t(`publishing.phase.${phase}`)}
      {pagesTotal > 0 ? ` · ${t('publishing.progress', { done: pagesDone, total: pagesTotal })}` : ''}
    </p>
  );
}

function RunDownloads({ run }: { readonly run: PublicationRunWire }) {
  const { t } = useCatalogText();
  return (
    <ul className="m-0 flex list-none flex-wrap gap-3 p-0 text-sm">
      {run.artifacts.map((artifact) => (
        <li key={artifact.profile} className="flex flex-col">
          <a className="font-medium text-[hsl(var(--text-info))] underline underline-offset-2" download
            href={CATALOG_API.publicationDownload(run.id, artifact.profile)}>
            {t('publishing.download')} · {t(`publishing.profile.${artifact.profile}`)}
          </a>
          <span className="text-xs text-muted-foreground">{t('publishing.pages', { count: artifact.pageCount })}</span>
        </li>
      ))}
    </ul>
  );
}

function RunRow({ run }: { readonly run: PublicationRunWire }) {
  const { t } = useCatalogText();
  return (
    <li className="flex flex-col gap-2 rounded-md border p-3">
      <header className="flex flex-wrap items-center gap-2">
        <Badge variant={STATUS_BADGES[run.status]}>{t(`publishing.status.${run.status}`)}</Badge>
        <time className="text-xs text-muted-foreground" dateTime={run.requestedAt}>{formatDate(run.requestedAt)}</time>
      </header>
      {run.status === 'queued' || run.status === 'running' ? <RunProgress run={run} /> : null}
      {run.status === 'ready' ? <RunDownloads run={run} /> : null}
      {run.status === 'failed' && run.failure !== null ? (
        <p className="m-0 text-sm text-destructive" role="alert">{t(`publishing.failure.${run.failure}`)}</p>
      ) : null}
      {run.report !== null ? <RunReport report={run.report} /> : null}
    </li>
  );
}

export function PublicationRunList({ runs }: { readonly runs: readonly PublicationRunWire[] }) {
  const { t } = useCatalogText();
  const newestFirst = [...runs].sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
  return (
    <section className="flex flex-col gap-2" aria-label={t('publishing.runs')}>
      <h3 className="m-0 text-sm font-semibold text-foreground">{t('publishing.runs')}</h3>
      {newestFirst.length === 0 ? (
        <p className="m-0 text-sm text-muted-foreground">{t('publishing.noRuns')}</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {newestFirst.map((run) => <RunRow key={run.id} run={run} />)}
        </ul>
      )}
    </section>
  );
}
