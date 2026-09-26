/**
 * @jest-environment node
 *
 * ADR-889 Φ1 — το συμβόλαιο των στηλών του ΜΑΜΑ: κεφαλίδα κατά θέση και όνομα, τυποποίηση γραμμής, κλειστό λεξιλόγιο.
 */

import { MAMA_HEADER, MamaFormatError, assertMamaHeader, parseMamaRow } from '../lib/market-transactions/mama-source';
import { MAMA_CATEGORIES } from '../lib/market-transactions/mama-vocabulary';
import { SEGMENT_METRIC, SEGMENT_PROPERTY_TYPES } from '../../src/lib/market/market-segments';

/** Πραγματική γραμμή του 2026 (πρώτη γραμμή δεδομένων του αρχείου), όπως τη δίνει το exceljs. */
function apartmentCells(): unknown[] {
  return [
    'ΑΘΗΝΩΝ (ΝΟΜΑΡΧΙΑ)', 'ΑΓΙΑΣ ΒΑΡΒΑΡΑΣ', 'ΑΓΙΑΣ ΒΑΡΒΑΡΑΣ', 'Εντός ΑΠΑΑ',
    'Κατοικία ή διαμέρισμα πλήν μονοκατοικίας', 0, 1300, 83, 45, 1989, 'Πλήρης Κυριότητα', 100, null, '2',
    '', null, '', '', new Date('2026-01-29T00:00:00.000Z'), 84440.47,
  ];
}

describe('κεφαλίδα', () => {
  it('η μετρημένη κεφαλίδα περνά — με ΛΑΤΙΝΙΚΑ T/E όπως στην πηγή', () => {
    expect(() => assertMamaHeader([...MAMA_HEADER])).not.toThrow();
    expect(MAMA_HEADER[6].charCodeAt(0)).toBe(0x54); // 'T' λατινικό
    expect(MAMA_HEADER[7].charCodeAt(0)).toBe(0x45); // 'E' λατινικό
  });

  it('«διορθωμένο» ελληνικό Τ στη στήλη 6 ⇒ αποτυχία (η πηγή δεν το γράφει έτσι)', () => {
    const header: string[] = [...MAMA_HEADER];
    header[6] = 'Τιμή Ζώνης';
    expect(() => assertMamaHeader(header)).toThrow(MamaFormatError);
  });

  it('μετακίνηση στήλης ⇒ αποτυχία, όχι σιωπηλή μετατόπιση', () => {
    const header: string[] = [...MAMA_HEADER];
    [header[18], header[19]] = [header[19], header[18]];
    expect(() => assertMamaHeader(header)).toThrow(/στήλη 18/);
  });

  it('επιπλέον στήλη ⇒ αποτυχία', () => {
    expect(() => assertMamaHeader([...MAMA_HEADER, 'Νέα στήλη'])).toThrow(/21 στήλες/);
  });
});

describe('parseMamaRow', () => {
  it('τυποποιεί πραγματική γραμμή: κενά κελιά = null, ποτέ 0', () => {
    const record = parseMamaRow(apartmentCells());
    expect(record).toMatchObject({
      prefecture: 'ΑΘΗΝΩΝ (ΝΟΜΑΡΧΙΑ)',
      municipality: 'ΑΓΙΑΣ ΒΑΡΒΑΡΑΣ',
      apaa: 'Εντός ΑΠΑΑ',
      mainArea: 83,
      buildingRight: 'Πλήρης Κυριότητα',
      buildingShare: 100,
      special: null,
      floor: '2',
      plotArea: null,
      plotRight: null,
      contractDate: '2026-01-29',
      price: 84440.47,
    });
  });

  it('το ΛΑΤΙΝΙΚΟ «Eπικαρπία» της πηγής αναγνωρίζεται', () => {
    const cells = apartmentCells();
    cells[10] = 'Eπικαρπία';
    expect(parseMamaRow(cells).buildingRight).toBe('Eπικαρπία');
  });

  it('άγνωστη κατηγορία, δικαίωμα ή ειδική συνθήκη ⇒ σφάλμα με το όνομα της στήλης', () => {
    const category = apartmentCells();
    category[4] = 'Πλωτή κατοικία';
    expect(() => parseMamaRow(category)).toThrow(/Κατηγορία Ακινήτου/);

    const right = apartmentCells();
    right[10] = 'Δουλεία';
    expect(() => parseMamaRow(right)).toThrow(/δικαιώματος Κτίσματος/);

    const special = apartmentCells();
    special[12] = 'Κάτι νέο';
    expect(() => parseMamaRow(special)).toThrow(/Ειδικές Συνθήκες/);
  });

  it('κείμενο σε αριθμητική στήλη ή κενό τίμημα/ημερομηνία ⇒ σφάλμα', () => {
    const area = apartmentCells();
    area[7] = '83 τ.μ.';
    expect(() => parseMamaRow(area)).toThrow(/Eπιφάνεια Κύριων/);

    const noPrice = apartmentCells();
    noPrice[19] = '';
    expect(() => parseMamaRow(noPrice)).toThrow(/κενό τίμημα/);

    const noDate = apartmentCells();
    noDate[18] = '2026-01-29';
    expect(() => parseMamaRow(noDate)).toThrow(/ημερομηνία/);
  });
});

describe('λεξιλόγιο', () => {
  it('οι 20 μετρημένες κατηγορίες: κάθε μία είτε τμήμα είτε εξαίρεση ΜΕ λόγο', () => {
    const entries = Object.values(MAMA_CATEGORIES);
    expect(entries).toHaveLength(20);
    for (const decision of entries) {
      if (decision.segment === null) expect(decision.excluded.length).toBeGreaterThan(0);
      else expect(SEGMENT_METRIC[decision.segment]).toBeDefined();
    }
  });

  it('κάθε τμήμα έχει μέτρο και λίστα τύπων εφαρμογής', () => {
    expect(Object.keys(SEGMENT_PROPERTY_TYPES).sort()).toEqual(Object.keys(SEGMENT_METRIC).sort());
  });
});
