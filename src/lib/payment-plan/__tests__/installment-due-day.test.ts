/**
 * ADR-234 — άγκυρες του κανόνα «η λήξη δόσης είναι ΗΜΕΡΑ» (`lib/payment-plan/installment-due-day`).
 *
 * Φυλάνε: (α) τις παλιές λήξεις-στιγμές διαβάζονται ως η ημέρα που εννοούσε ο άνθρωπος (Αθήνα)· (β) ληξιπρόθεσμη
 * μόνο αφού περάσει ΟΛΟΚΛΗΡΗ η ημέρα λήξης (ΑΚ 241)· (γ) «σήμερα» = ημέρα Αθήνας, όχι UTC· (δ) μηνιαίες λήξεις
 * ψαλιδίζονται στο τέλος του μήνα.
 */

import {
  compareInstallmentDueDays,
  installmentDaysPastDue,
  installmentDueDay,
  installmentToday,
  isInstallmentPastDue,
  monthlyDueDay,
} from '../installment-due-day';

describe('installmentDueDay — η ημέρα μιας αποθηκευμένης λήξης', () => {
  it('σκέτη ημέρα ⇒ αυτούσια', () => {
    expect(installmentDueDay('2026-11-05')).toBe('2026-11-05');
    expect(installmentDueDay('2028-02-29')).toBe('2028-02-29');
  });

  it('παλιό wizard 01:30 Αθήνα 5/11 (`toISOString` τοπικής ώρας) ⇒ 5/11, όχι 4/11', () => {
    expect(installmentDueDay('2026-11-04T23:30:00.000Z')).toBe('2026-11-05');
  });

  it('παλιά φόρμα επεξεργασίας (μεσάνυχτα UTC) ⇒ η ίδια ημέρα', () => {
    expect(installmentDueDay('2026-11-05T00:00:00.000Z')).toBe('2026-11-05');
    // Θερινή ώρα (UTC+3) — ίδια απάντηση.
    expect(installmentDueDay('2026-07-14T21:30:00.000Z')).toBe('2026-07-15');
  });

  it.each([
    ['ανύπαρκτη ημέρα', '2027-02-30'],
    ['κενό', ''],
    ['σκουπίδι', 'αύριο'],
    ['μη συμβολοσειρά', 20261105],
    ['null', null],
    ['undefined', undefined],
  ])('μη αναγνώσιμη ⇒ null: %s', (_label, value) => {
    expect(installmentDueDay(value)).toBeNull();
  });
});

describe('installmentToday — «σήμερα» της Αθήνας', () => {
  it('00:30 Αθήνα (21:30Z της προηγούμενης) ⇒ ήδη η νέα ημέρα', () => {
    expect(installmentToday(new Date('2026-07-14T21:30:00.000Z'))).toBe('2026-07-15');
  });

  it('χειμερινή ώρα (UTC+2): 23:30Z ⇒ 01:30 της επομένης', () => {
    expect(installmentToday(new Date('2026-11-04T23:30:00.000Z'))).toBe('2026-11-05');
    expect(installmentToday(new Date('2026-11-04T21:59:00.000Z'))).toBe('2026-11-04');
  });
});

describe('isInstallmentPastDue — ΑΚ 241: λήγει στο τέλος της ημέρας', () => {
  it('την ίδια την ημέρα λήξης ΔΕΝ είναι ληξιπρόθεσμη (και για παλιά λήξη μεσάνυχτα UTC)', () => {
    expect(isInstallmentPastDue('2026-11-05', '2026-11-05')).toBe(false);
    expect(isInstallmentPastDue('2026-11-05T00:00:00.000Z', '2026-11-05')).toBe(false);
  });

  it('την επομένη είναι', () => {
    expect(isInstallmentPastDue('2026-11-05', '2026-11-06')).toBe(true);
    expect(isInstallmentPastDue('2026-11-04T23:30:00.000Z', '2026-11-06')).toBe(true);
  });

  it('μη αναγνώσιμη λήξη ⇒ ποτέ «ληξιπρόθεσμη»', () => {
    expect(isInstallmentPastDue('', '2030-01-01')).toBe(false);
    expect(isInstallmentPastDue(undefined, '2030-01-01')).toBe(false);
  });
});

describe('installmentDaysPastDue — ολόκληρες ημέρες', () => {
  it('μετρά ημέρες ημερολογίου, όχι 24ωρα (και πάνω από αλλαγή ώρας)', () => {
    expect(installmentDaysPastDue('2026-10-24', '2026-10-26')).toBe(2);
    expect(installmentDaysPastDue('2025-01-01', '2026-01-01')).toBe(365);
  });

  it('ίδια ημέρα, μελλοντική ή μη αναγνώσιμη ⇒ 0', () => {
    expect(installmentDaysPastDue('2026-11-05', '2026-11-05')).toBe(0);
    expect(installmentDaysPastDue('2026-12-31', '2026-01-01')).toBe(0);
    expect(installmentDaysPastDue(null, '2026-01-01')).toBe(0);
  });
});

describe('monthlyDueDay — μηνιαίες λήξεις με ψαλίδισμα', () => {
  it.each([
    ['2027-01-31', 1, '2027-02-28'],
    ['2028-01-31', 1, '2028-02-29'],
    ['2026-12-15', 1, '2027-01-15'],
    ['2026-05-31', 1, '2026-06-30'],
    ['2026-11-05', 0, '2026-11-05'],
  ])('%s + %i μήνες ⇒ %s', (start, months, expected) => {
    expect(monthlyDueDay(start, months)).toBe(expected);
  });
});

describe('compareInstallmentDueDays — ταξινόμηση ανάμεικτων μορφών', () => {
  it('κατά ημέρα Αθήνας, μη αναγνώσιμες στο τέλος', () => {
    const sorted = ['2026-11-06', 'σκουπίδι', '2026-11-04T23:30:00.000Z', '2026-11-01'].sort(compareInstallmentDueDays);
    expect(sorted).toEqual(['2026-11-01', '2026-11-04T23:30:00.000Z', '2026-11-06', 'σκουπίδι']);
  });
});
