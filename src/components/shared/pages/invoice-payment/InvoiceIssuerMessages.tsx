/**
 * Το μπλοκ **«Γράψτε μας»** της δημόσιας σελίδας παραστατικού (ADR-939).
 *
 * Ο πελάτης γράφει στον εκδότη χωρίς να φύγει από τη σελίδα και χωρίς να δηλώσει email: ο σύνδεσμος είναι η
 * ταυτότητά του. Το μήνυμα φτάνει στα ενιαία εισερχόμενα CRM του εκδότη και η απάντηση εμφανίζεται εδώ (και με
 * email, όπου ο διακομιστής ξέρει διεύθυνση). Το νήμα δείχνει μόνο «Εσείς» / «Εκδότης», ποτέ ονόματα υπαλλήλων.
 *
 * @module components/shared/pages/invoice-payment/InvoiceIssuerMessages
 */

'use client';

import React from 'react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatOperatorDateTime } from '@/lib/operator-time-format';
import { cn } from '@/lib/utils';
import {
  INVOICE_PORTAL_MESSAGE_MAX_LENGTH, type InvoicePortalMessage,
} from '@/subapps/accounting/types/invoice-portal-messages';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

import { INVOICE_PUBLIC_PAYMENT_NS } from './invoice-payment-primitives';
import { useInvoicePortalThread, type InvoicePortalSendState } from './useInvoicePortalThread';

const TEXTAREA_ID = 'invoice-message-text';
const REMAINING_ID = 'invoice-message-remaining';

function MessageItem({ message }: { readonly message: InvoicePortalMessage }): React.ReactElement {
  const { t, i18n } = useTranslation(INVOICE_PUBLIC_PAYMENT_NS);
  const colors = useSemanticColors();
  const fromIssuer = message.author === 'issuer';
  return (
    <li className={cn('rounded-lg border p-3', fromIssuer ? 'mr-8' : 'ml-8')}>
      <article>
        <p className={cn('text-xs', colors.text.muted)}>
          <strong>{t(fromIssuer ? 'messages.issuer' : 'messages.you')}</strong>
          {' · '}
          <time dateTime={message.sentAt}>{formatOperatorDateTime(message.sentAt, i18n.language)}</time>
        </p>
        <p className="whitespace-pre-wrap break-words text-sm">{message.text}</p>
      </article>
    </li>
  );
}

/** Άρνηση → κλειδί μηνύματος. Ο σύνδεσμος/το κουπόνι που έληξαν λύνονται με ανανέωση (το πρόχειρο μένει). */
function refusalKey(state: InvoicePortalSendState): string | null {
  if (state.kind !== 'refused') return null;
  if (state.reason === 'invalid-text') return 'messages.errors.invalidText';
  if (state.reason === 'quota-exhausted') return 'messages.errors.quotaExhausted';
  if (state.reason === 'visit-expired' || state.reason === 'link-inactive') return 'messages.errors.expired';
  return 'messages.errors.generic';
}

interface ComposerProps {
  readonly draft: string;
  readonly setDraft: (text: string) => void;
  readonly send: () => void;
  readonly sendState: InvoicePortalSendState;
}

function MessageComposer({ draft, setDraft, send, sendState }: ComposerProps): React.ReactElement {
  const { t } = useTranslation(INVOICE_PUBLIC_PAYMENT_NS);
  const colors = useSemanticColors();
  const sending = sendState.kind === 'sending';
  const errorKey = refusalKey(sendState);
  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => { event.preventDefault(); send(); };
  return (
    <form className="space-y-2" onSubmit={onSubmit}>
      <Label htmlFor={TEXTAREA_ID}>{t('messages.label')}</Label>
      <Textarea
        id={TEXTAREA_ID}
        rows={4}
        maxLength={INVOICE_PORTAL_MESSAGE_MAX_LENGTH}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        aria-describedby={REMAINING_ID}
        disabled={sending}
      />
      <p id={REMAINING_ID} className={cn('text-xs', colors.text.muted)}>
        {t('messages.remaining', { count: INVOICE_PORTAL_MESSAGE_MAX_LENGTH - draft.length })}
      </p>
      <Button type="submit" disabled={sending || draft.trim() === ''}>
        {t(sending ? 'messages.sending' : 'messages.send')}
      </Button>
      <p role="status" className="text-sm">{sendState.kind === 'sent' ? t('messages.sent') : ''}</p>
      {errorKey && (
        <p role="alert" className="text-sm text-destructive">
          {t(errorKey, { max: INVOICE_PORTAL_MESSAGE_MAX_LENGTH })}
        </p>
      )}
    </form>
  );
}

interface InvoiceIssuerMessagesProps {
  readonly shareId: string;
  /** Σειρά-αριθμός του παραστατικού, για το εισαγωγικό κείμενο. */
  readonly reference: string;
}

export function InvoiceIssuerMessages({ shareId, reference }: InvoiceIssuerMessagesProps): React.ReactElement {
  const { t } = useTranslation(INVOICE_PUBLIC_PAYMENT_NS);
  const colors = useSemanticColors();
  const { messages, draft, setDraft, send, sendState } = useInvoicePortalThread(shareId);
  return (
    <section aria-labelledby="invoice-messages-title" className="space-y-3 print:hidden">
      <h2 id="invoice-messages-title" className="font-semibold">{t('messages.title')}</h2>
      <p className={cn('text-sm', colors.text.muted)}>{t('messages.intro', { number: reference })}</p>
      {messages && messages.length > 0 && (
        <ol aria-label={t('messages.thread')} className="space-y-2">
          {messages.map((message) => <MessageItem key={message.id} message={message} />)}
        </ol>
      )}
      <MessageComposer draft={draft} setDraft={setDraft} send={send} sendState={sendState} />
    </section>
  );
}
