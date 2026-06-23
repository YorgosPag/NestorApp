/**
 * ADR-507 Φ3 / §5β.1 — gap tolerance (AutoCAD HPGAPTOL) στο auto-area SSoT.
 *
 * Επιβεβαιώνει ότι το optional `gapTolerance` param γεφυρώνει μικρά ανοίγματα
 * ορίου ΧΩΡΙΣ να αλλάζει την προεπιλεγμένη συμπεριφορά (gap=0 → ταυτόσημη).
 */

import { getAutoAreaHitResult } from '../auto-area-hit';
import type { Entity } from '../../../types/entities';
import type { Point2D } from '../../../rendering/types/Types';

function line(id: string, start: Point2D, end: Point2D): Entity {
  return { id, type: 'line', start, end } as unknown as Entity;
}

/**
 * Τετράγωνο 1000×1000 από 4 γραμμές, αλλά με κενό 20 units στη γωνία (0,0):
 * η τελευταία γραμμή τελειώνει στο (0,20) αντί για (0,0). Default snap (6px) δεν
 * το κλείνει· gapTolerance≥20 το κλείνει.
 */
function squareWithGap(): Entity[] {
  return [
    line('l1', { x: 0, y: 0 }, { x: 1000, y: 0 }),
    line('l2', { x: 1000, y: 0 }, { x: 1000, y: 1000 }),
    line('l3', { x: 1000, y: 1000 }, { x: 0, y: 1000 }),
    line('l4', { x: 0, y: 1000 }, { x: 0, y: 20 }),
  ];
}

const CENTER: Point2D = { x: 500, y: 500 };

describe('auto-area gap tolerance (ADR-507 §5β.1)', () => {
  it('does NOT close a 20-unit gap with the default tolerance (gap=0)', () => {
    // Νέος πίνακας αναφοράς ανά test → καθαρό WeakMap cache.
    const result = getAutoAreaHitResult(CENTER, squareWithGap(), [], 1, 0);
    expect(result).toBeNull();
  });

  it('closes the gap when gapTolerance ≥ the opening', () => {
    const result = getAutoAreaHitResult(CENTER, squareWithGap(), [], 1, 30);
    expect(result).not.toBeNull();
    expect(result!.polygon.length).toBeGreaterThanOrEqual(4);
  });

  it('still detects a perfectly-closed square with default tolerance', () => {
    const closed: Entity[] = [
      line('l1', { x: 0, y: 0 }, { x: 1000, y: 0 }),
      line('l2', { x: 1000, y: 0 }, { x: 1000, y: 1000 }),
      line('l3', { x: 1000, y: 1000 }, { x: 0, y: 1000 }),
      line('l4', { x: 0, y: 1000 }, { x: 0, y: 0 }),
    ];
    expect(getAutoAreaHitResult(CENTER, closed, [], 1, 0)).not.toBeNull();
  });
});
