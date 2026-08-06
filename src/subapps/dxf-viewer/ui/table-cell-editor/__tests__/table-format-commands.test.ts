/**
 * 🔴 ADR-739 §52 — **οι πέντε εντολές μορφοποίησης**, κοινές σε τρεις επιφάνειες.
 *
 * Το ερώτημα εδώ **δεν** είναι αν γράφει σωστά ο κάθε γραφέας (το απαντά το
 * `table-format-scope.test.ts`). Είναι δύο άλλα, που καμία από τις τρεις επιφάνειες δεν
 * μπορεί να ελέγξει μόνη της:
 *
 *  1. **Η κατάσταση διαβάζεται ΜΕΣΑ στη μεταβολή**, πάνω στο μοντέλο που θα γραφτεί — όχι από
 *     ένα `FormatTarget` φτιαγμένο λίγο νωρίτερα. Ανάμεσα στα δύο μπορεί να έχει τρέξει
 *     `Ctrl+Z` από συντόμευση, και τότε το «Β» θα αποφάσιζε με **παλιά** δεδομένα.
 *  2. **Χωρίς στόχο, καμία εντολή δεν γράφει.** Πέντε φορές ο ίδιος έλεγχος στον καλούντα θα
 *     ήταν πέντε ευκαιρίες να ξεχαστεί — και το σύμπτωμα («γράφτηκε σε κελιά που δεν υπάρχουν
 *     πια») δεν δείχνει ποτέ προς την αιτία.
 *
 * @see ui/table-cell-editor/table-format-commands.ts
 */

import {
  tableFormatCommands,
  type TableFormatCommandTarget,
} from '../table-format-commands';
import {
  resolveTableFormatState,
  setTableFormatField,
  type TableFormatScope,
} from '../../../bim/table/table-format-scope';
import { hierarchicalTableStyle } from '../../../bim/table/__tests__/hierarchical-table-style-fixture';
import type { PersistedTableModel } from '../../../types/table';

const STYLE = hierarchicalTableStyle();

function model(): PersistedTableModel {
  return {
    columns: [
      { id: 'c0', sizing: { kind: 'hug' }, valueType: 'text', align: 'left' },
      { id: 'c1', sizing: { kind: 'hug' }, valueType: 'text', align: 'left' },
    ],
    rows: [
      { id: 'r0', rowClass: 'header' },
      { id: 'r1', rowClass: 'data' },
      { id: 'r2', rowClass: 'data' },
    ],
    cells: [],
    merges: [],
  };
}

/** Δύο κελιά δεδομένων της ίδιας στήλης — ομοιόμορφα, εκτός αν τα βάψουμε αλλιώς. */
const RANGE: TableFormatScope = {
  kind: 'range',
  bounds: { firstRow: 1, lastRow: 2, firstCol: 0, lastCol: 0 },
};
const CELL_R1: TableFormatScope = {
  kind: 'range',
  bounds: { firstRow: 1, lastRow: 1, firstCol: 0, lastCol: 0 },
};

const target = (scope: TableFormatScope): TableFormatCommandTarget => ({ style: STYLE, scope });

/** Δεσμευτής που κρατά το τρέχον μοντέλο — το ίδιο συμβόλαιο με το `useLiveTableMutation`. */
function liveApply(initial: PersistedTableModel) {
  const state = { model: initial, writes: 0 };
  const apply = (mutate: (m: PersistedTableModel) => PersistedTableModel): void => {
    const next = mutate(state.model);
    // Η **ίδια** εγγύηση με τον πραγματικό δεσμευτή: ταυτότητα by-reference ⇒ καμία εντολή,
    // κανένα βήμα undo. Χωρίς αυτήν, το test δεν θα ξεχώριζε «no-op» από «γράφτηκε το ίδιο».
    if (next === state.model) return;
    state.model = next;
    state.writes += 1;
  };
  return { state, apply };
}

const boldAt = (m: PersistedTableModel, scope: TableFormatScope): boolean | undefined =>
  resolveTableFormatState(m, STYLE, scope, 'bold')?.value;

describe('toggle — ο κανόνας «μεικτό ⇒ όλα ναι» ζει ΕΔΩ, όχι στον καλούντα', () => {
  it('ομοιόμορφα όχι-έντονα ⇒ γίνονται έντονα', () => {
    const { state, apply } = liveApply(model());
    tableFormatCommands(apply).toggle(target(RANGE), 'bold');
    expect(boldAt(state.model, RANGE)).toBe(true);
  });

  it('ομοιόμορφα έντονα ⇒ σβήνουν', () => {
    const { state, apply } = liveApply(setTableFormatField(model(), RANGE, 'bold', true));
    tableFormatCommands(apply).toggle(target(RANGE), 'bold');
    expect(boldAt(state.model, RANGE)).toBe(false);
  });

  it('🔴 ΜΕΙΚΤΟ ⇒ ΟΛΑ ναι — η μόνη επιλογή με ορατή αλλαγή σε κάθε κελί', () => {
    // Ένα «όλα όχι» θα άφηνε το μισό σύνολο φαινομενικά αμετάβλητο, δηλαδή το κουμπί θα
    // φαινόταν να μην κάνει τίποτα ακριβώς εκεί που ο χρήστης κοιτούσε.
    const mixed = setTableFormatField(model(), CELL_R1, 'bold', true);
    const { state, apply } = liveApply(mixed);
    tableFormatCommands(apply).toggle(target(RANGE), 'bold');
    expect(boldAt(state.model, RANGE)).toBe(true);
  });

  it('🔴 η κατάσταση διαβάζεται ΜΕΣΑ στη μεταβολή — δύο πατήματα εναλλάσσουν σωστά', () => {
    // Αν το `nextBooleanFormat` διάβαζε από παγωμένο στιγμιότυπο, το **δεύτερο** πάτημα θα
    // αποφάσιζε με την κατάσταση **πριν** το πρώτο και θα ξανάγραφε `true` — δηλαδή το κουμπί
    // θα κολλούσε αναμμένο.
    const { state, apply } = liveApply(model());
    const commands = tableFormatCommands(apply);
    commands.toggle(target(RANGE), 'bold');
    commands.toggle(target(RANGE), 'bold');
    expect(boldAt(state.model, RANGE)).toBe(false);
    expect(state.writes).toBe(2);
  });
});

describe('setField / reset / stepSize — καθαρή διαβίβαση στον σωστό γραφέα', () => {
  it('setField γράφει και τις τρεις καταστάσεις (τιμή / ρητά κανένα / αφαίρεση)', () => {
    const { state, apply } = liveApply(model());
    const commands = tableFormatCommands(apply);

    commands.setField(target(RANGE), 'fillColorHex', '#ff0000');
    expect(resolveTableFormatState(state.model, STYLE, RANGE, 'fillColorHex')?.value).toBe('#ff0000');

    commands.setField(target(RANGE), 'fillColorHex', null);
    expect(resolveTableFormatState(state.model, STYLE, RANGE, 'fillColorHex')?.value).toBeUndefined();

    // Αφαίρεση ⇒ πίσω στην κληρονομιά, και **όχι** «ρητά κανένα»: η ένδειξη το ξεχωρίζει.
    commands.setField(target(RANGE), 'fillColorHex', undefined);
    expect(resolveTableFormatState(state.model, STYLE, RANGE, 'fillColorHex')?.overridden).toBe(false);
  });

  it('reset σβήνει τη ρητή μορφοποίηση των κελιών', () => {
    const { state, apply } = liveApply(setTableFormatField(model(), RANGE, 'bold', true));
    tableFormatCommands(apply).reset(target(RANGE));
    expect(resolveTableFormatState(state.model, STYLE, RANGE, 'bold')?.overridden).toBe(false);
  });

  it('stepSize γράφει μία φορά και προς τη σωστή κατεύθυνση', () => {
    const { state, apply } = liveApply(setTableFormatField(model(), RANGE, 'textHeightMm', 2.5));
    tableFormatCommands(apply).stepSize(target(RANGE), 1);
    expect(resolveTableFormatState(state.model, STYLE, RANGE, 'textHeightMm')?.value).toBe(2.8);
    expect(state.writes).toBe(1);
  });
});

describe('🔴 Χωρίς στόχο — ΚΑΜΙΑ από τις πέντε δεν γράφει', () => {
  it('όλες οι εντολές είναι no-op με `null` (undo έσβησε τη γραμμή)', () => {
    // Ο έλεγχος ζει **μέσα** στις εντολές ώστε καμία από τις τρεις επιφάνειες να μη χρειάζεται
    // να τον γράψει — και άρα να μην μπορεί να τον ξεχάσει.
    const { state, apply } = liveApply(model());
    const commands = tableFormatCommands(apply);
    commands.toggle(null, 'bold');
    commands.setField(null, 'textColorHex', '#000000');
    commands.stepSize(null, 1);
    commands.reset(null);
    expect(state.writes).toBe(0);
  });
});
