import 'server-only';

/**
 * @fileoverview **Η ΘΕΣΗ ΟΛΟΚΛΗΡΗ, ΓΙΑ ΤΟΝ ΔΙΑΚΟΜΙΣΤΗ** — δημόσια γραμμή ακροατηρίου + ιδιωτική πλευρά (ADR-867 Β9(β) Ε9).
 * @related types/network-thread.ts (`NetworkAudienceSeat` · μητρώο ορατότητας) · CHECK 3.89 (δηλωμένος καταναλωτής —
 *   **μόνο ανάγνωση**) · `lib/network-messaging/network-thread-from-document.ts` (ο ΕΝΑΣ αναλυτής)
 * @module services/network-messaging/audience-seats
 *
 * 🔑 **ΕΝΑΣ ΤΡΟΠΟΣ ΝΑ ΕΝΩΘΟΥΝ ΟΙ ΔΥΟ ΠΛΕΥΡΕΣ**: την ιδιωτική πλευρά τη χρειάζονται η αποστολή (fan-out +
 * ειδοποίηση), η ανάκληση/επεξεργασία («το πρόλαβε κάποιος;»), ο κατάλογος (αδιάβαστο · σίγαση) και η πύλη
 * του email. Τέσσερις ενώσεις γραμμένες χωριστά θα διαφωνούσαν την ημέρα που η ιδιωτική πλευρά αποκτούσε
 * πεδίο — ή, χειρότερα, κάποια θα ξεχνούσε την εφεδρεία του παλιού σχήματος και θα έλεγε «αδιάβαστο» σε όλα.
 *
 * ⚡ **Ένα `getAll` για όλες τις γραμμές** — ποτέ μία ανάγνωση ανά θέση. Ο ίδιος κώδικας τρέχει μέσα σε
 * συναλλαγή (`transaction.getAll`) και έξω (`adminDb.getAll`): ο καλών δίνει τον αναγνώστη.
 */

import type {
  DocumentData,
  DocumentReference,
  DocumentSnapshot,
  Firestore as AdminFirestore,
  QueryDocumentSnapshot,
} from 'firebase-admin/firestore';

import {
  audiencePrivateFieldsOf,
  networkAudiencePrivateFromDocuments,
} from '@/lib/network-messaging/network-thread-from-document';
import {
  NETWORK_AUDIENCE_PRIVATE_FIELDS,
  type NetworkAudienceEntry,
  type NetworkAudiencePrivate,
  type NetworkAudienceSeat,
} from '@/types/network-thread';

import { networkAudiencePrivateRef } from './network-thread-ref';

/** `adminDb.getAll` **ή** `transaction.getAll` — ίδια υπογραφή, άλλη συνέπεια. */
export type SnapshotReader = (...refs: DocumentReference[]) => Promise<DocumentSnapshot[]>;

/** Μια δημόσια γραμμή όπως διαβάστηκε — `publicRaw: undefined` ⇒ ο άνθρωπος **δεν έχει** θέση εκεί. */
export interface PublicSeatRow {
  readonly threadId: string;
  readonly uid: string;
  readonly publicRaw: DocumentData | undefined;
}

/**
 * Δημόσια + ιδιωτική πλευρά ⇒ θέση. ⚠️ Τα ιδιωτικά πεδία **ξαναγράφονται** από τον αναλυτή, ώστε ό,τι
 * παλιό κουβαλά ακόμη η δημόσια γραμμή (πριν τη μετανάστευση) να μετρά **μόνο** ως εφεδρεία.
 */
export function audienceSeatOf(publicRaw: DocumentData, privateRaw: DocumentData | undefined): NetworkAudienceSeat {
  return { ...(publicRaw as NetworkAudienceEntry), ...networkAudiencePrivateFromDocuments(privateRaw, publicRaw) };
}

/**
 * 🔑 **Οι θέσεις, ευθυγραμμισμένες με τις γραμμές εισόδου** — `null` όπου δεν υπάρχει δημόσια γραμμή.
 * Η ιδιωτική πλευρά διαβάζεται **μόνο** για όσους έχουν θέση: ξένο `uid` δεν κοστίζει ανάγνωση.
 */
export async function joinAudienceSeats(
  read: SnapshotReader,
  adminDb: AdminFirestore,
  rows: readonly PublicSeatRow[],
): Promise<readonly (NetworkAudienceSeat | null)[]> {
  const seated = rows.filter((row) => row.publicRaw !== undefined);
  if (seated.length === 0) return rows.map(() => null);
  const snaps = await read(...seated.map((row) => networkAudiencePrivateRef(adminDb, row.threadId, row.uid)));
  const privateByKey = new Map(seated.map((row, index) => [`${row.threadId}/${row.uid}`, snaps[index]?.data()]));
  return rows.map((row) => (row.publicRaw === undefined
    ? null
    : audienceSeatOf(row.publicRaw, privateByKey.get(`${row.threadId}/${row.uid}`))));
}

/**
 * Όλες οι θέσεις **ενός** νήματος, από τις δημόσιες γραμμές του (ένα `get` της υποσυλλογής).
 * 🔑 Η ταυτότητα έρχεται από το **κλειδί** του εγγράφου — το κλειδί ΕΙΝΑΙ το πρόσωπο (§4.2).
 */
export async function seatsOfThread(
  read: SnapshotReader,
  adminDb: AdminFirestore,
  threadId: string,
  publicDocs: readonly QueryDocumentSnapshot[],
): Promise<readonly NetworkAudienceSeat[]> {
  const seats = await joinAudienceSeats(read, adminDb, publicDocs.map((doc) => ({ threadId, uid: doc.id, publicRaw: doc.data() })));
  return seats.filter((seat): seat is NetworkAudienceSeat => seat !== null);
}

// =============================================================================
// 🔁 ΤΟ ΚΑΤΑΛΟΙΠΟ ΤΟΥ ΠΑΛΙΟΥ ΣΧΗΜΑΤΟΣ (expand/contract · ADR-867 Β9(β) Ε9)
// =============================================================================

/** Τι πρέπει να μετακινηθεί από **μία** δημόσια γραμμή — `null` ⇒ η γραμμή είναι ήδη καθαρή. */
export interface LegacyPrivateResidue {
  /** Ό,τι περνά στο ιδιωτικό έγγραφο: **μόνο** όσα εκείνο δεν λέει ήδη (ό,τι λέει είναι νεότερο). */
  readonly carry: Partial<NetworkAudiencePrivate>;
  /** Ό,τι σβήνεται από τη δημόσια γραμμή — **κάθε** ιδιωτικό όνομα που βρέθηκε εκεί, έγκυρο ή όχι. */
  readonly strip: readonly (keyof NetworkAudiencePrivate)[];
}

/**
 * 🔑 **Καθαρό, ώστε ο γραφέας, η μετανάστευση και οι άγκυρες να ρωτούν το ΙΔΙΟ.** Τα ονόματα έρχονται από
 * το μητρώο ορατότητας (`NETWORK_AUDIENCE_PRIVATE_FIELDS`): πεδίο που μπαίνει εκεί αύριο μετακινείται
 * χωρίς να αγγίξει κανείς αυτή τη συνάρτηση.
 */
export function legacyPrivateResidue(publicRaw: DocumentData, privateRaw: DocumentData | undefined): LegacyPrivateResidue | null {
  const strip = NETWORK_AUDIENCE_PRIVATE_FIELDS.filter((field) => field in publicRaw);
  if (strip.length === 0) return null;
  const already = audiencePrivateFieldsOf(privateRaw);
  const legacy = audiencePrivateFieldsOf(publicRaw);
  const carry: { lastReadAt?: string | null; muted?: boolean; following?: boolean } = {};
  if (legacy.lastReadAt !== undefined && already.lastReadAt === undefined) carry.lastReadAt = legacy.lastReadAt;
  if (legacy.muted !== undefined && already.muted === undefined) carry.muted = legacy.muted;
  if (legacy.following !== undefined && already.following === undefined) carry.following = legacy.following;
  return { carry, strip };
}
