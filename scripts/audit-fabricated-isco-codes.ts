/**
 * =============================================================================
 * AUDIT FABRICATED ISCO CODES — πόσοι ΑΝΘΡΩΠΟΙ κουβαλούν το ψέμα;
 * =============================================================================
 *
 * Απαντά στο ερώτημα που κρατά πίσω το **Α2** (ADR-132 §10, ADR-823 §Α):
 *
 * > Ο παλιός εισαγωγέας ESCO έγραφε `iscoCode: '0000'` όπου το ESCO **δεν έδινε
 * > κωδικό**. Το `'0000'` **δεν** σημαίνει «άγνωστο» — είναι η μείζων ομάδα
 * > **«Ένοπλες Δυνάμεις»** του ISCO-08. Το `EscoOccupationPicker` **αντιγράφει**
 * > τον κωδικό της μνήμης **πάνω στην επαφή και στο προφίλ**. Άρα το ψέμα
 * > **ταξίδεψε από τη μνήμη στους ανθρώπους** — και η επανεισαγωγή της μνήμης
 * > **ΔΕΝ τους θεραπεύει**.
 *
 * **Πόσοι είναι;** Ίσως **μηδέν** — και τότε το Α2 δεν υπάρχει. Η μέτρηση είναι
 * φθηνή· η μετανάστευση δεν είναι.
 *
 * ┌─ ΣΥΜΒΟΛΑΙΟ ────────────────────────────────────────────────────────────────┐
 * │ 🔒 READ-ONLY. Καμία διαδρομή γραφής: ούτε set/update/delete/batch.        │
 * │ 🔒 Ο διαχωριστής ΔΕΝ είναι η τιμή — είναι η **ΑΥΘΕΝΤΙΑ**: το `escoUri` που │
 * │    ήδη κουβαλά η εγγραφή, διασταυρωμένο με τη **μνήμη ESCO** στη βάση.    │
 * │ 🔒 Το id εγγράφου μνήμης παράγεται με το **ΙΔΙΟ** `uriToDocId` που το     │
 * │    έγραψε — εισαγόμενο, ποτέ ξαναγραμμένο (γι' αυτό το script είναι TS).  │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * ## Η ΣΕΙΡΑ ΕΧΕΙ ΣΗΜΑΣΙΑ
 *
 * Τρέξε το **ΜΕΤΑ** την επανεισαγωγή (`import:esco:occupations`): ο κριτής είναι
 * η **διορθωμένη** μνήμη. Πριν από αυτήν, η μνήμη λέει ακόμη `'0000'` και κάθε
 * άνθρωπος θα φαινόταν «επιβεβαιωμένος». Το script το **λέει** στην αναφορά —
 * δεν το μαντεύει.
 *
 * ## ΤΙ ΔΕΝ ΚΑΝΕΙ
 *
 * ⛔ Δεν διορθώνει τίποτα. ⛔ Δεν επινοεί τιμή. Για όποιον δεν επιβεβαιώνεται, η
 * σωστή τιμή είναι `''` *(«δεν ξέρω»)*, **ποτέ** άλλος κωδικός — και η απόφαση
 * είναι ανθρώπου.
 *
 * USAGE:
 * ```bash
 * npx tsx scripts/audit-fabricated-isco-codes.ts
 * npx tsx scripts/audit-fabricated-isco-codes.ts --json
 * ```
 *
 * @module scripts/audit-fabricated-isco-codes
 * @enterprise ADR-132 §10 (ESCO) · ADR-823 §Α · ADR-798 §20.4
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { COLLECTIONS } from '../src/config/firestore-collections';
import { uriToDocId } from './lib/esco/esco-import-runner';
import { loadEnvLocal } from './_shared/loadEnvLocal';
import {
  ISCO_SENTINELS,
  isSentinelCode,
  judgeIscoCode,
  type IscoVerdict,
} from './_shared/isco-sentinel';

const JSON_MODE = process.argv.includes('--json');

/** Η μνήμη ESCO: υποσυλλογή, όχι συλλογή πρώτου επιπέδου. */
const ESCO_CACHE_PATH = 'system/esco_cache/occupations';
const ESCO_URI_PREFIX = 'http://data.europa.eu/esco/occupation/';

/** Πόσα δείγματα id ανά κατηγορία — αρκετά για να ψάξεις, όχι για dump. */
const SAMPLE_LIMIT = 15;

interface Finding {
  readonly collection: string;
  readonly docId: string;
  readonly iscoCode: string;
  readonly escoUri: string | null;
  readonly memoryCode: string | null;
  readonly verdict: IscoVerdict;
}

function initAdmin(): { db: Firestore; projectId: string } {
  const env: Record<string, string> = loadEnvLocal();
  const raw = env.FIREBASE_SERVICE_ACCOUNT_KEY ?? process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY απών από το .env.local');
  const serviceAccount = JSON.parse(raw) as { project_id: string };
  if (!getApps().length) initializeApp({ credential: cert(serviceAccount as object) });
  return { db: getFirestore(), projectId: serviceAccount.project_id };
}

/**
 * Ρωτά τη **μνήμη** για τον κωδικό που αντιστοιχεί σε ένα `escoUri`.
 *
 * @returns ο κωδικός της μνήμης, ή `null` αν η μνήμη δεν έχει την έννοια.
 */
async function memoryCodeFor(db: Firestore, escoUri: string): Promise<string | null> {
  const docId = uriToDocId(escoUri, ESCO_URI_PREFIX);
  const snapshot = await db.doc(`${ESCO_CACHE_PATH}/${docId}`).get();
  if (!snapshot.exists) return null;
  const code = (snapshot.data() ?? {})['iscoCode'];
  return typeof code === 'string' ? code : null;
}

/** Διαβάζει **μόνο** τα δύο πεδία που κρίνουν, ποτέ ολόκληρα έγγραφα. */
async function scanPeople(db: Firestore, collection: string): Promise<Finding[]> {
  const snapshot = await db.collection(collection).select('iscoCode', 'escoUri').get();
  const suspects: { docId: string; iscoCode: string; escoUri: string | null }[] = [];

  snapshot.forEach((doc) => {
    const data = doc.data();
    const code = data['iscoCode'];
    if (typeof code !== 'string') return;
    if (!isSentinelCode(code)) return;
    const uri = data['escoUri'];
    suspects.push({
      docId: doc.id,
      iscoCode: code,
      escoUri: typeof uri === 'string' && uri.trim().length > 0 ? uri : null,
    });
  });

  const findings: Finding[] = [];
  for (const suspect of suspects) {
    const memoryCode = suspect.escoUri === null ? null : await memoryCodeFor(db, suspect.escoUri);
    findings.push({
      collection,
      docId: suspect.docId,
      iscoCode: suspect.iscoCode,
      escoUri: suspect.escoUri,
      memoryCode,
      verdict: judgeIscoCode(suspect.escoUri, memoryCode),
    });
  }
  return findings;
}

/** Δείχνει αν η **μνήμη** έχει ήδη επανεισαχθεί — αλλιώς κάθε κρίση είναι άκυρη. */
async function memoryStillLies(db: Firestore): Promise<{ total: number; sentinels: number }> {
  const snapshot = await db.collection(ESCO_CACHE_PATH).select('iscoCode').get();
  let sentinels = 0;
  snapshot.forEach((doc) => {
    const code = (doc.data() ?? {})['iscoCode'];
    if (isSentinelCode(code)) sentinels += 1;
  });
  return { total: snapshot.size, sentinels };
}

function sample(ids: readonly string[]): string {
  const shown = ids.slice(0, SAMPLE_LIMIT).join(', ');
  return ids.length > SAMPLE_LIMIT ? `${shown}, … (+${ids.length - SAMPLE_LIMIT})` : shown;
}

function printHuman(
  findings: readonly Finding[],
  memory: { total: number; sentinels: number },
  projectId: string,
): void {
  const by = (v: IscoVerdict) => findings.filter((f) => f.verdict === v);

  console.log('');
  console.log('══════════════════════════════════════════════════════════════════');
  console.log(` ΕΠΙΝΟΗΜΕΝΟΙ ΚΩΔΙΚΟΙ ISCO ΣΕ ΑΝΘΡΩΠΟΥΣ — ΜΟΝΟ ΑΝΑΓΝΩΣΗ (${projectId})`);
  console.log('══════════════════════════════════════════════════════════════════');
  console.log('');
  console.log(`📚 Μνήμη ESCO: ${memory.total} έννοιες, από τις οποίες ${memory.sentinels} με κωδικό-σεντινέλα`);
  console.log(`   (σεντινέλες που αναζητούνται: ${ISCO_SENTINELS.join(', ')})`);
  if (memory.sentinels > 0) {
    console.log('');
    console.log('🔴 Η ΜΝΗΜΗ ΔΕΝ ΕΧΕΙ ΕΠΑΝΕΙΣΑΧΘΕΙ ΑΚΟΜΗ.');
    console.log('   Ο κριτής αυτού του ελέγχου ΕΙΝΑΙ η μνήμη — άρα κάθε «επιβεβαιωμένο»');
    console.log('   παρακάτω είναι ΑΝΑΞΙΟΠΙΣΤΟ. Τρέξε πρώτα:');
    console.log('     npm run import:esco:occupations -- --dry-run   (προεπισκόπηση)');
    console.log('     npm run import:esco:occupations                (πραγματική γραφή)');
  }

  console.log('');
  console.log(`🧮 Άνθρωποι με κωδικό-σεντινέλα: ${findings.length}`);
  if (findings.length === 0) {
    console.log('');
    console.log('✅ ΜΗΔΕΝ. Το Α2 (θεραπεία ανθρώπων) ΔΕΝ ΥΠΑΡΧΕΙ — κανείς δεν διάλεξε ποτέ');
    console.log('   επάγγελμα του οποίου η μνήμη έλεγε ψέματα. Καμία μετανάστευση.');
    return;
  }

  console.log('');
  console.log('| ετυμηγορία | πλήθος | τι σημαίνει |');
  console.log('|---|---|---|');
  console.log(`| 🔴 ΕΠΙΝΟΗΜΕΝΟ | ${by('fabricated').length} | η μνήμη λέει άλλο ⇒ ο κωδικός είναι ΨΕΜΑ |`);
  console.log(`| ✅ ΓΝΗΣΙΟ | ${by('confirmed').length} | η μνήμη συμφωνεί ⇒ πραγματικά Ένοπλες Δυνάμεις |`);
  console.log(`| ❔ ΑΝΕΠΙΒΕΒΑΙΩΤΟ | ${by('unverifiable').length} | χωρίς escoUri ή άγνωστο στη μνήμη |`);

  for (const verdict of ['fabricated', 'confirmed', 'unverifiable'] as const) {
    const rows = by(verdict);
    if (rows.length === 0) continue;
    console.log('');
    console.log(`▶ ${verdict}`);
    for (const collection of [...new Set(rows.map((r) => r.collection))]) {
      const inCollection = rows.filter((r) => r.collection === collection);
      console.log(`   ${collection} (${inCollection.length}): ${sample(inCollection.map((r) => r.docId))}`);
    }
  }

  console.log('');
  console.log('⚠️ ΜΗΝ διορθώσεις τυφλά:');
  console.log('   • ΕΠΙΝΟΗΜΕΝΟ → γράψε ό,τι λέει η μνήμη· αν η μνήμη λέει κενό, γράψε ΚΕΝΟ.');
  console.log('   • ΓΝΗΣΙΟ → ΜΗΝ το αγγίξεις. Υπάρχουν πραγματικοί στρατιωτικοί.');
  console.log('   • ΑΝΕΠΙΒΕΒΑΙΩΤΟ → «δεν ξέρω» γράφεται ΚΕΝΟ, ποτέ μαντεψιά.');
}

async function main(): Promise<void> {
  const { db, projectId } = initAdmin();
  const memory = await memoryStillLies(db);

  const findings: Finding[] = [];
  for (const collection of [COLLECTIONS.CONTACTS, COLLECTIONS.USERS]) {
    findings.push(...(await scanPeople(db, collection)));
  }

  if (JSON_MODE) console.log(JSON.stringify({ projectId, memory, findings }, null, 2));
  else printHuman(findings, memory, projectId);
}

main().catch((error: unknown) => {
  console.error('❌ [audit-fabricated-isco-codes]', error instanceof Error ? error.message : error);
  process.exit(1);
});
