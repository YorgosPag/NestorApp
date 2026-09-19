'use client';

/**
 * **Τα αιτήματα που περιμένουν απάντηση** — το εισερχόμενο του οικοδεσπότη (ADR-835 §23.8).
 *
 * 🔴 **ΧΩΡΙΣ παράθυρο μήνα, ΚΑΙ ΠΑΝΩ από το πλέγμα.** Ένα αίτημα για τον Αύγουστο δεν επιτρέπεται να
 * είναι αόρατο επειδή η οθόνη δείχνει τον Μάρτιο — θα έληγε χωρίς να το δει κανείς. Η πιο επείγουσα
 * προθεσμία πρώτη.
 *
 * 🔑 **Η προθεσμία λέγεται, δεν τιμωρεί**: «απαντήστε ως Τρίτη 14:00». Αν περάσει, το αίτημα λήγει
 * και οι μέρες ανοίγουν — **χωρίς** πτώση θέσης στην αναζήτηση (το αντίθετο του Airbnb/Vrbo, §4.11).
 *
 * @related lib/stay/stay-calendar-view.ts (`pendingRequests`) · services/stay-calendar/stay-calendar-request-write.ts
 */

import React from 'react';
import { COLOR_BRIDGE } from '@/design-system/color-bridge';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatCalendarDay, formatDateTime } from '@/lib/intl-formatting';
import type { StayCalendarCommand } from '@/lib/stay/stay-calendar-command';
import type { StayCalendarEntryView } from '@/lib/stay/stay-calendar-view';
import { STAY_HOLD_TIME_FORMAT } from '@/lib/stay/stay-hold-deadline';
import { cn } from '@/lib/utils';
import { StayEntryParty } from './StayEntryParty';

const ACTION = 'rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-50';

type BookingView = Extract<StayCalendarEntryView, { kind: 'booking' }>;

function RequestItem({ request, busy, onSend }: {
  readonly request: BookingView;
  readonly busy: boolean;
  readonly onSend: (command: StayCalendarCommand) => void;
}): React.ReactElement {
  const { t } = useTranslation(['property-market']);
  const range = t('property-market:offer.stayCalendar.entry.range', {
    from: formatCalendarDay(request.from, true), to: formatCalendarDay(request.to, true),
  });
  return (
    <li className="flex flex-col gap-1 rounded-md border border-border p-3">
      <p className="text-sm font-medium text-foreground">
        {request.guestLabel ?? t('property-market:offer.stayCalendar.requests.guestWithoutName')} · {range}
      </p>
      <StayEntryParty entry={request} />
      {request.holdExpiresAt !== null && (
        <p className="text-sm text-foreground">
          {t('property-market:offer.stayCalendar.requests.replyBy', { until: formatDateTime(request.holdExpiresAt, STAY_HOLD_TIME_FORMAT) })}
        </p>
      )}
      {request.riskDisclosedAt !== null && (
        <p className="text-sm text-muted-foreground">{t('property-market:offer.stayCalendar.requests.riskDisclosed')}</p>
      )}
      <menu className="flex flex-wrap gap-2">
        <li>
          <button type="button" disabled={busy} className={cn(ACTION, COLOR_BRIDGE.action.primary)}
            onClick={() => onSend({ action: 'accept', bookingId: request.id })}>
            {t('property-market:offer.stayCalendar.requests.accept')}
          </button>
        </li>
        <li>
          <button type="button" disabled={busy} className={cn(ACTION, COLOR_BRIDGE.action.caution)}
            onClick={() => onSend({ action: 'decline', bookingId: request.id })}>
            {t('property-market:offer.stayCalendar.requests.decline')}
          </button>
        </li>
      </menu>
    </li>
  );
}

export function StayRequestsInbox({ requests, busy, onSend }: {
  readonly requests: readonly StayCalendarEntryView[];
  readonly busy: boolean;
  readonly onSend: (command: StayCalendarCommand) => void;
}): React.ReactElement | null {
  const { t } = useTranslation(['property-market']);
  const bookings = requests.filter((entry): entry is BookingView => entry.kind === 'booking');
  if (bookings.length === 0) return null;
  return (
    <section aria-labelledby="stay-requests-heading" className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4">
      <h2 id="stay-requests-heading" className="text-base font-semibold text-foreground">
        {t('property-market:offer.stayCalendar.requests.heading', { count: bookings.length })}
      </h2>
      <ul className="flex flex-col gap-2">
        {bookings.map((request) => <RequestItem key={request.id} request={request} busy={busy} onSend={onSend} />)}
      </ul>
    </section>
  );
}
