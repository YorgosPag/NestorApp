'use client';

/**
 * @fileoverview **Η καρτέλα «Εκδόσεις»** — η χρονογραμμή των δημοσιευμένων με δείκτη «σήμερα», οι πρόχειρες με τις
 *   πράξεις τους, και το ιστορικό απορρίψεων (ADR-923 §5.11 «3δ» Τμήμα 1).
 * @related price-list-summary.ts (η ΜΙΑ χρονογραμμή: παραγόμενο «έως», φάσεις) · DraftVersionRow.tsx · NewVersionDialog.tsx
 * @module components/catalog/pricing/VersionTimeline
 *
 * 🔑 **Το «έως» παράγεται** από την επόμενη δημοσιευμένη (SAP: η νέα περίοδος κόβει την προηγούμενη) — εδώ μόνο φαίνεται.
 * 🔑 Νεότερη πρώτη, με τον δείκτη «σήμερα» **ανάμεσα** στις μελλοντικές και την τρέχουσα: ο αγοραστής βλέπει τι ισχύει
 *    και τι έρχεται χωρίς να συγκρίνει ημερομηνίες. Η φάση είναι **λέξη + εικονίδιο**, όχι μόνο χρώμα (CHECK 3.41).
 * 🔑 Το «τώρα» είναι η στιγμή της όψης (`asOf`) — ίδιο στιγμιότυπο με τα δεδομένα, άρα δεν διαφωνεί με τη λίστα.
 */

import React, { useState } from 'react';
import { CalendarClock, Plus } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { formatDate } from '@/lib/intl-formatting';
import type { PriceListVersionWire } from '@/subapps/catalog/types/pricing-views';
import { useCatalogText } from '../shared/catalog-ui-hooks';
import { DraftVersionRow } from './DraftVersionRow';
import { NewVersionDialog } from './NewVersionDialog';
import { summarizePriceList, type TimelineBand } from './price-list-summary';
import { TIMELINE_PHASE_BADGES, TIMELINE_PHASE_ICONS, TIMELINE_PHASE_KEYS, VERSION_STATUS_KEYS } from './pricing-labels';
import { NEW_VERSION_KEY, type PriceVersionActions } from './use-price-version-actions';

export interface VersionTimelineProps {
  readonly priceListId: string;
  readonly versions: readonly PriceListVersionWire[];
  readonly nowMs: number;
  readonly canManage: boolean;
  readonly canPublish: boolean;
  readonly actions: PriceVersionActions;
  readonly onOpenLines: (versionId: string) => void;
  readonly onPublish: (version: PriceListVersionWire) => void;
}

function PublishedBand({ band }: { readonly band: TimelineBand }) {
  const { t } = useCatalogText();
  const { version, window } = band.entry;
  const PhaseIcon = TIMELINE_PHASE_ICONS[band.phase];
  const from = window.fromMs === null ? '' : formatDate(new Date(window.fromMs));
  const until = window.untilMs === null ? t('pricing.versions.openEnded') : formatDate(new Date(window.untilMs));
  return (
    <li className="flex flex-wrap items-center gap-2 rounded-md border p-3">
      <Badge variant={TIMELINE_PHASE_BADGES[band.phase]} className="gap-1"><PhaseIcon className="h-3 w-3" aria-hidden />{t(TIMELINE_PHASE_KEYS[band.phase])}</Badge>
      <strong className="text-sm">{t('pricing.versions.number', { number: version.number })}</strong>
      <span className="text-sm text-muted-foreground">{t('pricing.versions.range', { from, until })}</span>
      {version.seal ? <span className="ml-auto text-xs text-muted-foreground">{t('pricing.versions.lineCount', { count: version.seal.lineCount })}</span> : null}
    </li>
  );
}

function TodayMarker({ nowMs }: { readonly nowMs: number }) {
  const { t } = useCatalogText();
  return (
    <li role="separator" className="flex items-center gap-2 text-xs font-semibold text-foreground">
      <CalendarClock className="h-4 w-4" aria-hidden />{t('pricing.versions.today', { date: formatDate(new Date(nowMs)) })}
      <hr className="m-0 flex-1 border-t-2 border-foreground" aria-hidden />
    </li>
  );
}

/** Νεότερη πρώτη · ο δείκτης «σήμερα» πριν από την πρώτη μη μελλοντική. */
function PublishedList({ bands, nowMs }: { readonly bands: readonly TimelineBand[]; readonly nowMs: number }) {
  const { t } = useCatalogText();
  const newest = [...bands].reverse();
  const todayAt = newest.findIndex((band) => band.phase !== 'future');
  const items = newest.map((band) => <PublishedBand key={band.entry.version.id} band={band} />);
  items.splice(todayAt === -1 ? items.length : todayAt, 0, <TodayMarker key="__today" nowMs={nowMs} />);
  return (
    <section className="flex flex-col gap-2" aria-labelledby="published-versions">
      <h3 id="published-versions" className="m-0 text-sm font-semibold">{t('pricing.versions.publishedTitle')}</h3>
      {bands.length === 0 ? <p className="m-0 text-sm text-muted-foreground">{t('pricing.versions.nonePublished')}</p> : <ol className="m-0 flex list-none flex-col gap-2 p-0">{items}</ol>}
    </section>
  );
}

function DiscardedList({ versions }: { readonly versions: readonly PriceListVersionWire[] }) {
  const { t } = useCatalogText();
  if (versions.length === 0) return null;
  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-muted-foreground">{t('pricing.versions.discardedTitle', { count: versions.length })}</summary>
      <ul className="mt-2 flex list-none flex-col gap-1 p-0">
        {versions.map((version) => (
          <li key={version.id} className="text-muted-foreground">{`${t('pricing.versions.number', { number: version.number })} · ${t(VERSION_STATUS_KEYS[version.status])}`}</li>
        ))}
      </ul>
    </details>
  );
}

export function VersionTimeline(props: VersionTimelineProps) {
  const { t } = useCatalogText();
  const { actions, canManage } = props;
  const summary = summarizePriceList(props.priceListId, props.versions, props.nowMs);
  const [creating, setCreating] = useState(false);
  const [discarding, setDiscarding] = useState<PriceListVersionWire | null>(null);
  return (
    <section className="flex flex-col gap-4 p-4" aria-label={t('pricing.versions.tab')}>
      <header className="flex flex-wrap items-center justify-between gap-2">
        <p className="m-0 text-sm text-muted-foreground">{t('pricing.versions.lead')}</p>
        {canManage ? (
          <Button type="button" disabled={actions.busy.has(NEW_VERSION_KEY)} onClick={() => setCreating(true)}><Plus className="mr-1 h-4 w-4" aria-hidden />{t('pricing.versions.new')}</Button>
        ) : null}
      </header>
      {summary.drafts.length > 0 ? (
        <section className="flex flex-col gap-2" aria-labelledby="draft-versions">
          <h3 id="draft-versions" className="m-0 text-sm font-semibold">{t('pricing.versions.draftsTitle')}</h3>
          {props.canPublish ? null : <p className="m-0 text-xs text-muted-foreground">{t('common.readOnlyPricingPublish')}</p>}
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {summary.drafts.map((version) => (
              <DraftVersionRow key={version.id} version={version} seededCopied={actions.seeded.get(version.id)} busy={actions.busy.has(version.id)}
                canManage={canManage} canPublish={props.canPublish}
                onValidFrom={(validFrom) => void actions.setValidFrom(version, validFrom)} onOpenLines={() => props.onOpenLines(version.id)}
                onPublish={() => props.onPublish(version)} onDiscard={() => setDiscarding(version)} onContinueSeed={() => void actions.seed(version)} />
            ))}
          </ul>
        </section>
      ) : null}
      <PublishedList bands={summary.bands} nowMs={props.nowMs} />
      <DiscardedList versions={summary.discarded} />
      <NewVersionDialog open={creating} onOpenChange={setCreating} hasPublished={summary.bands.length > 0} onCreate={actions.create} />
      <ConfirmDialog open={discarding !== null} onOpenChange={(open) => { if (!open) setDiscarding(null); }} variant="warning"
        title={t('pricing.versions.discardTitle', { number: discarding?.number ?? 0 })} description={t('pricing.versions.discardDescription')}
        confirmText={t('pricing.versions.discard')} cancelText={t('common.cancel')}
        onConfirm={async () => { if (discarding) await actions.discard(discarding); setDiscarding(null); }} />
    </section>
  );
}
