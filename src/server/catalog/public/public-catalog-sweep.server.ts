import 'server-only';

/**
 * **Το δίχτυ της δημόσιας βιτρίνας** (ADR-923 §5.13 Δ3 · Δ6): δύο δουλειές, χωρίς καμία κλήση σε ΓΕΜΗ ή άλλο μητρώο.
 *
 * 1. **Κρίση χώρων, κυκλικά.** Έγκριση, ανάκληση και αλλαγή στοιχείων αλλάζουν τη συνθήκη χωρίς καμία γραφή καταλόγου. Η
 *    σάρωση συγκρίνει με ό,τι είδε τελευταία και σημειώνει το `catalog`. Μια φορά τη μέρα, σε ανοιχτό χώρο, και πλήρες
 *    πέρασμα: ληγμένες άδειες και αρχεία που διαγράφηκαν δεν αφήνουν καμία άλλη σημείωση.
 * 2. **Άδειασμα ουράς**: `dirty`, παλαιότερο πρώτο. Ό,τι δεν τελείωσε πάει πίσω, ώστε ένα έγγραφο που αποτυγχάνει μόνιμα
 *    να μη μπλοκάρει τα επόμενα.
 *
 * ⚠️ Κάθε μετρητής εκπέμπεται και όταν είναι μηδέν. Το `unknownCompanies` είναι ο δείκτης μόνιμης βλάβης.
 *
 * @module server/catalog/public/public-catalog-sweep.server
 */

import { FieldValue, type DocumentSnapshot, type Firestore, type QueryDocumentSnapshot } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import { readPublicationCondition, rememberCondition, type SupplierStandingReader } from '@/subapps/catalog/public/public-publication-condition';
import { PUBLIC_PROFILE_SCOPE_KEY } from '@/subapps/catalog/public/public-scopes-of-write';
import { expandPublicCatalogPage } from './public-catalog-pass.server';
import { drainPublicModel, LIVE_PUBLIC_DRAIN_DEPS, type PublicDrainDeps, type PublicModelDrain } from './public-model-writer.server';
import { drainPublicProfile, LIVE_PUBLIC_PROFILE_DEPS } from './public-profile-writer.server';
import { PUBLIC_CATALOG_SCOPE, publicOutboxSignal, requeuePublicOutbox, type PublicOutboxRecord } from './public-outbox.server';

const logger = createModuleLogger('PublicCatalogSweep');

const COMPANY_BATCH = 50;
const QUEUE_BATCH = 100;
const FULL_PASS_INTERVAL_MS = 24 * 60 * 60 * 1000;
const MODEL_SCOPE_PREFIX = 'model:';

export interface PublicCatalogSweepMetrics {
  readonly judged: number;
  readonly transitions: number;
  readonly unknownCompanies: number;
  readonly drained: number;
  readonly deferred: number;
  readonly raced: number;
  readonly failed: number;
}

type Tally = { -readonly [K in keyof PublicCatalogSweepMetrics]: number };

interface QueueRun {
  readonly db: Firestore;
  readonly deps: PublicDrainDeps;
  readonly nowMs: number;
  readonly deadlineMs: number;
  readonly tally: Tally;
}

/** Μία ανάγνωση ανά χώρο ανά πέρασμα: η κρίση κοστίζει, και μέσα σε ένα πέρασμα είναι η ίδια. */
function memoizedStanding(read: SupplierStandingReader): SupplierStandingReader {
  const known = new Map<string, ReturnType<SupplierStandingReader>>();
  return (companyId) => {
    const cached = known.get(companyId) ?? read(companyId);
    known.set(companyId, cached);
    return cached;
  };
}

/** Τι θα γραφτεί για έναν χώρο. Το `unknown` μένει έξω από τη μνήμη. */
async function judgeCompany(doc: QueryDocumentSnapshot, read: SupplierStandingReader, nowMs: number, tally: Tally): Promise<void> {
  const record = doc.data() as PublicOutboxRecord;
  const condition = await readPublicationCondition(record.companyId, read);
  const memory = rememberCondition(record.seenCondition ?? null, condition);
  const fullPassDue = condition === 'open' && nowMs - (record.fullPassAtMs ?? 0) >= FULL_PASS_INTERVAL_MS;
  const signal = memory.changed || fullPassDue ? publicOutboxSignal(record.companyId, PUBLIC_CATALOG_SCOPE) : {};
  const seen = memory.seen === null ? {} : { seenCondition: memory.seen };
  const stamped = memory.changed || fullPassDue ? { fullPassAtMs: nowMs } : {};
  await doc.ref.set({ queuedAt: FieldValue.serverTimestamp(), ...seen, ...signal, ...stamped }, { merge: true });
  tally.judged += 1;
  if (memory.changed) tally.transitions += 1;
  if (condition !== 'unknown') return;
  tally.unknownCompanies += 1;
  logger.warn('Η συνθήκη δημοσίευσης δεν κρίθηκε για τον χώρο', { companyId: record.companyId });
}

/** Οι χώροι με κατάλογο, κυκλικά: όποιος κρίθηκε πάει πίσω, οπότε δεν χρειάζεται δρομέας. */
async function judgeCompanies(db: Firestore, read: SupplierStandingReader, nowMs: number, tally: Tally): Promise<void> {
  // tenant-scope-exempt: δίχτυ πλατφόρμας — κρίνει ΚΑΘΕ χώρο εκ σχεδιασμού, διαβάζει και γράφει μόνο το δικό του outbox.
  const snap = await db.collection(COLLECTIONS.CATALOG_PUBLIC_OUTBOX).where('scope', '==', 'catalog').orderBy('queuedAt', 'asc').limit(COMPANY_BATCH).get();
  for (const doc of snap.docs) await judgeCompany(doc, read, nowMs, tally);
}

function countDrain(outcome: PublicModelDrain, tally: Tally): boolean {
  switch (outcome) {
    case 'published':
    case 'withdrawn':
    case 'unchanged':
    case 'clean':
      tally.drained += 1;
      return true;
    case 'deferred':
      tally.deferred += 1;
      return false;
    case 'raced':
      tally.raced += 1;
      return false;
    case 'media-failed':
      tally.failed += 1;
      return false;
  }
}

/** Τμηματικά ως το όριο χρόνου. Ό,τι μείνει ξαναπαίρνει τη σειρά του από τον δρομέα του. */
async function expandUntil(db: Firestore, companyId: string, deadlineMs: number): Promise<boolean> {
  // Ρολόι ανά σελίδα, όχι η αρχή της σάρωσης: η σελίδα που κλείνει το πέρασμα γράφει πότε **πραγματικά** έκλεισε.
  let more = await expandPublicCatalogPage(db, companyId, Date.now());
  while (more && Date.now() < deadlineMs) more = await expandPublicCatalogPage(db, companyId, Date.now());
  return !more;
}

async function drainOne(record: PublicOutboxRecord, run: QueueRun): Promise<boolean> {
  const { db, deps, nowMs, deadlineMs, tally } = run;
  const { companyId, scope } = record;
  if (scope === PUBLIC_PROFILE_SCOPE_KEY) return countDrain(await drainPublicProfile(db, companyId, nowMs, { ...LIVE_PUBLIC_PROFILE_DEPS, readStanding: deps.readStanding }), tally);
  if (!scope.startsWith(MODEL_SCOPE_PREFIX)) return expandUntil(db, companyId, deadlineMs);
  return countDrain(await drainPublicModel(db, companyId, scope.slice(MODEL_SCOPE_PREFIX.length), nowMs, deps), tally);
}

async function drainDoc(doc: DocumentSnapshot, run: QueueRun): Promise<void> {
  const record = doc.data() as PublicOutboxRecord;
  try {
    if (!(await drainOne(record, run))) await requeuePublicOutbox(doc.ref);
  } catch (error) {
    run.tally.failed += 1;
    logger.error('Το άδειασμα της βιτρίνας απέτυχε', { companyId: record.companyId, scope: record.scope, error: error instanceof Error ? error.message : String(error) });
    await requeuePublicOutbox(doc.ref);
  }
}

/** Ως το όριο χρόνου. Έγγραφο που ξαναβγήκε στην ίδια εκτέλεση δεν ξανακρίνεται, άρα η ουρά είναι πεπερασμένη. */
async function drainQueue(run: QueueRun): Promise<void> {
  const visited = new Set<string>();
  while (Date.now() < run.deadlineMs) {
    // tenant-scope-exempt: δίχτυ πλατφόρμας — η ουρά είναι κοινή, κάθε έγγραφο κουβαλά τον χώρο του.
    const snap = await run.db.collection(COLLECTIONS.CATALOG_PUBLIC_OUTBOX).where('dirty', '==', true).orderBy('queuedAt', 'asc').limit(QUEUE_BATCH).get();
    const fresh = snap.docs.filter((doc) => !visited.has(doc.id));
    if (fresh.length === 0) return;
    for (const doc of fresh) {
      if (Date.now() >= run.deadlineMs) return;
      visited.add(doc.id);
      await drainDoc(doc, run);
    }
  }
}

export async function sweepPublicCatalog(db: Firestore, nowMs: number, deadlineMs: number, deps: PublicDrainDeps = LIVE_PUBLIC_DRAIN_DEPS): Promise<PublicCatalogSweepMetrics> {
  const tally: Tally = { judged: 0, transitions: 0, unknownCompanies: 0, drained: 0, deferred: 0, raced: 0, failed: 0 };
  const readStanding = memoizedStanding(deps.readStanding);
  await judgeCompanies(db, readStanding, nowMs, tally);
  await drainQueue({ db, deps: { ...deps, readStanding }, nowMs, deadlineMs, tally });
  return tally;
}
