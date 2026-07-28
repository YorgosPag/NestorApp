/**
 * ADR-718 §Β — «Άνοιγμα εδώ» στο μενού δεξιού κλικ της λαβής: **πού** εμφανίζεται και,
 * κυρίως, **πού ΔΕΝ** εμφανίζεται.
 *
 * ── Οι δύο κανόνες που καρφώνονται ──────────────────────────────────────────────────────────
 *  1. **Μόνο σε λαβή ΑΚΜΗΣ** (segment- ή arc-midpoint). Σε λαβή **κορυφής** δεν υπάρχει ακμή να
 *     αφαιρεθεί — ο δείκτης της κορυφής δεν είναι απάντηση στο «ποια ακμή;», είναι διαφορετική
 *     ερώτηση που τυχαίνει να έχει ίδιο τύπο. Αυτό ακριβώς είναι το είδος λάθους που ένας
 *     αριθμητικός δείκτης κρύβει τέλεια.
 *  2. **Μόνο σε ΚΛΕΙΣΤΗ** πολυγραμμή. Σε ανοιχτή δεν υπάρχει τι να ανοίξει· αν προσφερόταν, ο
 *     command θα την αρνιόταν και ο χρήστης θα έβλεπε εντολή που δεν κάνει τίποτα.
 *
 * Ο δεύτερος κανόνας είναι ο λόγος που ο resolver **χρησιμοποιεί** επιτέλους την παράμετρο
 * `entity` (ήταν `_entity`, αχρησιμοποίητη από το Phase 11).
 *
 * @see ../grip-context-menu-resolver
 * @see ../../polyline/polyline-closure-ops — το κατηγόρημα `canOpenPolyline`
 */

import { resolveContextMenuSections } from '../grip-context-menu-resolver';
import type { UnifiedGripInfo } from '../../../hooks/grips/unified-grip-types';
import type { Entity } from '../../../types/entities';

const VERTICES = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];

function polyline(closed: boolean): Entity {
  return { id: 'p1', type: 'polyline', layerId: 'lyr', vertices: VERTICES, closed } as unknown as Entity;
}

function grip(kind: string): UnifiedGripInfo {
  return { entityId: 'p1', gripKind: { on: 'polyline', kind } } as unknown as UnifiedGripInfo;
}

function opIds(entity: Entity, kind: string): readonly string[] {
  const section = resolveContextMenuSections(entity, grip(kind)).find((s) => s.id === 'polyline-ops');
  return section?.items.map((i) => i.id) ?? [];
}

const OPEN_HERE = 'polyline-ops:openAtEdge';

describe('«Άνοιγμα εδώ» — μόνο σε λαβή ακμής ΚΛΕΙΣΤΗΣ πολυγραμμής', () => {
  it.each([
    ['ευθύγραμμη ακμή', 'polyline-segment-midpoint-2'],
    ['τοξωτή ακμή', 'polyline-arc-midpoint-1'],
  ])('κλειστή + %s ⇒ προσφέρεται', (_label, kind) => {
    expect(opIds(polyline(true), kind)).toContain(OPEN_HERE);
  });

  it.each([
    ['ευθύγραμμη ακμή', 'polyline-segment-midpoint-2'],
    ['τοξωτή ακμή', 'polyline-arc-midpoint-1'],
  ])('ΑΝΟΙΧΤΗ + %s ⇒ ΔΕΝ προσφέρεται', (_label, kind) => {
    expect(opIds(polyline(false), kind)).not.toContain(OPEN_HERE);
  });

  it('λαβή ΚΟΡΥΦΗΣ κλειστής πολυγραμμής ⇒ ΔΕΝ προσφέρεται (κορυφή ≠ ακμή)', () => {
    expect(opIds(polyline(true), 'polyline-vertex-1')).not.toContain(OPEN_HERE);
  });

  it('οι υπόλοιπες πράξεις μένουν αμετάβλητες — η προσθήκη δεν έδιωξε τίποτα', () => {
    expect(opIds(polyline(true), 'polyline-segment-midpoint-0')).toEqual([
      'polyline-ops:addVertex',
      'polyline-ops:convertToArc',
      OPEN_HERE,
    ]);
    expect(opIds(polyline(true), 'polyline-vertex-0')).toEqual([
      'polyline-ops:addVertex',
      'polyline-ops:removeVertex',
      'polyline-ops:convertToArc',
    ]);
  });

  it('η ενότητα μένει πριν το τερματικό «Έξοδος»', () => {
    const ids = resolveContextMenuSections(polyline(true), grip('polyline-segment-midpoint-0')).map((s) => s.id);
    expect(ids).toEqual(['modes', 'extras', 'polyline-ops', 'terminal']);
  });
});
