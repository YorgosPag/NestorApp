/**
 * ADR-651 Φάση Ζ — «σετ φύλλων»: αυτόματη αρίθμηση (καθαρή, ντετερμινιστική) + παραγωγή
 * του σετ από τα levels + πέρασμα τίτλου/αριθμού ως scope overrides (ίδιο μοτίβο με το
 * `scaleName` της Φάσης Ε).
 */

import type { Level } from '../../../systems/levels/config';
import type { SceneModel } from '../../../types/entities';
import { buildActiveTitleBlockScope } from '../active-title-block';
import { autoSheetNumber, sheetNumberPrefixForLocale } from '../sheet-numbering';
import { buildSheetSet, type SheetSetSource } from '../sheet-set';

const SCENE = { entities: [] } as unknown as SceneModel;

function level(overrides: Partial<Level>): Level {
  return {
    id: 'lvl',
    name: 'Επίπεδο',
    order: 0,
    isDefault: false,
    visible: true,
    ...overrides,
  };
}

function source(overrides: Partial<Level>): SheetSetSource {
  return { level: level(overrides), scene: SCENE };
}

describe('sheet-numbering — auto-numbering (καθαρή συνάρτηση)', () => {
  it('παράγει `${prefix}-${index+1}` (0-based θέση → 1-based αριθμός)', () => {
    expect(autoSheetNumber(0, 'Α')).toBe('Α-1');
    expect(autoSheetNumber(1, 'Α')).toBe('Α-2');
    expect(autoSheetNumber(9, 'A')).toBe('A-10');
  });

  it('πρόθεμα ανά γλώσσα: ελληνικό «Α» (default) vs λατινικό «A» (αγγλικά)', () => {
    expect(sheetNumberPrefixForLocale('el')).toBe('Α'); // U+0391 Greek Alpha
    expect(sheetNumberPrefixForLocale('en')).toBe('A'); // U+0041 Latin A
    // Τα δύο προθέματα είναι ΔΙΑΦΟΡΕΤΙΚΟΙ χαρακτήρες (όχι το ίδιο glyph).
    expect(sheetNumberPrefixForLocale('el')).not.toBe(sheetNumberPrefixForLocale('en'));
  });
});

describe('buildSheetSet — παραγωγή σετ από levels', () => {
  it('αριθμεί τα φύλλα στη σειρά που δίνονται (ήδη ταξινομημένα από τον καλούντα)', () => {
    const sources = [
      source({ id: 'a', name: 'Ισόγειο' }),
      source({ id: 'b', name: 'Α΄ Όροφος' }),
      source({ id: 'c', name: 'Β΄ Όροφος' }),
    ];
    const { sheets } = buildSheetSet(sources, { locale: 'el' });
    expect(sheets.map((s) => s.sheetNumber)).toEqual(['Α-1', 'Α-2', 'Α-3']);
    expect(sheets.map((s) => s.title)).toEqual(['Ισόγειο', 'Α΄ Όροφος', 'Β΄ Όροφος']);
  });

  it('ο τίτλος φύλλου προτιμά το entityLabel, με fallback στο όνομα ορόφου', () => {
    const { sheets } = buildSheetSet(
      [
        source({ name: 'level-1', entityLabel: '1ος Όροφος' }),
        source({ name: 'Ισόγειο', entityLabel: '   ' }), // κενό ⇒ fallback στο name
      ],
      { locale: 'el' },
    );
    expect(sheets[0].title).toBe('1ος Όροφος');
    expect(sheets[1].title).toBe('Ισόγειο');
  });

  it('αγγλικό locale ⇒ λατινικό πρόθεμα αρίθμησης', () => {
    const { sheets } = buildSheetSet([source({ name: 'Ground' }), source({ name: 'First' })], {
      locale: 'en',
    });
    expect(sheets.map((s) => s.sheetNumber)).toEqual(['A-1', 'A-2']);
  });

  it('κενές πηγές ⇒ κενό σετ (ο καλών αποφασίζει τι κάνει)', () => {
    expect(buildSheetSet([], { locale: 'el' }).sheets).toEqual([]);
  });

  it('κρατά το scene κάθε φύλλου (WYSIWYG: κάθε φύλλο τυπώνει το scene του ορόφου του)', () => {
    const sceneA = { entities: [{ id: 'x' }] } as unknown as SceneModel;
    const sceneB = { entities: [{ id: 'y' }] } as unknown as SceneModel;
    const { sheets } = buildSheetSet(
      [
        { level: level({ id: 'a' }), scene: sceneA },
        { level: level({ id: 'b' }), scene: sceneB },
      ],
      { locale: 'el' },
    );
    expect(sheets[0].scene).toBe(sceneA);
    expect(sheets[1].scene).toBe(sceneB);
  });
});

describe('active-title-block — τίτλος/αριθμός φύλλου ως scope overrides', () => {
  it('τα overrides τίτλου/αριθμού περνούν στο drawing scope (Α-1 → sheetNumber, όνομα → title)', () => {
    const scope = buildActiveTitleBlockScope('el', { title: 'Ισόγειο', sheetNumber: 'Α-1' });
    expect(scope.drawing?.title).toBe('Ισόγειο');
    expect(scope.drawing?.sheetNumber).toBe('Α-1');
  });

  it('χωρίς overrides, τίτλος/αριθμός μένουν undefined (single print — αμετάβλητη συμπεριφορά)', () => {
    const scope = buildActiveTitleBlockScope('el');
    expect(scope.drawing?.title).toBeUndefined();
    expect(scope.drawing?.sheetNumber).toBeUndefined();
  });
});
