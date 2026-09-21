/**
 * @fileoverview **Ο ΚΑΤΑΛΟΓΟΣ ΝΗΜΑΤΩΝ ΕΝΟΣ ΑΝΘΡΩΠΟΥ** — ποια νήματα διαβάζει **τώρα**, με σειρά
 * δραστηριότητας, σε σελίδες. Μόνο **ανάγνωση**.
 * @related ADR-867 §4.2 · Β5 · CHECK 3.89 Κ2 (δηλωμένος καταναλωτής) · `firestore.indexes.json`
 * @module services/network-messaging/thread-directory
 *
 * 🔑 **Ο ΚΑΤΑΛΟΓΟΣ ΣΕΡΒΙΡΕΤΑΙ ΑΠΟ ΤΟΝ ΔΙΑΚΟΜΙΣΤΗ, ΕΠΙΤΗΔΕΣ** (`list: if false` στον κανόνα): το
 * ακροατήριο είναι **υποσυλλογή**, και ένας κανόνας δεν μπορεί να φιλτράρει «νήματα όπου υπάρχει
 * γραμμή μου». Ο διακομιστής λέει **ποια** νήματα· η ζωντανή οθόνη διαβάζει **το περιεχόμενο**
 * κατευθείαν (onSnapshot), μέσα από τον κανόνα.
 *
 * 🔑 **FAN-OUT ON WRITE** (το πρότυπο της τεκμηρίωσης του Firestore για συνομιλίες · Slack
 * `conversations.list` με δρομέα): η ταξινόμηση ζει στη **γραμμή** του ανθρώπου
 * (`threadActivityAt`, γραμμένο από την αποστολή στην ίδια συναλλαγή). Άρα ο κατάλογος είναι
 * **ένα** ερώτημα με όριο — το κόστος ανάγνωσης είναι **η σελίδα**, όχι όλη η ιστορία του.
 *
 * ⚠️ **ΔΡΟΜΕΑΣ, ΟΧΙ OFFSET**: το `offset` του Firestore **χρεώνει** κάθε παραλειπόμενο έγγραφο
 * και μετακινεί σελίδες όταν φτάνει νέο μήνυμα. Ο δρομέας (`startAfter` σε **δύο** τιμές —
 * δραστηριότητα + μονοπάτι) δεν χάνει ούτε διπλασιάζει νήμα σε ισοπαλία χιλιοστού.
 */

import 'server-only';

import { FieldPath, type Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { createModuleLogger } from '@/lib/telemetry';
import type { NetworkAudienceEntry, NetworkAudienceRole, NetworkThread } from '@/types/network-thread';
import type { NetworkThreadDirectoryResult, NetworkThreadListItem } from '@/types/network-wire';

import { workspacePath } from '@/lib/workspace/workspace-path';
import { workspaceSegmentFor } from '@/lib/workspace/workspace-segment';

import { threadMessageDestination } from './network-destination';
import { networkAudienceGroup, networkAudienceRef, networkThreadRef } from './network-thread-ref';

const logger = createModuleLogger('NetworkThreadDirectory');

/** Προεπιλεγμένη σελίδα — όσα χωρούν σε μια οθόνη εισερχομένων. */
export const NETWORK_THREAD_PAGE_SIZE = 30;
/** Ανώτατη σελίδα — πάνω από αυτό ο πελάτης ζητά **επόμενη** σελίδα, όχι μεγαλύτερη. */
export const NETWORK_THREAD_PAGE_MAX = 50;

/**
 * ⚠️ **ΤΟ ΣΧΗΜΑ ΤΗΣ ΓΡΑΜΜΗΣ ΚΑΙ ΤΗΣ ΣΕΛΙΔΑΣ ΖΟΥΝ ΣΤΟ `types/network-wire.ts`** (ADR-867 Β9β):
 * αυτό το αρχείο είναι `server-only`, άρα ο πελάτης δεν μπορεί να εισαγάγει τύπο από εδώ. **Ένα**
 * σχήμα, **δύο** άκρα — όπως κάθε άλλη πόρτα του δικτύου.
 */
export type { NetworkThreadListItem, NetworkThreadDirectoryResult };

/** Ο δρομέας: η **θέση** της τελευταίας γραμμής της σελίδας. Αδιαφανής για τον πελάτη. */
export interface ThreadDirectoryCursor {
  readonly activityAt: string;
  readonly threadId: string;
}

// =============================================================================
// ΚΑΘΑΡΑ ΚΟΜΜΑΤΙΑ — ελέγχονται χωρίς Firestore
// =============================================================================

/** Ο δρομέας σε μορφή σύρματος — base64url, ώστε να μη γίνει «συμβόλαιο» το εσωτερικό του. */
export function encodeDirectoryCursor(cursor: ThreadDirectoryCursor): string {
  return Buffer.from(JSON.stringify({ a: cursor.activityAt, t: cursor.threadId }), 'utf8').toString('base64url');
}

/** `null` ⇒ **χαλασμένος** δρομέας: η πόρτα απαντά 400, ποτέ «πρώτη σελίδα» σιωπηλά. */
export function decodeDirectoryCursor(raw: string): ThreadDirectoryCursor | null {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
    if (typeof parsed !== 'object' || parsed === null) return null;
    const { a, t } = parsed as { readonly a?: unknown; readonly t?: unknown };
    if (typeof a !== 'string' || typeof t !== 'string' || a.length === 0 || t.length === 0) return null;
    return { activityAt: a, threadId: t };
  } catch {
    return null;
  }
}

/**
 * Γραμμή ακροατηρίου + νήμα ⇒ στοιχείο καταλόγου.
 *
 * ⚠️ Το `href` έρχεται **έτοιμο** — δεν υπολογίζεται εδώ. Η διεύθυνση του γραφείου χρειάζεται το
 * **τμήμα του χώρου**, που είναι ανάγνωση· αυτή η συνάρτηση μένει **καθαρή** και ελέγξιμη.
 */
export function directoryItem(
  threadId: string,
  entry: NetworkAudienceEntry,
  thread: NetworkThread,
  href: string | null,
): NetworkThreadListItem {
  const { lastMessageAt } = thread;
  return {
    threadId,
    topic: thread.topic,
    state: thread.state,
    lastMessageAt,
    activityAt: entry.threadActivityAt,
    unread: lastMessageAt !== null && (entry.lastReadAt === null || entry.lastReadAt < lastMessageAt),
    muted: entry.muted,
    role: entry.role,
    side: entry.side,
    // 🔑 **Η δεύτερη ιδιότητα ταξιδεύει ως τη λίστα** (Β9β): χωρίς αυτήν, οι δύο γραμμές του
    //    ίδιου ανθρώπου («ιδιοκτήτης» και «υπεύθυνος») φαίνονται ταυτόσημες στον κατάλογο.
    alsoHostRole: entry.alsoHostRole,
    href,
    since: entry.since,
  };
}

// =============================================================================
// ΤΟ ΕΡΩΤΗΜΑ
// =============================================================================

export interface ThreadDirectoryQuery {
  readonly uid: string;
  readonly limit: number;
  readonly after: ThreadDirectoryCursor | null;
}

/**
 * 🔴 **ΤΟ ΣΧΗΜΑ ΤΟΥ ΕΡΩΤΗΜΑΤΟΣ — ΔΗΛΩΜΕΝΟ ΜΙΑ ΦΟΡΑ, ΕΠΕΙΔΗ ΚΑΜΙΑ ΠΥΛΗ ΔΕΝ ΤΟ ΒΛΕΠΕΙ.**
 *
 * Μετρημένο 2026-09-18: η CHECK 3.15 αναλύει **μόνο** το `firestoreQueryService` — πάνω σε αυτό
 * το αρχείο απάντησε *«analysed 0 composite query shape(s)»*, δηλαδή **πράσινο που δεν κοίταξε**.
 * Και ο εξομοιωτής **δεν** επιβάλλει δείκτες. Ένας λάθος δείκτης θα φαινόταν **μόνο στην
 * παραγωγή**, ως `FAILED_PRECONDITION` στον κατάλογο κάθε ανθρώπου.
 *
 * ⇒ Το ερώτημα **χτίζεται** από αυτή τη δήλωση, και η άγκυρα `thread-directory-index.test.ts`
 * απαιτεί **ακριβώς** αυτόν τον δείκτη στο `firestore.indexes.json`. Δύο αντίγραφα που δεν
 * μπορούν να αποκλίνουν χωρίς κόκκινο.
 */
export const THREAD_DIRECTORY_INDEX = {
  equality: ['uid', 'until'],
  orderBy: { field: 'threadActivityAt', direction: 'desc' },
} as const;

/**
 * 🔑 **Μία σελίδα του καταλόγου.** Ζητά `limit + 1` για να ξέρει αν υπάρχει επόμενη **χωρίς**
 * δεύτερο ερώτημα μέτρησης.
 *
 * ⚠️ Ο δείκτης: `network_audience` (COLLECTION_GROUP) · `uid ↑` · `until ↑` · `threadActivityAt ↓`.
 */
export async function listNetworkThreads(
  adminDb: AdminFirestore,
  query: ThreadDirectoryQuery,
): Promise<NetworkThreadDirectoryResult> {
  const [uidField, untilField] = THREAD_DIRECTORY_INDEX.equality;
  const { field: activityField, direction } = THREAD_DIRECTORY_INDEX.orderBy;
  let page = networkAudienceGroup(adminDb)
    .where(uidField, '==', query.uid)
    .where(untilField, '==', null)
    .orderBy(activityField, direction)
    .orderBy(FieldPath.documentId(), direction);
  if (query.after !== null) {
    page = page.startAfter(
      query.after.activityAt,
      networkAudienceRef(adminDb, query.after.threadId, query.uid),
    );
  }

  const rows = (await page.limit(query.limit + 1).get()).docs;
  const visible = rows.slice(0, query.limit);
  const items = await hydrate(adminDb, visible.map((doc) => ({
    threadId: doc.ref.parent.parent?.id ?? '',
    entry: doc.data() as NetworkAudienceEntry,
  })));

  const last = visible[visible.length - 1];
  const next = rows.length > query.limit && last !== undefined
    ? encodeDirectoryCursor({
        activityAt: (last.data() as NetworkAudienceEntry).threadActivityAt,
        threadId: last.ref.parent.parent?.id ?? '',
      })
    : null;
  return { items, next };
}

/** Τα νήματα της σελίδας με **ένα** `getAll` — ποτέ ένα ερώτημα ανά γραμμή. */
async function hydrate(
  adminDb: AdminFirestore,
  rows: readonly { readonly threadId: string; readonly entry: NetworkAudienceEntry }[],
): Promise<readonly NetworkThreadListItem[]> {
  if (rows.length === 0) return [];
  const snaps = await adminDb.getAll(...rows.map((row) => networkThreadRef(adminDb, row.threadId)));
  const present: PresentRow[] = [];
  rows.forEach((row, index) => {
    const thread = snaps[index]?.data() as NetworkThread | undefined;
    // ⚠️ Γραμμή χωρίς νήμα δεν γεννιέται από τον γραφέα (ίδια συναλλαγή). Αν τη δούμε, είναι
    //    βλάβη δεδομένων: την **ονομάζουμε** και δεν δείχνουμε κενό στοιχείο.
    if (thread === undefined) {
      logger.error('[DIRECTORY] Γραμμή ακροατηρίου χωρίς νήμα', { threadId: row.threadId });
      return;
    }
    present.push({ threadId: row.threadId, entry: row.entry, thread });
  });

  const hrefs = await addressed(present);
  return present.map((row, index) => directoryItem(row.threadId, row.entry, row.thread, hrefs[index] ?? null));
}

/** Μία γραμμή, όπως την είδε η `hydrate` αφού βρέθηκε το νήμα της. */
interface PresentRow {
  readonly threadId: string;
  readonly entry: NetworkAudienceEntry;
  readonly thread: NetworkThread;
}

/**
 * 🔑 **ΤΟ ΤΕΛΙΚΟ href ΚΑΘΕ ΓΡΑΜΜΗΣ — ΜΕ ΤΟΝ ΧΩΡΟ ΤΗΣ ΜΕΣΑ.**
 *
 * Ο προορισμός έρχεται από τον **ίδιο** πίνακα με την ειδοποίηση (`threadMessageDestination`), και
 * κουβαλά **χώρο**: η σελίδα του γραφείου ζει πίσω από `/o/<τμήμα>/`, που είναι **ανάγνωση**. Ο
 * κατάλογος όμως σερβίρεται στον **ιδιωτικό** χώρο, όπου κανένα πρόθεμα δεν μπαίνει μόνο του —
 * άρα το πρόθεμα μπαίνει **εδώ**, μία φορά ανά **διακριτό** χώρο, ποτέ ανά γραμμή.
 *
 * ⚠️ **Χώρος χωρίς διεύθυνση ΔΕΝ ρίχνει τη σελίδα**: το `workspaceDestinationOf` πετά επίτηδες
 * (ADR-819 §5 Α7), αλλά εδώ μία χαλασμένη παροχή δεν επιτρέπεται να σβήσει **όλα** τα μηνύματα
 * του ανθρώπου. Η γραμμή χάνει τον σύνδεσμό της, η βλάβη **ονομάζεται** στα ίχνη.
 */
async function addressed(rows: readonly PresentRow[]): Promise<readonly (string | null)[]> {
  const destinations = rows.map((row) => threadMessageDestination(row.thread.topic, row.threadId, row.entry.uid));
  const segments = new Map<string, Promise<string | null>>();

  return Promise.all(destinations.map((destination) => {
    const path = destination?.actions[0]?.url ?? null;
    if (destination === null || path === null) return null;
    if (destination.workspace.kind !== 'org') return path;

    const { companyId } = destination.workspace;
    const cached = segments.get(companyId) ?? segmentOf(companyId);
    segments.set(companyId, cached);
    return cached.then((segment) => (segment === null ? null : workspacePath(segment, path)));
  }));
}

/**
 * Το **τμήμα διεύθυνσης** ενός γραφείου — μία ανάγνωση ανά γραφείο, όσες γραμμές κι αν το δείχνουν.
 *
 * ⚠️ Ρωτά το `workspaceSegmentFor`, **όχι** το `workspaceDestinationOf`: εκείνο **πετά** στο
 * `unaddressable` (ADR-819 §5 Α7, σωστά για **μία** σελίδα) — εδώ μία χαλασμένη παροχή δεν
 * επιτρέπεται να σβήσει **όλα** τα μηνύματα του ανθρώπου. Η ερώτηση απαντιέται, η βλάβη ονομάζεται.
 */
async function segmentOf(companyId: string): Promise<string | null> {
  const resolution = await workspaceSegmentFor({ kind: 'organization', companyId });
  if (resolution.outcome === 'segment') return resolution.segment;
  logger.error('[DIRECTORY] Χώρος χωρίς διεύθυνση — η γραμμή μένει χωρίς σύνδεσμο', { companyId });
  return null;
}
