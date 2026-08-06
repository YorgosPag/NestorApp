/**
 * 🔴 ADR-739 §55 — **ο κοινός builder των τριών νέων τμημάτων**: μία κατάσταση, ΕΝΑΣ γραφέας.
 *
 * Το ερώτημα εδώ δεν είναι «ζωγραφίζονται;» (το απαντά το `table-format-toolbar-rows.test.tsx`)
 * αλλά το ένα που **καμία** από τις δύο υποδοχές δεν μπορεί να ρωτήσει μόνη της: **ποιο κλειδί
 * γράφει το κάθε χειριστήριο**. Είναι ακριβώς το είδος σφάλματος που δεν κοκκινίζει πουθενά —
 * το combobox γραμματοσειράς γράφοντας `textHeightMm` δείχνει «δούλεψε» και αλλάζει το λάθος
 * πράγμα — και που θα ζούσε **δύο** φορές αν κάθε μενού έχτιζε μόνο του τα props.
 *
 * @see ui/components/table-format-toolbar/table-toolbar-extras.ts
 */

import { tableToolbarExtrasProps, type TableToolbarExtrasState } from '../table-toolbar-extras';
import type { TableAxisStyleOverride } from '../../../../types/table';

const STATE: TableToolbarExtrasState = {
  fonts: {
    family: { current: 'Arial', mixed: false },
    size: { current: 2.5, mixed: false },
  },
  fontNames: ['Arial', 'ISOCPEUR'],
  numberFormat: { current: { kind: 'percent', decimals: 0 }, explicit: true },
  align: 'ML',
};

/** Καταγράφει ζεύγη «κλειδί → τιμή» — ο ένας γραφέας, όπως τον βλέπει η γραμμή. */
function recorder() {
  const writes: { key: string; value: unknown }[] = [];
  const setField = <K extends keyof TableAxisStyleOverride>(
    key: K,
    value: TableAxisStyleOverride[K] | undefined,
  ): void => { writes.push({ key, value }); };
  return { writes, props: tableToolbarExtrasProps(STATE, setField) };
}

describe('η κατάσταση ταξιδεύει αυτούσια στα τρία τμήματα', () => {
  it('η γραμματοσειρά παίρνει ΚΑΙ την κατάσταση ΚΑΙ τη λίστα επιλογών', () => {
    const { props } = recorder();
    expect(props.fonts.state).toBe(STATE.fonts);
    expect(props.fonts.fonts).toEqual(['Arial', 'ISOCPEUR']);
  });

  it('αριθμητική μορφή και στοίχιση περνούν χωρίς μεταφραστή στη μέση', () => {
    const { props } = recorder();
    expect(props.numberFormat.state).toBe(STATE.numberFormat);
    expect(props.align.current).toBe('ML');
  });
});

describe('🔴 ΚΑΘΕ χειριστήριο γράφει ΤΟ ΔΙΚΟ ΤΟΥ κλειδί — ο έλεγχος που δεν κάνει κανείς άλλος', () => {
  it('γραμματοσειρά ⇒ `fontFamily` (και η «Αυτόματη» περνά ως `undefined`)', () => {
    const { writes, props } = recorder();
    props.fonts.onSetFontFamily('ISOCPEUR');
    props.fonts.onSetFontFamily(undefined);
    expect(writes).toEqual([
      { key: 'fontFamily', value: 'ISOCPEUR' },
      { key: 'fontFamily', value: undefined },
    ]);
  });

  it('μέγεθος ⇒ `textHeightMm`, πάντα ρητή τιμή από τη σκάλα', () => {
    const { writes, props } = recorder();
    props.fonts.onSetTextHeightMm(3.5);
    expect(writes).toEqual([{ key: 'textHeightMm', value: 3.5 }]);
  });

  it('μορφή αριθμού ⇒ `numberFormat` (και το ξεπάτημα ως `undefined` = κληρονομιά)', () => {
    const { writes, props } = recorder();
    props.numberFormat.onSetNumberFormat({ kind: 'whole' });
    props.numberFormat.onSetNumberFormat(undefined);
    expect(writes).toEqual([
      { key: 'numberFormat', value: { kind: 'whole' } },
      { key: 'numberFormat', value: undefined },
    ]);
  });

  it('στοίχιση ⇒ `align`, με τη σύνθετη τιμή των εννιά θέσεων', () => {
    const { writes, props } = recorder();
    props.align.onSetAlign('TR');
    expect(writes).toEqual([{ key: 'align', value: 'TR' }]);
  });
});
