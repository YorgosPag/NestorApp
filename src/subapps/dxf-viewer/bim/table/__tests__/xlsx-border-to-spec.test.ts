/**
 * 🔴 ADR-833 §5.7 — άγκυρες του **αντίστροφου μολυβιού**: στυλ περιγράμματος του Excel → πένα.
 *
 * Γεννήθηκαν από **τρεις πράσινες μεταλλάξεις** (M38 «κάθε πάχος → τρίχα» · M70 «κάθε μοτίβο →
 * συνεχές» · M71 «η διπλή χάνεται»): ολόκληρη η αντιστοίχιση των 14 θέσεων του listbox ήταν
 * **χωρίς φρουρό**, επειδή ο κύκλος εξαγωγής→εισαγωγής χρησιμοποιούσε μόνο το προεπιλεγμένο
 * πλέγμα — δηλαδή **μία** από τις δεκατέσσερις.
 *
 * ## Γιατί οι αριθμοί γράφονται ΑΥΤΟΥΣΙΟΙ και όχι ως σταθερές του καταλόγου
 * Το μάθημα των M14/M15 (§5.7.6): μια άγκυρα που συγκρίνει τη σταθερά με τον εαυτό της δεν
 * μπορεί να κοκκινίσει ποτέ. Η κλίμακα **ISO 128-20** (`0,13 · 0,25 · 0,50 · 1,00`) είναι
 * εξωτερικό πρότυπο — γράφεται ως πρότυπο.
 *
 * @see bim/table/import/xlsx-border-to-spec.ts
 * @see bim/table/table-border-style-catalog.ts — οι ίδιες 14 θέσεις, από την άλλη πλευρά
 */

import { tableBorderFromXlsx } from '../import/xlsx-border-to-spec';
import { AUTOMATIC_TABLE_INK } from '../table-ink';

describe('ADR-833 §5.7 — οι ΤΕΣΣΕΡΙΣ βαθμίδες πάχους είναι ΔΙΑΚΡΙΤΕΣ (ISO 128-20)', () => {
  it.each([
    ['hair', 0.13],
    ['thin', 0.25],
    ['medium', 0.5],
    ['thick', 1],
  ] as const)('%s ⇒ %s mm', (style, widthMm) => {
    expect(tableBorderFromXlsx({ style })?.widthMm).toBeCloseTo(widthMm, 3);
  });

  it('🔴 …και οι τέσσερις είναι ΔΙΑΦΟΡΕΤΙΚΕΣ μεταξύ τους', () => {
    const widths = (['hair', 'thin', 'medium', 'thick'] as const).map(
      (style) => tableBorderFromXlsx({ style })?.widthMm,
    );
    expect(new Set(widths).size).toBe(4);
  });
});

describe('ADR-833 §5.7 — οι ΠΕΝΤΕ οικογένειες μοτίβου δεν ισοπεδώνονται σε συνεχή', () => {
  it('η συνεχής ΔΕΝ έχει μοτίβο — «κενό» σημαίνει συνεχής, όχι «δεν διάλεξα»', () => {
    expect(tableBorderFromXlsx({ style: 'thin' })?.dashMm).toBeUndefined();
    expect(tableBorderFromXlsx({ style: 'hair' })?.dashMm).toBeUndefined();
  });

  it.each(['dotted', 'dashed', 'dashDot', 'dashDotDot', 'mediumDashed'] as const)(
    '🔴 %s ⇒ ΕΧΕΙ μοτίβο, από τον κατάλογο linetype',
    (style) => {
      const dash = tableBorderFromXlsx({ style })?.dashMm;
      expect(dash).toBeDefined();
      expect((dash as readonly number[]).length).toBeGreaterThan(0);
    },
  );

  it('🔴 οι οικογένειες παράγουν ΔΙΑΦΟΡΕΤΙΚΑ μοτίβα — αλλιώς η διάκριση είναι διακοσμητική', () => {
    const patterns = (['dotted', 'dashed', 'dashDot', 'dashDotDot'] as const).map((style) =>
      JSON.stringify(tableBorderFromXlsx({ style })?.dashMm),
    );
    expect(new Set(patterns).size).toBe(4);
  });

  it('🔴 η ΔΙΠΛΗ κρατά τη διπλότητά της (απόσταση κέντρου-κέντρου)', () => {
    const spec = tableBorderFromXlsx({ style: 'double' });
    expect(spec?.doubleGapMm).toBeGreaterThan(0);
    // …και καμία άλλη δεν την αποκτά κατά λάθος.
    expect(tableBorderFromXlsx({ style: 'thin' })?.doubleGapMm).toBeUndefined();
  });

  it('⚠️ το `slantDashDot` του Excel πέφτει στην ΙΔΙΑ ΟΙΚΟΓΕΝΕΙΑ — δηλωμένο, όχι σιωπηλό', () => {
    expect(JSON.stringify(tableBorderFromXlsx({ style: 'slantDashDot' })?.dashMm)).toBe(
      JSON.stringify(tableBorderFromXlsx({ style: 'dashDot' })?.dashMm),
    );
  });
});

describe('ADR-833 §5.7 — απουσία σημαίνει ΚΛΗΡΟΝΟΜΙΑ, ποτέ «καμία γραμμή»', () => {
  it('🔴 πλευρά που το Excel δεν δήλωσε ⇒ `undefined` (ο καλών την παραλείπει)', () => {
    expect(tableBorderFromXlsx(undefined)).toBeUndefined();
    expect(tableBorderFromXlsx({})).toBeUndefined();
  });

  it('άγνωστο στυλ ⇒ `undefined`, ποτέ τυχαία γραμμή', () => {
    expect(tableBorderFromXlsx({ style: 'σκαρίφημα' as never })).toBeUndefined();
  });

  it('🔴 χρώμα που δεν δηλώθηκε ⇒ «από το στυλ», ΟΧΙ καρφωμένο μαύρο', () => {
    expect(tableBorderFromXlsx({ style: 'thin' })?.colorHex).toBe(AUTOMATIC_TABLE_INK);
  });

  it('χρώμα που δηλώθηκε ταξιδεύει ακέραιο, χωρίς το κανάλι διαφάνειας', () => {
    expect(
      tableBorderFromXlsx({ style: 'thin', color: { argb: 'FF3366CC' } })?.colorHex,
    ).toBe('#3366CC');
  });
});
