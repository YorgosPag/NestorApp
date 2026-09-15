'use client';

/**
 * @fileoverview **Η ΚΑΤΑΣΤΑΣΗ ΚΑΙ Η ΑΠΟΣΤΟΛΗ ΕΠΙΒΕΒΑΙΩΣΗΣ ΕΝΟΣ EMAIL** — δίπλα στη γραμμή του, στις ρυθμίσεις
 *   (ADR-841 §7 Α21.18 · Α21.20).
 * @related components/mandate/ShowcaseChannelFields.tsx (ο γονέας) · hooks/mandate/useEmailConfirmationSend.ts
 * @module components/mandate/ShowcaseEmailConfirmationControl
 *
 * 🔴 **ΜΟΝΟ ΓΙΑ ΑΠΟΘΗΚΕΥΜΕΝΗ ΔΙΕΥΘΥΝΣΗ**: η υπηρεσία δέχεται μόνο ό,τι **ήδη** δημοσιεύει η κάρτα. Κουμπί σε
 * διεύθυνση που μόλις πληκτρολογήθηκε θα απαντούσε «δεν είναι στην κάρτα» — λάθος που η οθόνη ήξερε να αποφύγει.
 *
 * 🔑 Η κατάσταση διαβάζεται με τους **ίδιους** κανόνες με τον διακομιστή (`carryConfirmations` ·
 * `confirmationFreshness` · `returnStands`): αλλαγμένο γράμμα στο πεδίο ⇒ «Δήλωση», όπως θα γίνει μετά την αποθήκευση.
 *
 * 🔑 **Α21.20 — «ΕΠΕΣΤΡΕΨΕ ΟΡΙΣΤΙΚΑ»** είναι **ιδιωτική** ένδειξη: ο επισκέπτης βλέπει απλώς «Δήλωση». Το κουμπί
 * γίνεται «Το διόρθωσα — νέα επιβεβαίωση» και στέλνει **ρητή** δήλωση, ώστε ο διακομιστής να καθαρίσει τη
 * λίστα bounces του παρόχου πριν στείλει — αλλιώς το «στάλθηκε» θα ήταν ψέμα.
 */

import React from 'react';

import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useEmailConfirmationSend } from '@/hooks/mandate/useEmailConfirmationSend';
import {
  EMAIL_CONFIRMATION_LIFETIME_HOURS,
  carryConfirmations,
  confirmationFreshness,
  returnStands,
} from '@/lib/agency/showcase-email-confirmation-rules';
import { normaliseChannelEmail, sameChannelEmail } from '@/lib/contact/channel-email';
import { nowISO } from '@/lib/date-local';
import { formatLongDate, formatMonthYear } from '@/lib/intl-formatting';
import type { ShowcaseEmailReturn, ShowcaseLocationChannels } from '@/types/showcase-card';
import {
  SHOWCASE_CARD_EMAIL_ISSUE_KEYS,
  SHOWCASE_CARD_KEYS,
  SHOWCASE_NS,
} from '@/components/mandate/agency-showcase-labels';

/** Το αποθηκευμένο κατάστημα — `null` για κατάστημα που δεν αποθηκεύτηκε ακόμη. */
export interface SavedEmailChannels {
  readonly locationId: string;
  readonly channels: ShowcaseLocationChannels;
  /** Α21.20 — email της κάρτας που επέστρεψαν οριστικά (από το ημερολόγιο παράδοσης). */
  readonly returns: readonly ShowcaseEmailReturn[];
}

type EmailStatus =
  | { readonly kind: 'declared' }
  | { readonly kind: 'confirmed'; readonly confirmedAt: string }
  | { readonly kind: 'returned'; readonly returnedAt: string };

/** Η κατάσταση μιας αποθηκευμένης διεύθυνσης — επιστροφή νεότερη από την επιβεβαίωση υπερισχύει. */
function statusOf(saved: SavedEmailChannels, email: string): EmailStatus {
  const confirmedAt = carryConfirmations(saved.channels.emailConfirmations, [email])[0]?.confirmedAt ?? null;
  const returnedAt = saved.returns.find((entry) => sameChannelEmail(entry.email, email))?.returnedAt ?? null;
  if (returnedAt !== null && returnStands(returnedAt, confirmedAt)) return { kind: 'returned', returnedAt };
  return confirmedAt === null ? { kind: 'declared' } : { kind: 'confirmed', confirmedAt };
}

function StatusLine({ status }: { readonly status: EmailStatus }): React.ReactElement {
  const { t } = useTranslation([SHOWCASE_NS]);
  switch (status.kind) {
    case 'declared':
      return <span className="text-xs text-muted-foreground">{t(SHOWCASE_CARD_KEYS.emailDeclared)}</span>;
    case 'returned':
      return <span className="text-xs font-medium text-destructive">{t(SHOWCASE_CARD_KEYS.emailReturnedOn, { date: formatLongDate(status.returnedAt) })}</span>;
    case 'confirmed': {
      const date = formatMonthYear(status.confirmedAt);
      return confirmationFreshness(status.confirmedAt, nowISO()) === 'fresh'
        ? <span className="text-xs font-medium text-foreground">{t(SHOWCASE_CARD_KEYS.emailConfirmedOn, { date })}</span>
        : <span className="text-xs text-muted-foreground">{t(SHOWCASE_CARD_KEYS.emailAged, { date })}</span>;
    }
  }
}

function SendFeedback({ email }: { readonly email: string }): React.ReactElement | null {
  const { t } = useTranslation([SHOWCASE_NS]);
  const { phase } = useEmailConfirmationSendContext();
  switch (phase.kind) {
    case 'sent':
      return <span role="status" className="w-full text-xs text-muted-foreground">{t(SHOWCASE_CARD_KEYS.emailSent, { email, hours: EMAIL_CONFIRMATION_LIFETIME_HOURS })}</span>;
    case 'refused':
      return <span role="alert" className="w-full text-xs text-destructive">{t(SHOWCASE_CARD_EMAIL_ISSUE_KEYS[phase.reason])}</span>;
    case 'failed':
      return <span role="alert" className="w-full text-xs text-destructive">{t(SHOWCASE_CARD_EMAIL_ISSUE_KEYS.failed)}</span>;
    default:
      return null;
  }
}

const SendContext = React.createContext<ReturnType<typeof useEmailConfirmationSend> | null>(null);

function useEmailConfirmationSendContext(): ReturnType<typeof useEmailConfirmationSend> {
  const value = React.useContext(SendContext);
  if (value === null) throw new Error('ShowcaseEmailConfirmationControl context missing');
  return value;
}

/**
 * ⚠️ **Οι κλήσεις `t()` γράφονται ρητά ανά κλάδο** — ποτέ `t(keyOf(status))`: ο τεμαχιστής του ADR-744
 * (CHECK 3.34) θα το μετρούσε ως ανεπίλυτη δυναμική κλήση.
 */
function SendButton({ locationId, email, status }: { readonly locationId: string; readonly email: string; readonly status: EmailStatus }): React.ReactElement {
  const { t } = useTranslation([SHOWCASE_NS]);
  const sender = useEmailConfirmationSendContext();
  const sending = sender.phase.kind === 'sending';
  const returned = status.kind === 'returned';
  const label = sending
    ? t(SHOWCASE_CARD_KEYS.emailSending)
    : returned
      ? t(SHOWCASE_CARD_KEYS.emailReturnedResend)
      : status.kind === 'declared'
        ? t(SHOWCASE_CARD_KEYS.emailSendConfirmation)
        : t(SHOWCASE_CARD_KEYS.emailResendConfirmation);
  return (
    <Button type="button" variant="outline" size="sm" disabled={sending || sender.phase.kind === 'sent'} onClick={() => void sender.send(locationId, email, returned)}>
      {label}
    </Button>
  );
}

export function ShowcaseEmailConfirmationControl({
  email,
  saved,
}: {
  readonly email: string;
  readonly saved: SavedEmailChannels | null;
}): React.ReactElement | null {
  const { t } = useTranslation([SHOWCASE_NS]);
  const sender = useEmailConfirmationSend();
  const normalised = normaliseChannelEmail(email);
  if (normalised === '') return null;

  const isSaved = saved !== null && saved.channels.emails.includes(normalised);
  if (!isSaved) return <span className="w-full text-xs text-muted-foreground">{t(SHOWCASE_CARD_KEYS.emailSaveFirst)}</span>;

  const status = statusOf(saved, normalised);
  return (
    <SendContext.Provider value={sender}>
      <span className="flex w-full flex-wrap items-center gap-2">
        <StatusLine status={status} />
        <SendButton locationId={saved.locationId} email={normalised} status={status} />
        {status.kind === 'returned' ? <span className="w-full text-xs text-muted-foreground">{t(SHOWCASE_CARD_KEYS.emailReturnedHint)}</span> : null}
        <SendFeedback email={normalised} />
      </span>
    </SendContext.Provider>
  );
}
