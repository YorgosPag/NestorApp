/**
 * 🔴 **Η ένδειξη μεγέθους της σύρσης** (Giorgio 2026-08-04) — «Πλάτος: 14,14 (104 pixel)».
 *
 * Το κρίσιμο test της σουίτας είναι το **annotative**: ένα πλάτος στήλης σε sheet-mm ΔΕΝ
 * είναι το μέγεθός του πάνω στο σχέδιο. Σε κλίμακα 1:100, τα 40 sheet-mm είναι **4 μέτρα**,
 * και ο χρήστης που έχει διαλέξει «m» πρέπει να δει 4 — όχι 0,04. Ένας μορφοποιητής που
 * παίρνει το sheet-mm κατευθείαν θα φαινόταν σωστός σε **κάθε** test που τρέχει σε 1:1.
 */

jest.mock('@/i18n', () => ({
  i18n: {
    t: (key: string): string => {
      const map: Record<string, string> = {
        'table.resize.width': 'Πλάτος',
        'table.resize.height': 'Ύψος',
        'table.resize.pixels': 'pixel',
      };
      return map[key] ?? key;
    },
    language: 'el',
  },
}));

import { tableResizeReadoutText } from '../table-resize-readout';
import { displayUnitState } from '../../../config/display-unit-state';

const initialUnit = displayUnitState.getUnit();
afterEach(() => displayUnitState.setUnit(initialUnit));

/** Το μέγεθος σε sheet-mm (χαρτί) — ό,τι κρατά το μοντέλο του πίνακα. */
const SIZE_MM = 40;

describe('tableResizeReadoutText — τι διαβάζει ο χρήστης', () => {
  it('γράφει την ετικέτα του ΑΞΟΝΑ — πλάτος για στήλη, ύψος για γραμμή', () => {
    const base = { sizeMm: SIZE_MM, pxPerMm: 2, mmToWorld: 1 };
    expect(tableResizeReadoutText({ ...base, axis: 'column' })).toContain('Πλάτος');
    expect(tableResizeReadoutText({ ...base, axis: 'row' })).toContain('Ύψος');
  });

  it('🔴 ANNOTATIVE: σε 1:100 τα 40 sheet-mm είναι 4 ΜΕΤΡΑ, όχι 4 χιλιοστά', () => {
    displayUnitState.setUnit('m');
    // `mmToWorld = 100` ⇒ η κλίμακα σχεδίου 1:100 με μονάδες σκηνής mm.
    const text = tableResizeReadoutText({
      axis: 'column', sizeMm: SIZE_MM, pxPerMm: 2, mmToWorld: 100,
    });
    expect(text).toContain('4');
    expect(text).toContain('m');
    // Το λάθος που θα έκανε ο απευθείας μορφοποιητής: 40mm χαρτιού ⇒ «0,04 m».
    expect(text).not.toContain('0,04');
  });

  it('ακολουθεί τον επιλογέα μονάδας της γραμμής κατάστασης', () => {
    const input = { axis: 'column', sizeMm: SIZE_MM, pxPerMm: 2, mmToWorld: 1 } as const;
    displayUnitState.setUnit('mm');
    expect(tableResizeReadoutText(input)).toContain('mm');
    displayUnitState.setUnit('cm');
    expect(tableResizeReadoutText(input)).toContain('cm');
  });

  it('🔴 τα PIXEL είναι ακέραια και εξαρτώνται από το ZOOM — όχι δεύτερη γραφή του ίδιου', () => {
    // Το ίδιο μέγεθος σχεδίου, δύο διαφορετικά zoom ⇒ δύο διαφορετικά pixel. Αυτός ακριβώς
    // είναι ο λόγος που ο δεύτερος αριθμός υπάρχει: απαντά ερώτηση **οθόνης**.
    expect(tableResizeReadoutText({
      axis: 'column', sizeMm: SIZE_MM, pxPerMm: 2.6, mmToWorld: 1,
    })).toContain('(104 pixel)');
    expect(tableResizeReadoutText({
      axis: 'column', sizeMm: SIZE_MM, pxPerMm: 5.2, mmToWorld: 1,
    })).toContain('(208 pixel)');
  });

  it('🔴 ποτέ αρνητικό: ενδιάμεσο καρέ σύρσης πέρα από το όριο δεν γράφει «−12 pixel»', () => {
    const text = tableResizeReadoutText({
      axis: 'row', sizeMm: -12, pxPerMm: 2, mmToWorld: 1,
    });
    expect(text).not.toContain('-');
    expect(text).toContain('(0 pixel)');
  });
});
