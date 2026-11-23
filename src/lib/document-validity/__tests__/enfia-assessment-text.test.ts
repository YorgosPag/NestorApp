/**
 * Αναγνώστης πράξης ΕΝΦΙΑ (ADR-949 Α-3) — πάνω σε **ανωνυμοποιημένα** πραγματικά δείγματα (`enfia-assessment-text.fixture.ts`):
 * στήλες από τους αριθμούς τους, δεξιά στοιχισμένες τιμές, συνέχεια της ενότητας Δ σε επόμενη σελίδα, σημείωμα πληρωμής.
 */

import { ENFIA_D_PAGE_2, ENFIA_E_PAGES, ENFIA_PAYMENT_NOTE_PAGES } from './enfia-assessment-text.fixture';
import { ENFIA_BROKEN_FONT_PAGES, E9_A_PAGES } from './e9-text.fixture';
import { readEnfiaAssessmentText, type EnfiaBuildingRow } from '../enfia-assessment-text';

function readOf(pages: Parameters<typeof readEnfiaAssessmentText>[0]) {
  const result = readEnfiaAssessmentText(pages);
  if (result.kind !== 'read') throw new Error(`expected read, got ${result.kind}`);
  return result;
}

const STOREY_ADDRESS = 'ΘΕΣΣΑΛΟΝΙΚΗΣ, ΕΥΟΣΜΟΥ - ΕΥΟΣΜΟΥ (ΕΠΕΚΤΑΣΗ), ΜΥΡΤΩΝ';

describe('ADR-949 Α-3 — readEnfiaAssessmentText: πράξη 2 σελίδων', () => {
  const result = readOf(ENFIA_E_PAGES);

  it('το έτος της πράξης («Αρχική Εκκαθάριση ΕΝ.Φ.Ι.Α. 2020») — το «ισχύει κατά» της τιμής ζώνης', () => {
    expect(result.year).toBe(2020);
  });

  it('16 κτίσματα της ενότητας Δ· η 2η σελίδα (χωρίς πίνακα) δεν δίνει γραμμές', () => {
    expect(result.rows).toHaveLength(16);
    expect(new Set(result.rows.map((row) => row.page))).toEqual(new Set([1]));
  });

  it('αποθήκη υπογείου: όλες οι στήλες στη θέση τους, η διεύθυνση από δύο γραμμές', () => {
    expect(result.rows[0]).toEqual<EnfiaBuildingRow>({
      page: 1,
      category: 5,
      specialCondition: null,
      floor: { kind: 'basement' },
      mainArea: 101.5,
      auxArea: null,
      constructionYear: 2009,
      rightKind: 1,
      ownershipPct: 100,
      address: STOREY_ADDRESS,
      zonePrice: 650,
    });
  });

  it('κατοικία 1ου ορόφου με βοηθητικούς: δεξιά στοιχισμένα 113,51 και 12,00 μένουν στις στήλες 9 και 10', () => {
    expect(result.rows[15]).toMatchObject({ category: 1, floor: { kind: 'level', number: 1 }, mainArea: 113.51, auxArea: 12, zonePrice: 650 });
  });

  it('επαγγελματική στέγη και θέσεις στάθμευσης διαβάζονται ως έχουν (η απόφαση «αποτιμάται;» είναι της πρότασης)', () => {
    expect(result.rows.map((row) => row.category)).toEqual([5, 5, 3, 3, 6, 6, 6, 6, 6, 5, 5, 5, 5, 6, 6, 1]);
  });
});

describe('ADR-949 Α-3 — readEnfiaAssessmentText: συνέχεια της ενότητας Δ', () => {
  const { rows } = readOf(ENFIA_D_PAGE_2);

  it('οι επικεφαλίδες επαναλαμβάνονται σε κάθε σελίδα ⇒ 31 γραμμές (αύξων 25 ως 55), με τη σελίδα του πρωτοτύπου', () => {
    expect(rows).toHaveLength(31);
    expect(rows.every((row) => row.page === 2)).toBe(true);
  });

  it('δύο τιμές ζώνης στην ίδια πράξη (750 · 650) — ανά ακίνητο, όχι ανά έγγραφο', () => {
    expect(rows[0].zonePrice).toBe(750);
    expect(rows[16].zonePrice).toBe(650);
  });

  it('συνιδιοκτησία 50% και όροφος 3', () => {
    expect(rows[28]).toMatchObject({ category: 1, floor: { kind: 'level', number: 3 }, mainArea: 73.21, auxArea: 11.76, ownershipPct: 50 });
  });

  it('βοηθητικοί 129,49 (το πλατύτερο κελί) μένουν στη στήλη 10', () => {
    expect(rows[22]).toMatchObject({ category: 3, mainArea: 33.22, auxArea: 129.49 });
  });
});

describe('ADR-949 Α-3 — readEnfiaAssessmentText: ό,τι ΔΕΝ είναι πράξη ΕΝΦΙΑ', () => {
  it.each([
    ['σημείωμα πληρωμής ΕΝΦΙΑ (χωρίς στοιχεία ακινήτου)', ENFIA_PAYMENT_NOTE_PAGES],
    ['Ε9', E9_A_PAGES],
    ['σπασμένη γραμματοσειρά', ENFIA_BROKEN_FONT_PAGES],
  ])('%s ⇒ not-recognized', (_, pages) => {
    expect(readEnfiaAssessmentText(pages)).toEqual({ kind: 'not-recognized' });
  });
});
