/**
 * =============================================================================
 * ΜΕΤΑΝΑΣΤΕΥΣΗ — οι εγγραφές του χώρου συστήματος φεύγουν από το `files` (ADR-934 §5.2.2 Μ-β6)
 * =============================================================================
 *
 * **Γιατί**: ως το Μ-β6 η καραντίνα μέσων καταλόγου (`catalog_media_content`) γραφόταν στο `files`, δίπλα στα αρχεία του
 * ανθρώπου ⇒ φαινόταν σε λίστα «Αρχεία», Κάδο, Αρχειοθήκη και αναζήτηση. Ο κώδικας πλέον γράφει στο `files_system`· οι
 * εγγραφές που γεννήθηκαν **πριν** μένουν στο `files` ώσπου να μετακομίσουν εδώ.
 *
 * ┌─ ΣΥΜΒΟΛΑΙΟ ────────────────────────────────────────────────────────────────┐
 * │ 🔒 Ποιοι τύποι: ΑΠΟΚΛΕΙΣΤΙΚΑ ο κλειστός κατάλογος `SYSTEM_FILE_ENTITY_TYPES` │
 * │    (`lib/files/system-file-space.ts`) — κανένα αντίγραφο εδώ.              │
 * │ 🔒 Ίδιο id, ίδια πεδία: κάδος · `purgeAt` · επιτύμβιο · ζωντανό διατηρούνται│
 * │    — η μετακόμιση δεν είναι πράξη πάνω στο αρχείο (κανένα `updatedAt`).     │
 * │ 🔒 Bytes: ΚΑΝΕΝΑ άγγιγμα — ίδιο `storagePath`, ίδιος κάδος (`files-eu`).    │
 * │ 🔒 Ιδεμποτητική, ανά έγγραφο σε συναλλαγή: ήδη στον προορισμό ⇒ μόνο        │
 * │    διαγραφή του παλιού· ήδη μετακομισμένο ⇒ τίποτα.                         │
 * │ ⛔ Ίδιο id στον προορισμό με ΑΛΛΑ bytes (`entityId`) ⇒ ΑΝΑΦΟΡΑ, ποτέ γραφή. │
 * │ 🔴 ΣΕΙΡΑ: δείκτες + κανόνες → push κώδικα → ΑΥΤΟ (καμία εισαγωγή ενδιάμεσα) │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * Η διαγραφή από το `files` πυροδοτεί το `onFileWrite` ⇒ οι εγγραφές φεύγουν **και** από την καθολική αναζήτηση.
 *
 * USAGE (από το `C:\Nestor_Pagonis`, που έχει `.env.local`):
 * ```bash
 * npx tsx scripts/migrate-system-space-files.ts            # dry-run (μέτρηση)
 * npx tsx scripts/migrate-system-space-files.ts --execute  # εγγραφή
 * npx tsx scripts/migrate-system-space-files.ts --attribution            # Μ-β7: dry-run απόδοσης
 * npx tsx scripts/migrate-system-space-files.ts --attribution --execute  # Μ-β7: εγγραφή
 * ```
 *
 * **`--attribution` (ADR-934 §5.2.2 Μ-β7)**: τα πεδία δράστη (`SYSTEM_SPACE_ACTOR_FIELDS`) που κρατούν uid ανθρώπου γίνονται ο
 * διαχειριστής του χώρου (`systemSpaceActorOf`) — **μόνο** αν ο ίδιος άνθρωπος μένει στο ίχνος του αρχείου (`performedBy`).
 * Αλλιώς σύγκρουση, καμία γραφή, καμία κατασκευασμένη γραμμή ίχνους. Ιδεμπότητη: δεύτερη εκτέλεση = 0 διορθώσεις.
 *
 * @see src/lib/files/system-file-space.ts · firestore.rules `match /files_system/{fileId}`
 */

import admin from 'firebase-admin';

import { COLLECTIONS } from '../src/config/firestore-collections';
import {
  planSystemSpaceAttribution,
  SYSTEM_FILE_ENTITY_TYPES,
  type SystemSpaceAttributionPlan,
} from '../src/lib/files/system-file-space';
import { applyEnvLocal } from './_shared/loadEnvLocal';
import { initAdminApp } from './_shared/firebaseAdminOps';

type Data = Readonly<Record<string, unknown>>;

/** Η απόφαση για ένα έγγραφο — ονομασμένη, ποτέ boolean. */
export type SystemSpaceMovePlan =
  | { readonly kind: 'move' }
  | { readonly kind: 'drop-source' }
  | { readonly kind: 'conflict'; readonly why: string };

/**
 * **Τι πρέπει να γίνει** με αυτό το έγγραφο — καθαρό, χωρίς δίσκο. `target` = ό,τι υπάρχει ήδη στο `files_system` με το ίδιο
 * id (ή `null`). Το `fileId` είναι ντετερμινιστικό από (χώρος · sha256 · κατάληξη), άρα ίδιο id με ίδιο `entityId` και
 * `companyId` = **το ίδιο** περιεχόμενο, γεννημένο ήδη στον νέο χώρο ⇒ η παλιά εγγραφή περισσεύει.
 */
export function planSystemSpaceMove(source: Data, target: Data | null): SystemSpaceMovePlan {
  if (target === null) return { kind: 'move' };
  const same = target.companyId === source.companyId && target.entityId === source.entityId && target.entityType === source.entityType;
  return same ? { kind: 'drop-source' } : { kind: 'conflict', why: 'same-id-different-content' };
}

type MoveOutcome = SystemSpaceMovePlan['kind'] | 'gone';

/** Μία μετακόμιση, σε συναλλαγή: ξανακρίνεται μέσα της, ώστε δεύτερη εκτέλεση ή παράλληλος γραφέας να μη χαλά τίποτα. */
async function moveOne(db: admin.firestore.Firestore, fileId: string): Promise<MoveOutcome> {
  const sourceRef = db.collection(COLLECTIONS.FILES).doc(fileId);
  const targetRef = db.collection(COLLECTIONS.FILES_SYSTEM).doc(fileId);
  return db.runTransaction(async (tx): Promise<MoveOutcome> => {
    const [source, target] = await Promise.all([tx.get(sourceRef), tx.get(targetRef)]);
    if (!source.exists) return 'gone';
    const plan = planSystemSpaceMove(source.data() ?? {}, target.exists ? (target.data() ?? {}) : null);
    if (plan.kind === 'conflict') return 'conflict';
    if (plan.kind === 'move') tx.create(targetRef, source.data() ?? {});
    tx.delete(sourceRef);
    return plan.kind;
  });
}

// =============================================================================
// ΦΑΣΗ `--attribution` — ο άνθρωπος φεύγει από την εγγραφή, μένει στο ίχνος (ADR-934 §5.2.2 Μ-β7)
// =============================================================================

type AttributionOutcome = SystemSpaceAttributionPlan['kind'] | 'gone';

/** Οι `performedBy` του ίχνους **αυτού** του αρχείου — από το εταιρικό βιβλίο, όπου γράφει ο χώρος συστήματος. */
async function trailPerformersOf(db: admin.firestore.Firestore, fileId: string): Promise<Set<string>> {
  // tenant-scope-exempt: μετανάστευση συστήματος· το `fileId` είναι ντετερμινιστικό ανά εταιρεία (χώρος · sha256 · κατάληξη).
  const snapshot = await db.collection(COLLECTIONS.FILE_AUDIT_LOG).where('fileId', '==', fileId).get();
  return new Set(snapshot.docs.map((doc) => String(doc.data().performedBy)));
}

/** Μία διόρθωση, σε συναλλαγή: ξανακρίνεται μέσα της. Το ίχνος μόνο **μεγαλώνει**, άρα η ανάγνωσή του έξω από τη συναλλαγή αρκεί. */
async function attributeOne(db: admin.firestore.Firestore, fileId: string, trail: ReadonlySet<string>): Promise<AttributionOutcome> {
  const ref = db.collection(COLLECTIONS.FILES_SYSTEM).doc(fileId);
  return db.runTransaction(async (tx): Promise<AttributionOutcome> => {
    const snap = await tx.get(ref);
    if (!snap.exists) return 'gone';
    const plan = planSystemSpaceAttribution(snap.data() ?? {}, trail);
    // Καμία αλλαγή `updatedAt`: η διόρθωση απόδοσης δεν είναι πράξη πάνω στο αρχείο (ίδιο δόγμα με τη μετακόμιση).
    if (plan.kind === 'rewrite') tx.update(ref, plan.fields);
    return plan.kind;
  });
}

async function runAttribution(db: admin.firestore.Firestore, execute: boolean): Promise<void> {
  // tenant-scope-exempt: μετανάστευση συστήματος σε **κάθε** εταιρεία εκ σχεδιασμού· ο κάτοχος ταξιδεύει μέσα στην εγγραφή.
  const snapshot = await db.collection(COLLECTIONS.FILES_SYSTEM).get();
  const tally: Record<AttributionOutcome, number> = { clean: 0, rewrite: 0, conflict: 0, gone: 0 };
  for (const doc of snapshot.docs) {
    const trail = await trailPerformersOf(db, doc.id);
    const preview = planSystemSpaceAttribution(doc.data(), trail);
    const outcome: AttributionOutcome = execute ? await attributeOne(db, doc.id, trail) : preview.kind;
    tally[outcome] += 1;
    const detail = preview.kind === 'rewrite'
      ? ` ${Object.keys(preview.fields).join('+')} · άνθρωποι στο ίχνος: ${preview.humans.length}`
      : preview.kind === 'conflict' ? ` ⛔ ${preview.why} · άνθρωποι: ${preview.humans.length}` : '';
    console.log(`  ${doc.id} [${String(doc.data().lifecycleState)}] ${outcome}${detail}`);
  }
  // Κάθε κάδος τυπώνεται, και τα μηδενικά: «0» που δεν φαίνεται διαβάζεται «δεν κοίταξα».
  console.log(
    `\nΣύνολο ${snapshot.size} · καθαρά ${tally.clean} · διόρθωση ${tally.rewrite} · συγκρούσεις ${tally.conflict} · ` +
      `χαμένα ${tally.gone}${execute ? ' · ΓΡΑΦΤΗΚΑΝ' : ' · (dry-run, τίποτα δεν γράφτηκε)'}\n`,
  );
  if (tally.conflict > 0) process.exitCode = 1;
}

async function main(): Promise<void> {
  const execute = process.argv.includes('--execute');
  const attribution = process.argv.includes('--attribution');
  applyEnvLocal();
  const { db, projectId } = initAdminApp(admin);

  console.log(`\nΧώρος συστήματος αρχείων — ${attribution ? 'ΑΠΟΔΟΣΗ' : 'ΜΕΤΑΚΟΜΙΣΗ'} · ${execute ? 'EXECUTE (εγγραφή)' : 'DRY-RUN'} · ${projectId}`);
  console.log(`Τύποι: ${SYSTEM_FILE_ENTITY_TYPES.join(', ')}\n`);
  if (attribution) return runAttribution(db, execute);
  return runMove(db, execute);
}

async function runMove(db: admin.firestore.Firestore, execute: boolean): Promise<void> {
  // tenant-scope-exempt: μετανάστευση συστήματος σε **κάθε** εταιρεία εκ σχεδιασμού· ο κάτοχος ταξιδεύει μέσα στην εγγραφή.
  const snapshot = await db.collection(COLLECTIONS.FILES).where('entityType', 'in', [...SYSTEM_FILE_ENTITY_TYPES]).get();
  const tally: Record<MoveOutcome, number> = { move: 0, 'drop-source': 0, conflict: 0, gone: 0 };

  for (const doc of snapshot.docs) {
    const targetSnap = await db.collection(COLLECTIONS.FILES_SYSTEM).doc(doc.id).get();
    const preview = planSystemSpaceMove(doc.data(), targetSnap.exists ? (targetSnap.data() ?? {}) : null);
    const outcome: MoveOutcome = execute ? await moveOne(db, doc.id) : preview.kind;
    tally[outcome] += 1;
    const data = doc.data();
    console.log(`  ${outcome === 'conflict' ? '⛔' : '→'} ${doc.id} [${String(data.companyId)} · ${String(data.lifecycleState)}${data.isDeleted === true ? ' · κάδος' : ''}] ${outcome}`);
  }

  // Κάθε κάδος τυπώνεται, και τα μηδενικά: «0» που δεν φαίνεται διαβάζεται «δεν κοίταξα».
  console.log(
    `\nΣύνολο ${snapshot.size} · μετακόμιση ${tally.move} · μόνο διαγραφή παλιού ${tally['drop-source']} · ` +
      `συγκρούσεις ${tally.conflict} · ήδη χαμένα ${tally.gone}${execute ? ' · ΓΡΑΦΤΗΚΑΝ' : ' · (dry-run, τίποτα δεν γράφτηκε)'}\n`,
  );
  if (tally.conflict > 0) process.exitCode = 1;
}

if (process.argv[1]?.includes('migrate-system-space-files')) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
