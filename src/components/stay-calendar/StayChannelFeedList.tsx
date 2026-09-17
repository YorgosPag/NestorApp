'use client';

/**
 * **ΟΙ ΠΗΓΕΣ ΕΙΣΑΓΩΓΗΣ** — μία γραμμή ανά κανάλι: βαθμίδα, πότε διαβάστηκε, τι έσπασε,
 * και **οι δύο διέξοδοι** (συγχρονισμός τώρα · αφαίρεση).
 *
 * 🏆 **Η βαθμίδα λέγεται με ΛΕΞΗ, όχι με χρώμα** (WCAG 1.4.1) — και η λέξη είναι η
 * απάντηση στο *«τι βλέπει ο επισκέπτης τώρα;»*: στο `stale` οι ελεύθερες νύχτες του
 * καταλύματος **δεν** διαφημίζονται ως ελεύθερες. Η αγορά δείχνει «Warning» και
 * συνεχίζει να πουλά.
 *
 * @related ADR-835 §22 (Στάδιο Γ) · lib/stay/stay-channel-command.ts
 */

import React from 'react';
import { AlertTriangle, CheckCircle2, Clock, Link2, PauseCircle, RefreshCw, Trash2 } from 'lucide-react';
import { COLOR_BRIDGE } from '@/design-system/color-bridge';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatRelativeTime } from '@/lib/intl-formatting';
import type { StayChannelCommand, StayChannelFeedView } from '@/lib/stay/stay-channel-command';
import { cn } from '@/lib/utils';
import type { StayChannelFreshness } from '@/types/stay-channels';

/** Κλειδιά ως ΚΥΡΙΟΛΕΚΤΙΚΑ — η γεννήτρια των route slices τα διαβάζει από εδώ (ADR-744). */
const FRESHNESS_LABEL: Readonly<Record<StayChannelFreshness, string>> = {
  fresh: 'property-market:offer.stayChannels.freshness.fresh',
  lagging: 'property-market:offer.stayChannels.freshness.lagging',
  stale: 'property-market:offer.stayChannels.freshness.stale',
  paused: 'property-market:offer.stayChannels.freshness.paused',
};

const FRESHNESS_ICON: Readonly<Record<StayChannelFreshness, typeof CheckCircle2>> = {
  fresh: CheckCircle2,
  lagging: Clock,
  stale: AlertTriangle,
  paused: PauseCircle,
};

const FRESHNESS_TONE: Readonly<Record<StayChannelFreshness, string>> = {
  fresh: 'text-foreground',
  lagging: 'text-muted-foreground',
  stale: 'text-destructive',
  paused: 'text-destructive',
};

const BUTTON = 'inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-foreground disabled:opacity-50';

interface StayChannelFeedRowProps {
  readonly feed: StayChannelFeedView;
  readonly busy: boolean;
  readonly onSend: (command: StayChannelCommand) => void;
}

function StayChannelFeedRow({ feed, busy, onSend }: StayChannelFeedRowProps): React.ReactElement {
  const { t } = useTranslation(['property-market']);
  const Icon = FRESHNESS_ICON[feed.freshness];
  const alerting = feed.freshness === 'stale' || feed.freshness === 'paused';

  return (
    <li className={cn('flex flex-col gap-2 rounded-lg border border-border p-3', alerting && COLOR_BRIDGE.bg.warning)}>
      <header className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Link2 aria-hidden className="size-4" />
          {feed.label}
          <span className="text-xs font-normal text-muted-foreground">{feed.host}</span>
        </span>
        <span className={cn('flex items-center gap-1.5 text-xs font-medium', FRESHNESS_TONE[feed.freshness])}>
          <Icon aria-hidden className="size-4" />
          {t(FRESHNESS_LABEL[feed.freshness])}
        </span>
      </header>

      <p className="text-xs text-muted-foreground">
        {feed.lastSuccessAt === null
          ? t('property-market:offer.stayChannels.neverRead')
          : t('property-market:offer.stayChannels.lastRead', {
            when: formatRelativeTime(feed.lastSuccessAt),
            count: feed.eventCount,
          })}
      </p>

      {feed.lastFailure !== null && (
        <p role="alert" className="text-xs text-foreground">
          {t('property-market:offer.stayChannels.lastFailure', { code: feed.lastFailure })}
        </p>
      )}

      {/* 🔴 Η Booking.com δεν δέχεται τον σύνδεσμό μας (03/2025): λέγεται, δεν υπονοείται. */}
      {!feed.acceptsImport && (
        <p className="text-xs text-foreground">{t('property-market:offer.stayChannels.oneWay')}</p>
      )}

      {feed.exportUrl !== null && (
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          {t('property-market:offer.stayChannels.feedExportLabel', { label: feed.label })}
          <input
            type="text" readOnly value={feed.exportUrl}
            onFocus={(event) => event.currentTarget.select()}
            className="w-full rounded-md border border-border bg-card px-2 py-1.5 font-mono text-xs text-foreground"
          />
        </label>
      )}

      <footer className="flex flex-wrap gap-2">
        <button type="button" disabled={busy} className={BUTTON}
          onClick={() => onSend({ action: 'sync-feed', feedId: feed.id })}>
          <RefreshCw aria-hidden className="size-3.5" />
          {t('property-market:offer.stayChannels.syncNow')}
        </button>
        <button type="button" disabled={busy} className={BUTTON}
          onClick={() => onSend({ action: 'remove-feed', feedId: feed.id })}>
          <Trash2 aria-hidden className="size-3.5" />
          {t('property-market:offer.stayChannels.remove')}
        </button>
      </footer>
    </li>
  );
}

interface StayChannelFeedListProps {
  readonly feeds: readonly StayChannelFeedView[];
  readonly busy: boolean;
  readonly onSend: (command: StayChannelCommand) => void;
}

export function StayChannelFeedList({ feeds, busy, onSend }: StayChannelFeedListProps): React.ReactElement {
  const { t } = useTranslation(['property-market']);
  if (feeds.length === 0) {
    return <p className="text-sm text-muted-foreground">{t('property-market:offer.stayChannels.noFeeds')}</p>;
  }
  return (
    <ul className="flex flex-col gap-2">
      {feeds.map((feed) => (
        <StayChannelFeedRow key={feed.id} feed={feed} busy={busy} onSend={onSend} />
      ))}
    </ul>
  );
}
