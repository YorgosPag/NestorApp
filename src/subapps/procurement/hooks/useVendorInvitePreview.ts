'use client';

/**
 * @fileoverview **Η προεπισκόπηση του email πρόσκλησης, από τον server** (ADR-327 §7.5).
 * @module subapps/procurement/hooks/useVendorInvitePreview
 *
 * Ζητά `POST /api/rfqs/[id]/invites/preview` — τον ΙΔΙΟ composer με την αποστολή — ώστε η οθόνη να δείχνει
 * **αυτό ακριβώς** που θα λάβει ο παραλήπτης. Debounce στις αλλαγές του σημειώματος· κάθε νέο αίτημα **ακυρώνει**
 * το προηγούμενο (AbortController) και μια καθυστερημένη απάντηση παλιού αιτήματος δεν γράφει ποτέ πάνω από νεότερη
 * (αριθμός σειράς, όπως το `useRfqRecord`).
 */

import { useEffect, useRef, useState } from 'react';

import type { VendorInvitePreviewRecipient } from '../types/vendor-invite-preview';

export interface VendorInvitePreviewRequest {
  readonly recipient: VendorInvitePreviewRecipient;
  readonly expiresOn: string;
  readonly buyerNote: string;
}

export interface VendorInvitePreviewData {
  readonly subject: string;
  readonly html: string;
  readonly language: string;
}

export type VendorInvitePreviewState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'loading'; readonly last: VendorInvitePreviewData | null }
  | { readonly kind: 'ready'; readonly data: VendorInvitePreviewData }
  | { readonly kind: 'failed' };

/** Αρκετό για να μη ζητείται προεπισκόπηση σε κάθε πλήκτρο του σημειώματος. */
const PREVIEW_DEBOUNCE_MS = 400;

async function fetchPreview(rfqId: string, request: VendorInvitePreviewRequest, signal: AbortSignal): Promise<VendorInvitePreviewData> {
  const res = await fetch(`/api/rfqs/${rfqId}/invites/preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
    signal,
  });
  const json: { data?: VendorInvitePreviewData } = await res.json().catch(() => ({}));
  if (!res.ok || !json.data) throw new Error(`HTTP ${res.status}`);
  return json.data;
}

const lastDataOf = (state: VendorInvitePreviewState): VendorInvitePreviewData | null =>
  state.kind === 'ready' ? state.data : state.kind === 'loading' ? state.last : null;

/** `request = null` ⇒ κανένας παραλήπτης ακόμη: τίποτα να δειχθεί. */
export function useVendorInvitePreview(rfqId: string, request: VendorInvitePreviewRequest | null): VendorInvitePreviewState {
  const [state, setState] = useState<VendorInvitePreviewState>({ kind: 'idle' });
  const seq = useRef(0);
  const requestKey = request === null ? null : JSON.stringify(request);

  useEffect(() => {
    const current = ++seq.current;
    if (requestKey === null) {
      setState({ kind: 'idle' });
      return;
    }
    setState((previous) => ({ kind: 'loading', last: lastDataOf(previous) }));
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetchPreview(rfqId, JSON.parse(requestKey) as VendorInvitePreviewRequest, controller.signal)
        .then((data) => { if (current === seq.current) setState({ kind: 'ready', data }); })
        .catch(() => { if (current === seq.current && !controller.signal.aborted) setState({ kind: 'failed' }); });
    }, PREVIEW_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [rfqId, requestKey]);

  return state;
}
