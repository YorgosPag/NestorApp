/**
 * =============================================================================
 * ΑΝΑΦΟΡΑ (ΜΟΝΟ ΑΝΑΓΝΩΣΗ) — αποθηκευμένα BIC ελληνικών λογαριασμών απέναντι στον ΕΝΑ κατάλογο (ADR-ACC-018 §15)
 * =============================================================================
 *
 * **Γιατί**: το `61679b87` διόρθωσε τον κατάλογο τραπεζών (`src/constants/greek-banks.ts`, πηγή HEBIC) — πριν,
 * ο κατάλογος πρότεινε ανύπαρκτα BIC (`PIABORAA`/`EFABORAA`/`ATABORAA`, BIC 7 χαρακτήρων). Ό,τι αποθηκεύτηκε τότε
 * μένει λάθος στη βάση. Αυτή η αναφορά **μετρά** πόσα — δεν γράφει τίποτα.
 *
 * ┌─ ΣΥΜΒΟΛΑΙΟ ────────────────────────────────────────────────────────────────┐
 * │ 🔒 ΜΟΝΟ ανάγνωση: καμία εγγραφή, καμία σημαία `--execute`.                  │
 * │ 🔒 Αναμενόμενο BIC = ΑΠΟΚΛΕΙΣΤΙΚΑ `getBankByIBAN` (ο ΕΝΑΣ κατάλογος).        │
 * │ ⛔ Snapshots τιμολογίων (`issuer.bankAccounts`) ΔΕΝ διαβάζονται: αμετάβλητα. │
 * │ ➜ Διόρθωση = από την εφαρμογή (επεξεργασία λογαριασμού ⇒ ίχνος), όχι εδώ:   │
 * │   το ίχνος (CHECK 3.17) ζει μόνο στον διακομιστή.                           │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * USAGE: `npx tsx scripts/report-greek-bank-bic.ts`
 *
 * @see src/subapps/accounting/docs/adrs/ADR-ACC-018-invoice-pdf-generation.md §15
 */

import admin from 'firebase-admin';

import { COLLECTIONS, SUBCOLLECTIONS } from '../src/config/firestore-collections';
import { bicAgreementWithIBAN, getBankByIBAN } from '../src/constants/greek-banks';
import { applyEnvLocal } from './_shared/loadEnvLocal';
import { initAdminApp } from './_shared/firebaseAdminOps';

/** Η κρίση για έναν λογαριασμό — ονομασμένη, ποτέ boolean. Κάθε κάδος τυπώνεται, και τα μηδενικά. */
export type BicVerdict =
  /** Αποθηκευμένο = καταλογογραφημένο */
  | { readonly kind: 'ok' }
  /** Λάθος BIC — πρέπει να διορθωθεί στο `expected` */
  | { readonly kind: 'wrong'; readonly stored: string; readonly expected: string }
  /** Κενό BIC σε ελληνικό IBAN που ο κατάλογος γνωρίζει */
  | { readonly kind: 'missing'; readonly expected: string }
  /** Μη ελληνικό IBAN, ή κωδικός τράπεζας που ο κατάλογος δεν γνωρίζει — εκτός εμβέλειας */
  | { readonly kind: 'out_of_scope' };

/** **Τι ισχύει** για αυτόν τον λογαριασμό — καθαρή, χωρίς βάση. */
export function judgeBic(iban: unknown, bankCode: unknown): BicVerdict {
  if (typeof iban !== 'string' || !iban.replace(/\s/g, '').toUpperCase().startsWith('GR')) return { kind: 'out_of_scope' };
  const bank = getBankByIBAN(iban);
  if (!bank) return { kind: 'out_of_scope' };
  const stored = typeof bankCode === 'string' ? bankCode.replace(/\s/g, '').toUpperCase() : '';
  if (stored === '') return { kind: 'missing', expected: bank.code };
  // Ο ΕΝΑΣ κριτής με φόρμα και γραφέα (ADR-ACC-018 §15.2): BIC8 = BIC11 του ίδιου ιδρύματος · δεκτός ο διάδοχος.
  return bicAgreementWithIBAN(iban, stored) === 'mismatch' ? { kind: 'wrong', stored, expected: bank.code } : { kind: 'ok' };
}

type Tally = Record<BicVerdict['kind'], number>;

function report(label: string, docs: readonly admin.firestore.QueryDocumentSnapshot[]): Tally {
  const tally: Tally = { ok: 0, wrong: 0, missing: 0, out_of_scope: 0 };
  for (const doc of docs) {
    const data = doc.data();
    const verdict = judgeBic(data.iban, data.bankCode);
    tally[verdict.kind] += 1;
    if (verdict.kind === 'wrong') console.log(`  ✗ ${doc.ref.path}: ${verdict.stored} → ${verdict.expected}`);
    if (verdict.kind === 'missing') console.log(`  ∅ ${doc.ref.path}: (κενό) → ${verdict.expected}`);
  }
  console.log(
    `  ${label}: σύνολο ${docs.length} · σωστά ${tally.ok} · ΛΑΘΟΣ ${tally.wrong} · ` +
      `κενά ${tally.missing} · εκτός εμβέλειας ${tally.out_of_scope}\n`,
  );
  return tally;
}

async function main(): Promise<void> {
  applyEnvLocal();
  const { db, projectId } = initAdminApp(admin);
  console.log(`\nBIC ελληνικών λογαριασμών απέναντι στον κατάλογο — ΜΟΝΟ ΑΝΑΓΝΩΣΗ · ${projectId}\n`);

  const company = await db.collection(COLLECTIONS.ACCOUNTING_BANK_ACCOUNTS).get();
  report(COLLECTIONS.ACCOUNTING_BANK_ACCOUNTS, company.docs);

  const contacts = await db.collectionGroup(SUBCOLLECTIONS.BANK_ACCOUNTS).get();
  report(`${COLLECTIONS.CONTACTS}/*/${SUBCOLLECTIONS.BANK_ACCOUNTS}`, contacts.docs);

  console.log('(μόνο ανάγνωση — τίποτα δεν γράφτηκε)\n');
}

if (process.argv[1]?.includes('report-greek-bank-bic')) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
