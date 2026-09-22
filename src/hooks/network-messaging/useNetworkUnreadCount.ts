'use client';

/**
 * @fileoverview **ΠΟΣΑ ΝΗΜΑΤΑ ΕΧΟΥΝ ΑΔΙΑΒΑΣΤΟ — ΖΩΝΤΑΝΑ** (ADR-867 §4.5 · Β10 · ADR-871 Π5).
 * @related `lib/network-messaging/network-thread-client-ref.ts` (το ερώτημα) · `services/realtime/hooks/use-live-snapshot.ts`
 *   (ο κύκλος ζωής) · `thread-writer.ts` (ο ΕΝΑΣ γραφέας των γραμμών)
 * @module hooks/network-messaging/useNetworkUnreadCount
 *
 * 🔑 **Ο ΑΡΙΘΜΟΣ = ΠΛΗΘΟΣ ΓΡΑΜΜΩΝ.** Κάθε νήμα με αδιάβαστο έχει **μία** γραμμή στο κουτί του ανθρώπου· δεν
 * υπάρχει μετρητής να αποκλίνει. Ο ακροατής ζητά **μία παραπάνω** από την οροφή του σήματος: 100 γραμμές ⇒
 * «99+» οπτικά και «τουλάχιστον 100» στον αναγνώστη οθόνης — αληθές και στα δύο κανάλια, με φραγμένο κόστος.
 *
 * ⚠️ Άρνηση του κανόνα (π.χ. κανόνες που δεν έχουν γίνει ακόμη deploy) ⇒ `absent` ⇒ **0** — ομαλή υποβάθμιση,
 * ποτέ σφάλμα στη στήλη. Δύο καταναλωτές (στήλη + μενού avatar) με το **ίδιο** ερώτημα μοιράζονται **έναν**
 * στόχο ακρόασης στο Web SDK — καμία διπλή ανάγνωση.
 */

import { useAuth } from '@/auth/hooks/useAuth';
import { ICON_COUNT_BADGE_DEFAULT_MAX } from '@/core/badges';
import { clientInboxUnreadRows } from '@/lib/network-messaging/network-thread-client-ref';
import { useLiveList } from '@/services/realtime/hooks/use-live-snapshot';
import type { MenuCount } from '@/types/sidebar';

/** Πόσες γραμμές φτάνουν για να ξέρουμε ότι ξεπεράσαμε την οροφή του σήματος (99 ⇒ 100). */
export const NETWORK_UNREAD_CEILING = ICON_COUNT_BADGE_DEFAULT_MAX + 1;

const NONE: MenuCount = { count: 0, atLeast: false };

/** Πλήθος γραμμών ⇒ τιμή σήματος. Στην οροφή ο αριθμός είναι **κάτω φράγμα**, όχι ακριβής. */
export function networkUnreadCountOf(rows: number): MenuCount {
  return { count: rows, atLeast: rows >= NETWORK_UNREAD_CEILING };
}

/** Η γραμμή δεν κουβαλά τίποτα που χρειάζεται το σήμα — μετρά μόνο ότι **υπάρχει**. */
const rowId = (_raw: unknown, id: string): string => id;

export function useNetworkUnreadCount(): MenuCount {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const live = useLiveList(
    uid,
    () => clientInboxUnreadRows(uid ?? '', NETWORK_UNREAD_CEILING),
    rowId,
    'network-unread-count',
  );
  return live.state === 'ready' ? networkUnreadCountOf(live.value.length) : NONE;
}
