/**
 * useInvoicePortalThread — το νήμα «Γράψτε μας» της σελίδας παραστατικού (ADR-939).
 *
 * - Φέρνει το νήμα μία φορά ανά άνοιγμα (ίδιο κουπόνι επίσκεψης με την όψη).
 * - Στέλνει με `Idempotency-Key` ανά πάτημα (CHECK 3.92): επανάληψη δικτύου = ίδια απάντηση, όχι δεύτερο μήνυμα.
 * - Το **πρόχειρο** μένει στο `sessionStorage` της καρτέλας: αν λήξει το κουπόνι (15′) και ο πελάτης ανανεώσει τη
 *   σελίδα, το κείμενό του δεν χάνεται. Ευκολία ανά θεατή μόνο· χωρίς αποθήκευση η σελίδα δουλεύει κανονικά.
 *
 * @module components/shared/pages/invoice-payment/useInvoicePortalThread
 */

'use client';

import { useCallback, useEffect, useState } from 'react';

import { keyedHeaders } from '@/lib/api/api-client-transport';
import type {
  InvoicePortalMessage,
  InvoicePortalMessageRefusal,
  InvoicePortalMessageRequestBody,
  InvoicePortalPostResponse,
  InvoicePortalThreadResponse,
} from '@/subapps/accounting/types/invoice-portal-messages';

import { invoicePortalMessagesUrl } from './useInvoicePublicView';

export type InvoicePortalSendState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'sending' }
  | { readonly kind: 'sent' }
  | { readonly kind: 'refused'; readonly reason: InvoicePortalMessageRefusal | 'generic' };

export interface InvoicePortalThreadHandle {
  /** `null` όσο φορτώνει ή όταν το νήμα δεν διαβάστηκε: η φόρμα μένει διαθέσιμη. */
  readonly messages: readonly InvoicePortalMessage[] | null;
  readonly draft: string;
  readonly setDraft: (text: string) => void;
  readonly send: () => void;
  readonly sendState: InvoicePortalSendState;
}

const draftKey = (shareId: string): string => `invoice-portal-draft:${shareId}`;

function readDraft(shareId: string): string {
  try { return window.sessionStorage.getItem(draftKey(shareId)) ?? ''; } catch { return ''; }
}

function writeDraft(shareId: string, text: string): void {
  try {
    if (text === '') window.sessionStorage.removeItem(draftKey(shareId));
    else window.sessionStorage.setItem(draftKey(shareId), text);
  } catch { /* χωρίς αποθήκευση: το πρόχειρο ζει μόνο στη μνήμη */ }
}

async function fetchThread(shareId: string, signal: AbortSignal): Promise<readonly InvoicePortalMessage[] | null> {
  const response = await fetch(invoicePortalMessagesUrl(shareId), { credentials: 'same-origin', cache: 'no-store', signal });
  if (!response.ok) return null;
  const body = (await response.json()) as InvoicePortalThreadResponse;
  return body.status === 'ok' ? body.messages : null;
}

async function postMessage(shareId: string, body: InvoicePortalMessageRequestBody): Promise<InvoicePortalPostResponse | null> {
  const response = await fetch(invoicePortalMessagesUrl(shareId), {
    method: 'POST',
    credentials: 'same-origin',
    cache: 'no-store',
    headers: keyedHeaders('POST', body, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  });
  return response.ok ? ((await response.json()) as InvoicePortalPostResponse) : null;
}

export function useInvoicePortalThread(shareId: string): InvoicePortalThreadHandle {
  const [messages, setMessages] = useState<readonly InvoicePortalMessage[] | null>(null);
  const [draft, setDraftState] = useState('');
  const [sendState, setSendState] = useState<InvoicePortalSendState>({ kind: 'idle' });

  useEffect(() => {
    setDraftState(readDraft(shareId));
    const controller = new AbortController();
    fetchThread(shareId, controller.signal).then(setMessages).catch(() => { /* το νήμα μένει κρυφό */ });
    return () => controller.abort();
  }, [shareId]);

  const setDraft = useCallback((text: string) => {
    setDraftState(text);
    writeDraft(shareId, text);
    setSendState((current) => (current.kind === 'sending' ? current : { kind: 'idle' }));
  }, [shareId]);

  const send = useCallback(() => {
    setSendState({ kind: 'sending' });
    postMessage(shareId, { text: draft })
      .then((outcome) => {
        if (outcome?.status !== 'sent') {
          setSendState({ kind: 'refused', reason: outcome?.status === 'refused' ? outcome.reason : 'generic' });
          return;
        }
        setMessages(outcome.messages);
        setDraftState('');
        writeDraft(shareId, '');
        setSendState({ kind: 'sent' });
      })
      .catch(() => setSendState({ kind: 'refused', reason: 'generic' }));
  }, [shareId, draft]);

  return { messages, draft, setDraft, send, sendState };
}
