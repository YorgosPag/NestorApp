/**
 * Άγκυρες για το `table-worksheet-menu-state` — ADR-833 Φάση 4, **εξαγμένο στη Φάση 5Β**.
 *
 * Η ερώτηση που φυλάνε: **«δείχνει το μενού ενεργό ό,τι ο σχεδιαστής αρνείται;»**
 *
 * Οι σημαίες δεν επαναδιατυπώνουν κανέναν κανόνα — ρωτούν τους **ίδιους** σχεδιαστές που θα
 * εκτελέσουν τις πράξεις. Γι' αυτό η άγκυρα δεν συγκρίνει με χειρόγραφους κανόνες αλλά με τη
 * **συμπεριφορά** των σχεδιαστών: μια δεύτερη διατύπωση εδώ θα ήταν η πρώτη ευκαιρία το μενού
 * να προσφέρει το αδύνατο.
 *
 * @see ../table-worksheet-menu-state.ts
 */

import { worksheetMenuState } from '../table-worksheet-menu-state';
import { newWorksheetModel, planWorksheetAdd } from '../table-worksheet-ops';
import { buildTableModel } from '../build-table-entity';
import { makeTableEntity, tableWorksheetsFields } from './make-table-entity';
import { tableWorksheetId } from '../../../types/table-worksheet';
import { createTableModel, toPersistedTableModel } from '../table-model-helpers';
import type { TableEntity } from '../../../types/table-entity';
import type { TableCell, TableCellStyleOverride } from '../../../types/table';

/** Πίνακας με `count` φύλλα (`ws0…`), ενεργό το `activeIndex`. */
function book(count: number, activeIndex = 0): TableEntity {
  const models = Array.from({ length: count }, () => buildTableModel({ columnCount: 2, dataRowCount: 1 }));
  return { ...makeTableEntity(), ...tableWorksheetsFields(models, activeIndex) };
}

const ID = (index: number) => tableWorksheetId(`ws${index}`);

/** Η μορφοποίηση ενός **τυπικού** κελιού μετά τη Φάση 6 — το κελί που κοστίζει 198 bytes. */
const TYPICAL_FORMAT: TableCellStyleOverride = {
  numberFormat: { kind: 'decimal', decimals: 2, grouping: true },
  textHeightMm: 3.88,
  textColorHex: '#1E293B',
  bold: true,
  align: 'MR',
};

/** Πίνακας με `count` **βαριά** φύλλα — το βιβλίο που έχει εξαντλήσει το μερίδιό του. */
function heavyBook(count: number): TableEntity {
  const values = ['Δοκός Δ1', 'Κ12', '4Ø20'];
  const models = Array.from({ length: count }, () => toPersistedTableModel(createTableModel({
    columns: Array.from({ length: 30_000 }, (_, i) => ({
      id: `c${i}`,
      sizing: { kind: 'fixed' as const, widthMm: 40 },
      valueType: 'text' as const,
      align: 'left' as const,
    })),
    rows: [{ id: 'r0', rowClass: 'data' as const }],
    cells: Array.from({ length: 30_000 }, (_, i) => [
      'r0',
      `c${i}`,
      { kind: 'text', value: values[i % values.length], styleOverride: TYPICAL_FORMAT } as TableCell,
    ] as const),
    merges: [],
  })));
  return { ...makeTableEntity(), ...tableWorksheetsFields(models, 0) };
}

describe('worksheetMenuState — οι σημαίες ρωτούν τους ΙΔΙΟΥΣ σχεδιαστές', () => {
  it('μοναδικό φύλλο: τίποτα δεν επιτρέπεται', () => {
    expect(worksheetMenuState(book(1), ID(0))).toEqual({
      index: 0,
      // 🔴 ADR-833 Φ5Β — «τίποτα» ΕΚΤΟΣ από την προσθήκη: ένας πίνακας με ένα μικρό φύλλο
      // έχει άφθονο μερίδιο εγγράφου. Η σημαία απαντά για τη **χωρητικότητα**, όχι για τη
      // θέση του στόχου — γι' αυτό είναι η μόνη που μένει `true` εδώ.
      canAdd: true,
      canDelete: false,
      canMoveLeft: false,
      canMoveRight: false,
    });
  });

  it('πρώτο από τρία: όχι αριστερά, ναι δεξιά, ναι διαγραφή', () => {
    expect(worksheetMenuState(book(3), ID(0))).toEqual({
      index: 0,
      canAdd: true,
      canDelete: true,
      canMoveLeft: false,
      canMoveRight: true,
    });
  });

  it('τελευταίο από τρία: ναι αριστερά, όχι δεξιά', () => {
    expect(worksheetMenuState(book(3), ID(2))).toMatchObject({
      index: 2,
      canMoveLeft: true,
      canMoveRight: false,
    });
  });

  it('άγνωστος στόχος ⇒ null (το μενού δεν ανοίγει σε φάντασμα)', () => {
    expect(worksheetMenuState(book(3), tableWorksheetId('ws9'))).toBeNull();
  });

  it('🔴 ADR-833 Φ5Β — η σημαία `canAdd` ρωτά τον ΙΔΙΟ σχεδιαστή, όχι δεύτερο κανόνα', () => {
    // Ο κριτής είναι η **συμπεριφορά** του σχεδιαστή, όχι αντιγραμμένος κανόνας: αν κάποιος
    // αλλάξει τον φύλακα χωρητικότητας μέσα στο `planWorksheetAdd`, το μενού οφείλει να τον
    // ακολουθήσει χωρίς να αγγιχτεί αυτό το αρχείο. (§5.7.6, δεύτερο μάθημα: κριτής που
    // αντιγράφει τον ελεγχόμενο δεν μπορεί να κοκκινίσει.)
    const entity = book(3);
    const state = worksheetMenuState(entity, ID(1));
    expect(state?.canAdd).toBe(planWorksheetAdd(entity, newWorksheetModel(entity)) !== null);
  });

  it('🔴 ΓΕΜΑΤΟΣ πίνακας ⇒ `canAdd: false` — το παράνομο ΔΕΝ προσφέρεται (σχολή Excel)', () => {
    // ⚠️ Η προηγούμενη άγκυρα **δεν αρκούσε**: με άφθονο μερίδιο, και το `true` και ο
    // σχεδιαστής συμφωνούν, οπότε η μετάλλαξη «`canAdd: true` πάντα» έμενε πράσινη (M34,
    // κενό αγκύρωσης — §5.7.6 τρίτο μάθημα). Ο μόνος τρόπος να κοκκινίσει είναι βιβλίο που
    // **όντως** δεν χωρά άλλο φύλλο.
    expect(worksheetMenuState(heavyBook(6), ID(0))?.canAdd).toBe(false);
  }, 60_000);
});
