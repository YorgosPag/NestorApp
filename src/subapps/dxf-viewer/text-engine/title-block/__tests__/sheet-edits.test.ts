/**
 * ADR-651 Φάση Ι — μαζική επεξεργασία φύλλων: η σειρά προτεραιότητας (pending → persisted →
 * αυτόματο), οι καθαρές μαζικές πράξεις, και το ΤΙ γράφεται όντως στους ορόφους.
 */

import type { Level } from '../../../systems/levels/config';
import type { SceneModel } from '../../../types/entities';
import {
  autoNumberSheets,
  mergeSheetEdits,
  renumberSheets,
  sheetLevelUpdates,
} from '../sheet-edits';
import {
  buildSheetRows,
  buildSheetSet,
  resolveSheetIdentity,
  type SheetSetSource,
} from '../sheet-set';

const SCENE = { entities: [] } as unknown as SceneModel;

function level(overrides: Partial<Level>): Level {
  return { id: 'lvl', name: 'Επίπεδο', order: 0, isDefault: false, visible: true, ...overrides };
}

function source(overrides: Partial<Level>): SheetSetSource {
  return { level: level(overrides), scene: SCENE };
}

const SOURCES: readonly SheetSetSource[] = [
  source({ id: 'a', name: 'Ισόγειο' }),
  source({ id: 'b', name: 'Α΄ Όροφος' }),
  source({ id: 'c', name: 'Β΄ Όροφος' }),
];

const ROWS = buildSheetRows(SOURCES, { locale: 'el' });

describe('resolveSheetIdentity — pending → persisted → αυτόματο', () => {
  it('χωρίς τίποτα: αριθμός από τη ΘΕΣΗ, τίτλος από το όνομα ορόφου', () => {
    expect(resolveSheetIdentity(level({ name: 'Ισόγειο' }), 0, 'Α')).toEqual({
      sheetNumber: 'Α-1',
      title: 'Ισόγειο',
    });
  });

  it('persisted override υπερισχύει του αυτόματου (Revit Sheet Number / ArchiCAD custom ID)', () => {
    const stored = level({ name: 'Ισόγειο', entityLabel: 'Κάτοψη Ισογείου', sheetNumberOverride: 'ΑΡΧ-05' });
    expect(resolveSheetIdentity(stored, 0, 'Α')).toEqual({
      sheetNumber: 'ΑΡΧ-05',
      title: 'Κάτοψη Ισογείου',
    });
  });

  it('pending edit υπερισχύει του persisted (ό,τι βλέπει ο χρήστης = ό,τι τυπώνεται)', () => {
    const stored = level({ name: 'Ισόγειο', entityLabel: 'Παλιός', sheetNumberOverride: 'ΑΡΧ-05' });
    expect(resolveSheetIdentity(stored, 0, 'Α', { sheetNumber: 'Α-9', title: 'Νέος' })).toEqual({
      sheetNumber: 'Α-9',
      title: 'Νέος',
    });
  });

  it('ΣΒΗΣΜΕΝΟ πεδίο = «αυτόματο», ΟΧΙ «κράτα το παλιό» (αλλιώς δεν σβήνεται ποτέ override)', () => {
    const stored = level({ name: 'Ισόγειο', entityLabel: 'Παλιός', sheetNumberOverride: 'ΑΡΧ-05' });
    expect(resolveSheetIdentity(stored, 2, 'Α', { sheetNumber: '  ', title: '' })).toEqual({
      sheetNumber: 'Α-3', // πίσω στη ΘΕΣΗ, όχι στο ΑΡΧ-05
      title: 'Ισόγειο', // πίσω στο όνομα ορόφου, όχι στο «Παλιός»
    });
  });

  it('πεδίο που ΔΕΝ αγγίχτηκε (undefined) κρατά το persisted — δεν το σβήνει η επεξεργασία του άλλου', () => {
    const stored = level({ name: 'Ισόγειο', entityLabel: 'Κάτοψη', sheetNumberOverride: 'ΑΡΧ-05' });
    expect(resolveSheetIdentity(stored, 0, 'Α', { title: 'Νέα κάτοψη' })).toEqual({
      sheetNumber: 'ΑΡΧ-05',
      title: 'Νέα κάτοψη',
    });
  });
});

describe('buildSheetSet με pending edits (το PDF τυπώνει ό,τι είδε ο χρήστης)', () => {
  it('εφαρμόζει τα edits ανά levelId, αφήνοντας τα υπόλοιπα φύλλα αυτόματα', () => {
    const { sheets } = buildSheetSet(SOURCES, {
      locale: 'el',
      edits: { b: { sheetNumber: 'Α-20', title: 'Τυπικός Όροφος' } },
    });
    expect(sheets.map((s) => s.sheetNumber)).toEqual(['Α-1', 'Α-20', 'Α-3']);
    expect(sheets.map((s) => s.title)).toEqual(['Ισόγειο', 'Τυπικός Όροφος', 'Β΄ Όροφος']);
  });

  it('edit σε ΑΝΥΠΑΡΚΤΟ φύλλο αγνοείται (ποτέ crash)', () => {
    const { sheets } = buildSheetSet(SOURCES, {
      locale: 'el',
      edits: { 'ghost-level': { sheetNumber: 'Χ-1' } },
    });
    expect(sheets.map((s) => s.sheetNumber)).toEqual(['Α-1', 'Α-2', 'Α-3']);
  });

  it('κενά edits ⇒ ίδιο σετ με καθόλου edits (αμετάβλητη συμπεριφορά Φάσης Ζ)', () => {
    expect(buildSheetSet(SOURCES, { locale: 'el', edits: {} })).toEqual(
      buildSheetSet(SOURCES, { locale: 'el' }),
    );
  });

  it('κάθε φύλλο κουβαλά το levelId του (η ταυτότητα για το write-back)', () => {
    const { sheets } = buildSheetSet(SOURCES, { locale: 'el' });
    expect(sheets.map((s) => s.levelId)).toEqual(['a', 'b', 'c']);
  });
});

describe('mergeSheetEdits — idempotency', () => {
  it('ίδιο patch δύο φορές ⇒ ΙΔΙΑ αναφορά (μηδέν περιττό re-render)', () => {
    const once = mergeSheetEdits({}, { a: { sheetNumber: 'Α-1' } });
    const twice = mergeSheetEdits(once, { a: { sheetNumber: 'Α-1' } });
    expect(twice).toBe(once);
  });

  it('κενό patch ⇒ ίδια αναφορά', () => {
    const edits = mergeSheetEdits({}, { a: { title: 'Ισόγειο' } });
    expect(mergeSheetEdits(edits, {})).toBe(edits);
  });

  it('συγχωνεύει πεδία της ίδιας γραμμής χωρίς να σβήνει το άλλο', () => {
    const withTitle = mergeSheetEdits({}, { a: { title: 'Ισόγειο' } });
    const withBoth = mergeSheetEdits(withTitle, { a: { sheetNumber: 'Α-7' } });
    expect(withBoth.a).toEqual({ title: 'Ισόγειο', sheetNumber: 'Α-7' });
  });
});

describe('renumberSheets / autoNumberSheets — οι μαζικές πράξεις', () => {
  it('αριθμεί τα ΕΠΙΛΕΓΜΕΝΑ στη σειρά του σετ, από τον αρχικό αριθμό', () => {
    const patch = renumberSheets(ROWS, new Set(['c', 'a']), { prefix: 'ΑΡΧ', start: 5 });
    expect(patch).toEqual({
      a: { sheetNumber: 'ΑΡΧ-5' }, // σειρά ΣΕΤ, όχι σειρά επιλογής
      c: { sheetNumber: 'ΑΡΧ-6' },
    });
  });

  it('ίδια επαναρίθμηση δύο φορές ⇒ ίδιο αποτέλεσμα (idempotent)', () => {
    const first = mergeSheetEdits({}, renumberSheets(ROWS, new Set(['a']), { prefix: 'Α', start: 1 }));
    const second = mergeSheetEdits(first, renumberSheets(ROWS, new Set(['a']), { prefix: 'Α', start: 1 }));
    expect(second).toBe(first);
  });

  it('άγνωστο levelId στην επιλογή αγνοείται· κενή επιλογή ⇒ κενό patch', () => {
    expect(renumberSheets(ROWS, new Set(['ghost']), { prefix: 'Α', start: 1 })).toEqual({});
    expect(renumberSheets(ROWS, new Set(), { prefix: 'Α', start: 1 })).toEqual({});
  });

  it('«αυτόματη αρίθμηση» = κενό κείμενο ⇒ ο αριθμός ξαναγίνεται συνάρτηση της θέσης', () => {
    const patch = autoNumberSheets(ROWS, new Set(['b']));
    expect(patch).toEqual({ b: { sheetNumber: '' } });
    const { sheets } = buildSheetSet(
      [source({ id: 'a', name: 'Ισόγειο' }), source({ id: 'b', name: 'Α΄', sheetNumberOverride: 'Χ-9' })],
      { locale: 'el', edits: patch },
    );
    expect(sheets[1].sheetNumber).toBe('Α-2');
  });
});

describe('sheetLevelUpdates — τι γράφεται ΟΝΤΩΣ στους ορόφους', () => {
  it('χωρίς αλλαγές ⇒ ΜΗΔΕΝ writes (idempotent submit)', () => {
    expect(sheetLevelUpdates(ROWS, {})).toEqual([]);
  });

  it('edit ίδιο με το persisted ⇒ κανένα write (μόνο ό,τι άλλαξε ταξιδεύει)', () => {
    const rows = buildSheetRows([source({ id: 'a', name: 'Ισόγειο', entityLabel: 'Κάτοψη' })], {
      locale: 'el',
    });
    expect(sheetLevelUpdates(rows, { a: { title: 'Κάτοψη' } })).toEqual([]);
  });

  it('γράφει τίτλο → entityLabel και αριθμό → sheetNumberOverride', () => {
    const updates = sheetLevelUpdates(ROWS, { b: { sheetNumber: 'ΑΡΧ-2', title: 'Τυπικός' } });
    expect(updates).toEqual([
      { levelId: 'b', entityLabel: 'Τυπικός', sheetNumberOverride: 'ΑΡΧ-2' },
    ]);
  });

  it('σβήσιμο πεδίου ⇒ null (καθαρίζει το override, γυρνά στο αυτόματο)', () => {
    const rows = buildSheetRows(
      [source({ id: 'a', name: 'Ισόγειο', entityLabel: 'Παλιός', sheetNumberOverride: 'Χ-1' })],
      { locale: 'el' },
    );
    expect(sheetLevelUpdates(rows, { a: { sheetNumber: '', title: '  ' } })).toEqual([
      { levelId: 'a', entityLabel: null, sheetNumberOverride: null },
    ]);
  });

  it('edit σε ανύπαρκτο φύλλο δεν παράγει write', () => {
    expect(sheetLevelUpdates(ROWS, { ghost: { title: 'Φάντασμα' } })).toEqual([]);
  });
});
