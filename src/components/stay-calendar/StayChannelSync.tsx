'use client';

/**
 * **ΣΥΓΧΡΟΝΙΣΜΟΣ ΜΕ ΤΑ ΚΑΝΑΛΙΑ** — ο σύνδεσμος εξαγωγής, οι πηγές εισαγωγής, οι
 * συγκρούσεις.
 *
 * 🔑 **Η οθόνη δεν αποφασίζει τίποτα**: η βαθμίδα φρεσκάδας, η αποδοχή εισαγωγής ανά
 * κανάλι και οι συγκρούσεις έρχονται **υπολογισμένες** από τον διακομιστή. Εδώ ζει μόνο
 * η σύνθεση και οι λέξεις.
 *
 * ⚠️ **Καμία αισιόδοξη ενημέρωση** — δες `useStayChannels` για το γιατί.
 *
 * @related ADR-835 §22 (Στάδιο Γ) · hooks/owner-property/useStayChannels.ts
 */

import React from 'react';
import { KeyRound, Link2 } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { StayChannelCommand } from '@/lib/stay/stay-channel-command';
import { useStayChannels } from '@/hooks/owner-property/useStayChannels';
import type { StayChannelsSendOutcome } from '@/services/stay-calendar/stay-channels.client';
import { StayChannelAddForm } from './StayChannelAddForm';
import { StayChannelConflicts } from './StayChannelConflicts';
import { StayChannelFeedList } from './StayChannelFeedList';
import { stayChannelMessageOf, type StayChannelMessageId } from './stay-channel-outcome';

/** Κλειδιά ως ΚΥΡΙΟΛΕΚΤΙΚΑ — η γεννήτρια των route slices τα διαβάζει από εδώ (ADR-744). */
const MESSAGE_KEYS: Readonly<Record<StayChannelMessageId, string>> = {
  saved: 'property-market:offer.stayChannels.message.saved',
  feedUnreadable: 'property-market:offer.stayChannels.message.feedUnreadable',
  duplicate: 'property-market:offer.stayChannels.message.duplicate',
  tooMany: 'property-market:offer.stayChannels.message.tooMany',
  tooSoon: 'property-market:offer.stayChannels.message.tooSoon',
  feedAbsent: 'property-market:offer.stayChannels.message.feedAbsent',
  notAStay: 'property-market:offer.stayChannels.message.notAStay',
  unreadable: 'property-market:offer.stayChannels.message.unreadable',
  exportUnconfigured: 'property-market:offer.stayChannels.message.exportUnconfigured',
  absent: 'property-market:offer.stayChannels.message.absent',
  failed: 'property-market:offer.stayChannels.message.failed',
};

const BUTTON = 'inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground disabled:opacity-50';

function StayChannelExport({ url, configured, busy, onSend }: {
  readonly url: string | null;
  readonly configured: boolean;
  readonly busy: boolean;
  readonly onSend: (command: StayChannelCommand) => void;
}): React.ReactElement {
  const { t } = useTranslation(['property-market']);
  const [confirming, setConfirming] = React.useState(false);

  if (!configured || url === null) {
    return (
      <p role="status" className="text-sm text-foreground">
        {t('property-market:offer.stayChannels.export.unconfigured')}
      </p>
    );
  }

  return (
    <section className="flex flex-col gap-2">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Link2 aria-hidden className="size-4" />
        {t('property-market:offer.stayChannels.export.title')}
      </h3>
      <p className="text-xs text-muted-foreground">{t('property-market:offer.stayChannels.export.hint')}</p>
      <input
        type="text" readOnly value={url} aria-label={t('property-market:offer.stayChannels.export.title')}
        onFocus={(event) => event.currentTarget.select()}
        className="w-full rounded-md border border-border bg-card px-3 py-2 font-mono text-xs text-foreground"
      />
      {confirming ? (
        <p className="flex flex-wrap items-center gap-2 text-sm text-foreground">
          {t('property-market:offer.stayChannels.export.rotateConfirm')}
          <button type="button" disabled={busy} className={BUTTON}
            onClick={() => { setConfirming(false); onSend({ action: 'rotate-export' }); }}>
            {t('property-market:offer.stayChannels.export.rotateYes')}
          </button>
          <button type="button" className={BUTTON} onClick={() => setConfirming(false)}>
            {t('property-market:offer.stayChannels.export.rotateNo')}
          </button>
        </p>
      ) : (
        <button type="button" disabled={busy} className={`${BUTTON} w-fit`} onClick={() => setConfirming(true)}>
          <KeyRound aria-hidden className="size-4" />
          {t('property-market:offer.stayChannels.export.rotate')}
        </button>
      )}
    </section>
  );
}

/**
 * **Ο συγχρονισμός καναλιών μιας αγγελίας.** Αυτόνομο: φορτώνει και γράφει μόνο του.
 *
 * ⚠️ **`export default`, επίτηδες**: φορτώνεται πίσω από **όριο `next/dynamic`** (ADR-744
 * Κ2) — τα ~5 KB κλειδιών του είναι **κάτω** από το πλέγμα και δεν χρειάζονται στο πρώτο
 * καρέ. Δες `StayCalendarContent`.
 */
export default function StayChannelSync({ ownerPropertyId }: { readonly ownerPropertyId: string }): React.ReactElement {
  const { t } = useTranslation(['property-market']);
  const channels = useStayChannels(ownerPropertyId);
  const [outcome, setOutcome] = React.useState<StayChannelsSendOutcome | null>(null);

  const send = (command: StayChannelCommand): void => {
    void channels.send(command).then(setOutcome);
  };

  const message = outcome === null ? null : stayChannelMessageOf(outcome);
  const view = channels.state.kind === 'ready' ? channels.state.view : null;

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border p-4">
      <header className="flex flex-col gap-1">
        <h2 className="text-base font-semibold text-foreground">
          {t('property-market:offer.stayChannels.title')}
        </h2>
        <p className="text-sm text-muted-foreground">{t('property-market:offer.stayChannels.lead')}</p>
      </header>

      {channels.state.kind === 'loading' && (
        <p className="text-sm text-muted-foreground">{t('property-market:offer.stayChannels.loading')}</p>
      )}
      {(channels.state.kind === 'absent' || channels.state.kind === 'failed') && (
        <p className="flex items-center gap-3 text-sm text-foreground">
          {t('property-market:offer.stayChannels.failed')}
          <button type="button" onClick={channels.reload} className="underline">
            {t('property-market:offer.stayChannels.retry')}
          </button>
        </p>
      )}
      {view?.kind === 'unreadable' && (
        <p role="alert" className="text-sm text-foreground">
          {t('property-market:offer.stayChannels.calendarUnreadable')}
        </p>
      )}

      {message !== null && (
        <p role={message.tone === 'alert' ? 'alert' : 'status'} className="text-sm text-foreground">
          {t(MESSAGE_KEYS[message.id], message.params)}
        </p>
      )}

      {view?.kind === 'readable' && (
        <>
          <StayChannelExport
            url={view.exportUrl} configured={view.exportConfigured}
            busy={channels.busy} onSend={send}
          />
          <StayChannelConflicts conflicts={view.conflicts} />
          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-foreground">
              {t('property-market:offer.stayChannels.import.title')}
            </h3>
            <StayChannelFeedList feeds={view.feeds} busy={channels.busy} onSend={send} />
          </section>
          <StayChannelAddForm busy={channels.busy} disabled={false} onSend={send} />
        </>
      )}
    </section>
  );
}
