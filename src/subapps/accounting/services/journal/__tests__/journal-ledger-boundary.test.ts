/**
 * @jest-environment node
 *
 * ΣΥΝΟΡΟ «σελίδα ≠ καθολικό» — ποιος επιτρέπεται να καλεί τις ΣΕΛΙΔΕΣ της οθόνης.
 *
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ (περιστατικά 2026-10-14): ΦΠΑ, φόροι και αναφορές αθροίζαν τη σελίδα του ημερολογίου (όριο
 * 50 / 10.000, `period` αγνοημένο)· η τραπεζική συμφωνία μετρούσε τις 10.000 νεότερες κινήσεις όλων των εποχών·
 * η αυτόματη αντιστοίχιση έβλεπε τα 100 νεότερα ανοιχτά τιμολόγια. Η διόρθωση είναι τα `collect*` / στένεμα
 * υποψηφίων· αυτή η άγκυρα κλείνει την ΚΑΤΗΓΟΡΙΑ: κάθε κλήση σελίδας ζει σε ΚΛΕΙΣΤΟ σύνολο αρχείων, το καθένα με
 * λόγο. Νέος υπολογισμός πάνω σε σελίδα ⇒ κόκκινο εδώ, όχι λάθος νούμερο στον πελάτη.
 */

import { listRepoSourceFiles, readRepoCode } from '@/test-utils/read-source';

/** Για κάθε σελίδα: οι ΜΟΝΟΙ νόμιμοι καλούντες — και γιατί δεν είναι υπολογισμός. */
const ALLOWED_PAGE_CALLERS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  listJournalEntries: {
    'src/app/api/accounting/journal/route.ts': 'η λίστα της οθόνης — σελίδα εξ ορισμού',
    'src/app/api/accounting/categories/[id]/route.ts': 'έλεγχος ύπαρξης (pageSize 1): «χρησιμοποιείται η κατηγορία;»',
  },
  listBankTransactions: {
    'src/app/api/accounting/bank/transactions/route.ts': 'η λίστα της οθόνης — σελίδα εξ ορισμού',
  },
  listInvoices: {
    'src/app/api/accounting/invoices/route.ts': 'η λίστα της οθόνης — σελίδα εξ ορισμού',
    // Φάση 3 (2026-10-15): το `balance-service` ΒΓΗΚΕ — υπόλοιπο / ηλικίωση / πιστωτικό όριο μέσω `collectInvoices`.
  },
};

/** Ο ορισμός και η μεταβίβαση των μεθόδων — δεν είναι καλούντες. */
const PLUMBING = new Set([
  'src/subapps/accounting/types/interfaces.ts',
  'src/subapps/accounting/services/repository/accounting-repo-financial.ts',
  'src/subapps/accounting/services/repository/accounting-repo-operations.ts',
  'src/subapps/accounting/services/repository/firestore-accounting-repository.ts',
  'src/subapps/accounting/services/audited-repository-wrapper.ts',
]);

const SOURCES = listRepoSourceFiles('src')
  .filter((file) => !/\/__tests__\/|\.test\.tsx?$/.test(file) && !PLUMBING.has(file))
  .map((file) => [file, readRepoCode(file)] as const);

function pageCallers(method: string): string[] {
  const call = new RegExp(`\\b${method}\\s*\\(`);
  return SOURCES.filter(([, code]) => call.test(code)).map(([file]) => file);
}

describe.each(Object.entries(ALLOWED_PAGE_CALLERS))('Σύνορο σελίδας / καθολικού — %s', (method, allowed) => {
  const callers = pageCallers(method);

  it('Β-1 καμία κλήση της σελίδας έξω από το κλειστό σύνολο', () => {
    expect(callers.filter((file) => !(file in allowed))).toEqual([]);
  });

  it('Β-2 κάθε γραμμή του συνόλου είναι ζωντανή (όχι εξαίρεση-φάντασμα)', () => {
    expect([...callers].sort()).toEqual(Object.keys(allowed).sort());
  });

  it('Β-3 ο σαρωτής ΟΝΤΩΣ βλέπει κλήσεις (αλλιώς το Β-1 θα ήταν πράσινο επειδή δεν κοίταξε)', () => {
    expect(callers.length).toBeGreaterThan(0);
  });
});
