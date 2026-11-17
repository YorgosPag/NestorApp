/**
 * =============================================================================
 * BACKFILL CONTACT EMAIL KEYS — συμπλήρωση του `emailKeys` στις υπάρχουσες επαφές (ADR-944)
 * =============================================================================
 *
 * Οι γραφείς γράφουν πλέον το `emailKeys` σε κάθε αποθήκευση· οι επαφές που γράφτηκαν **πριν** δεν το έχουν, άρα
 * ο έλεγχος «το email υπάρχει ήδη σε άλλη επαφή» **δεν** τις βλέπει. Αυτό το script κλείνει το κενό.
 *
 * 🔑 **Ίδια παραγωγή με τους γραφείς**: `contactEmailKeys` από `@/lib/contacts/contact-email-keys` — ποτέ δεύτερη.
 * 🔑 **Ιδεμπότητο**: γράφει **μόνο** όπου τα κλειδιά διαφέρουν (`sameEmailKeys`)· δεύτερη εκτέλεση = 0 εγγραφές.
 * 🔑 **Προεπιλογή = ξηρή εκτέλεση**: τυπώνει τι ΘΑ άλλαζε. Εγγραφή **μόνο** με `--execute`.
 * 🔑 Αγγίζει **μόνο** το `emailKeys` (`update`, όχι `set`): καμία σφραγίδα `_lastModifiedBy` ⇒ ο CDC ελεγκτής δεν
 *    γράφει ψεύτικη «αλλαγή χρήστη» — είναι παράγωγο πεδίο, όχι περιεχόμενο της επαφής.
 *
 * USAGE:
 * ```bash
 * CONFIRM_BACKFILL=true npx tsx scripts/backfill-contact-email-keys.ts            # ξηρή εκτέλεση
 * CONFIRM_BACKFILL=true npx tsx scripts/backfill-contact-email-keys.ts --execute  # εγγραφή
 * ```
 * Έξοδος: `0` τίποτα να γίνει / εγγράφηκε · `2` ξηρή εκτέλεση με εκκρεμείς αλλαγές · `1` σφάλμα.
 *
 * @module scripts/backfill-contact-email-keys
 * =============================================================================
 */

import admin from 'firebase-admin';

import { CONTACT_EMAIL_KEYS_FIELD, contactEmailKeys, sameEmailKeys } from '@/lib/contacts/contact-email-keys';

/* eslint-disable @typescript-eslint/no-require-imports -- τα shared helpers των scripts είναι CommonJS */
const { loadEnvLocal } = require('./_shared/loadEnvLocal') as {
  loadEnvLocal: () => Record<string, string>;
};
/* eslint-enable @typescript-eslint/no-require-imports */

const SCRIPT_NAME = 'backfill-contact-email-keys.ts';
const CONTACTS = 'contacts';
const PAGE_SIZE = 300;
const BATCH_LIMIT = 400;

if (process.env.CONFIRM_BACKFILL !== 'true') {
  console.error(`\n❌ [${SCRIPT_NAME}] ΑΣΦΑΛΕΙΑ: απαιτείται CONFIRM_BACKFILL=true (δείχνει στην ΠΑΡΑΓΩΓΗ)\n`);
  process.exit(1);
}

const EXECUTE = process.argv.includes('--execute');

interface PendingChange {
  readonly ref: admin.firestore.DocumentReference;
  readonly keys: readonly string[];
}

/** Μία σελίδα: ποιες επαφές χρειάζονται νέα κλειδιά. */
function pendingOf(docs: readonly admin.firestore.QueryDocumentSnapshot[]): PendingChange[] {
  return docs.flatMap((doc) => {
    const data = doc.data();
    const keys = contactEmailKeys(data.emails, data.email);
    return sameEmailKeys(data[CONTACT_EMAIL_KEYS_FIELD], keys) ? [] : [{ ref: doc.ref, keys }];
  });
}

async function writeAll(db: admin.firestore.Firestore, changes: readonly PendingChange[]): Promise<void> {
  for (let i = 0; i < changes.length; i += BATCH_LIMIT) {
    const batch = db.batch();
    for (const change of changes.slice(i, i + BATCH_LIMIT)) batch.update(change.ref, { [CONTACT_EMAIL_KEYS_FIELD]: change.keys });
    await batch.commit();
  }
}

/** Όλες οι επαφές, σε σελίδες κατά id (δρομέας εγγράφου, όχι τιμής). */
async function collectPending(db: admin.firestore.Firestore): Promise<{ scanned: number; pending: PendingChange[] }> {
  const pending: PendingChange[] = [];
  let scanned = 0;
  let cursor: admin.firestore.QueryDocumentSnapshot | null = null;
  for (;;) {
    let page = db.collection(CONTACTS).orderBy(admin.firestore.FieldPath.documentId()).limit(PAGE_SIZE);
    if (cursor !== null) page = page.startAfter(cursor);
    const snapshot = await page.get();
    scanned += snapshot.size;
    pending.push(...pendingOf(snapshot.docs));
    if (snapshot.size < PAGE_SIZE) break;
    cursor = snapshot.docs[snapshot.docs.length - 1] ?? null;
  }
  return { scanned, pending };
}

async function main(): Promise<number> {
  const env = loadEnvLocal();
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_KEY)) });
  const db = admin.firestore();
  const { scanned, pending } = await collectPending(db);
  console.log(`[${SCRIPT_NAME}] Σαρώθηκαν ${scanned} επαφές · χρειάζονται κλειδιά: ${pending.length}`);
  for (const change of pending) console.log(`  ${change.ref.id} → ${change.keys.length} κλειδιά`);
  if (pending.length === 0) return 0;
  if (!EXECUTE) {
    console.log('\nΞηρή εκτέλεση — τίποτα δεν γράφτηκε. Για εγγραφή: --execute');
    return 2;
  }
  await writeAll(db, pending);
  console.log(`✅ Γράφτηκαν ${pending.length} επαφές.`);
  return 0;
}

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(`❌ [${SCRIPT_NAME}]`, error instanceof Error ? error.message : String(error));
    process.exit(1);
  },
);
