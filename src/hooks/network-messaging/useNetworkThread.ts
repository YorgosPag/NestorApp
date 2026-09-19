'use client';

/**
 * @fileoverview **ΤΟ ΝΗΜΑ, ΖΩΝΤΑΝΑ** — νήμα · ακροατήριο · μηνύματα (σελιδοποίηση προς τα πίσω) · άγκυρα «νέα».
 * @related ADR-867 Β7 · `services/realtime/hooks/use-live-snapshot.ts` (η μηχανή) ·
 *   `lib/network-messaging/network-thread-from-document.ts` (τα σύνορα)
 * @module hooks/network-messaging/useNetworkThread
 *
 * 🔑 **ΖΩΝΤΑΝΟ, ΟΧΙ POLLING**: ο κανόνας δίνει ανάγνωση σε όποιον έχει ζωντανή γραμμή ακροατηρίου, άρα
 * `onSnapshot` — ένα νέο μήνυμα, μια σφραγίδα, ένας νέος συνεργάτης φαίνονται **αμέσως** (Slack/Teams).
 *
 * 📜 **ΣΕΛΙΔΟΠΟΙΗΣΗ ΠΡΟΣ ΤΑ ΠΙΣΩ = ΜΕΓΑΛΥΤΕΡΟ ΠΑΡΑΘΥΡΟ**: η συνδρομή κρατά τα **τελευταία Ν** μηνύματα
 * (`orderBy createdAt desc · limit N`)· «παλαιότερα» ⇒ Ν + σελίδα. Όσο φορτώνει το μεγαλύτερο παράθυρο, η
 * οθόνη κρατά **τα ήδη ορατά** — ποτέ κενό που αναβοσβήνει.
 *
 * 📌 **Η ΑΓΚΥΡΑ «ΝΕΑ ΜΗΝΥΜΑΤΑ»** πιάνεται **μία** φορά ανά νήμα (το `lastReadAt` μου τη στιγμή που ήρθε
 * πρώτη φορά το ακροατήριο) και **δεν** ακολουθεί το ζωντανό `lastReadAt` — δες `thread-timeline.ts`.
 */

import { useEffect, useState } from 'react';
import {
  clientRecentMessages,
  clientThreadAudience,
  clientThreadDoc,
} from '@/lib/network-messaging/network-thread-client-ref';
import {
  networkAudienceFromDocument,
  networkMessageFromDocument,
  networkThreadFromDocument,
} from '@/lib/network-messaging/network-thread-from-document';
import { useLiveDocument, useLiveList, type LiveState } from '@/services/realtime/hooks/use-live-snapshot';
import type { NetworkAudienceEntry, NetworkMessage, NetworkThread } from '@/types/network-thread';

/** Μηνύματα ανά «σελίδα» — όσα χωρούν σε μια οθόνη συζήτησης (Slack/Teams φορτώνουν ~30-50). */
export const NETWORK_MESSAGE_PAGE = 30;

export interface NetworkThreadView {
  readonly thread: LiveState<NetworkThread>;
  /** `null` όσο δεν ήρθε ακόμη. */
  readonly audience: readonly NetworkAudienceEntry[] | null;
  /** Χρονολογικά (παλαιότερο πρώτο) — τα ήδη ορατά μένουν όσο φορτώνει μεγαλύτερο παράθυρο. */
  readonly messages: readonly NetworkMessage[];
  readonly messagesLoading: boolean;
  readonly hasEarlier: boolean;
  readonly loadEarlier: () => void;
  /** Το `lastReadAt` μου **στο άνοιγμα** — `undefined` όσο δεν το ξέρουμε ακόμη. */
  readonly anchorReadAt: string | null | undefined;
}

function useThreadMessages(threadId: string | null) {
  const [windowSize, setWindowSize] = useState(NETWORK_MESSAGE_PAGE);
  useEffect(() => setWindowSize(NETWORK_MESSAGE_PAGE), [threadId]);

  const live = useLiveList(
    threadId === null ? null : `${threadId}:messages:${windowSize}`,
    () => clientRecentMessages(threadId ?? '', windowSize),
    networkMessageFromDocument,
    'network-thread-messages',
  );

  // Τα τελευταία ΕΤΟΙΜΑ μηνύματα αυτού του νήματος — ό,τι δείχνει η οθόνη όσο φορτώνει μεγαλύτερο παράθυρο.
  const [shown, setShown] = useState<{ readonly threadId: string | null; readonly items: readonly NetworkMessage[] }>({
    threadId,
    items: [],
  });
  useEffect(() => {
    if (live.state === 'ready') setShown({ threadId, items: [...live.value].reverse() });
  }, [live, threadId]);

  return {
    messages: shown.threadId === threadId ? shown.items : [],
    messagesLoading: live.state === 'loading',
    // Γεμάτο παράθυρο ⇒ **ίσως** υπάρχουν παλαιότερα· αν όχι, το επόμενο παράθυρο θα έρθει ίδιο και θα κρυφτεί.
    hasEarlier: live.state === 'ready' && live.value.length >= windowSize,
    loadEarlier: () => setWindowSize((size) => size + NETWORK_MESSAGE_PAGE),
  };
}

/** Η άγκυρα «νέα»: το `lastReadAt` μου, πιασμένο **μία** φορά ανά νήμα. */
function useAnchorReadAt(threadId: string | null, viewerUid: string | null, audience: readonly NetworkAudienceEntry[] | null) {
  const [anchor, setAnchor] = useState<{ readonly threadId: string | null; readonly value: string | null } | null>(null);
  useEffect(() => {
    if (audience === null || viewerUid === null || anchor?.threadId === threadId) return;
    setAnchor({ threadId, value: audience.find((entry) => entry.uid === viewerUid)?.lastReadAt ?? null });
  }, [threadId, viewerUid, audience, anchor]);
  return anchor?.threadId === threadId ? anchor.value : undefined;
}

/** **Το νήμα, ζωντανά.** `threadId: null` ⇒ καμία συνδρομή (π.χ. εντολή χωρίς νήμα ακόμη). */
export function useNetworkThread(threadId: string | null, viewerUid: string | null): NetworkThreadView {
  const key = threadId !== null && viewerUid !== null ? threadId : null;

  const thread = useLiveDocument(
    key,
    () => clientThreadDoc(key ?? ''),
    networkThreadFromDocument,
    'network-thread',
  );
  const audienceLive = useLiveList(
    key === null ? null : `${key}:audience`,
    () => clientThreadAudience(key ?? ''),
    networkAudienceFromDocument,
    'network-thread-audience',
  );
  const audience = audienceLive.state === 'ready' ? audienceLive.value : null;
  const messages = useThreadMessages(key);
  const anchorReadAt = useAnchorReadAt(key, viewerUid, audience);

  return { thread, audience, ...messages, anchorReadAt };
}
