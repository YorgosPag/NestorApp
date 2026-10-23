/**
 * @fileoverview **ΤΙ ΕΧΟΥΜΕ ΗΔΗ ΠΕΙ ΣΕ ΑΥΤΟΝ ΤΟΝ ΑΝΘΡΩΠΟ** — από τις ίδιες τις ειδοποιήσεις.
 * @related ADR-777 §8.69 · §8.69.12 · §8.22.6 · server/notifications/notification-orchestrator.ts
 * @module services/demand/demand-match-ledger
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΕΛΑΤΤΩΜΑ ΠΟΥ ΔΙΟΡΘΩΣΕ (βρέθηκε 2026-09-15, γράφοντας τη μείωση τιμής)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο ειδοποιητής ταιριάσματος έκοβε τα ταιριάσματα στα **πρώτα 10 ΠΡΙΝ** μάθει ποια είναι
 * ήδη γνωστά. Σε κάθε ωριαίο πέρασμα τα **ίδια** 10 ξαναέβγαιναν «ήδη γνωστά» ⇒ η 11η
 * αγγελία **δεν ανακοινωνόταν ποτέ**. Εδώ διαβάζεται **ΜΙΑ φορά ανά παραλήπτη** τι υπάρχει
 * ήδη, ώστε το όριο να μετρά **μόνο νέες** ανακοινώσεις.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🗄️ §8.69.12 — ΔΥΟ ΓΕΝΙΕΣ ΚΛΕΙΔΙΩΝ, ΜΙΑ ΑΠΑΝΤΗΣΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η ταυτότητα έγινε **θέμα** (παραλήπτης, αγγελία[, μείωση]) αντί για **αιτία** (ζήτηση).
 * Τα **ήδη γραμμένα** έγγραφα όμως έχουν κλειδί ανά ζήτηση. Αν το καθολόγιο κοιτούσε μόνο το
 * νέο κλειδί, **κάθε** παλιό ταίριασμα και **κάθε** φρέσκια μείωση θα ξαναστελνόταν μία φορά.
 * ⇒ Ένα θέμα είναι «γνωστό» αν υπάρχει το νέο κλειδί **ή** το παλιό κλειδί **οποιασδήποτε**
 * ζήτησης του παραλήπτη. Η στιγμή = η **πρώτη** γνωστή ανακοίνωση, γιατί από τότε ο άνθρωπος
 * ξέρει την τιμή (`priceDropVerdict`).
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
import {
  demandListingMatchEventId,
  demandPriceDropEventId,
  recipientAvailabilityChangeEventId,
  recipientListingMatchEventId,
  recipientPriceDropEventId,
  type MatchHistory,
} from '@/lib/demand/demand-announcement';
import { generateNotificationDedupeId } from '@/services/enterprise-id.service';
import type { AvailabilityChange } from '@/types/availability-history';
import type { PriceReduction } from '@/types/price-history';

/**
 * **Πόσα έγγραφα ανά `getAll`** — μία κλήση δικτύου ανά δέσμη, ποτέ μία ανά αγγελία.
 * Παραλήπτης με 250 ανιχνεύσεις κάνει **3** κλήσεις, όχι 250.
 */
export const MATCH_LEDGER_BATCH = 100;

/**
 * **Ένα θέμα** που ρωτάμε: η αγγελία, οι ζητήσεις-λόγοι της, η μείωσή της αν έχει, και (ADR-919 §10) η αλλαγή
 * διαθεσιμότητας που κρίνεται σε αυτό το πέρασμα, αν υπάρχει.
 */
export interface LedgerTopic {
  readonly listingId: string;
  readonly demandIds: readonly string[];
  readonly reduction: Pick<PriceReduction, 'to' | 'since'> | null;
  readonly availabilityChange: Pick<AvailabilityChange, 'at'> | null;
}

/** **Τι ξέρει ήδη ο άνθρωπος** για μία αγγελία. */
export interface TopicKnowledge {
  readonly match: MatchHistory;
  /** Η **τρέχουσα** μείωση έχει ήδη γραμμένη ειδοποίηση — με νέο ή παλιό κλειδί. */
  readonly priceDropKnown: boolean;
  /** Η αλλαγή διαθεσιμότητας του θέματος έχει ήδη γραμμένη ειδοποίηση (ADR-919 §10· ένα κλειδί, καμία παλιά γενιά). */
  readonly availabilityChangeKnown: boolean;
}

/** `listingId → γνώση` για **κάθε** θέμα που ρωτήθηκε — ποτέ απουσία. */
export type RecipientLedger = ReadonlyMap<string, TopicKnowledge>;

type Aspect = 'match' | 'price-drop' | 'availability-change';

interface Probe {
  readonly listingId: string;
  readonly aspect: Aspect;
  readonly docId: string;
}

/** Όλα τα αναγνωριστικά εγγράφων που θα σήμαιναν «το έχουμε πει» για αυτό το θέμα. */
function probesOf(recipientId: string, topic: LedgerTopic): Probe[] {
  const { listingId, demandIds, reduction, availabilityChange } = topic;
  const probe = (aspect: Aspect, eventType: string, eventId: string): Probe => ({
    listingId,
    aspect,
    docId: generateNotificationDedupeId(eventType, recipientId, eventId),
  });

  const matchType = NOTIFICATION_EVENT_TYPES.PROPERTIES_DEMAND_LISTING_MATCH;
  const probes = [
    probe('match', matchType, recipientListingMatchEventId(listingId)),
    ...demandIds.map((demandId) => probe('match', matchType, demandListingMatchEventId(demandId, listingId))),
  ];
  if (availabilityChange !== null) {
    probes.push(
      probe(
        'availability-change',
        NOTIFICATION_EVENT_TYPES.PROPERTIES_DEMAND_AVAILABILITY_CHANGE,
        recipientAvailabilityChangeEventId(listingId, availabilityChange),
      ),
    );
  }
  if (reduction === null) return probes;

  const dropType = NOTIFICATION_EVENT_TYPES.PROPERTIES_DEMAND_PRICE_DROP;
  return [
    ...probes,
    probe('price-drop', dropType, recipientPriceDropEventId(listingId, reduction)),
    ...demandIds.map((demandId) =>
      probe('price-drop', dropType, demandPriceDropEventId(demandId, listingId, reduction)),
    ),
  ];
}

/** Ό,τι μαζεύεται για ένα θέμα καθώς επιστρέφουν οι δέσμες. */
interface Accumulator {
  matchSeen: boolean;
  /** Βρέθηκε ανακοίνωση χωρίς αναγνώσιμη στιγμή ⇒ η κρίση πάει προς τη **σιωπή**. */
  matchUnreadable: boolean;
  earliestMs: number;
  priceDropKnown: boolean;
  availabilityChangeKnown: boolean;
}

function absorb(acc: Accumulator, aspect: Aspect, createdAtMs: number | null): void {
  if (aspect === 'price-drop') {
    acc.priceDropKnown = true;
    return;
  }
  if (aspect === 'availability-change') {
    acc.availabilityChangeKnown = true;
    return;
  }
  acc.matchSeen = true;
  if (createdAtMs === null) acc.matchUnreadable = true;
  else acc.earliestMs = Math.min(acc.earliestMs, createdAtMs);
}

function knowledgeOf(acc: Accumulator): TopicKnowledge {
  const known = { priceDropKnown: acc.priceDropKnown, availabilityChangeKnown: acc.availabilityChangeKnown };
  if (!acc.matchSeen) return { match: { kind: 'never-announced' }, ...known };
  return { match: { kind: 'announced', atMs: acc.matchUnreadable ? null : acc.earliestMs }, ...known };
}

/** **Τι ξέρει ήδη αυτός ο παραλήπτης για αυτά τα θέματα.** Κενή λίστα ⇒ καμία ανάγνωση. */
export async function readRecipientLedger(
  db: AdminFirestore,
  recipientId: string,
  topics: readonly LedgerTopic[],
): Promise<RecipientLedger> {
  const accumulators = new Map<string, Accumulator>(
    topics.map((topic) => [
      topic.listingId,
      {
        matchSeen: false,
        matchUnreadable: false,
        earliestMs: Number.POSITIVE_INFINITY,
        priceDropKnown: false,
        availabilityChangeKnown: false,
      },
    ]),
  );
  const probes = topics.flatMap((topic) => probesOf(recipientId, topic));

  for (let start = 0; start < probes.length; start += MATCH_LEDGER_BATCH) {
    const batch = probes.slice(start, start + MATCH_LEDGER_BATCH);
    const snapshots = await db.getAll(
      ...batch.map((probe) => db.collection(COLLECTIONS.NOTIFICATIONS).doc(probe.docId)),
    );
    snapshots.forEach((snapshot, index) => {
      const probe = batch[index];
      const acc = accumulators.get(probe.listingId);
      if (snapshot.exists && acc) absorb(acc, probe.aspect, normalizeToMillisOrNull(snapshot.get('createdAt')));
    });
  }

  return new Map([...accumulators].map(([listingId, acc]) => [listingId, knowledgeOf(acc)]));
}
