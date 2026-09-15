/**
 * @fileoverview **ΤΙ ΕΧΟΥΜΕ ΗΔΗ ΠΕΙ ΣΕ ΑΥΤΟΝ ΤΟΝ ΖΗΤΟΥΝΤΑ** — από τις ίδιες τις ειδοποιήσεις.
 * @related ADR-777 §8.69 · §8.22.6 · server/notifications/notification-orchestrator.ts
 * @module services/demand/demand-match-ledger
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΕΛΑΤΤΩΜΑ ΠΟΥ ΔΙΟΡΘΩΝΕΙ (βρέθηκε 2026-09-15, γράφοντας τη μείωση τιμής)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο ειδοποιητής ταιριάσματος έκοβε τα ταιριάσματα στα **πρώτα 10 ΠΡΙΝ** μάθει ποια είναι
 * ήδη γνωστά. Σε κάθε ωριαίο πέρασμα τα **ίδια** 10 ξαναέβγαιναν «ήδη γνωστά» ⇒ η 11η
 * αγγελία **δεν ανακοινωνόταν ποτέ** — ενώ το σχόλιο υποσχόταν *«σε δόσεις των 10»*.
 * Η υπόσχεση ήταν γραμμένη· ο μηχανισμός όχι.
 *
 * ⇒ Εδώ διαβάζεται **ΜΙΑ φορά ανά ζήτηση** ποιες ειδοποιήσεις ταιριάσματος **υπάρχουν
 * ήδη**, ώστε το όριο να μετρά **μόνο νέες** ανακοινώσεις.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ ΔΕΝ ΕΙΝΑΙ ΔΕΥΤΕΡΗ ΑΛΗΘΕΙΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το §8.22.6 απορρίπτει ρητά πεδίο «πότε του το είπαμε». Αυτό **δεν** το προσθέτει:
 * διαβάζει τα **ίδια** έγγραφα που γράφει ο orchestrator, με το **ίδιο** ντετερμινιστικό
 * αναγνωριστικό (`generateNotificationDedupeId`). Και το `create()` μένει ο **φρουρός**
 * (N.7.2 #4): αν δύο περάσματα διαβάσουν «άγνωστο» ταυτόχρονα, μόνο το ένα γράφει.
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { NOTIFICATION_EVENT_TYPES } from '@/config/notification-events';
import { normalizeToMillisOrNull } from '@/lib/date-local';
import { demandListingMatchEventId } from '@/lib/demand/demand-announcement';
import { generateNotificationDedupeId } from '@/services/enterprise-id.service';

/**
 * **Πόσα έγγραφα ανά `getAll`** — μία κλήση δικτύου ανά δέσμη, ποτέ μία ανά αγγελία.
 * Ζήτηση με 250 ταιριάσματα κάνει **3** κλήσεις, όχι 250.
 */
export const MATCH_LEDGER_BATCH = 100;

/**
 * `listingId → στιγμή ανακοίνωσης (ms)` για κάθε ταίριασμα που **έχει ήδη** ειδοποίηση.
 *
 * ⚠️ **Απουσία από τον χάρτη = δεν ανακοινώθηκε ποτέ. `null` = ανακοινώθηκε, η στιγμή
 * δεν διαβάζεται.** Δύο διαφορετικές απαντήσεις — δες `MatchHistory`.
 */
export type MatchLedger = ReadonlyMap<string, number | null>;

/** **Τι ξέρει ήδη αυτός ο ζητών για αυτές τις αγγελίες.** Κενή λίστα ⇒ καμία ανάγνωση. */
export async function readMatchLedger(
  db: AdminFirestore,
  recipientId: string,
  demandId: string,
  listingIds: readonly string[],
): Promise<MatchLedger> {
  const ledger = new Map<string, number | null>();

  for (let start = 0; start < listingIds.length; start += MATCH_LEDGER_BATCH) {
    const batch = listingIds.slice(start, start + MATCH_LEDGER_BATCH);
    const refs = batch.map((listingId) =>
      db
        .collection(COLLECTIONS.NOTIFICATIONS)
        .doc(
          generateNotificationDedupeId(
            NOTIFICATION_EVENT_TYPES.PROPERTIES_DEMAND_LISTING_MATCH,
            recipientId,
            demandListingMatchEventId(demandId, listingId),
          ),
        ),
    );
    const snapshots = await db.getAll(...refs);
    snapshots.forEach((snapshot, index) => {
      if (snapshot.exists) ledger.set(batch[index], normalizeToMillisOrNull(snapshot.get('createdAt')));
    });
  }

  return ledger;
}
