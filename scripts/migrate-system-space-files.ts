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
 * ```
 *
 * @see src/lib/files/system-file-space.ts · firestore.rules `match /files_system/{fileId}`
 */

import admin from 'firebase-admin';

import { COLLECTIONS } from '../src/config/firestore-collections';
import { SYSTEM_FILE_ENTITY_TYPES } from '../src/lib/files/system-file-space';
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

async function main(): Promise<void> {
  const execute = process.argv.includes('--execute');
  applyEnvLocal();
  const { db, projectId } = initAdminApp(admin);

  console.log(`\nΧώρος συστήματος αρχείων — ${execute ? 'EXECUTE (εγγραφή)' : 'DRY-RUN'} · ${projectId}`);
  console.log(`Τύποι: ${SYSTEM_FILE_ENTITY_TYPES.join(', ')}\n`);

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
