/**
 * ADR-344 Φ-3D — ο κοινός πυρήνας του in-place text editor.
 *
 * Καρφώνει τους ΔΥΟ κανόνες που πριν ζούσαν inline μέσα στο 2D hook και που τώρα
 * μοιράζονται 2D και 3D:
 *   1. πότε ανοίγει ο editor (ακριβώς 1 επιλογή, TEXT ή MTEXT)
 *   2. πόσα undo βήματα παράγει ένα commit (πάντα ΕΝΑ, ή κανένα)
 *
 * ⚠️ Ο έλεγχος για `mtext` ΔΕΝ είναι διακοσμητικός: ο διαχωρισμός TEXT/MTEXT επιβιώνει
 * μόνο στο `SceneModel`. Αν κάποιος «απλοποιήσει» τον κανόνα σε σκέτο `'text'`, το MTEXT
 * παύει σιωπηλά να είναι επεξεργάσιμο και στις δύο προβολές.
 */

import { resolveTextEditTarget, buildTextEditCommand, isEditableTextType } from '../text-edit-session';
import type { SceneModel } from '../../../types/scene';
import type { DxfTextNode } from '../../../text-engine/types';
import type { DxfTextServices } from '../hooks/useDxfTextServices';

jest.mock('../../../text-engine/edit', () => ({
  ensureTextNode: jest.fn((entity: { textNode?: DxfTextNode }) => entity.textNode ?? { marker: 'fallback' }),
  diffTextNode: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { diffTextNode } = require('../../../text-engine/edit') as { diffTextNode: jest.Mock };

function sceneWith(entities: Array<Record<string, unknown>>): SceneModel {
  return { entities, layersById: {}, bounds: null, units: 'mm' } as unknown as SceneModel;
}

const NODE = { marker: 'node' } as unknown as DxfTextNode;
const SERVICES = {} as DxfTextServices;

describe('isEditableTextType', () => {
  it.each(['text', 'mtext'])('δέχεται τον τύπο %s', (type) => {
    expect(isEditableTextType(type)).toBe(true);
  });

  it.each(['line', 'circle', 'dimension', 'openingInfoTag', undefined])(
    'απορρίπτει τον τύπο %s',
    (type) => {
      expect(isEditableTextType(type)).toBe(false);
    },
  );
});

describe('resolveTextEditTarget', () => {
  const scene = sceneWith([
    { id: 't1', type: 'text', textNode: NODE },
    { id: 'm1', type: 'mtext', textNode: NODE },
    { id: 'l1', type: 'line' },
  ]);

  it('ανοίγει σε μονή επιλογή TEXT', () => {
    expect(resolveTextEditTarget(scene, ['t1'])?.entity.id).toBe('t1');
  });

  it('ανοίγει σε μονή επιλογή MTEXT — ο διαχωρισμός ζει μόνο στο SceneModel', () => {
    expect(resolveTextEditTarget(scene, ['m1'])?.entity.id).toBe('m1');
  });

  it('επιστρέφει το AST της οντότητας', () => {
    expect(resolveTextEditTarget(scene, ['t1'])?.node).toBe(NODE);
  });

  it('δεν ανοίγει χωρίς επιλογή', () => {
    expect(resolveTextEditTarget(scene, [])).toBeNull();
  });

  it('δεν ανοίγει σε πολλαπλή επιλογή — «επεξεργάσου αυτό» ≠ «επέλεξε πολλά»', () => {
    expect(resolveTextEditTarget(scene, ['t1', 'm1'])).toBeNull();
  });

  it('δεν ανοίγει σε μη-κείμενο', () => {
    expect(resolveTextEditTarget(scene, ['l1'])).toBeNull();
  });

  it('δεν ανοίγει για id εκτός σκηνής (π.χ. επιλογή άλλου ορόφου)', () => {
    expect(resolveTextEditTarget(scene, ['ghost'])).toBeNull();
  });

  it('δεν ανοίγει χωρίς σκηνή', () => {
    expect(resolveTextEditTarget(null, ['t1'])).toBeNull();
  });
});

describe('buildTextEditCommand', () => {
  beforeEach(() => diffTextNode.mockReset());

  it('καμία αλλαγή → null (μηδέν θόρυβος στο ιστορικό)', () => {
    diffTextNode.mockReturnValue([]);
    expect(buildTextEditCommand('t1', NODE, NODE, SERVICES)).toBeNull();
  });

  it('μία αλλαγή → το command ΩΣ ΕΧΕΙ, χωρίς περιτύλιγμα', () => {
    const single = { execute: jest.fn(), undo: jest.fn() };
    diffTextNode.mockReturnValue([single]);
    expect(buildTextEditCommand('t1', NODE, NODE, SERVICES)).toBe(single);
  });

  it('πολλές αλλαγές → ΕΝΑ CompoundCommand (AutoCAD MTEXTEDIT undo grain)', () => {
    diffTextNode.mockReturnValue([
      { execute: jest.fn(), undo: jest.fn() },
      { execute: jest.fn(), undo: jest.fn() },
      { execute: jest.fn(), undo: jest.fn() },
    ]);
    const result = buildTextEditCommand('t1', NODE, NODE, SERVICES);
    expect(result).toMatchObject({ type: 'compound', name: 'Edit text' });
    expect((result as unknown as { commands: unknown[] }).commands).toHaveLength(3);
  });
});
