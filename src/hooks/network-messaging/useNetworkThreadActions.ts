'use client';

/**
 * @fileoverview **ΟΙ ΠΡΑΞΕΙΣ ΤΟΥ ΝΗΜΑΤΟΣ** — αισιόδοξη αποστολή, επανάληψη χωρίς διπλό, «το είδα», σίγαση/ακολουθώ.
 * @related ADR-867 Β7 · `network-thread.client.ts` · N.7 (optimistic updates, zero race conditions)
 * @module hooks/network-messaging/useNetworkThreadActions
 *
 * ✉️ **ΑΙΣΙΟΔΟΞΗ ΑΠΟΣΤΟΛΗ (Slack · Teams)**: το μήνυμα εμφανίζεται **αμέσως** ως «στέλνεται»· φεύγει με
 * **κλειδί ιδεμποτησίας** (`generateOpaqueToken`)· όταν ο διακομιστής απαντήσει με το `messageId`, η
 * εκκρεμής φούσκα **σβήνει τη στιγμή που το ίδιο id φτάσει στο ζωντανό snapshot** — ποτέ νωρίτερα (θα
 * αναβόσβηνε), ποτέ διπλή. Αποτυχία ⇒ «δεν στάλθηκε — ξανά» με το **ίδιο** κλειδί: η επανάληψη **δεν**
 * μπορεί να γεννήσει δεύτερο μήνυμα, ακόμη κι αν η πρώτη είχε καταχωρηθεί και χάθηκε μόνο η απάντηση.
 *
 * 👁️ **«ΤΟ ΕΙΔΑ»** στέλνεται **μόνο** όταν η καρτέλα είναι ορατή και υπάρχει ξένο μήνυμα νεότερο από το
 * `lastReadAt` μου — μία φορά ανά νεότερο μήνυμα, ποτέ σε βρόχο.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { nowISO } from '@/lib/date-local';
import { pendingNotArrived } from '@/lib/network-messaging/thread-timeline';
import { generateOpaqueToken } from '@/services/enterprise-id.service';
import {
  networkThreadClient,
  type NetworkFailure,
  type NetworkResult,
} from '@/services/network-messaging/network-thread.client';
import type { NetworkMessage } from '@/types/network-thread';
import type { NetworkEditResult, NetworkRetractionResult } from '@/types/network-wire';

export interface PendingMessage {
  readonly clientKey: string;
  readonly text: string;
  readonly createdAt: string;
  readonly status: 'sending' | 'sent' | 'failed';
  readonly messageId: string | null;
  readonly failure: NetworkFailure | null;
}

function withEntry(list: readonly PendingMessage[], clientKey: string, patch: Partial<PendingMessage>): PendingMessage[] {
  return list.map((entry) => (entry.clientKey === clientKey ? { ...entry, ...patch } : entry));
}

/** Μια νέα εκκρεμής αποστολή — με **δικό της** κλειδί ιδεμποτησίας, που μένει ίδιο σε κάθε επανάληψη. */
function pendingOf(text: string): PendingMessage {
  return { clientKey: generateOpaqueToken(), text: text.trim(), createdAt: nowISO(), status: 'sending', messageId: null, failure: null };
}

/**
 * Οι εκκρεμείς φούσκες σβήνουν **μόνο** όταν το ΙΔΙΟ id φτάσει στο snapshot — ποτέ νωρίτερα, ποτέ διπλές.
 *
 * 🔑 Η **ορατότητα** παράγεται (`pendingNotArrived`) από **και τις δύο** εισόδους σε κάθε απόδοση — όχι
 * από effect που ξυπνά μόνο με το snapshot: αν το snapshot φτάσει **πριν** την απάντηση με το `messageId`,
 * το effect δεν ξανατρέχει ποτέ και η φούσκα μένει διπλή (μετρημένο ζωντανά, ADR-872). Το effect μόνο
 * **καθαρίζει τη μνήμη** — η οθόνη δεν το περιμένει.
 */
function useReconcileArrivals(
  threadId: string | null,
  liveMessages: readonly NetworkMessage[],
  pending: readonly PendingMessage[],
  setPending: React.Dispatch<React.SetStateAction<readonly PendingMessage[]>>,
): readonly PendingMessage[] {
  useEffect(() => setPending([]), [threadId, setPending]);
  const visible = useMemo(() => pendingNotArrived(pending, liveMessages), [pending, liveMessages]);
  useEffect(() => {
    if (visible !== pending) setPending((list) => pendingNotArrived(list, liveMessages));
  }, [visible, pending, liveMessages, setPending]);
  return visible;
}

/** Εκκρεμείς αποστολές + ταύτιση με το snapshot κατά `messageId`. */
function usePendingSends(threadId: string | null, liveMessages: readonly NetworkMessage[]) {
  const [stored, setPending] = useState<readonly PendingMessage[]>([]);
  const pending = useReconcileArrivals(threadId, liveMessages, stored, setPending);

  const dispatch = useCallback(
    async (entry: Pick<PendingMessage, 'clientKey' | 'text'>) => {
      if (threadId === null) return;
      const result = await networkThreadClient.send(threadId, entry.text, entry.clientKey);
      setPending((list) =>
        withEntry(list, entry.clientKey, result.ok
          ? { status: 'sent', messageId: result.value.messageId, failure: null }
          : { status: 'failed', failure: result.failure }),
      );
    },
    [threadId],
  );

  const send = useCallback((text: string) => {
    const entry = pendingOf(text);
    setPending((list) => [...list, entry]);
    void dispatch(entry);
  }, [dispatch]);

  const retry = useCallback((entry: PendingMessage) => {
    setPending((list) => withEntry(list, entry.clientKey, { status: 'sending', failure: null }));
    void dispatch(entry);
  }, [dispatch]);

  const discard = useCallback((clientKey: string) => {
    setPending((list) => list.filter((entry) => entry.clientKey !== clientKey));
  }, []);

  return { pending, send, retry, discard };
}

/** «Το είδα» — όταν η καρτέλα φαίνεται και υπάρχει ξένο μήνυμα νεότερο από το `lastReadAt` μου. */
function useMarkRead(threadId: string | null, viewerUid: string | null, messages: readonly NetworkMessage[], myLastReadAt: string | null) {
  const marked = useRef<string | null>(null);
  const latestForeign = [...messages].reverse().find((message) => message.senderUid !== viewerUid) ?? null;
  const unread = latestForeign !== null && (myLastReadAt === null || latestForeign.createdAt > myLastReadAt);
  const target = unread && threadId !== null ? `${threadId}:${latestForeign.id}` : null;

  useEffect(() => {
    if (target === null || threadId === null) return undefined;
    const attempt = () => {
      if (document.visibilityState !== 'visible' || marked.current === target) return;
      marked.current = target;
      void networkThreadClient.markRead(threadId);
    };
    attempt();
    document.addEventListener('visibilitychange', attempt);
    return () => document.removeEventListener('visibilitychange', attempt);
  }, [target, threadId]);
}

export interface NetworkThreadActions {
  readonly pending: readonly PendingMessage[];
  readonly send: (text: string) => void;
  readonly retry: (entry: PendingMessage) => void;
  readonly discard: (clientKey: string) => void;
  readonly retract: (messageId: string) => Promise<NetworkResult<NetworkRetractionResult>>;
  readonly edit: (messageId: string, text: string) => Promise<NetworkResult<NetworkEditResult>>;
}

/** **Οι πράξεις ενός νήματος.** Οι απαντήσεις ανάκλησης/επεξεργασίας επιστρέφονται — η οθόνη λέει τι έγινε. */
export function useNetworkThreadActions(
  threadId: string | null,
  viewerUid: string | null,
  messages: readonly NetworkMessage[],
  myLastReadAt: string | null,
): NetworkThreadActions {
  const sends = usePendingSends(threadId, messages);
  useMarkRead(threadId, viewerUid, messages, myLastReadAt);

  const retract = useCallback(
    (messageId: string) => networkThreadClient.retract(threadId ?? '', messageId),
    [threadId],
  );
  const edit = useCallback(
    (messageId: string, text: string) => networkThreadClient.edit(threadId ?? '', messageId, text),
    [threadId],
  );

  return { ...sends, retract, edit };
}
