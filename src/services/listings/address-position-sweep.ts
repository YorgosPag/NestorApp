/**
 * **Ο ΙΔΙΟΚΤΗΤΗΣ ΤΟΥ ΚΥΚΛΟΥ ΖΩΗΣ ΤΗΣ ΘΕΣΗΣ** — η σάρωση που ολοκληρώνει κάθε διεύθυνση χωρίς κριμένη
 * θέση, σε επαφές · έργα · κτίρια, χωρίς να περιμένει κανένα κλικ (ADR-332 §D33).
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΚΕΝΟ ΠΟΥ ΚΛΕΙΝΕΙ
 * ────────────────────────────────────────────────────────────────────────────
 * Ως το §D33 η θέση ολοκληρωνόταν **μόνο** μέσα σε αποθήκευση: «Αποθήκευση» χωρίς αλλαγές δεν φτάνει
 * ποτέ στον διακομιστή (ADR-323 κενή διαφορά), άρα η κάρτα «θα υπολογιστεί στην επόμενη αποθήκευση»
 * **δεν τηρούνταν** — μετρημένο ζωντανά στην έδρα `cont_c4d79d09…`. Και το `after()` χανόταν σε
 * επανεκκίνηση του διακομιστή χωρίς ίχνος.
 *
 * 🏆 Πρακτική: Salesforce Geocode Data Integration Rules (θέση σε αλλαγή **και** πέρασμα στις
 * υπάρχουσες) · Dynamics (προγραμματισμένη εργασία για όσες δεν έχουν συντεταγμένες) · GitLab Geo
 * (registry με `retry_at`, cron που ξαναπαίρνει ό,τι κόπηκε). **Το βήμα πέρα από αυτούς**: δεν γράφει
 * ποτέ πάνω σε πινέζα ανθρώπου ή σε κριμένη θέση (το Salesforce κάνει overwrite)· και το «δεν βρέθηκε»
 * ξαναρωτιέται **μόνο του** όταν βελτιωθεί η αναζήτηση (`GEOCODING_POLICY_REVISION` ⇒ `positionSettled`).
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ΔΥΟ ΛΩΡΙΔΕΣ, ΕΝΑΣ ΓΡΑΦΕΑΣ
 * ────────────────────────────────────────────────────────────────────────────
 * 1. **Ανακάλυψη** — κυλιόμενο πέρασμα όλων των εγγράφων (σημείο συνέχισης ανά συλλογή). Ό,τι εκκρεμεί
 *    μπαίνει στο μητρώο. Φτηνό: κρίση στη μνήμη, καμία κλήση στον πάροχο. Πιάνει **κάθε** γραφέα —
 *    φόρμα, εισαγωγή, AI, παλιά δεδομένα — χωρίς να χρειάζεται να θυμηθεί κανείς να ειδοποιήσει.
 * 2. **Οφειλόμενες** — ό,τι λέει το μητρώο ότι οφείλεται, μέσα στην προθεσμία, με τον **ίδιο** γραφέα
 *    (`completePendingAddressPositions`): CAS ταυτότητας, καμία `_v`, ιστορικό με ταυτότητα μηχανής.
 *
 * @module services/listings/address-position-sweep
 */

import 'server-only';

import { FieldPath, type DocumentData, type Firestore as AdminFirestore } from 'firebase-admin/firestore';
import { GEOGRAPHIC_CONFIG } from '@/config/geographic-config';
import { unsettledAddressIds } from '@/lib/geocoding/position-work';
import type { AddressPositionBudget } from '@/lib/geocoding/address-position-types';
import type { CronScanCursor } from '@/lib/cron/cron-scan-cursor';
import { completePendingAddressPositions } from './address-position-completion';
import {
  ADDRESS_POSITION_CONTAINERS,
  addressPositionContainerFor,
  type AddressPositionContainer,
} from './address-position-containers';
import {
  enqueueAddressPositionWork,
  listDueAddressPositionWork,
  recordAddressPositionAttempt,
  settleAddressPositionWork,
  type AddressPositionWorkRecord,
} from './address-position-work';

/** Τα όρια μιας εκτέλεσης — δηλωμένα, ώστε τα tests να τα στενεύουν χωρίς να αλλάζει η λογική. */
export const ADDRESS_POSITION_SWEEP_POLICY = {
  /** Πόσα έγγραφα ανά συλλογή εξετάζει η ανακάλυψη σε κάθε εκτέλεση (ανάγνωση, όχι κλήση παρόχου). */
  discoveryPageSize: 500,
  /** Πόσες οφειλόμενες εγγραφές φορτώνονται ανά εκτέλεση. */
  dueLimit: 50,
  /** Μετά από αυτό δεν ξεκινά νέα δοκιμή — χωρά στο `maxDuration = 300` της διαδρομής (μοτίβο rfq). */
  sweepDeadlineMs: 240_000,
} as const;

export interface AddressPositionSweepReport {
  /** Έγγραφα που εξέτασε η ανακάλυψη. */
  scanned: number;
  /** Νέες εγγραφές στο μητρώο. */
  discovered: number;
  /** Οφειλόμενες που δοκιμάστηκαν. */
  attempted: number;
  /** Διευθύνσεις που απέκτησαν (ή άλλαξαν) θέση. */
  written: number;
  /** Εγγραφές που έκλεισαν (κρίθηκε η θέση ή χάθηκε η οντότητα). */
  settled: number;
  /** Εγγραφές που ξαναπρογραμματίστηκαν με αναμονή. */
  retried: number;
  /** Οφειλόμενες που δεν πρόλαβαν αυτή την εκτέλεση — μένουν οφειλόμενες. */
  deferred: number;
}

export interface AddressPositionSweepDeps {
  readonly db: AdminFirestore;
  readonly cursor: CronScanCursor;
  readonly saveCursor: (cursor: CronScanCursor) => Promise<void>;
  /** Ό,τι οφείλει να ακολουθήσει γραφή θέσης σε αυτό το δοχείο (έργο: μνήμη λίστας + αγγελίες). */
  readonly onWritten?: (container: AddressPositionContainer, docId: string, data: DocumentData) => Promise<void>;
  readonly wallClock?: () => number;
  readonly policy?: Partial<typeof ADDRESS_POSITION_SWEEP_POLICY>;
}

function emptyReport(): AddressPositionSweepReport {
  return { scanned: 0, discovered: 0, attempted: 0, written: 0, settled: 0, retried: 0, deferred: 0 };
}

/** Λογικά διαγραμμένη οντότητα (κοινό σχήμα κάδου, `purge-deleted-entities`) — δεν ολοκληρώνεται. */
function isLive(data: DocumentData | undefined): data is DocumentData {
  return data !== undefined && data.status !== 'deleted';
}

function companyIdOf(data: DocumentData): string | null {
  return typeof data.companyId === 'string' && data.companyId !== '' ? data.companyId : null;
}

/** Μία σελίδα ανακάλυψης σε μία συλλογή. Επιστρέφει το νέο σημείο συνέχισης (`null` ⇒ ο κύκλος έκλεισε). */
async function discoverPage(
  deps: AddressPositionSweepDeps,
  container: AddressPositionContainer,
  pageSize: number,
  report: AddressPositionSweepReport,
): Promise<string | null> {
  const after = deps.cursor[container.collection] ?? null;
  // tenant-scope-exempt: η ανακάλυψη περνά ΟΛΟΥΣ τους χώρους· γράφει μόνο εγγραφή μητρώου για το ΙΔΙΟ
  // έγγραφο, με το companyId του — καμία ανάγνωση ή γραφή διασταυρώνει χώρους.
  let query = deps.db.collection(container.collection).orderBy(FieldPath.documentId()).limit(pageSize);
  if (after) query = query.startAfter(after);
  const snapshot = await query.get();
  const now = (deps.wallClock ?? Date.now)();
  for (const doc of snapshot.docs) {
    report.scanned += 1;
    const data = doc.data();
    if (!isLive(data) || unsettledAddressIds(container.read(data)).length === 0) continue;
    const target = { collection: container.collection, docId: doc.id, companyId: companyIdOf(data) };
    if (await enqueueAddressPositionWork(deps.db, target, now)) report.discovered += 1;
  }
  return snapshot.size < pageSize ? null : snapshot.docs[snapshot.size - 1].id;
}

async function discover(deps: AddressPositionSweepDeps, pageSize: number, report: AddressPositionSweepReport): Promise<void> {
  const next: Record<string, string | null> = { ...deps.cursor };
  for (const container of ADDRESS_POSITION_CONTAINERS) {
    next[container.collection] = await discoverPage(deps, container, pageSize, report);
  }
  await deps.saveCursor(next);
}

/** Οι διευθύνσεις του εγγράφου που περιμένουν ακόμη θέση — `null` αν η οντότητα δεν υπάρχει πια. */
async function readUnsettled(
  db: AdminFirestore,
  container: AddressPositionContainer,
  docId: string,
): Promise<{ readonly ids: string[]; readonly data: DocumentData } | null> {
  const data = (await db.collection(container.collection).doc(docId).get()).data();
  return isLive(data) ? { ids: unsettledAddressIds(container.read(data)), data } : null;
}

/** Μία οφειλόμενη εγγραφή: δοκιμή με τον έναν γραφέα, μετά κλείσιμο ή νέα αναμονή. */
async function attemptOne(
  deps: AddressPositionSweepDeps,
  entry: { readonly ref: FirebaseFirestore.DocumentReference; readonly record: AddressPositionWorkRecord },
  budget: AddressPositionBudget,
  report: AddressPositionSweepReport,
): Promise<void> {
  const container = addressPositionContainerFor(entry.record.collection);
  const before = container ? await readUnsettled(deps.db, container, entry.record.docId) : null;
  if (!container || !before || before.ids.length === 0) {
    await settleAddressPositionWork(entry.ref);
    report.settled += 1;
    return;
  }
  report.attempted += 1;
  const job = { container, docId: entry.record.docId, pendingIds: before.ids, budget };
  const { written } = await completePendingAddressPositions(deps.db, job);
  report.written += written;
  const after = await readUnsettled(deps.db, container, entry.record.docId);
  if (written > 0 && after) await deps.onWritten?.(container, entry.record.docId, after.data);
  if (!after || after.ids.length === 0) {
    await settleAddressPositionWork(entry.ref);
    report.settled += 1;
    return;
  }
  await recordAddressPositionAttempt(entry.ref, entry.record, (deps.wallClock ?? Date.now)());
  report.retried += 1;
}

async function attemptDue(
  deps: AddressPositionSweepDeps,
  policy: typeof ADDRESS_POSITION_SWEEP_POLICY,
  deadlineAt: number,
  report: AddressPositionSweepReport,
): Promise<void> {
  const wallClock = deps.wallClock ?? Date.now;
  const due = await listDueAddressPositionWork(deps.db, wallClock(), policy.dueLimit);
  const budget: AddressPositionBudget = {
    remainingMs: () => deadlineAt - wallClock(),
    advisoryReserveMs: GEOGRAPHIC_CONFIG.GEOCODING.ADVISORY_RESERVE_MS,
  };
  for (const [index, entry] of due.entries()) {
    if (wallClock() >= deadlineAt) {
      report.deferred = due.length - index;
      return;
    }
    await attemptOne(deps, entry, budget, report);
  }
}

/** Μία εκτέλεση: πρώτα ανακάλυψη (φτηνή), μετά οι οφειλόμενες μέσα στην προθεσμία. */
export async function runAddressPositionSweep(deps: AddressPositionSweepDeps): Promise<AddressPositionSweepReport> {
  const policy = { ...ADDRESS_POSITION_SWEEP_POLICY, ...deps.policy };
  const deadlineAt = (deps.wallClock ?? Date.now)() + policy.sweepDeadlineMs;
  const report = emptyReport();
  await discover(deps, policy.discoveryPageSize, report);
  await attemptDue(deps, policy, deadlineAt, report);
  return report;
}
