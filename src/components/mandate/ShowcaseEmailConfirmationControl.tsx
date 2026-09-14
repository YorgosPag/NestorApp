'use client';

/**
 * @fileoverview **Η ΚΑΤΑΣΤΑΣΗ ΚΑΙ Η ΑΠΟΣΤΟΛΗ ΕΠΙΒΕΒΑΙΩΣΗΣ ΕΝΟΣ EMAIL** — δίπλα στη γραμμή του, στις ρυθμίσεις (ADR-841 §7 Α21.18).
 * @related components/mandate/ShowcaseChannelFields.tsx (ο γονέας) · hooks/mandate/useEmailConfirmationSend.ts
 * @module components/mandate/ShowcaseEmailConfirmationControl
 *
 * 🔴 **ΜΟΝΟ ΓΙΑ ΑΠΟΘΗΚΕΥΜΕΝΗ ΔΙΕΥΘΥΝΣΗ**: η υπηρεσία δέχεται μόνο ό,τι **ήδη** δημοσιεύει η κάρτα. Κουμπί σε
 * διεύθυνση που μόλις πληκτρολογήθηκε θα απαντούσε «δεν είναι στην κάρτα» — λάθος που η οθόνη ήξερε να αποφύγει.
 *
 * 🔑 Η κατάσταση διαβάζεται με τους **ίδιους** κανόνες με τον διακομιστή (`carryConfirmations` ·
 * `confirmationFreshness`): αλλαγμένο γράμμα στο πεδίο ⇒ «Δήλωση», όπως θα γίνει μετά την αποθήκευση.
 */

import React from 'react';

import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useEmailConfirmationSend } from '@/hooks/mandate/useEmailConfirmationSend';
import {
  EMAIL_CONFIRMATION_LIFETIME_HOURS,
  carryConfirmations,
  confirmationFreshness,
} from '@/lib/agency/showcase-email-confirmation-rules';
import { normaliseChannelEmail } from '@/lib/contact/channel-email';
import { nowISO } from '@/lib/date-local';
import { formatMonthYear } from '@/lib/intl-formatting';
import type { ShowcaseLocationChannels } from '@/types/showcase-card';
import {
  SHOWCASE_CARD_EMAIL_ISSUE_KEYS,
  SHOWCASE_CARD_KEYS,
  SHOWCASE_NS,
} from '@/components/mandate/agency-showcase-labels';

/** Το αποθηκευμένο κατάστημα — `null` για κατάστημα που δεν αποθηκεύτηκε ακόμη. */
export interface SavedEmailChannels {
  readonly locationId: string;
  readonly channels: ShowcaseLocationChannels;
}

function StatusLine({ confirmedAt }: { readonly confirmedAt: string | null }): React.ReactElement {
  const { t } = useTranslation([SHOWCASE_NS]);
  if (confirmedAt === null) return <span className="text-xs text-muted-foreground">{t(SHOWCASE_CARD_KEYS.emailDeclared)}</span>;
  const date = formatMonthYear(confirmedAt);
  return confirmationFreshness(confirmedAt, nowISO()) === 'fresh'
    ? <span className="text-xs font-medium text-foreground">{t(SHOWCASE_CARD_KEYS.emailConfirmedOn, { date })}</span>
    : <span className="text-xs text-muted-foreground">{t(SHOWCASE_CARD_KEYS.emailAged, { date })}</span>;
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

  const confirmedAt = carryConfirmations(saved.channels.emailConfirmations, [normalised])[0]?.confirmedAt ?? null;
  const sending = sender.phase.kind === 'sending';
  return (
    <SendContext.Provider value={sender}>
      <span className="flex w-full flex-wrap items-center gap-2">
        <StatusLine confirmedAt={confirmedAt} />
        <Button type="button" variant="outline" size="sm" disabled={sending || sender.phase.kind === 'sent'} onClick={() => void sender.send(saved.locationId, normalised)}>
          {sending ? t(SHOWCASE_CARD_KEYS.emailSending) : confirmedAt === null ? t(SHOWCASE_CARD_KEYS.emailSendConfirmation) : t(SHOWCASE_CARD_KEYS.emailResendConfirmation)}
        </Button>
        <SendFeedback email={normalised} />
      </span>
    </SendContext.Provider>
  );
}
