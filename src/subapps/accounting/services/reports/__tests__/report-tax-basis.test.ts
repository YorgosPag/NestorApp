/**
 * @jest-environment node
 *
 * Βάση φόρου των αναφορών P&L / Σύνοψης Φόρων — IAS 34 (ADR-ACC-010 §2.1.1, Φάση 2, 2026-10-14).
 *
 * Τα αναμενόμενα νούμερα υπολογίστηκαν ΑΝΕΞΑΡΤΗΤΑ (κλίμακες ν.4172/2013 αρ.15 για 2025 και ν.5246/2025 για
 * 2026), όχι αντιγράφοντας έξοδο του κώδικα. Αντικαθιστά το test της «απλοποιημένης κλίμακας», που κάρφωνε το
 * λάθος: το Q2 2025 (κέρδος 7.500 €) έβγαζε 675 € (9% — σαν να ήταν ΕΤΗΣΙΟ εισόδημα), ενώ κατά IAS 34 είναι 1.430,36 €.
 */

import type { ReportGeneratorDeps } from '../../../types/reports';
import type { JournalEntry, JournalLedgerQuery } from '../../../types/journal';
import type { EFKAPayment } from '../../../types/efka';
import type { EntityType } from '../../../types/entity';
import { createPeriodTaxBasisLoader } from '../report-tax-basis';

const entry = (type: 'income' | 'expense', netAmount: number, date: string) =>
  ({ type, netAmount, date, fiscalYear: Number(date.slice(0, 4)) } as JournalEntry);

const paidEfka = (amount: number, paidDate: string) =>
  ({ amount, status: 'paid', paidDate, dueDate: paidDate } as EFKAPayment);

/** Ένα «βιβλίο» εγγραφών· η ψεύτικη σάρωση εφαρμόζει την εμβέλεια όπως ο Firestore. */
function fakeDeps(
  book: JournalEntry[],
  efka: EFKAPayment[],
  asOf: string,
  entityType: EntityType = 'sole_proprietor'
) {
  const collectJournalEntries = jest.fn(async (q: JournalLedgerQuery) => {
    const { scope } = q;
    return scope.kind === 'period'
      ? book.filter((e) => e.date >= scope.period.from && e.date <= scope.period.to)
      : book.filter((e) => e.fiscalYear === scope.fiscalYear);
  });
  const repository = {
    collectJournalEntries,
    getCompanySetup: jest.fn(async () => ({ entityType })),
    getEFKAPayments: jest.fn(async (year: number) => efka.filter((p) => p.paidDate?.startsWith(String(year)))),
    getMembers: jest.fn(async () => []),
    getMemberEFKAPayments: jest.fn(async () => []),
  };
  return { deps: { repository, asOf } as unknown as ReportGeneratorDeps, collectJournalEntries };
}

// Χρήση 2025: έσοδα 40.000, έξοδα 10.000, ΕΦΚΑ 2.000 ⇒ κέρδος 28.000 ⇒ φόρος 5.340 ⇒ συντελεστής 19,0714…%
const BOOK_2025: JournalEntry[] = [
  entry('income', 30_000, '2025-02-10'), entry('income', 10_000, '2025-05-15'),
  entry('expense', 8_000, '2025-03-01'), entry('expense', 2_000, '2025-06-01'),
];
const EFKA_2025 = [paidEfka(1_500, '2025-02-28'), paidEfka(500, '2025-05-31')];
const Q2_2025 = { from: '2025-04-01', to: '2025-06-30' };

describe('IAS 34 — φόρος περιόδου = κέρδος περιόδου × εκτιμώμενος ετήσιος συντελεστής', () => {
  it('Φ-1 κλεισμένη χρήση: πραγματικά ετήσια· ΕΦΚΑ μόνο όσα πληρώθηκαν ΜΕΣΑ στην περίοδο', async () => {
    const { deps } = fakeDeps(BOOK_2025, EFKA_2025, '2026-10-14');
    const basis = await createPeriodTaxBasisLoader(deps)(Q2_2025);

    expect(basis.ledger.totalIncomeNet).toBe(10_000);
    expect(basis.ledger.totalExpenseNet).toBe(2_000);
    expect(basis.efkaPaid).toBe(500); // όχι 2.000 της χρήσης
    expect(basis.estimatedIncomeTax).toBe(1_430.36); // 7.500 × 5.340 / 28.000
  });

  it('Φ-2 τρέχουσα χρήση 2026: αναγωγή «έως σήμερα» και κλίμακα ν.5246/2025', async () => {
    // Έως 30/6 (181η ημέρα): έσοδα 20.000, έξοδα 5.000 ⇒ ετήσια 40.331,49 / 10.082,87 ⇒ φόρος 5.584,53
    const book = [
      entry('income', 8_000, '2026-02-01'), entry('income', 12_000, '2026-05-01'),
      entry('expense', 2_000, '2026-02-01'), entry('expense', 3_000, '2026-05-01'),
      entry('income', 99_999, '2026-09-01'), // μετά το «σήμερα» — ΔΕΝ μπαίνει στην εκτίμηση
    ];
    const { deps } = fakeDeps(book, [], '2026-06-30');
    const basis = await createPeriodTaxBasisLoader(deps)({ from: '2026-04-01', to: '2026-06-30' });

    expect(basis.estimatedIncomeTax).toBe(1_661.59); // 9.000 × 5.584,53 / 30.248,62
  });

  it('Φ-3 ΕΠΕ: εταιρικός 22% — όχι η κλίμακα φυσικών προσώπων· ζημιά τριμήνου σε κερδοφόρο έτος ⇒ όφελος', async () => {
    const book = [entry('income', 50_000, '2025-01-15'), entry('expense', 4_000, '2025-08-01')];
    const { deps } = fakeDeps(book, [], '2026-10-14', 'epe');
    const load = createPeriodTaxBasisLoader(deps);

    expect((await load({ from: '2025-01-01', to: '2025-03-31' })).estimatedIncomeTax).toBe(11_000);
    expect((await load({ from: '2025-07-01', to: '2025-09-30' })).estimatedIncomeTax).toBe(-880);
  });

  it('Φ-4 περίοδος που διασχίζει χρήσεις: κάθε κομμάτι με τον συντελεστή του έτους του', async () => {
    const book = [...BOOK_2025, entry('income', 1_000, '2026-01-10')];
    const { deps } = fakeDeps(book, EFKA_2025, '2026-12-31');
    const basis = await createPeriodTaxBasisLoader(deps)({ from: '2025-06-01', to: '2026-01-31' });

    // 2025 κομμάτι: −2.000 έξοδο (1/6) ⇒ −381,43 · 2026 κομμάτι: 1.000 έσοδο, έτος 2026 = 1.000 ⇒ 9% ⇒ 90
    expect(basis.estimatedIncomeTax).toBe(-291.43);
  });

  it('Φ-5 τρεις περίοδοι μιας αναφοράς ⇒ ΜΙΑ σάρωση χρήσης ανά έτος (ο συντελεστής μοιράζεται)', async () => {
    const { deps, collectJournalEntries } = fakeDeps(BOOK_2025, EFKA_2025, '2026-10-14');
    const load = createPeriodTaxBasisLoader(deps);
    await Promise.all([load(Q2_2025), load({ from: '2025-01-01', to: '2025-03-31' }), load(Q2_2025)]);

    const yearScans = collectJournalEntries.mock.calls.filter(([q]) => q.scope.kind === 'fiscalYear');
    expect(yearScans).toHaveLength(1);
  });

  it('Φ-6 σφάλμα ανάγνωσης ⇒ η αναφορά ΑΠΟΡΡΙΠΤΕΤΑΙ (όχι σύνολα μηδέν)', async () => {
    const { deps, collectJournalEntries } = fakeDeps(BOOK_2025, [], '2026-10-14');
    collectJournalEntries.mockRejectedValue(new Error('FAILED_PRECONDITION'));
    await expect(createPeriodTaxBasisLoader(deps)(Q2_2025)).rejects.toThrow('FAILED_PRECONDITION');
  });
});
