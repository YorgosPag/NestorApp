/**
 * @fileoverview **Η ΑΠΟΘΗΚΗ ΤΟΥ ΗΡΩΑ** — ο μόνος που αγγίζει `settings/landing_heroes` (ADR-881 §4.2).
 * @related ADR-881 · lib/landing/landing-hero-document · services/landing-hero/landing-hero-publication
 * @module services/landing-hero/landing-hero-store
 *
 * ⚠️ **SERVER-ONLY (Admin SDK).** Καμία γραμμή κανόνων για `settings` ⇒ το `match /{document=**}`
 *    (`firestore.rules:35`) αρνείται **κάθε** πελάτη. Ο browser δεν διαβάζει και δεν γράφει εδώ ποτέ.
 *
 * 🔑 **Χρονοσφραγίδες του διακομιστή** (`serverTimestamp`) στην εγγραφή, **ISO** στην ανάγνωση
 *    (`normalizeToISO`, ADR-218) — ώστε ο καθαρός αναγνώστης και το `unstable_cache` να βλέπουν
 *    σειριοποιήσιμες τιμές.
 *
 * 📏 **Κανένα σύνθετο ευρετήριο**: η λίστα εκδόσεων ταξινομεί σε **ένα** πεδίο (`createdAt`, αυτόματο
 *    ευρετήριο) και ομαδοποιεί ανά σελίδα **στη μνήμη** — οι εκδόσεις είναι δεκάδες, όχι χιλιάδες.
 */

import 'server-only';

import { FieldValue, type Firestore, type Transaction } from 'firebase-admin/firestore';

import { COLLECTIONS, SUBCOLLECTIONS, SYSTEM_DOCS } from '@/config/firestore-collections';
import { normalizeToISO } from '@/lib/date-local';
import { isRecord } from '@/lib/type-guards';
import {
  readLandingHeroPointers,
  readLandingHeroRevision,
  type LandingHeroPointers,
  type LandingHeroRevision,
} from '@/lib/landing/landing-hero-document';
import type { LandingHeroPage } from '@/lib/landing/landing-hero-vocabulary';

/** Πόσες εκδόσεις φέρνει η λίστα — αρκετές για ιστορικό, λίγες για μία ανάγνωση. */
export const LANDING_HERO_REVISION_LIST_LIMIT = 90;

/** Η έκδοση **πριν** πάρει ταυτότητα και χρονοσφραγίδα — ό,τι συνθέτει η δημοσίευση. */
export type LandingHeroRevisionDraft = Omit<LandingHeroRevision, 'id' | 'createdAt'>;

function pointerDoc(db: Firestore) {
  return db.collection(COLLECTIONS.SETTINGS).doc(SYSTEM_DOCS.LANDING_HEROES);
}

function revisionsCollection(db: Firestore) {
  return pointerDoc(db).collection(SUBCOLLECTIONS.LANDING_HERO_REVISIONS);
}

/** Κάθε πεδίο χρονοσφραγίδας → ISO, πριν φτάσει στον καθαρό αναγνώστη. */
function withIsoDates(data: Record<string, unknown>, fields: readonly string[]): Record<string, unknown> {
  const copy = { ...data };
  for (const field of fields) copy[field] = normalizeToISO(data[field]);
  return copy;
}

// ---------------------------------------------------------------------------
// Ανάγνωση
// ---------------------------------------------------------------------------

export async function readLandingHeroPointersDoc(db: Firestore): Promise<LandingHeroPointers> {
  return readLandingHeroPointers(normalisePointerData((await pointerDoc(db).get()).data()));
}

/** Το ωμό έγγραφο του δείκτη με κάθε `publishedAt` σε ISO — **η μία** προετοιμασία του. */
function normalisePointerData(data: unknown): Record<string, unknown> {
  const pages = isRecord(data) && isRecord(data.pages) ? data.pages : {};
  const normalised: Record<string, unknown> = {};
  for (const [page, pointer] of Object.entries(pages)) {
    normalised[page] = isRecord(pointer) ? withIsoDates(pointer, ['publishedAt']) : pointer;
  }
  return { pages: normalised };
}

export async function readLandingHeroRevisionDoc(
  db: Firestore,
  id: string,
): Promise<LandingHeroRevision | null> {
  const snapshot = await revisionsCollection(db).doc(id).get();
  if (!snapshot.exists) return null;
  return readLandingHeroRevision(id, withIsoDates(snapshot.data() ?? {}, ['createdAt']));
}

/** Πολλές εκδόσεις με **μία** ανάγνωση (`getAll`) — για τις ζωντανές των τριών σελίδων. */
export async function readLandingHeroRevisionDocs(
  db: Firestore,
  ids: readonly string[],
): Promise<readonly LandingHeroRevision[]> {
  if (ids.length === 0) return [];
  const snapshots = await db.getAll(...ids.map((id) => revisionsCollection(db).doc(id)));
  return snapshots
    .map((snap) => (snap.exists ? readLandingHeroRevision(snap.id, withIsoDates(snap.data() ?? {}, ['createdAt'])) : null))
    .filter((revision): revision is LandingHeroRevision => revision !== null);
}

/** Οι πιο πρόσφατες εκδόσεις, **νεότερη πρώτη** — όλων των σελίδων. */
export async function listLandingHeroRevisionDocs(db: Firestore): Promise<readonly LandingHeroRevision[]> {
  const snapshot = await revisionsCollection(db)
    .orderBy('createdAt', 'desc')
    .limit(LANDING_HERO_REVISION_LIST_LIMIT)
    .get();
  return snapshot.docs
    .map((doc) => readLandingHeroRevision(doc.id, withIsoDates(doc.data(), ['createdAt'])))
    .filter((revision): revision is LandingHeroRevision => revision !== null);
}

// ---------------------------------------------------------------------------
// Εγγραφή
// ---------------------------------------------------------------------------

/**
 * **Γράψε μια νέα έκδοση** — `create`, όχι `set`: μια ταυτότητα που υπάρχει ήδη **πετά** αντί να
 * αντικαταστήσει σιωπηλά αμετάβλητη έκδοση.
 */
export async function createLandingHeroRevisionDoc(
  db: Firestore,
  id: string,
  draft: LandingHeroRevisionDraft,
): Promise<void> {
  await revisionsCollection(db).doc(id).create({ ...draft, createdAt: FieldValue.serverTimestamp() });
}

/**
 * **Μετακίνησε τον δείκτη μιας σελίδας** — μέσα σε transaction, ώστε η επαλήθευση «η έκδοση
 * υπάρχει και ανήκει σε αυτή τη σελίδα» και η εγγραφή να είναι **ένα** βήμα.
 * @returns ο **προηγούμενος** δείκτης (για το audit), ή `'invalid-target'`.
 */
export async function movePublishedPointer(
  db: Firestore,
  page: LandingHeroPage,
  revisionId: string | null,
  actorUid: string,
): Promise<{ readonly previous: string | null } | 'invalid-target'> {
  return db.runTransaction(async (tx) => {
    if (revisionId !== null && !(await revisionBelongsTo(tx, db, revisionId, page))) return 'invalid-target';
    const current = readLandingHeroPointers(normalisePointerData((await tx.get(pointerDoc(db))).data()));
    tx.set(
      pointerDoc(db),
      {
        pages: {
          [page]: {
            publishedRevisionId: revisionId,
            publishedAt: FieldValue.serverTimestamp(),
            publishedBy: actorUid,
          },
        },
      },
      { merge: true },
    );
    return { previous: current[page].publishedRevisionId };
  });
}

async function revisionBelongsTo(
  tx: Transaction,
  db: Firestore,
  revisionId: string,
  page: LandingHeroPage,
): Promise<boolean> {
  const snapshot = await tx.get(revisionsCollection(db).doc(revisionId));
  return snapshot.exists && snapshot.data()?.page === page;
}
