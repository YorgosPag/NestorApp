/**
 * ADR-750 Φάση 2 — **οι 13 εντολές ως πράξεις**, μετρημένες στον ζωντανό μηχανισμό.
 *
 * Δύο επίπεδα απόδειξης, και τα δύο απαραίτητα:
 *
 * 1. **Στο μοντέλο** — ποιες ακμές γράφτηκαν, με ποιο μολύβι, σε ποια σειρά. Εδώ φαίνεται
 *    ό,τι ο ζωγράφος έχει δικαίωμα να κρύψει (π.χ. εσωτερικές ακμές συγχώνευσης).
 * 2. **Στην οθόνη** — μέσω πραγματικού `resolveTableModel` + `layoutTable`, δηλαδή της ίδιας
 *    διαδρομής που τροφοδοτεί καμβά / PDF / DXF. Ένα test μόνο στο μοντέλο θα έλεγε «η
 *    συνάρτηση έγραψε αυτό που της ζήτησα», ποτέ «ο χρήστης βλέπει αυτό που ζήτησε».
 *
 * Ο μετρητής κειμένου είναι ενεθειμένος και ντετερμινιστικός, για τον λόγο που εξηγεί το
 * `table-layout.test.ts` — **όχι** ως δεύτερη υλοποίηση μέτρησης (N.18).
 */

import { LINEWEIGHT_CONCRETE_MM_VALUES } from '../../../config/lineweight-iso-catalog';
import { layoutTable } from '../table-layout';
import { resolveTableModel } from '../table-model-helpers';
import { HIDDEN_TABLE_EDGE, TABLE_EDGE_END } from '../table-edge-model';
import {
  TABLE_BORDER_COMMANDS,
  applyTableBorderCommand,
  clearTableRangeBorders,
  hasExplicitTableRangeBorders,
  tableRangeSideEdges,
} from '../table-range-border-ops';
import type { TableBorderCommandId, TableBorderSide } from '../table-range-border-ops';
import { BUILTIN_TABLE_STYLE_IDS, BUILTIN_TABLE_STYLES } from '../table-style-presets';
import type { TableStyle } from '../table-style';
import type { TableBorderSegment, TableTextMeasurer } from '../table-layout-types';
import type { CellSpan, PersistedTableModel, TableColumn, TableRow } from '../../../types/table';
import type { TableBorderSpec } from '../../../types/table-edges';
import type { TableCellRangeBounds } from '../table-cell-range';

// ── Εργαλεία ────────────────────────────────────────────────────────────────

const measureText: TableTextMeasurer = (text, heightMm) => text.length * heightMm * 0.6;

/** Οι έξι πλευρές, γραμμένες μία φορά — η σειρά δεν έχει σημασία, η πληρότητα έχει. */
const ALL_SIDES: readonly TableBorderSide[] = [
  'top',
  'bottom',
  'left',
  'right',
  'insideH',
  'insideV',
];

const STANDARD: TableStyle = (() => {
  const style = BUILTIN_TABLE_STYLES.find((s) => s.id === BUILTIN_TABLE_STYLE_IDS.STANDARD);
  if (!style) throw new Error('missing preset: standard');
  return style;
})();

const W = 10;
const H = 6;

/** Το μολύβι του χρήστη — εμφανώς διαφορετικό από ό,τι λέει η κλάση (`#666666`, 0.25mm). */
const PEN: TableBorderSpec = { visible: true, colorHex: '#ff00ff', widthMm: 0.25 };

function persisted(rowCount: number, colCount: number, merges: readonly CellSpan[] = []) {
  const columns: TableColumn[] = Array.from({ length: colCount }, (_, c) => ({
    id: `c${c + 1}`,
    sizing: { kind: 'fixed', widthMm: W },
    valueType: 'text',
    align: 'left',
  }));
  const rows: TableRow[] = Array.from({ length: rowCount }, (_, r) => ({
    id: `r${r + 1}`,
    rowClass: 'data',
    heightMm: H,
  }));
  const model: PersistedTableModel = { columns, rows, cells: [], merges };
  return model;
}

function bounds(
  firstRow: number,
  lastRow: number,
  firstCol: number,
  lastCol: number,
): TableCellRangeBounds {
  return { firstRow, lastRow, firstCol, lastCol };
}

/** Οι ρητές ακμές ως αναγνώσιμες προτάσεις «Ο:γραμμή:στήλη → χρώμα@πάχος». */
function describeEdges(model: PersistedTableModel): readonly string[] {
  return (model.edges ?? []).map(
    ([orientation, rowAnchor, colAnchor, spec]) =>
      `${orientation}:${rowAnchor}:${colAnchor} ${spec.visible ? spec.colorHex : 'ΑΟΡΑΤΗ'}@${spec.widthMm}`,
  );
}

/** Ό,τι θα ζωγραφιστεί πραγματικά — μέσω της ζωντανής διαδρομής. */
function paint(model: PersistedTableModel): readonly TableBorderSegment[] {
  return layoutTable(resolveTableModel(model), STANDARD, { measureText }).borders;
}

/** Ταξίδι στο αρχείο και πίσω — ό,τι κάνει η αποθήκευση σκηνής και το undo. */
function roundTrip(model: PersistedTableModel): PersistedTableModel {
  return JSON.parse(JSON.stringify(model)) as PersistedTableModel;
}

function apply(
  model: PersistedTableModel,
  b: TableCellRangeBounds,
  id: TableBorderCommandId,
  pencil: TableBorderSpec = PEN,
): PersistedTableModel {
  return applyTableBorderCommand(model, b, id, pencil);
}

// ── Το μητρώο ───────────────────────────────────────────────────────────────

describe('το μητρώο των 13 — δεδομένα, όχι δεκατρία σώματα', () => {
  it('έχει ακριβώς 13 εντολές με μοναδικές ταυτότητες', () => {
    expect(TABLE_BORDER_COMMANDS).toHaveLength(13);
    const ids = TABLE_BORDER_COMMANDS.map((c) => c.id);
    expect(new Set(ids).size).toBe(13);
  });

  it('οι τρεις ομάδες του μενού είναι ΣΥΝΕΧΟΜΕΝΕΣ και στα μετρημένα πλήθη 4/4/5', () => {
    // Μετρημένα από το ελληνικό Excel (στιγμιότυπο 2026-08-03): διαχωριστικά μετά την 4η και
    // την 8η. Αν κάποτε αναδιαταχθεί το μητρώο, μια ομάδα που «σπάει» στα δύο θα έδινε
    // διπλό διαχωριστικό στο dropdown — ορατό ελάττωμα με αόρατη αιτία.
    const groups = TABLE_BORDER_COMMANDS.map((c) => c.group);
    expect(groups).toEqual([
      'side',
      'side',
      'side',
      'side',
      'range',
      'range',
      'range',
      'range',
      'accent',
      'accent',
      'accent',
      'accent',
      'accent',
    ]);
  });

  it('καμία εντολή δεν έχει κενό σκέλος — κάθε σκέλος ονομάζει πλευρές', () => {
    for (const command of TABLE_BORDER_COMMANDS) {
      expect(command.parts.length).toBeGreaterThan(0);
      for (const part of command.parts) expect(part.sides.length).toBeGreaterThan(0);
    }
  });

  it('🔴 Α10 — το «Εξωτερικά» ΔΕΝ αναφέρει καθόλου εσωτερικές πλευρές', () => {
    // Excel parity, κλειδωμένο: πλαίσιο γύρω από περιοχή που έχει ήδη δικό της πλέγμα δεν
    // επιτρέπεται να το σβήσει ή να το ξαναγράψει.
    for (const id of ['outside', 'thickOutside'] as const) {
      const command = TABLE_BORDER_COMMANDS.find((c) => c.id === id);
      const sides = command?.parts.flatMap((p) => p.sides) ?? [];
      expect(sides).not.toContain('insideH');
      expect(sides).not.toContain('insideV');
      expect(sides).toHaveLength(4);
    }
  });

  it('✅ Φ5 — ΚΑΜΙΑ εντολή δεν αφήνει το μοντέλο αμετάβλητο (η τρύπα της Α17 έκλεισε)', () => {
    // Μέχρι τη Φ5 οι δύο διπλές επέστρεφαν το μοντέλο by-reference. Η πύλη διαθεσιμότητας
    // διαγράφηκε, άρα η μόνη τίμια απόδειξη είναι να **εκτελεστούν** και οι 13.
    for (const command of TABLE_BORDER_COMMANDS) {
      const before = persisted(3, 3);
      const after = apply(before, bounds(1, 1, 1, 1), command.id);
      expect(after).not.toBe(before);
      expect((after.edges ?? []).length).toBeGreaterThan(0);
    }
  });

  it('🔑 Α24 — η διπλή γραμμή γράφει απόσταση 3× πένα, όχι σημαία', () => {
    const next = apply(persisted(3, 3), bounds(1, 1, 1, 1), 'doubleBottom');
    const specs = (next.edges ?? []).map(([, , , spec]) => spec);
    expect(specs).toHaveLength(1);
    expect(specs[0].doubleGapMm).toBeCloseTo(PEN.widthMm * 3, 10);
    // Το χρώμα και η πένα μένουν του χρήστη — η διπλή δεν είναι άλλο μολύβι, είναι το ίδιο δύο φορές.
    expect(specs[0].colorHex).toBe(PEN.colorHex);
    expect(specs[0].widthMm).toBe(PEN.widthMm);
  });

  it('🔑 «Επάνω και διπλό κάτω»: ΜΟΝΟ η κάτω ακμή είναι διπλή', () => {
    const next = apply(persisted(3, 3), bounds(1, 1, 1, 1), 'topAndDoubleBottom');
    const doubles = (next.edges ?? []).filter(([, , , spec]) => spec.doubleGapMm !== undefined);
    expect(doubles).toHaveLength(1);
    // Η κάτω πλευρά μιας περιοχής κάθεται στο `lastRow + 1` — εδώ η γραμμή `r3`.
    expect(doubles[0][1]).toBe('r3');
  });

  it('η διπλή σέβεται απόσταση που ΗΔΗ κουβαλά το μολύβι του χρήστη', () => {
    const wide: TableBorderSpec = { ...PEN, doubleGapMm: 2 };
    const next = apply(persisted(3, 3), bounds(1, 1, 1, 1), 'doubleBottom', wide);
    expect((next.edges ?? [])[0][3].doubleGapMm).toBe(2);
  });
});

// ── Γεωμετρία: ποιες ακμές αγγίζει κάθε πλευρά ──────────────────────────────

describe('γεωμετρία περιοχής', () => {
  it('περιοχή 1×1 με «Όλα τα περιγράμματα» γράφει ΑΚΡΙΒΩΣ τις 4 πλευρές του κελιού', () => {
    // Οι insideH/insideV δίνουν κενό χωρίς καμία ειδική περίπτωση.
    const next = apply(persisted(3, 3), bounds(1, 1, 1, 1), 'all');
    expect(describeEdges(next)).toEqual([
      `H:r2:c2 ${PEN.colorHex}@0.25`,
      `V:r2:c2 ${PEN.colorHex}@0.25`,
      `V:r2:c3 ${PEN.colorHex}@0.25`,
      `H:r3:c2 ${PEN.colorHex}@0.25`,
    ]);
  });

  it('🔑 περιοχή που ακουμπά το ΤΕΛΟΣ του πίνακα γράφει `$end` χωρίς ειδική λογική', () => {
    const next = apply(persisted(2, 2), bounds(1, 1, 1, 1), 'all');
    const keys = describeEdges(next).map((s) => s.split(' ')[0]);
    expect(keys).toContain(`H:${TABLE_EDGE_END}:c2`);
    expect(keys).toContain(`V:r2:${TABLE_EDGE_END}`);
  });

  it('«Όλα» σε 2×2 γράφει 12 ακμές: 4 περιμετρικές οριζόντιες + 4 κατακόρυφες + 2 + 2 εσωτερικές', () => {
    const next = apply(persisted(3, 3), bounds(0, 1, 0, 1), 'all');
    // (rows+1)×cols οριζόντιες = 3×2 = 6 · rows×(cols+1) κατακόρυφες = 2×3 = 6
    expect(next.edges).toHaveLength(12);
  });

  it.each([
    [1, 1],
    [1, 3],
    [3, 1],
    [4, 5],
  ])('«Όλα» σε %i×%i καλύπτει ΟΛΟ το πλέγμα: (R+1)·C + R·(C+1) ακμές', (rowCount, colCount) => {
    const next = apply(
      persisted(rowCount, colCount),
      bounds(0, rowCount - 1, 0, colCount - 1),
      'all',
    );
    expect(next.edges).toHaveLength((rowCount + 1) * colCount + rowCount * (colCount + 1));
  });

  it.each([
    [1, 1],
    [1, 3],
    [3, 1],
    [4, 5],
  ])(
    '🔑 σε %i×%i οι έξι πλευρές είναι ανά δύο ΞΕΝΕΣ — καμία ακμή δεν ανήκει σε δύο',
    (rowCount, colCount) => {
      // 🔴 Η αναλλοίωτη που επιτρέπει στο μητρώο να είναι **επίπεδη λίστα σκελών χωρίς κανόνα
      // σύγκρουσης**: δύο σκέλη της ίδιας εντολής δεν μπορούν να διεκδικήσουν την ίδια ακμή.
      //
      // Ελέγχεται ΕΔΩ και όχι μέσω των εντολών, επειδή μέσω εντολών **δεν ελέγχεται**: μια
      // διπλοεγγραφή στο ίδιο κλειδί του `Map` απλώς αντικαθιστά, οπότε ούτε το πλήθος ούτε
      // το σύνολο κλειδιών αλλάζει. (Μέτρηση μετάλλαξης: με την `insideH` να φτάνει ως το
      // κάτω σύνορο, ΟΛΑ τα άλλα tests έμεναν πράσινα.) Σήμερα καμία εντολή δεν δίνει
      // διαφορετικό μολύβι σε `insideH` και `bottom`· η Φ6 θα δώσει.
      const model = persisted(rowCount, colCount);
      const b = bounds(0, rowCount - 1, 0, colCount - 1);
      const owner = new Map<string, TableBorderSide>();

      for (const side of ALL_SIDES) {
        for (const key of tableRangeSideEdges(model, b, side)) {
          expect(owner.get(key)).toBeUndefined();
          owner.set(key, side);
        }
      }
      expect(owner.size).toBe((rowCount + 1) * colCount + rowCount * (colCount + 1));
    },
  );

  it.each([
    ['top', 5],
    ['bottom', 5],
    ['left', 4],
    ['right', 4],
  ] as const)(
    'μεμονωμένη πλευρά «%s» σε περιοχή 4×5 γράφει ακριβώς %i ακμές — όσο το μήκος της',
    (id: TableBorderCommandId, expected: number) => {
      const next = apply(persisted(4, 5), bounds(0, 3, 0, 4), id);
      expect(next.edges ?? []).toHaveLength(expected);
    },
  );
});

// ── Α14: το σβήσιμο σβήνει ΚΑΙ ΜΕΝΕΙ σβηστό (Π3) ───────────────────────────

describe('🔴 Α14 — «Χωρίς περίγραμμα» εναντίον «Επαναφορά στο στυλ»', () => {
  const INTERIOR = 1;

  function interiorSegments(model: PersistedTableModel): readonly TableBorderSegment[] {
    const y = H * INTERIOR;
    return paint(model).filter((s) => s.a.y === y && s.b.y === y);
  }

  it('χωρίς καμία ρητή ακμή, η κλάση ζωγραφίζει το εσωτερικό πλέγμα', () => {
    expect(interiorSegments(persisted(2, 2))).toHaveLength(1);
  });

  it('«Χωρίς περίγραμμα» σβήνει τη γραμμή — και ΜΕΝΕΙ σβηστή μετά από round-trip (Π3)', () => {
    const erased = apply(persisted(2, 2), bounds(0, 1, 0, 1), 'none');
    expect(interiorSegments(erased)).toHaveLength(0);
    expect(interiorSegments(roundTrip(erased))).toHaveLength(0);
  });

  it('το σβήσιμο είναι ΡΗΤΗ εγγραφή, όχι απουσία — γι’ αυτό δεν ξαναζωντανεύει η κλάση', () => {
    const erased = apply(persisted(2, 2), bounds(0, 1, 0, 1), 'none');
    expect(erased.edges?.length).toBeGreaterThan(0);
    for (const [, , , spec] of erased.edges ?? []) expect(spec).toEqual(HIDDEN_TABLE_EDGE);
  });

  it('🔑 «Επαναφορά στο στυλ» διαγράφει τις εγγραφές — το πλέγμα της κλάσης ΕΠΙΣΤΡΕΦΕΙ', () => {
    const erased = apply(persisted(2, 2), bounds(0, 1, 0, 1), 'none');
    const restored = clearTableRangeBorders(erased, bounds(0, 1, 0, 1));
    expect(restored.edges).toBeUndefined();
    expect(interiorSegments(restored)).toHaveLength(1);
  });

  it('πίνακας που έμεινε χωρίς ρητές ακμές ΔΕΝ γράφει καν το πεδίο `edges`', () => {
    const restored = clearTableRangeBorders(
      apply(persisted(2, 2), bounds(0, 1, 0, 1), 'all'),
      bounds(0, 1, 0, 1),
    );
    expect(Object.keys(JSON.parse(JSON.stringify(restored)) as object)).not.toContain('edges');
  });

  it('το σβήσιμο είναι ΚΑΝΟΝΙΚΟ: δύο διαφορετικά μολύβια δίνουν την ίδια εγγραφή', () => {
    const a = apply(persisted(2, 2), bounds(0, 1, 0, 1), 'none', PEN);
    const b = apply(persisted(2, 2), bounds(0, 1, 0, 1), 'none', {
      visible: true,
      colorHex: '#00ff00',
      widthMm: 1.4,
    });
    expect(describeEdges(a)).toEqual(describeEdges(b));
  });
});

// ── Α10 στη ζωντανή μηχανή ──────────────────────────────────────────────────

describe('🔴 Α10 — «Εξωτερικά» δεν αγγίζει τις εσωτερικές', () => {
  it('η εσωτερική γραμμή μένει αυτή της κλάσης, όχι το μολύβι του χρήστη', () => {
    const next = apply(persisted(2, 2), bounds(0, 1, 0, 1), 'outside');
    const interior = paint(next).filter((s) => s.a.y === H && s.b.y === H);
    expect(interior.map((s) => s.spec.colorHex)).toEqual(['#666666']);
    expect(describeEdges(next).some((s) => s.startsWith('H:r2:'))).toBe(false);
  });

  it('ενώ το «Όλα» τη βάφει με το μολύβι του χρήστη', () => {
    const next = apply(persisted(2, 2), bounds(0, 1, 0, 1), 'all');
    const interior = paint(next).filter((s) => s.a.y === H && s.b.y === H);
    expect(interior.map((s) => s.spec.colorHex)).toEqual([PEN.colorHex]);
  });
});

// ── Το μολύβι: παχύ, βάση, δύο μολύβια σε μία εντολή ────────────────────────

describe('το μολύβι', () => {
  function bottomSpecOf(model: PersistedTableModel): TableBorderSpec | undefined {
    return model.edges?.find(([o, r]) => o === 'H' && r === TABLE_EDGE_END)?.[3];
  }

  it('🔑 «παχύ» = η επόμενη πένα ISO 128-20 (λόγος 1:2), ΠΑΡΑΓΟΜΕΝΗ από τον κατάλογο', () => {
    // Κάθε ζεύγος είναι πραγματική ομάδα γραμμών του ISO 128-20. Κανένα από αυτά τα νούμερα
    // δεν είναι γραμμένο στο `table-range-border-ops.ts` — προκύπτουν από τον κατάλογο.
    const pairs: readonly (readonly [number, number])[] = [
      [0.13, 0.25],
      [0.18, 0.35],
      [0.25, 0.5],
      [0.35, 0.7],
      [0.5, 1.0],
      [0.7, 1.4],
      [1.0, 2.0],
    ];
    for (const [thin, thick] of pairs) {
      expect(LINEWEIGHT_CONCRETE_MM_VALUES).toContain(thin);
      const next = apply(persisted(1, 1), bounds(0, 0, 0, 0), 'thickBottom', {
        ...PEN,
        widthMm: thin,
      });
      expect(bottomSpecOf(next)?.widthMm).toBe(thick);
    }
  });

  it('«παχύ» αλλάζει ΜΟΝΟ το πάχος — χρώμα και ορατότητα μένουν του χρήστη', () => {
    const next = apply(persisted(1, 1), bounds(0, 0, 0, 0), 'thickBottom');
    expect(bottomSpecOf(next)).toEqual({ visible: true, colorHex: PEN.colorHex, widthMm: 0.5 });
  });

  it('μολύβι χωρίς πάχος δεν έχει «διπλάσιο» — μένει αυτούσιο αντί να εφευρεθεί πένα', () => {
    const next = apply(persisted(1, 1), bounds(0, 0, 0, 0), 'thickBottom', {
      ...PEN,
      widthMm: 0,
    });
    expect(bottomSpecOf(next)?.widthMm).toBe(0);
  });

  it('🔑 «Επάνω και παχύ κάτω» βάζει ΔΥΟ διαφορετικά μολύβια σε μία εντολή', () => {
    const next = apply(persisted(2, 1), bounds(0, 1, 0, 0), 'topAndThickBottom');
    expect(describeEdges(next)).toEqual([
      `H:r1:c1 ${PEN.colorHex}@0.25`,
      `H:${TABLE_EDGE_END}:c1 ${PEN.colorHex}@0.5`,
    ]);
  });
});

// ── Α17 → Α24: η διπλή γραμμή, από την εντολή ως τα τμήματα που ζωγραφίζονται ──

describe('✅ Α24 — η διπλή γραμμή έπαψε να είναι τρύπα (Φ5)', () => {
  it('«Επάνω και διπλό κάτω» γράφει ΚΑΙ τα δύο σκέλη', () => {
    // Μέχρι τη Φ5 αυτή η εντολή επέστρεφε το μοντέλο αυτούσιο («όλα ή τίποτα» της Α17, όπου
    // στην πράξη ίσχυε πάντα το «τίποτα»).
    const model = persisted(2, 2);
    const next = apply(model, bounds(0, 1, 0, 1), 'topAndDoubleBottom');
    expect(next).not.toBe(model);
    const doubles = (next.edges ?? []).filter(([, , , s]) => s.doubleGapMm !== undefined);
    const singles = (next.edges ?? []).filter(([, , , s]) => s.doubleGapMm === undefined);
    expect(doubles.length).toBeGreaterThan(0);
    expect(singles.length).toBeGreaterThan(0);
  });

  it('🔑 η ΔΙΑΤΑΞΗ βγάζει δύο παράλληλα τμήματα — ο ζωγράφος δεν μαθαίνει τη λέξη «διπλή»', () => {
    // Η απόδειξη που μετράει: όχι «το πεδίο γράφτηκε» αλλά «δύο γραμμές θα φανούν», μέσω της
    // ίδιας διαδρομής που τροφοδοτεί καμβά / PDF / DXF.
    const next = apply(persisted(2, 2), bounds(1, 1, 0, 1), 'doubleBottom');
    const mine = paint(next).filter((s) => s.spec.colorHex === PEN.colorHex);

    expect(mine).toHaveLength(2);
    // Καμία δεν κουβαλά πια το πεδίο: τα τέσσερα backends βλέπουν συνηθισμένες γραμμές.
    for (const segment of mine) expect(segment.spec.doubleGapMm).toBeUndefined();

    // Συμμετρικά εκατέρωθεν της ακμής (y = 2 γραμμές × 6 mm = 12), κατά ±μισή απόσταση.
    const half = (PEN.widthMm * 3) / 2;
    expect(mine.map((s) => s.a.y).sort((p, q) => p - q)).toEqual([12 - half, 12 + half]);
    // …και ταυτόσημες κατά μήκος: ίδιο ξεκίνημα και ίδιο τέλος στον άξονα x.
    for (const segment of mine) {
      expect(segment.a.y).toBe(segment.b.y);
      expect([segment.a.x, segment.b.x]).toEqual([0, 2 * W]);
    }
  });

  it('🔑 η ΚΑΤΑΚΟΡΥΦΗ διπλή μετατοπίζεται κατά x, όχι κατά y', () => {
    // Ο προσανατολισμός έρχεται από τον παραγωγό, όχι από εικασία πάνω στη γεωμετρία.
    const next = apply(persisted(2, 2), bounds(0, 1, 0, 0), 'doubleBottom');
    expect(paint(next).filter((s) => s.spec.colorHex === PEN.colorHex)).toHaveLength(2);

    const withLeft = apply(persisted(2, 2), bounds(0, 1, 0, 0), 'left', {
      ...PEN,
      doubleGapMm: 1,
    });
    const mine = paint(withLeft).filter((s) => s.spec.colorHex === PEN.colorHex);
    expect(mine).toHaveLength(2);
    expect(mine.map((s) => s.a.x).sort((p, q) => p - q)).toEqual([-0.5, 0.5]);
    for (const segment of mine) expect(segment.a.x).toBe(segment.b.x);
  });

  it('🔴 μονή και διπλή με ίδιο χρώμα/πένα ΔΕΝ ενώνονται σε ένα τμήμα', () => {
    // Χωρίς το `doubleGapMm` μέσα στο `sameBorderSpec`, η ένωση (που τρέχει ΠΡΙΝ την
    // αποσύνθεση) θα κατάπινε τη διπλή στη μισή διαδρομή — και το αποτέλεσμα θα ήταν ακόμη
    // μια απολύτως νόμιμη γραμμή, δηλαδή σιωπηλή απώλεια.
    let model = apply(persisted(1, 2), bounds(0, 0, 0, 0), 'doubleBottom');
    model = apply(model, bounds(0, 0, 1, 1), 'bottom');
    const mine = paint(model).filter((s) => s.spec.colorHex === PEN.colorHex);
    // 2 (η διπλή στην πρώτη στήλη) + 1 (η μονή στη δεύτερη) = 3, ποτέ 1.
    expect(mine).toHaveLength(3);
  });
});

// ── Ταυτότητα αντικειμένου: η εγγύηση της μνήμης και του undo ───────────────

describe('🔴 ταυτότητα by-reference — η αλυσίδα των WeakMap και το ιστορικό', () => {
  it('ίδιο μολύβι δεύτερη φορά ⇒ ΤΟ ΙΔΙΟ αντικείμενο (κανένα βήμα undo)', () => {
    const once = apply(persisted(3, 3), bounds(0, 2, 0, 2), 'all');
    const twice = apply(once, bounds(0, 2, 0, 2), 'all');
    expect(twice).toBe(once);
  });

  it('διαφορετικό μολύβι ⇒ ΝΕΟ αντικείμενο (αλλιώς η μορφοποίηση δεν φαίνεται ποτέ)', () => {
    const once = apply(persisted(3, 3), bounds(0, 2, 0, 2), 'all');
    const twice = apply(once, bounds(0, 2, 0, 2), 'all', { ...PEN, colorHex: '#0000ff' });
    expect(twice).not.toBe(once);
    expect(paint(twice)[0].spec.colorHex).not.toBe(paint(once)[0].spec.colorHex);
  });

  it('«Επαναφορά στο στυλ» σε περιοχή που δεν έχει τίποτα ρητό ⇒ το ίδιο αντικείμενο', () => {
    const model = persisted(3, 3);
    expect(clearTableRangeBorders(model, bounds(0, 2, 0, 2))).toBe(model);
  });
});

// ── Σειρά: μία ταξινόμηση, ό,τι κι αν έγινε πρώτο ──────────────────────────

describe('η σειρά των ακμών μένει ΜΙΑ — ανεξάρτητα από τη σειρά των εντολών', () => {
  it('δύο διαφορετικές διαδρομές στο ίδιο αποτέλεσμα δίνουν ταυτόσημο JSON', () => {
    const b = bounds(0, 1, 0, 1);
    const inOneGo = apply(persisted(2, 2), b, 'all');

    // Η ανάποδη διαδρομή: πρώτα το κάτω, μετά τα υπόλοιπα.
    let stepwise = persisted(2, 2);
    stepwise = apply(stepwise, b, 'bottom');
    stepwise = apply(stepwise, b, 'right');
    stepwise = apply(stepwise, b, 'all');

    expect(JSON.stringify(stepwise.edges)).toBe(JSON.stringify(inOneGo.edges));
  });
});

// ── Α16: συγχώνευση — η δομή αποφασίζει τι φαίνεται, η μορφοποίηση επιβιώνει ──

describe('🔴 Α16 — συγχώνευση: γράφονται όλες οι ακμές, η δομή κρύβει ό,τι δεν υπάρχει', () => {
  const MERGE: readonly CellSpan[] = [
    { anchorRowId: 'r1', anchorColId: 'c1', rowSpan: 2, colSpan: 2 },
  ];

  it('η εσωτερική ακμή της συγχώνευσης ΔΕΝ ζωγραφίζεται, παρότι γράφτηκε ρητά', () => {
    const merged = apply(persisted(2, 2, MERGE), bounds(0, 1, 0, 1), 'all');
    const interiorH = paint(merged).filter((s) => s.a.y === H && s.b.y === H);
    expect(interiorH).toHaveLength(0);
    // …αλλά η εγγραφή υπάρχει: η μορφοποίηση δεν χάθηκε, απλώς δεν έχει πού να φανεί.
    expect(describeEdges(merged).some((s) => s.startsWith('H:r2:c1'))).toBe(true);
  });

  it('🔑 όταν λυθεί η συγχώνευση, η γραμμή που ζήτησε ο χρήστης ΕΜΦΑΝΙΖΕΤΑΙ', () => {
    // Αυτό ΕΙΝΑΙ η απόφαση Α16: δομή και μορφοποίηση είναι ορθογώνιες. «Όλα τα περιγράμματα»
    // σημαίνει «θέλω πλήρες πλέγμα εδώ»· η αποσυγχώνευση αποκαθιστά ό,τι ζητήθηκε, δεν
    // αφήνει τρύπα. Το Excel καταλήγει στο ίδιο αποτέλεσμα — εδώ είναι σχεδιασμένο.
    const merged = apply(persisted(2, 2, MERGE), bounds(0, 1, 0, 1), 'all');
    const unmerged: PersistedTableModel = { ...merged, merges: [] };
    const interiorH = paint(unmerged).filter((s) => s.a.y === H && s.b.y === H);
    expect(interiorH).toHaveLength(1);
    expect(interiorH[0].spec.colorHex).toBe(PEN.colorHex);
  });

  it('συμμετρικά: «Χωρίς περίγραμμα» σε συγχώνευση μένει σβηστό και μετά την αποσυγχώνευση', () => {
    const merged = apply(persisted(2, 2, MERGE), bounds(0, 1, 0, 1), 'none');
    const unmerged: PersistedTableModel = { ...merged, merges: [] };
    expect(paint(unmerged).filter((s) => s.a.y === H && s.b.y === H)).toHaveLength(0);
  });
});

// ── Μπαγιάτικα όρια: ο πίνακας δεν χάνεται ─────────────────────────────────

describe('ανοχή — μπαγιάτικα όρια δεν ρίχνουν τον πίνακα', () => {
  it('όρια εκτός πλέγματος γράφουν μόνο ό,τι υπάρχει', () => {
    const next = apply(persisted(2, 2), bounds(0, 9, 0, 9), 'all');
    // Καμία ακμή δεν αγκυρώνεται σε ανύπαρκτη γραμμή/στήλη.
    for (const [, rowAnchor, colAnchor] of next.edges ?? []) {
      expect(['r1', 'r2', TABLE_EDGE_END]).toContain(rowAnchor);
      expect(['c1', 'c2', TABLE_EDGE_END]).toContain(colAnchor);
    }
    expect(() => paint(next)).not.toThrow();
  });

  it('άγνωστη ταυτότητα εντολής αφήνει το μοντέλο ΑΥΤΟΥΣΙΟ', () => {
    const model = persisted(2, 2);
    const unknown = 'σχεδίασηΠλέγματος' as TableBorderCommandId;
    expect(applyTableBorderCommand(model, bounds(0, 1, 0, 1), unknown, PEN)).toBe(model);
  });
});

// ── Φ3: έχει η περιοχή τι να επαναφέρει; ───────────────────────────────────

describe('ADR-750 Φ3 — `hasExplicitTableRangeBorders`, το «canReset» της περιοχής', () => {
  it('καθαρός πίνακας: κανένα κουμπί επαναφοράς δεν έχει νόημα', () => {
    expect(hasExplicitTableRangeBorders(persisted(3, 3), bounds(0, 2, 0, 2))).toBe(false);
  });

  it('βλέπει ρητή ακμή που γράφτηκε από εντολή', () => {
    const next = apply(persisted(3, 3), bounds(1, 1, 1, 1), 'all');
    expect(hasExplicitTableRangeBorders(next, bounds(1, 1, 1, 1))).toBe(true);
  });

  it('🔴 ΔΕΝ βλέπει ακμή που ανήκει σε ΑΛΛΗ περιοχή — αλλιώς θα υποσχόταν ψέματα', () => {
    // Η επαναφορά διαγράφει τις ακμές **της περιοχής**. Ένα «ναι» επειδή κάπου αλλού στον
    // πίνακα υπάρχει ρητή ακμή θα έδινε ενεργό κουμπί που δεν αλλάζει τίποτα.
    const next = apply(persisted(4, 4), bounds(0, 0, 0, 0), 'all');
    expect(hasExplicitTableRangeBorders(next, bounds(2, 3, 2, 3))).toBe(false);
  });

  it('«Χωρίς περίγραμμα» ΜΕΤΡΑΕΙ ως ρητή — είναι μολύβι, όχι απουσία (Α14)', () => {
    const next = apply(persisted(3, 3), bounds(1, 1, 1, 1), 'none');
    expect(hasExplicitTableRangeBorders(next, bounds(1, 1, 1, 1))).toBe(true);
  });

  it('μετά την επαναφορά ξαναγίνεται `false` — ο κύκλος κλείνει', () => {
    const painted = apply(persisted(3, 3), bounds(0, 2, 0, 2), 'all');
    const cleared = clearTableRangeBorders(painted, bounds(0, 2, 0, 2));
    expect(hasExplicitTableRangeBorders(cleared, bounds(0, 2, 0, 2))).toBe(false);
  });

  it('επιβιώνει του ταξιδιού στο αρχείο', () => {
    const next = roundTrip(apply(persisted(3, 3), bounds(1, 2, 1, 2), 'outside'));
    expect(hasExplicitTableRangeBorders(next, bounds(1, 2, 1, 2))).toBe(true);
  });
});
