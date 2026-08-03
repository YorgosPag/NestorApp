/**
 * ADR-750 Φάση 3, απόφαση **Α20** — από πού έρχεται το μολύβι μιας εντολής περιγράμματος.
 *
 * Η ουσία που ελέγχεται δεν είναι «επιστρέφει αντικείμενο»: είναι ότι το αποτέλεσμα **ταιριάζει
 * με τις γραμμές που ο πίνακας έχει ήδη**, σε κάθε built-in στυλ — και ότι δεν είναι ποτέ
 * αόρατο, γιατί ένα αόρατο μολύβι θα έκανε το «Όλα τα περιγράμματα» σιωπηλό no-op.
 */

import { resolveTableBorderPencil } from '../table-border-pencil';
import { applyTableBorderCommand } from '../table-range-border-ops';
import { BUILTIN_TABLE_STYLE_IDS, BUILTIN_TABLE_STYLES } from '../table-style-presets';
import { LINEWEIGHT_CONCRETE_MM_VALUES } from '../../../config/lineweight-iso-catalog';
import type { TableStyle } from '../table-style';
import type { PersistedTableModel, TableColumn, TableRow } from '../../../types/table';

function styleById(id: string): TableStyle {
  const style = BUILTIN_TABLE_STYLES.find((s) => s.id === id);
  if (!style) throw new Error(`missing preset: ${id}`);
  return style;
}

const STANDARD = styleById(BUILTIN_TABLE_STYLE_IDS.STANDARD);

function persisted(rowCount: number, colCount: number): PersistedTableModel {
  const columns: TableColumn[] = Array.from({ length: colCount }, (_, c) => ({
    id: `c${c + 1}`,
    sizing: { kind: 'fixed', widthMm: 10 },
    valueType: 'text',
    align: 'left',
  }));
  const rows: TableRow[] = Array.from({ length: rowCount }, (_, r) => ({
    id: `r${r + 1}`,
    rowClass: 'data',
    heightMm: 6,
  }));
  return { columns, rows, cells: [], merges: [] };
}

describe('Α20 — το μολύβι παράγεται από το στυλ, δεν είναι σταθερά', () => {
  it('παίρνει την ΕΣΩΤΕΡΙΚΗ γραμμή της κλάσης «data» — τη γραμμή πλέγματος του πίνακα', () => {
    const pencil = resolveTableBorderPencil(STANDARD);
    const grid = STANDARD.rowClasses.data.borders.insideH;
    expect(pencil.colorHex).toBe(grid.colorHex);
    expect(pencil.widthMm).toBe(grid.widthMm);
  });

  it('🔑 το «παχύ» του είναι η ΕΠΟΜΕΝΗ πένα ISO πάνω από τη γραμμή πλέγματος του στυλ', () => {
    // ⚠️ Ιστορικό, γιατί η διατύπωση άλλαξε: μέχρι την 2026-08-04 το `standard` είχε ΔΥΟ πάχη
    // (πλέγμα 0,25 · πλαίσιο 0,50) και ο έλεγχος ήταν «το thick βγαίνει ΑΚΡΙΒΩΣ ίσο με το
    // πλαίσιο». Ο Giorgio ισοπέδωσε τα πάχη — μία πένα για κάθε ακμή — οπότε δεν υπάρχει πια
    // δεύτερο πάχος στο στυλ για να συμπέσει μαζί του. Η **αρχή** όμως δεν άλλαξε καθόλου: το
    // `thick` είναι σκαλοπάτι της κλίμακας ISO 128-20 (λόγος 1:2, κουμπωμένο στον κατάλογο),
    // ποτέ ελεύθερο διπλάσιο. Αυτό ελέγχεται εδώ — και είναι το μόνο που ήταν ποτέ ουσιώδες.
    const pencil = resolveTableBorderPencil(STANDARD);
    const model = applyTableBorderCommand(
      persisted(2, 2),
      { firstRow: 0, lastRow: 1, firstCol: 0, lastCol: 1 },
      'thickOutside',
      pencil,
    );
    const widths = new Set((model.edges ?? []).map(([, , , spec]) => spec.widthMm));
    expect(widths.size).toBe(1);

    const thick = [...widths][0] as number;
    expect(LINEWEIGHT_CONCRETE_MM_VALUES).toContain(thick);
    expect(thick).toBeGreaterThan(pencil.widthMm);
    // Πάνω από το πλέγμα, αλλά **ένα** σκαλοπάτι: όχι διπλή βαθμίδα, όχι στρογγυλοποίηση προς
    // τα πάνω σε ό,τι υπάρχει στον κατάλογο.
    expect(thick).toBeLessThanOrEqual(pencil.widthMm * 2);
  });

  it('είναι ΠΑΝΤΑ ορατό, σε κάθε built-in στυλ — αλλιώς το «Όλα» δεν θα ζωγράφιζε τίποτα', () => {
    for (const style of BUILTIN_TABLE_STYLES) {
      expect(resolveTableBorderPencil(style).visible).toBe(true);
    }
  });

  it('το πάχος του είναι ΠΑΝΤΑ πένα του καταλόγου ISO — ποτέ ελεύθερος αριθμός', () => {
    for (const style of BUILTIN_TABLE_STYLES) {
      const { widthMm } = resolveTableBorderPencil(style);
      expect(LINEWEIGHT_CONCRETE_MM_VALUES).toContain(widthMm);
    }
  });

  it('🔴 στυλ ΧΩΡΙΣ καμία ορατή γραμμή: παίρνει το μελάνι του κειμένου, όχι μαύρο', () => {
    // Το `detailSheet` (ADR-622) έχει και τις έξι ακμές αόρατες. Ένα σταθερό `#000000` εδώ θα
    // ήταν εφεύρεση σε στυλ που δηλώνει ρητά άλλο χρώμα κειμένου.
    const blank = styleById(BUILTIN_TABLE_STYLE_IDS.DETAIL_SHEET);
    const pencil = resolveTableBorderPencil(blank);
    expect(pencil.visible).toBe(true);
    expect(pencil.colorHex).toBe(blank.rowClasses.data.textColorHex);
    expect(pencil.widthMm).toBeGreaterThan(0);
  });

  it('είναι ντετερμινιστικό — δύο κλήσεις, ίδια τιμή (καμία κρυφή κατάσταση, Α15)', () => {
    for (const style of BUILTIN_TABLE_STYLES) {
      expect(resolveTableBorderPencil(style)).toEqual(resolveTableBorderPencil(style));
    }
  });
});

// ── Α23: η επιλογή του χρήστη πάνω στο στυλ ─────────────────────────────────

/**
 * 🔑 Η ουσία της Α23 δεν είναι «η παράμετρος περνάει»: είναι ότι η κληρονομιά είναι **ανά
 * πεδίο**. Ένα μολύβι που κρατούσε *ολόκληρη* την προηγούμενη κατάσταση θα πάγωνε και τα
 * τέσσερα πεδία με το πρώτο κλικ σε ένα από αυτά — και ο πίνακας θα έπαυε σιωπηλά να
 * ακολουθεί το στυλ του σχεδίου, που είναι ακριβώς ό,τι η Α20 υπάρχει για να αποτρέψει.
 */
describe('Α23 — η επιλογή του χρήστη είναι παράκαμψη ΑΝΑ ΠΕΔΙΟ', () => {
  const AUTO = resolveTableBorderPencil(STANDARD);

  it('χωρίς επιλογή, δίνει ΤΟ ΙΔΙΟ με την Α20 — καμία αλλαγή συμπεριφοράς', () => {
    expect(resolveTableBorderPencil(STANDARD, {})).toEqual(AUTO);
    expect(resolveTableBorderPencil(STANDARD)).toEqual(AUTO);
  });

  it('🔑 χρώμα μόνο ⇒ αλλάζει ΜΟΝΟ το χρώμα· το πάχος μένει του στυλ', () => {
    const pencil = resolveTableBorderPencil(STANDARD, { colorHex: '#ff00ff' });
    expect(pencil.colorHex).toBe('#ff00ff');
    expect(pencil.widthMm).toBe(AUTO.widthMm);
  });

  it('🔑 πάχος μόνο ⇒ αλλάζει ΜΟΝΟ το πάχος· το χρώμα μένει του στυλ', () => {
    const pencil = resolveTableBorderPencil(STANDARD, { widthMm: 1 });
    expect(pencil.widthMm).toBe(1);
    expect(pencil.colorHex).toBe(AUTO.colorHex);
  });

  it('ελεύθερο πάχος ΚΟΥΜΠΩΝΕΙ στην κλίμακα ISO — καμία δεύτερη κλίμακα πένας', () => {
    const pencil = resolveTableBorderPencil(STANDARD, { widthMm: 0.44 });
    expect(LINEWEIGHT_CONCRETE_MM_VALUES).toContain(pencil.widthMm);
    expect(pencil.widthMm).toBe(0.4);
  });

  it('πάχος εκτός κλίμακας (0 / αρνητικό) πέφτει πίσω στο στυλ αντί να εφευρεθεί πένα', () => {
    expect(resolveTableBorderPencil(STANDARD, { widthMm: 0 }).widthMm).toBe(AUTO.widthMm);
    expect(resolveTableBorderPencil(STANDARD, { widthMm: -3 }).widthMm).toBe(AUTO.widthMm);
  });

  it('🔴 ΚΕΝΟ μοτίβο είναι επιλογή («Συνεχής»), όχι απουσία επιλογής', () => {
    // Με έλεγχο μήκους αντί για `??`, ο χρήστης που διαλέγει ρητά συνεχή γραμμή θα
    // κληρονομούσε τη διακεκομμένη του στυλ.
    const dashed = resolveTableBorderPencil(STANDARD, { dashMm: [4, -2] });
    expect(dashed.dashMm).toEqual([4, -2]);
    const solid = resolveTableBorderPencil(STANDARD, { dashMm: [] });
    expect(solid.dashMm).toBeUndefined();
  });

  it('🔑 Α24 — η διπλή δίνει απόσταση 3× την ΤΕΛΙΚΗ πένα, όχι την πένα του στυλ', () => {
    // Η σειρά μετράει: αν η απόσταση υπολογιζόταν πριν το κούμπωμα του πάχους, μια διπλή με
    // επιλεγμένο πάχος 1 mm θα έπαιρνε την απόσταση των 0,25 mm του στυλ.
    const pencil = resolveTableBorderPencil(STANDARD, { widthMm: 1, double: true });
    expect(pencil.widthMm).toBe(1);
    expect(pencil.doubleGapMm).toBeCloseTo(3, 10);
  });

  it('χωρίς «διπλή», το πεδίο ΛΕΙΠΕΙ — ποτέ ρητό `undefined` (ταυτότητα σχήματος)', () => {
    const pencil = resolveTableBorderPencil(STANDARD, { colorHex: '#ff00ff' });
    expect('doubleGapMm' in pencil).toBe(false);
    expect('dashMm' in pencil).toBe(false);
  });

  it('παραμένει ντετερμινιστικό: ίδια επιλογή ⇒ ίδιο αποτέλεσμα (Α15, μηδέν κρυφή κατάσταση)', () => {
    const choice = { colorHex: '#00aa00', widthMm: 0.5, double: true };
    expect(resolveTableBorderPencil(STANDARD, choice)).toEqual(
      resolveTableBorderPencil(STANDARD, choice),
    );
  });
});
