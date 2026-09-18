/**
 * @fileoverview **ΤΟ ΗΜΕΡΟΛΟΓΙΟ ΕΝΟΣ ΚΑΤΑΛΥΜΑΤΟΣ, ΟΠΩΣ ΤΟ ΞΕΡΕΙ Η ΒΑΣΗ** — η ΜΙΑ
 *   ανάγνωση, μέσα ή έξω από συναλλαγή.
 * @related ADR-835 §20 (Στάδιο Α) · §6.2 · §6.4 · lib/stay/stay-calendar-from-document.ts ·
 *   services/stay-calendar/stay-calendar-write.service.ts
 * @module services/stay-calendar/stay-calendar-read.service
 *
 * 🔑 **ΜΙΑ ανάγνωση για τρεις καταναλωτές**: η οθόνη του οικοδεσπότη, η συναλλαγή κάθε
 * εγγραφής, και (Στάδιο Β) η αναζήτηση στον διακομιστή. Δεύτερη ανάγνωση θα ήταν δεύτερη
 * απάντηση στο «τι είναι πιασμένο;» — και η μέρα που θα διαφωνούσαν λέγεται overbooking.
 *
 * ⛔ **ΚΑΝΕΝΑ ΧΡΟΝΙΚΟ `where` ΣΤΟ ΕΡΩΤΗΜΑ.** Ένα `where('to', '>', σήμερα)` θα έκρυβε
 * ακριβώς τα έγγραφα με **χαλασμένο** `to` — το «άγνωστο» θα γινόταν «κενό» (ADR-832
 * §5.5, μετρημένο). Διαβάζονται **όλα**, περνούν από το σύνορο, και ό,τι δεν διαβάζεται
 * **μετριέται**.
 */

import 'server-only';
import type {
  DocumentReference,
  DocumentSnapshot,
  Firestore as AdminFirestore,
  Query,
  QuerySnapshot,
  Transaction,
} from 'firebase-admin/firestore';
import { COLLECTIONS } from '@/config/firestore-collections';
import { custodyOf, mayAdminister, type ListingActor } from '@/lib/owner-property/listing-custody';
import { ownerPropertyFromDocument } from '@/lib/owner-property/owner-property-from-document';
import {
  stayCalendarEntryViewOf,
  stayDaysWithin,
  stayEntriesWithin,
  stayPendingRequestsOf,
  type StayCalendarView,
} from '@/lib/stay/stay-calendar-view';
import {
  stayBlockFromDocument,
  stayBookingFromDocument,
  stayCalendarHeadFromDocument,
  stayCalendarMonthFromDocument,
  stayChannelsFromDocument,
} from '@/lib/stay/stay-calendar-from-document';
import { stayChannelsTrustedAt } from '@/lib/stay/stay-channel-health';
import type { StayChannelTrust } from '@/lib/stay/stay-availability-vocabulary';
import { STAY_CHANNELS_NONE, type StayChannels } from '@/types/stay-channels';
import { nowISO } from '@/lib/date-local';
import { stayDayRulesOf } from '@/lib/stay/stay-calendar-of';
import { STAY_RULES_NONE, type StayCalendarMonth } from '@/types/stay-rules';
import {
  type StayCalendarEntry,
  type StayCalendarHead,
} from '@/types/stay-calendar';

/**
 * **Τι διαβάστηκε.** Διακριτή ένωση, ποτέ «κενός πίνακας + σημαία».
 *
 * 🔴 `unreadable` **ΔΕΝ** είναι `readable` με λιγότερες εγγραφές: μια κράτηση που δεν
 * διαβάστηκε **πιάνει νύχτες που δεν ξέρουμε**. Η εγγραφή **αρνείται**, η αναζήτηση
 * απαντά `unreadable` (§6.4) — κανείς δεν συνεχίζει «με ό,τι βρήκε».
 */
export type StayCalendarSnapshot =
  | {
      readonly kind: 'readable';
      readonly head: StayCalendarHead | null;
      readonly entries: readonly StayCalendarEntry[];
      /** Οι μήνες με κανόνες ανά ημερομηνία (Στάδιο Β) — όλοι, χωρίς χρονικό φίλτρο. */
      readonly months: readonly StayCalendarMonth[];
      /**
       * 🔴 **Η φρεσκάδα των καναλιών ως ΓΕΓΟΝΟΣ** (Στάδιο Γ, §22): κρίνεται εδώ, όπου
       * υπάρχει ρολόι, και ταξιδεύει στη καθαρή σύνθεση. `stale` ⇒ ό,τι θα λέγαμε
       * «ελεύθερο» γίνεται `unsynced` — ποτέ υπόσχεση για νύχτες που κανάλι σώπασε.
       */
      readonly channels: StayChannelTrust;
      /** Το έγγραφο των καναλιών **αυτούσιο** — για την εισαγωγή και την οθόνη πηγών. */
      readonly channelDoc: StayChannels | null;
    }
  | { readonly kind: 'unreadable'; readonly unreadableIds: readonly string[] };

/** Ο ελάχιστος αναγνώστης — το `adminDb` ή μια `Transaction`, με την ίδια σημασία. */
interface CalendarReader {
  readonly doc: (ref: DocumentReference) => Promise<DocumentSnapshot>;
  readonly query: (query: Query) => Promise<QuerySnapshot>;
}

function readerOf(transaction: Transaction | null): CalendarReader {
  if (transaction === null) {
    return { doc: (ref) => ref.get(), query: (query) => query.get() };
  }
  return { doc: (ref) => transaction.get(ref), query: (query) => transaction.get(query) };
}

/**
 * Η αναφορά του **ακινήτου** του ημερολογίου — **μόνο για ανάγνωση** (κατοχή + διάθεση).
 * Ζει εδώ ώστε ο γραφέας του ημερολογίου να μην αναφέρει καν τη συλλογή των αγγελιών:
 * δεν τη γράφει ποτέ, και το CHECK 3.17 κρίνει ανά αρχείο.
 */
export function stayPropertyRef(adminDb: AdminFirestore, propertyId: string): DocumentReference {
  return adminDb.collection(COLLECTIONS.OWNER_PROPERTIES).doc(propertyId);
}

/** Η αναφορά του εγγράφου καναλιών (Στάδιο Γ) — **μία** διατύπωση, όπως της κεφαλής. */
export function stayChannelsRef(adminDb: AdminFirestore, propertyId: string): DocumentReference {
  return adminDb.collection(COLLECTIONS.STAY_CHANNELS).doc(propertyId);
}

/** Η αναφορά της κεφαλής — **μία** διατύπωση, για αναγνώστη και γραφέα. */
export function stayCalendarHeadRef(adminDb: AdminFirestore, propertyId: string): DocumentReference {
  return adminDb.collection(COLLECTIONS.STAY_CALENDARS).doc(propertyId);
}

function entriesQuery(adminDb: AdminFirestore, collection: string, propertyId: string): Query {
  // tenant-scope-exempt: ανάγνωση ΓΟΝΕΑ — «οι εγγραφές ημερολογίου ΑΥΤΟΥ του ακινήτου». Δύο
  // είδη καλούντων: (α) η οθόνη/συναλλαγή, που έχει ήδη περάσει τον `mayAdminister(custodyOf(…))`
  // (CHECK 3.56) — ο άξονας `authorUserId` ΔΕΝ είναι ο κριτής της διαχείρισης (γραφείο: άλλος
  // υπάλληλος)· (β) η δημόσια διαθεσιμότητα (ADR-835 §21), για ΔΗΜΟΣΙΕΥΜΕΝΗ βραχυχρόνια αγγελία,
  // όπου από τον διακομιστή φεύγει ΜΟΝΟ η απάντηση της μηχανής, ποτέ εγγραφή.
  return adminDb.collection(collection).where('propertyId', '==', propertyId);
}

/**
 * **Διαβάζει ολόκληρο το ημερολόγιο ενός ακινήτου.**
 *
 * @param transaction — `null` για απλή ανάγνωση (οθόνη)· η συναλλαγή της εγγραφής
 *   αλλιώς, ώστε η ετυμηγορία να βγει από **φρέσκα** δεδομένα (Κ1).
 */
export async function readStayCalendar(
  adminDb: AdminFirestore,
  propertyId: string,
  transaction: Transaction | null,
): Promise<StayCalendarSnapshot> {
  const reader = readerOf(transaction);
  const [headSnap, blockSnap, bookingSnap, monthSnap, channelSnap] = await Promise.all([
    reader.doc(stayCalendarHeadRef(adminDb, propertyId)),
    reader.query(entriesQuery(adminDb, COLLECTIONS.STAY_BLOCKS, propertyId)),
    reader.query(entriesQuery(adminDb, COLLECTIONS.STAY_BOOKINGS, propertyId)),
    reader.query(entriesQuery(adminDb, COLLECTIONS.STAY_CALENDAR_MONTHS, propertyId)),
    reader.doc(stayChannelsRef(adminDb, propertyId)),
  ]);

  const unreadableIds: string[] = [];
  const head = headSnap.exists ? stayCalendarHeadFromDocument(headSnap.data(), propertyId) : null;
  if (headSnap.exists && head === null) unreadableIds.push(propertyId);

  const entries: StayCalendarEntry[] = [];
  for (const doc of blockSnap.docs) {
    const block = stayBlockFromDocument(doc.data(), doc.id);
    if (block === null) unreadableIds.push(doc.id);
    else entries.push({ kind: 'block', block });
  }
  for (const doc of bookingSnap.docs) {
    const booking = stayBookingFromDocument(doc.data(), doc.id);
    if (booking === null) unreadableIds.push(doc.id);
    else entries.push({ kind: 'booking', booking });
  }

  const months: StayCalendarMonth[] = [];
  for (const doc of monthSnap.docs) {
    const month = stayCalendarMonthFromDocument(doc.data(), doc.id);
    // Ένας μήνας άλλου ακινήτου κάτω από αυτό το ερώτημα είναι αδύνατος — αν συμβεί, χαλασμένος.
    if (month === null || month.propertyId !== propertyId) unreadableIds.push(doc.id);
    else months.push(month);
  }

  // 🔴 Χαλασμένο έγγραφο καναλιών ⇒ `unreadable`: πηγή που δεν διαβάζεται δεν
  //    δημοσκοπείται και δεν φυλάει νύχτες (§22).
  const channelDoc = channelSnap.exists ? stayChannelsFromDocument(channelSnap.data(), propertyId) : null;
  if (channelSnap.exists && channelDoc === null) unreadableIds.push(`${propertyId}:channels`);

  if (unreadableIds.length > 0) return { kind: 'unreadable', unreadableIds };
  const feeds = channelDoc?.feeds ?? STAY_CHANNELS_NONE.feeds;
  const channels: StayChannelTrust = stayChannelsTrustedAt(feeds, nowISO()) ? 'synced' : 'stale';
  return { kind: 'readable', head, entries, months, channels, channelDoc };
}

/**
 * **Η προβολή για τον διαχειριστή της αγγελίας** — ή `absent`.
 *
 * 🔑 `absent` και για «δεν υπάρχει» **και** για «δεν το διαχειρίζεσαι» — ίδια έκβαση με
 * το `loadAdministrable` του `owner-property-write.service`: η άρνηση δεν αποκαλύπτει
 * ύπαρξη. Ο κριτής είναι ο **ένας** (`mayAdminister`, CHECK 3.56).
 *
 * @param window — `[from, to)` σε `YYYY-MM-DD`· επιστρέφονται μόνο οι εγγραφές που το αγγίζουν.
 */
export async function readStayCalendarView(
  adminDb: AdminFirestore,
  propertyId: string,
  actor: ListingActor,
  window: { readonly from: string; readonly to: string },
): Promise<StayCalendarView | { readonly kind: 'absent' }> {
  const propertySnap = await stayPropertyRef(adminDb, propertyId).get();
  const property = ownerPropertyFromDocument(propertySnap.data(), propertyId);
  if (property === null || !mayAdminister(custodyOf(property), actor)) return { kind: 'absent' };

  const snapshot = await readStayCalendar(adminDb, propertyId, null);
  if (snapshot.kind === 'unreadable') return { kind: 'unreadable' };
  // 🔑 **Μία** στιγμή για όλη την προβολή — αλλιώς ένα αίτημα θα μπορούσε να λήγει ανάμεσα σε δύο γραμμές.
  const instant = nowISO();
  const views = snapshot.entries.map((entry) => stayCalendarEntryViewOf(entry, instant));
  return {
    kind: 'readable',
    declaredAt: snapshot.head?.declaredAt ?? null,
    version: snapshot.head?.version ?? 0,
    rules: snapshot.head?.rules ?? STAY_RULES_NONE,
    days: stayDaysWithin(stayDayRulesOf(snapshot.months), window.from, window.to),
    // 🔑 Η στιγμή της ανάγνωσης κρίνει ποια αιτήματα **ζουν ακόμη** (Στάδιο Δ, §23.1).
    entries: stayEntriesWithin(views, window.from, window.to),
    pendingRequests: stayPendingRequestsOf(views),
  };
}
