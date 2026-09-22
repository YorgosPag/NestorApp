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
 * πρώτη φορά η ιδιωτική μου πλευρά) και **δεν** ακολουθεί το ζωντανό `lastReadAt` — δες `thread-timeline.ts`.
 *
 * 🔒 **Η ΙΔΙΩΤΙΚΗ ΜΟΥ ΠΛΕΥΡΑ ΕΙΝΑΙ ΔΙΚΟ ΤΗΣ ΕΓΓΡΑΦΟ** (ADR-867 Β9(β) Ε9): ώρα ανάγνωσης, σίγαση, follow. Το
 * ακροατήριο το βλέπουν όλοι· αυτό **μόνο** εγώ — γι' αυτό δεν βρίσκεται πια μέσα στη γραμμή μου.
 */

import { useEffect, useState } from 'react';
import {
  clientAudiencePrivateDoc,
  clientRecentMessages,
  clientThreadAudience,
  clientThreadDoc,
} from '@/lib/network-messaging/network-thread-client-ref';
import {
  networkAudienceFromDocument,
  networkAudiencePrivateFromDocument,
  networkMessageFromDocument,
  networkThreadFromDocument,
} from '@/lib/network-messaging/network-thread-from-document';
import { useLiveDocument, useLiveList, type LiveState } from '@/services/realtime/hooks/use-live-snapshot';
import {
  NETWORK_AUDIENCE_PRIVATE_DEFAULTS,
  type NetworkAudienceEntry,
  type NetworkAudiencePrivate,
  type NetworkMessage,
  type NetworkThread,
} from '@/types/network-thread';

/** Μηνύματα ανά «σελίδα» — όσα χωρούν σε μια οθόνη συζήτησης (Slack/Teams φορτώνουν ~30-50). */
export const NETWORK_MESSAGE_PAGE = 30;

export interface NetworkThreadView {
  readonly thread: LiveState<NetworkThread>;
  /** `null` όσο δεν ήρθε ακόμη. */
  readonly audience: readonly NetworkAudienceEntry[] | null;
  /** 🔒 Η **δική μου** ώρα ανάγνωσης / σίγαση / follow — `null` όσο δεν ήρθε (ή αν δεν διαβάζω το νήμα). */
  readonly mine: NetworkAudiencePrivate | null;
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

/**
 * Η ιδιωτική μου πλευρά, ζωντανά. ⚠️ Ανύπαρκτο έγγραφο = **έγκυρη** κατάσταση («δεν διάβασα ποτέ, δεν σίγασα»)
 * ⇒ οι ουδέτερες τιμές, όχι «φορτώνει». Άρνηση (δεν διαβάζω το νήμα) ⇒ `null`.
 */
function useMyPrivateSeat(threadId: string | null, viewerUid: string | null): NetworkAudiencePrivate | null {
  const live = useLiveDocument(
    threadId === null || viewerUid === null ? null : `${threadId}:private:${viewerUid}`,
    () => clientAudiencePrivateDoc(threadId ?? '', viewerUid ?? ''),
    (raw) => networkAudiencePrivateFromDocument(raw),
    'network-thread-private-seat',
  );
  return live.state === 'ready' ? (live.value ?? NETWORK_AUDIENCE_PRIVATE_DEFAULTS) : null;
}

/** Η άγκυρα «νέα»: το `lastReadAt` μου, πιασμένο **μία** φορά ανά νήμα. */
function useAnchorReadAt(threadId: string | null, mine: NetworkAudiencePrivate | null) {
  const [anchor, setAnchor] = useState<{ readonly threadId: string | null; readonly value: string | null } | null>(null);
  useEffect(() => {
    if (mine === null || anchor?.threadId === threadId) return;
    setAnchor({ threadId, value: mine.lastReadAt });
  }, [threadId, mine, anchor]);
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
  const mine = useMyPrivateSeat(key, viewerUid);
  const anchorReadAt = useAnchorReadAt(key, mine);

  return { thread, audience, mine, ...messages, anchorReadAt };
}
