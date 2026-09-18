'use client';

/**
 * **Το αίτημα κράτησης στη σελίδα της αγγελίας** — η υπόσχεση ΠΡΙΝ, η έκβαση ΜΕΤΑ, τα αιτήματά μου πάντα.
 *
 * 🏆 **Η υπόσχεση πριν την αποστολή**: «ο οικοδεσπότης θα απαντήσει ως Τρίτη 14:00 — ως τότε οι μέρες
 * κρατιούνται για εσάς». Η αγορά δείχνει μέσο όρο απόκρισης τρίτων («απαντά συνήθως σε 3 ώρες»)· εδώ
 * δείχνεται **η ώρα που δεσμεύει**, από την **ίδια** σύνθεση που θα τη γράψει (`stayRequestPreview`).
 *
 * ⚠️ **Καμία αισιόδοξη έκβαση**: «στάλθηκε» λέγεται μόνο όταν το είπε ο διακομιστής — ένα αίτημα που
 * φαίνεται κρατημένο και μετά αποδεικνύεται «όχι» είναι ψέμα για διαμονή (δες `useMyStayRequests`).
 *
 * @related ADR-835 §23 · §4.7 (αποκάλυψη πώλησης) · hooks/listings/useMyStayRequests.ts
 */

import React from 'react';
import { useAuth } from '@/auth/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useMyStayRequests } from '@/hooks/listings/useMyStayRequests';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatCalendarDay, formatDateTime } from '@/lib/intl-formatting';
import { loginHref } from '@/lib/routes/return-path';
import { STAY_BOOKING_MAX_GUESTS } from '@/lib/stay/stay-calendar-command';
import type { StayGuestRequestView } from '@/lib/stay/stay-guest-request-view';
import { STAY_HOLD_TIME_FORMAT, type StayHoldBound } from '@/lib/stay/stay-hold-deadline';
import type { PublicStayAnswer } from '@/lib/stay/stay-public-request';
import { isStayable } from '@/lib/stay/stay-availability-vocabulary';
import { Link, usePathname } from '@/lib/workspace/navigation';
import type { StayCalendarSendOutcome } from '@/services/stay-calendar/stay-calendar.client';
import type { StayBookingLifecycle } from '@/types/stay-booking';

type T = (key: string, params?: Record<string, unknown>) => string;

/** Η υπόσχεση, ανά ταβάνι που κέρδισε — κλειδιά ΚΥΡΙΟΛΕΚΤΙΚΑ (ADR-744). */
const PROMISE_KEY: Readonly<Record<StayHoldBound, string>> = {
  'response-hours': 'short-stay:request.promise.response-hours',
  stretch: 'short-stay:request.promise.stretch',
  arrival: 'short-stay:request.promise.arrival',
};

/** Η κατάσταση ενός δικού μου αιτήματος που **δεν** είναι σε αναμονή. */
const STATUS_KEY: Readonly<Record<StayBookingLifecycle, string>> = {
  // `requested` που δεν είναι σε αναμονή = η προθεσμία πέρασε και το cron δεν το έχει γράψει ακόμη.
  requested: 'short-stay:request.status.expired',
  confirmed: 'short-stay:request.status.confirmed',
  declined: 'short-stay:request.status.declined',
  expired: 'short-stay:request.status.expired',
  withdrawn: 'short-stay:request.status.withdrawn',
  cancelled: 'short-stay:request.status.cancelled',
  completed: 'short-stay:request.status.completed',
};

/** Η έκβαση μιας πράξης μου, με λέξεις — `Record`: νέα έκβαση δεν μένει ποτέ χωρίς πρόταση. */
const OUTCOME_KEY: Readonly<Record<StayCalendarSendOutcome['kind'], string>> = {
  ok: 'short-stay:request.outcome.ok',
  conflict: 'short-stay:request.outcome.taken',
  unavailable: 'short-stay:request.outcome.taken',
  'too-late': 'short-stay:request.outcome.too-late',
  'risk-not-acknowledged': 'short-stay:request.outcome.risk',
  'guest-hold-limit': 'short-stay:request.outcome.limit',
  'hold-lapsed': 'short-stay:request.outcome.lapsed',
  'own-listing': 'short-stay:request.outcome.own-listing',
  'not-changeable': 'short-stay:request.outcome.lapsed',
  absent: 'short-stay:request.outcome.failed',
  'not-a-stay': 'short-stay:request.outcome.failed',
  unreadable: 'short-stay:request.outcome.failed',
  'entry-absent': 'short-stay:request.outcome.failed',
  'rules-unacknowledged': 'short-stay:request.outcome.failed',
  'contradictory-rules': 'short-stay:request.outcome.failed',
  'hold-alive': 'short-stay:request.outcome.failed',
  failed: 'short-stay:request.outcome.failed',
};

const untilOf = (iso: string): string => formatDateTime(iso, STAY_HOLD_TIME_FORMAT);
const rangeOf = (from: string, to: string): string => `${formatCalendarDay(from, true)} – ${formatCalendarDay(to, true)}`;

function MyRequestLine({ request, busy, onWithdraw, t }: {
  readonly request: StayGuestRequestView;
  readonly busy: boolean;
  readonly onWithdraw: (id: string) => void;
  readonly t: T;
}): React.ReactElement {
  const range = rangeOf(request.checkIn, request.checkOut);
  if (!request.pending || request.holdExpiresAt === null) {
    return <li className="text-sm text-muted-foreground">{t('short-stay:request.mineLine', { range, status: t(STATUS_KEY[request.lifecycle]) })}</li>;
  }
  return (
    <li className="flex flex-wrap items-center gap-2 text-sm text-foreground">
      {t('short-stay:request.minePending', { range, until: untilOf(request.holdExpiresAt) })}
      <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => onWithdraw(request.id)}>
        {t('short-stay:request.withdraw')}
      </Button>
    </li>
  );
}

function RequestForm({ answer, maxGuests, busy, onSubmit, t }: {
  readonly answer: PublicStayAnswer;
  readonly maxGuests: number;
  readonly busy: boolean;
  readonly onSubmit: (guests: number, riskAcknowledged: boolean) => void;
  readonly t: T;
}): React.ReactElement | null {
  const [guests, setGuests] = React.useState(1);
  const [risk, setRisk] = React.useState(false);
  const conditional = answer.answer.kind === 'conditional';
  const hold = answer.hold;
  if (hold === null) return null;
  if (hold.kind === 'too-late') return <p className="text-sm text-foreground">{t('short-stay:request.tooLate')}</p>;
  const ready = Number.isInteger(guests) && guests >= 1 && guests <= maxGuests && (!conditional || risk);
  return (
    <form className="flex flex-col gap-2" onSubmit={(event) => { event.preventDefault(); if (ready) onSubmit(guests, risk); }}>
      <p className="text-sm text-foreground">{t(PROMISE_KEY[hold.bound], { until: untilOf(hold.expiresAt) })}</p>
      <Label htmlFor="stay-request-guests">{t('short-stay:request.guests')}</Label>
      <Input
        id="stay-request-guests" type="number" min={1} max={maxGuests} value={guests}
        onChange={(event) => setGuests(Number(event.target.value))} className="w-24"
      />
      {conditional && (
        <Label className="flex items-start gap-2 text-sm font-normal text-foreground">
          <Checkbox checked={risk} onCheckedChange={(value) => setRisk(value === true)} />
          {t('short-stay:request.riskAcknowledge')}
        </Label>
      )}
      <Button type="submit" disabled={!ready || busy} className="self-start">
        {busy ? t('short-stay:request.sending') : t('short-stay:request.submit')}
      </Button>
    </form>
  );
}

export function ListingStayRequest({ listingId, query, answer, maxGuests, onChanged }: {
  readonly listingId: string;
  readonly query: { readonly checkIn: string; readonly checkOut: string } | null;
  readonly answer: PublicStayAnswer | undefined;
  readonly maxGuests: number | null;
  /** Το ημερολόγιο άλλαξε (νέο αίτημα ή απόσυρση) — ξαναδιάβασε νύχτες και απαντήσεις. */
  readonly onChanged: () => void;
}): React.ReactElement | null {
  const { t } = useTranslation(['short-stay']);
  const { user } = useAuth();
  const pathname = usePathname();
  const mine = useMyStayRequests(listingId, user !== null);
  const stayable = answer !== undefined && isStayable(answer.answer.kind);

  const act = async (command: Parameters<typeof mine.send>[0]): Promise<void> => {
    const outcome = await mine.send(command);
    if (outcome.kind === 'ok') onChanged();
  };
  const requests = mine.state.kind === 'loaded' && mine.state.requests.kind === 'readable' ? mine.state.requests.requests : [];

  return (
    <section aria-label={t('short-stay:request.title')} className="flex flex-col gap-2">
      {mine.state.kind === 'failed' && <p role="alert" className="text-sm text-foreground">{t('short-stay:request.mineFailed')}</p>}
      {requests.length > 0 && (
        <ul className="flex flex-col gap-1">
          {requests.map((request) => (
            <MyRequestLine key={request.id} request={request} busy={mine.busy} t={t}
              onWithdraw={(bookingId) => void act({ action: 'withdraw', bookingId })} />
          ))}
        </ul>
      )}
      {stayable && query !== null && user === null && (
        <p className="text-sm text-foreground">
          {t('short-stay:request.signIn')} <Link href={loginHref(pathname)} className="underline">{t('short-stay:request.signInLink')}</Link>
        </p>
      )}
      {stayable && query !== null && user !== null && answer !== undefined && (
        <RequestForm answer={answer} maxGuests={maxGuests ?? STAY_BOOKING_MAX_GUESTS} busy={mine.busy} t={t}
          onSubmit={(guests, riskAcknowledged) => void act({ action: 'request', ...query, guests, riskAcknowledged })} />
      )}
      {mine.lastOutcome !== null && (
        <p role="status" className="text-sm text-foreground">{t(OUTCOME_KEY[mine.lastOutcome.kind])}</p>
      )}
    </section>
  );
}
