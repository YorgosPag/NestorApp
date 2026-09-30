/**
 * @fileoverview **Η σουίτα συμβολαίου του Firestore** — ΜΙΑ λίστα ισχυρισμών, ΔΥΟ υλοποιήσεις (verified fake).
 *
 * Τρέχει:
 *   • στο `FakeFirestore` — `src/test-utils/fake-firestore/__tests__/fake-firestore.contract.test.ts` (unit jest)
 *   • στον **Firestore emulator** με το Admin SDK — `tests/firestore-contract/suites/*.integration.test.ts`
 *
 * 🔑 Αν ένας ισχυρισμός περνά στο fake και κοκκινίζει στον emulator, **το fake λέει ψέματα** — και κάθε test πάνω του
 * κρίνει κώδικα που η παραγωγή δεν εκτελεί. Αυτό ακριβώς συνέβη δύο φορές με το `orderBy` (ADR-890 §17.4), με δύο
 * fakes που κανείς δεν είχε ελέγξει απέναντι στο αληθινό.
 *
 * ⚠️ **Γράφε μόνο ό,τι ισχύει στο ΑΛΗΘΙΝΟ.** Όπου το fake **σκόπιμα** αποκλίνει, ο ισχυρισμός μπαίνει στο
 * `DECLARED_DEVIATIONS` με λόγο: στον emulator τρέχει κανονικά, στο fake ως `it.failing` — ορατό, και **κοκκινίζει**
 * τη μέρα που κάποιος «διορθώσει» το fake χωρίς να σβήσει τη δήλωση.
 *
 * @module test-utils/fake-firestore/contract/firestore-contract
 * @see adrs/ADR-742 §7sexdecies
 */

import { contractCasesQueries } from './firestore-contract-queries';
import { contractCasesWrites } from './firestore-contract-writes';
import type { ContractCase, ContractHarness } from './firestore-contract-kit';

/**
 * 🔴 **Οι σκόπιμες αποκλίσεις του fake από το αληθινό** — κάθε μία με λόγο. Κενό ⇒ το fake είναι πιστό σε ό,τι
 * ισχυρίζεται το συμβόλαιο. Προσθήκη γραμμής = απόφαση, όχι ευκολία: γράψε **ποιος καλών** θα άλλαζε αν διορθωνόταν.
 */
export const DECLARED_DEVIATIONS: Readonly<Record<string, string>> = {
  // Κενό από 2026-09-30: οι δύο αποκλίσεις που βρήκε ο emulator (Q11 σειρά χωρίς `orderBy`, W5 βαθύ merge) διορθώθηκαν
  // στο fake — με **μηδέν** καλούντες να αλλάζουν αποτέλεσμα (μετρημένο σε όλους). ADR-742 §7sexdecies.
};

export const CONTRACT_CASES: readonly ContractCase[] = [...contractCasesQueries, ...contractCasesWrites];

export function describeFirestoreContract(harness: ContractHarness): void {
  describe(`Συμβόλαιο Firestore — ${harness.name}`, () => {
    beforeEach(() => harness.reset());

    for (const contractCase of CONTRACT_CASES) {
      const deviates = harness.name === 'fake' && contractCase.id in DECLARED_DEVIATIONS;
      const register = deviates ? it.failing : it;
      register(`${contractCase.id} — ${contractCase.title}`, () => contractCase.run(harness.db()));
    }
  });
}
