/**
 * @fileoverview **Η ΑΠΟΘΗΚΕΥΣΗ ΩΣ ΔΕΥΤΕΡΟΣ ΛΟΓΟΣ ΣΤΟ ΙΔΙΟ ΘΕΜΑ** — «μειώθηκε η τιμή αγγελίας που κράτησες».
 * @related ADR-777 §8.74 · services/demand/listing-match-topics.ts · lib/demand/demand-announcement.ts
 * @module services/demand/saved-listing-topics
 *
 * 🏆 **ΓΙΑΤΙ ΟΧΙ ΔΕΥΤΕΡΟΣ ΕΙΔΟΠΟΙΗΤΗΣ.** Ο άνθρωπος που **και** ζητά **και** κράτησε την ίδια αγγελία
 * θα έπαιρνε δύο email για μία μείωση — ακριβώς το ελάττωμα του §8.69.12 («ένα μήνυμα ανά αιτία»). Εδώ η
 * αποθήκευση μπαίνει στο **ίδιο θέμα** (παραλήπτης, αγγελία), με το **ίδιο** κλειδί μείωσης: το dedup του
 * orchestrator κάνει το δεύτερο email **δομικά αδύνατο**, όχι απλώς «απίθανο».
 *
 * 🔑 **Η ΑΠΟΘΗΚΕΥΣΗ ΕΙΝΑΙ ΓΝΩΣΗ, ΟΧΙ ΝΕΟΣ ΚΑΝΟΝΑΣ.** Από τη στιγμή που κράτησε την αγγελία, ο άνθρωπος
 * **ξέρει** την τιμή της — όπως από τη στιγμή που του ανακοινώθηκε ταίριασμα. Άρα το υπάρχον
 * `priceDropVerdict` κρίνει **αμετάβλητο**: μείωση **πριν** την αποθήκευση ⇒ σιωπή (την είδε ήδη
 * μειωμένη)· μείωση **μετά** ⇒ είδηση. Το Zillow κρίνει με σταθερό κατώφλι ($1.000), όχι με ό,τι ξέρει
 * ο άνθρωπος.
 *
 * **Layering**: καθαρό — καμία εξάρτηση από Firestore/δίκτυο/ρολόι.
 */

import type { MatchHistory } from '@/lib/demand/demand-announcement';
import type { PublicListing } from '@/types/public-listing';
import type { SavedListing } from '@/types/saved-listing';

import type { ListingTopic, RecipientTopics } from './listing-match-topics';

/**
 * **Από πότε ξέρει ο άνθρωπος αυτή την αγγελία** — η **νωρίτερη** από ανακοίνωση ταιριάσματος και
 * αποθήκευση.
 *
 * ⚠️ `atMs: null` («ανακοινώθηκε, η στιγμή δεν διαβάζεται») **μένει** `null`: η κρίση πάει προς τη
 * σιωπή, και μια αποθήκευση δεν επιτρέπεται να την ξαναανοίξει.
 */
export function knownSince(match: MatchHistory, savedAtMs: number | null): MatchHistory {
  if (savedAtMs === null) return match;
  if (match.kind === 'never-announced') return { kind: 'announced', atMs: savedAtMs };
  if (match.atMs === null) return match;
  return { kind: 'announced', atMs: Math.min(match.atMs, savedAtMs) };
}

/** Θέμα που υπάρχει **μόνο** επειδή κρατήθηκε — δεν γεννά ποτέ email ταιριάσματος, μόνο μείωσης. */
export function isSavedOnly(topic: ListingTopic): boolean {
  return topic.reasons.demandIds.length === 0 && topic.savedAtMs !== null;
}

function savedOnlyTopic(listing: PublicListing, savedAtMs: number): ListingTopic {
  return { listing, reasons: { demandIds: [], seeks: [] }, metOn: [], savedAtMs };
}

/** `παραλήπτης → (αγγελία → στιγμή αποθήκευσης)` — μόνο για αγγελίες που είναι στη δεξαμενή. */
function savedAtByRecipient(
  saves: readonly SavedListing[],
  listingIds: ReadonlySet<string>,
): ReadonlyMap<string, ReadonlyMap<string, number>> {
  const byRecipient = new Map<string, Map<string, number>>();
  for (const saved of saves) {
    const savedAtMs = Date.parse(saved.savedAt);
    if (!listingIds.has(saved.listingId) || !Number.isFinite(savedAtMs)) continue;
    const listings = byRecipient.get(saved.saverUserId) ?? new Map<string, number>();
    byRecipient.set(saved.saverUserId, listings);
    listings.set(saved.listingId, savedAtMs);
  }
  return byRecipient;
}

function withSaves(
  recipient: RecipientTopics,
  savedAt: ReadonlyMap<string, number>,
  listingsById: ReadonlyMap<string, PublicListing>,
): RecipientTopics {
  const covered = new Set(recipient.topics.map((topic) => topic.listing.id));
  const topics = recipient.topics.map((topic) => ({ ...topic, savedAtMs: savedAt.get(topic.listing.id) ?? null }));
  const savedOnly = [...savedAt].flatMap(([listingId, savedAtMs]) => {
    const listing = listingsById.get(listingId);
    return covered.has(listingId) || listing === undefined ? [] : [savedOnlyTopic(listing, savedAtMs)];
  });
  return { ...recipient, topics: [...topics, ...savedOnly] };
}

/**
 * **Οι παραλήπτες των ζητήσεων, μαζί με όσους κράτησαν αγγελία.** Ο ίδιος άνθρωπος εμφανίζεται
 * **μία** φορά, και η ίδια αγγελία **ένα** θέμα — με ζήτηση, με αποθήκευση, ή και με τα δύο.
 *
 * 🔑 Τα θέματα «μόνο αποθήκευσης» μπαίνουν **μετά** τα θέματα ζητήσεων: το όριο νέων ανακοινώσεων
 * κόβει με την **ίδια** σειρά που έκοβε πριν (και δεν τα αγγίζει ποτέ — δεν είναι ανακοινώσεις).
 */
export function mergeSavedTopics(
  recipients: readonly RecipientTopics[],
  saves: readonly SavedListing[],
  listings: readonly PublicListing[],
): readonly RecipientTopics[] {
  const listingsById = new Map(listings.map((listing) => [listing.id, listing] as const));
  const savedAt = savedAtByRecipient(saves, new Set(listingsById.keys()));
  const merged = recipients.map((recipient) => withSaves(recipient, savedAt.get(recipient.recipientId) ?? new Map(), listingsById));
  const known = new Set(recipients.map((recipient) => recipient.recipientId));
  const savedOnlyRecipients = [...savedAt]
    .filter(([recipientId]) => !known.has(recipientId))
    .map(([recipientId, byListing]) => withSaves({ recipientId, topics: [], pairs: 0 }, byListing, listingsById));
  return [...merged, ...savedOnlyRecipients];
}
