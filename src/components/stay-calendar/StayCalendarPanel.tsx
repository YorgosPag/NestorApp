'use client';

/**
 * **Το πάνελ της επιλογής** — τι επιλέχθηκε, τι σημαίνει, τι μπορεί να γίνει.
 *
 * 🔑 Οι πράξεις βγαίνουν από το **νόημα** της επιλογής (`selectionMeaning`), ποτέ από
 * το πού κλίκαρε ο άνθρωπος: ελεύθερες νύχτες ⇒ κλείσιμο/κράτηση· νύχτες **μίας**
 * εγγραφής ⇒ άνοιγμα/ακύρωση· ανάμικτες ⇒ καμία πράξη, μόνο εξήγηση. Μερική εκτέλεση
 * («κλείσε όσες είναι ελεύθερες») δεν προσφέρεται — θα ήταν σιωπηλή απόφαση.
 *
 * @related ADR-835 §20 (Στάδιο Α) · lib/stay/stay-calendar-month.ts
 */

import React from 'react';
import { COLOR_BRIDGE } from '@/design-system/color-bridge';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatCalendarDay } from '@/lib/intl-formatting';
import type { StayCalendarCommand } from '@/lib/stay/stay-calendar-command';
import type { StayNightSelection, StaySelectionMeaning } from '@/lib/stay/stay-calendar-month';
import { isPendingEntry } from '@/lib/stay/stay-calendar-optimistic';
import type { StayCalendarEntryView } from '@/lib/stay/stay-calendar-view';
import { cn } from '@/lib/utils';
import type { StayCalendarMessage, StayCalendarMessageId } from './stay-calendar-outcome';
import { StayBlockForm, StayBookingForm } from './StayCalendarForms';
import { StayDayRulesForm } from './StayDayRulesForm';
import { StayEntryParty } from './StayEntryParty';
import { StayRuleWarningsConfirm, type StayPendingWarnings } from './StayRuleWarningsConfirm';
import type { StayDayRules } from '@/types/stay-rules';

/** Κλειδιά ως ΚΥΡΙΟΛΕΚΤΙΚΑ — η γεννήτρια των route slices τα διαβάζει από εδώ (ADR-744). */
const MESSAGE: Readonly<Record<StayCalendarMessageId, string>> = {
  saved: 'property-market:offer.stayCalendar.outcome.saved',
  conflictBlock: 'property-market:offer.stayCalendar.outcome.conflictBlock',
  conflictBooking: 'property-market:offer.stayCalendar.outcome.conflictBooking',
  notAStay: 'property-market:offer.stayCalendar.outcome.notAStay',
  unreadable: 'property-market:offer.stayCalendar.outcome.unreadable',
  entryAbsent: 'property-market:offer.stayCalendar.outcome.entryAbsent',
  externalSource: 'property-market:offer.stayCalendar.outcome.externalSource',
  lifecycle: 'property-market:offer.stayCalendar.outcome.lifecycle',
  absent: 'property-market:offer.stayCalendar.outcome.absent',
  failed: 'property-market:offer.stayCalendar.outcome.failed',
  rulesUnacknowledged: 'property-market:offer.stayCalendar.outcome.rulesUnacknowledged',
  contradictoryRules: 'property-market:offer.stayCalendar.outcome.contradictoryRules',
  conflictRequest: 'property-market:offer.stayCalendar.outcome.conflictRequest',
  holdLapsed: 'property-market:offer.stayCalendar.outcome.holdLapsed',
};

const ACTION = 'self-start rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50';

interface StayCalendarPanelProps {
  readonly selection: StayNightSelection | null;
  readonly meaning: StaySelectionMeaning | null;
  readonly busy: boolean;
  /** `true` όταν το ημερολόγιο δεν διαβάζεται — καμία πράξη (δες `StayCalendarView`). */
  readonly locked: boolean;
  readonly message: StayCalendarMessage | null;
  /** Κράτηση που παρακάμπτει κανόνες και περιμένει ρητή επιβεβαίωση (ADR-835 §21). */
  readonly warnings: StayPendingWarnings | null;
  readonly days: StayDayRules;
  readonly onSend: (command: StayCalendarCommand) => void;
  readonly onClear: () => void;
  readonly onDismissWarnings: () => void;
}

interface DetailsProps<E extends StayCalendarEntryView['kind']> {
  readonly entry: Extract<StayCalendarEntryView, { kind: E }>;
  readonly range: string;
  readonly busy: boolean;
  readonly onSend: (command: StayCalendarCommand) => void;
}

function BlockDetails({ entry, range, busy, onSend }: DetailsProps<'block'>): React.ReactElement {
  const { t } = useTranslation(['property-market']);
  const external = entry.source === 'external';
  return (
    <article className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-foreground">
        {external ? t('property-market:offer.stayCalendar.entry.externalTitle') : t('property-market:offer.stayCalendar.entry.blockTitle')}
      </h3>
      <p className="text-sm text-foreground">{range}</p>
      {entry.note !== null && <p className="text-sm text-muted-foreground">{entry.note}</p>}
      {external ? (
        <p className="text-sm text-muted-foreground">{t('property-market:offer.stayCalendar.entry.externalHint')}</p>
      ) : (
        <button type="button" disabled={busy} onClick={() => onSend({ action: 'unblock', blockId: entry.id })} className={cn(ACTION, COLOR_BRIDGE.action.secondary)}>
          {t('property-market:offer.stayCalendar.entry.unblock')}
        </button>
      )}
    </article>
  );
}

function BookingDetails({ entry, range, busy, onSend }: DetailsProps<'booking'>): React.ReactElement {
  const { t } = useTranslation(['property-market']);
  // Στάδιο Δ: **μόνο** η επιβεβαιωμένη ακυρώνεται· το ζωντανό αίτημα απαντιέται από το εισερχόμενο.
  const pendingRequest = entry.lifecycle === 'requested' && entry.occupies;
  return (
    <article className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-foreground">
        {pendingRequest ? t('property-market:offer.stayCalendar.entry.requestTitle') : t('property-market:offer.stayCalendar.entry.bookingTitle')}
      </h3>
      <p className="text-sm text-foreground">{range}</p>
      {entry.guestLabel !== null && <p className="text-sm text-foreground">{entry.guestLabel}</p>}
      <StayEntryParty entry={entry} />
      {pendingRequest && <p className="text-sm text-muted-foreground">{t('property-market:offer.stayCalendar.entry.requestHint')}</p>}
      {entry.lifecycle === 'confirmed' && (
        <button type="button" disabled={busy} onClick={() => onSend({ action: 'cancel', bookingId: entry.id })} className={cn(ACTION, COLOR_BRIDGE.action.caution)}>
          {t('property-market:offer.stayCalendar.entry.cancel')}
        </button>
      )}
    </article>
  );
}

function EntryDetails({ entry, busy, onSend }: {
  readonly entry: StayCalendarEntryView;
  readonly busy: boolean;
  readonly onSend: (command: StayCalendarCommand) => void;
}): React.ReactElement {
  const { t } = useTranslation(['property-market']);
  if (isPendingEntry(entry)) {
    return <p className="text-sm text-muted-foreground">{t('property-market:offer.stayCalendar.selection.pending')}</p>;
  }
  const range = t('property-market:offer.stayCalendar.entry.range', {
    from: formatCalendarDay(entry.from, true), to: formatCalendarDay(entry.to, true),
  });
  return entry.kind === 'block'
    ? <BlockDetails entry={entry} range={range} busy={busy} onSend={onSend} />
    : <BookingDetails entry={entry} range={range} busy={busy} onSend={onSend} />;
}

export function StayCalendarPanel(props: StayCalendarPanelProps): React.ReactElement {
  const { t } = useTranslation(['property-market']);
  const { selection, meaning, busy, locked, message, warnings, days, onSend, onClear, onDismissWarnings } = props;

  return (
    <aside aria-live="polite" className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4">
      {message !== null && (
        <p role={message.tone === 'alert' ? 'alert' : 'status'} className={cn('text-sm', message.tone === 'alert' ? COLOR_BRIDGE.text.error : COLOR_BRIDGE.text.primary)}>
          {t(MESSAGE[message.id], message.params)}
        </p>
      )}
      {warnings !== null && (
        <StayRuleWarningsConfirm pending={warnings} busy={busy} onSend={onSend} onDismiss={onDismissWarnings} />
      )}
      {selection === null || meaning === null ? (
        <p className="text-sm text-muted-foreground">{t('property-market:offer.stayCalendar.selection.prompt')}</p>
      ) : (
        <>
          <header className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-foreground">
              {t('property-market:offer.stayCalendar.selection.summary', {
                nights: selection.nights, from: formatCalendarDay(selection.from, true), to: formatCalendarDay(selection.to, true),
              })}
            </p>
            <button type="button" onClick={onClear} className="text-sm text-foreground underline">
              {t('property-market:offer.stayCalendar.selection.clear')}
            </button>
          </header>
          {!locked && meaning.kind === 'free' && (
            <>
              <StayBookingForm selection={selection} busy={busy} onSend={onSend} />
              <StayBlockForm selection={selection} busy={busy} onSend={onSend} />
            </>
          )}
          {!locked && meaning.kind === 'entry' && <EntryDetails entry={meaning.entry} busy={busy} onSend={onSend} />}
          {meaning.kind === 'mixed' && <p className="text-sm text-muted-foreground">{t('property-market:offer.stayCalendar.selection.mixed')}</p>}
          {/* Οι κανόνες ανά ημερομηνία ισχύουν όποια κι αν είναι η κατάσταση των νυχτών. */}
          {!locked && <StayDayRulesForm selection={selection} days={days} busy={busy} onSend={onSend} />}
        </>
      )}
    </aside>
  );
}
