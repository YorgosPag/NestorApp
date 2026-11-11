/**
 * Το μπλοκ **«Επικοινωνία με τον εκδότη»** της δημόσιας σελίδας τιμολογίου (ADR-ACC-018 §16).
 *
 * Δύο σειρές: τα στοιχεία του PDF (email, τηλέφωνο, ιστότοπος) και τα **κανάλια συνομιλίας** της εταιρείας
 * (Viber, WhatsApp, Messenger, Telegram, Instagram). Κάθε κανάλι ανοίγει συνομιλία **με τον εκδότη** και έτοιμο
 * μήνυμα που αναφέρει **μόνο** τον αριθμό του παραστατικού: ποτέ ποσό, ποτέ τον σύνδεσμο (ο σύνδεσμος είναι
 * διαπιστευτήριο και δεν φεύγει ποτέ προς τρίτους). Όπου το κανάλι δεν δέχεται έτοιμο κείμενο (Instagram), το κλικ
 * **αντιγράφει** το μήνυμα στο πρόχειρο πριν ανοίξει η συνομιλία, και η σελίδα το λέει.
 *
 * @module components/shared/pages/invoice-payment/InvoiceIssuerContact
 */

'use client';

import React from 'react';

import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';
import {
  buildChatLink, chatChannelBrandName, chatChannelPrefillsDraft, type ChatChannelRef,
} from '@/lib/contact/social-chat-links';
import { CHAT_CHANNEL_ICONS } from '@/lib/social-platform-system/chat-channel-icons';
import { emailHref, phoneHref, webHref } from '@/lib/validation/text-link-segments';
import type { InvoicePublicView } from '@/subapps/accounting/types/invoice-public-view';

import { INVOICE_PUBLIC_PAYMENT_NS } from './invoice-payment-primitives';

interface ChatChannelLinkProps {
  readonly refOf: ChatChannelRef;
  readonly draft: string;
  /** Καλείται μόνο για κανάλι χωρίς έτοιμο κείμενο: αντιγράφει το μήνυμα. Η πλοήγηση ΔΕΝ ακυρώνεται. */
  readonly onCopyDraft: () => void;
}

function ChatChannelLink({ refOf, draft, onCopyDraft }: ChatChannelLinkProps): React.ReactElement {
  const { t } = useTranslation(INVOICE_PUBLIC_PAYMENT_NS);
  const Icon = CHAT_CHANNEL_ICONS[refOf.channel];
  const channel = chatChannelBrandName(refOf.channel);
  const prefills = chatChannelPrefillsDraft(refOf.channel);
  return (
    <li>
      <Button asChild variant="outline" size="sm">
        <a
          href={buildChatLink(refOf, draft)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t(prefills ? 'contact.chatVia' : 'contact.chatViaCopy', { channel })}
          onClick={prefills ? undefined : onCopyDraft}
        >
          <Icon className="mr-2 h-4 w-4" />
          {channel}
        </a>
      </Button>
    </li>
  );
}

function ChatChannels({ view }: { readonly view: InvoicePublicView }): React.ReactElement | null {
  const { t } = useTranslation(INVOICE_PUBLIC_PAYMENT_NS);
  const { copy, copied } = useCopyToClipboard(6000);
  if (view.issuerChatChannels.length === 0) return null;
  const draft = t('contact.chatDraft', { number: `${view.series}-${view.number}` });
  const copyDraft = () => { void copy(draft); };
  return (
    <>
      <ul className="flex flex-wrap gap-2 print:hidden" aria-label={t('contact.chatChannels')}>
        {view.issuerChatChannels.map((ref) => (
          <ChatChannelLink key={ref.channel} refOf={ref} draft={draft} onCopyDraft={copyDraft} />
        ))}
      </ul>
      <p role="status" className="print:hidden">{copied ? t('contact.draftCopied') : ''}</p>
    </>
  );
}

function IssuerAddress({ view }: { readonly view: InvoicePublicView }): React.ReactElement | null {
  const { email, phone, website } = view.issuer;
  if (!email && !phone && !website) return null;
  const mailto = email ? emailHref(email) : null;
  const tel = phone ? phoneHref(phone) : null;
  const web = website ? webHref(website) : null;
  return (
    <address className="not-italic flex flex-wrap gap-x-4 gap-y-1">
      {email && (mailto ? <a className="underline" href={mailto}>{email}</a> : <span>{email}</span>)}
      {phone && (tel ? <a className="underline" href={tel}>{phone}</a> : <span>{phone}</span>)}
      {website && (web ? <a className="underline" href={web} rel="noopener noreferrer" target="_blank">{website}</a> : <span>{website}</span>)}
    </address>
  );
}

export function InvoiceIssuerContact({ view }: { readonly view: InvoicePublicView }): React.ReactElement | null {
  const { t } = useTranslation(INVOICE_PUBLIC_PAYMENT_NS);
  const { email, phone, website } = view.issuer;
  if (!email && !phone && !website && view.issuerChatChannels.length === 0) return null;
  return (
    <section aria-labelledby="invoice-contact-title" className="space-y-2 text-sm">
      <h2 id="invoice-contact-title" className="font-semibold">{t('contact.title')}</h2>
      <IssuerAddress view={view} />
      <ChatChannels view={view} />
    </section>
  );
}
