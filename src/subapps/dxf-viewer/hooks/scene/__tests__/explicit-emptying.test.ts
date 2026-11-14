/**
 * ADR-714 §2.8 — «ρητό άδειασμα»: καθαρή απόφαση της μετάβασης previous → next.
 *
 * Καρφώνει και τις δύο κατευθύνσεις: το άδειασμα του χρήστη ΑΝΑΓΝΩΡΙΖΕΤΑΙ, ενώ τα
 * αποτυπώματα των περιστατικών 2026-06-08 (load) και 2026-07-26 / Ρίζα 5 (σκηνή που δεν
 * είχε ποτέ DXF στη μνήμη) ΔΕΝ αναγνωρίζονται ως άδειασμα.
 */

import { isExplicitDxfEmptying, nextExplicitEmptying } from '../explicit-emptying';
import type { SceneModel } from '../../../types/scene';

type SceneEntity = SceneModel['entities'][number];
const entity = (id: string, type: string): SceneEntity =>
  ({ id, type, layerId: 'lyr_1', visible: true }) as unknown as SceneEntity;
const scene = (...entities: SceneEntity[]): SceneModel =>
  ({ entities, layersById: {}, units: 'mm' }) as unknown as SceneModel;

const withLines = scene(entity('l1', 'line'), entity('p1', 'polyline'));
const empty = scene();
const columnOnly = scene(entity('c1', 'column'));

describe('isExplicitDxfEmptying', () => {
  it('Delete / Ctrl+Z της τελευταίας γεωμετρίας ⇒ ρητό άδειασμα', () => {
    expect(isExplicitDxfEmptying(withLines, empty, 'local-edit')).toBe(true);
  });

  it('γεωμετρία ⇒ μόνο BIM με ενέργεια χρήστη ⇒ ρητό άδειασμα', () => {
    expect(isExplicitDxfEmptying(scene(entity('l1', 'line'), entity('c1', 'column')), columnOnly, 'local-edit')).toBe(true);
  });

  it.each(['load', 'remote-echo', 'system-reconcile'] as const)(
    '%s που αδειάζει ⇒ ΟΧΙ άδειασμα χρήστη (περιστατικό 2026-06-08)',
    (origin) => {
      expect(isExplicitDxfEmptying(withLines, empty, origin)).toBe(false);
    },
  );

  it('Ρίζα 5: σκηνή που δεν είχε DXF στη μνήμη ⇒ ΟΧΙ άδειασμα (ο isDxfWipe μένει ενεργός)', () => {
    expect(isExplicitDxfEmptying(columnOnly, scene(entity('c1', 'column'), entity('c2', 'column')), 'local-edit')).toBe(false);
    expect(isExplicitDxfEmptying(columnOnly, empty, 'local-edit')).toBe(false);
  });

  it('χωρίς προηγούμενη σκηνή ⇒ ΟΧΙ άδειασμα', () => {
    expect(isExplicitDxfEmptying(null, empty, 'local-edit')).toBe(false);
  });

  it('μερική διαγραφή (μένει γεωμετρία) ⇒ ΟΧΙ άδειασμα', () => {
    expect(isExplicitDxfEmptying(withLines, scene(entity('l1', 'line')), 'local-edit')).toBe(false);
  });
});

describe('nextExplicitEmptying — η πρόθεση επιβιώνει μέχρι να ξαναεμφανιστεί γεωμετρία ή φόρτωση', () => {
  it('άδειασμα και μετά κολόνα μέσα στο debounce ⇒ η πρόθεση μένει', () => {
    const latched = nextExplicitEmptying(false, withLines, empty, 'local-edit');
    expect(latched).toBe(true);
    expect(nextExplicitEmptying(latched, empty, columnOnly, 'local-edit')).toBe(true);
  });

  it('η γεωμετρία ξαναεμφανίζεται ⇒ η πρόθεση σβήνει', () => {
    expect(nextExplicitEmptying(true, empty, withLines, 'local-edit')).toBe(false);
  });

  it('νέα φόρτωση ⇒ η πρόθεση σβήνει, ακόμη κι αν η φορτωμένη σκηνή είναι άδεια', () => {
    expect(nextExplicitEmptying(true, empty, empty, 'load')).toBe(false);
  });

  it('remote-echo χωρίς γεωμετρία ΔΕΝ γεννά πρόθεση, αλλά δεν σβήνει την υπάρχουσα', () => {
    expect(nextExplicitEmptying(false, withLines, empty, 'remote-echo')).toBe(false);
    expect(nextExplicitEmptying(true, empty, columnOnly, 'remote-echo')).toBe(true);
  });
});
