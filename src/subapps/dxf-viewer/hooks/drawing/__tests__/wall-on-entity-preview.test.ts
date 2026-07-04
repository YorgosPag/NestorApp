/**
 * ADR-363 Phase 1J — `generateWallOnEntityPreview` tests (ζωντανό on-entity φάντασμα).
 *
 * Καλύπτει το bug που διορθώθηκε: ο `wall-on-entity` δεν παρήγαγε ΚΑΝΕΝΑ preview (το
 * `generatePreviewEntity` δρομολογούσε μόνο `tool === 'wall'`). Επιβεβαιώνει:
 *   - awaitingStart hover πάνω σε γραμμή → WYSIWYG wall ghost·
 *   - hover σε κενό → null·
 *   - hover σε κλειστό ορθογώνιο → null (το αναλαμβάνει η region πράσινη διακεκομμένη)·
 *   - awaitingSide (picked line στο store) → wall ghost πάνω στη γραμμή.
 */

import type { Entity } from '../../../types/entities';
import { generateWallOnEntityPreview } from '../wall-on-entity-preview';
import { wallPreviewStore } from '../../../bim/walls/wall-preview-store';

const SU = 'mm' as const;

function lineEntity(x1: number, y1: number, x2: number, y2: number): Entity {
  return {
    id: 'line-1', type: 'line', layer: '0',
    start: { x: x1, y: y1 }, end: { x: x2, y: y2 },
  } as unknown as Entity;
}

function rectEntity(x: number, y: number, w: number, h: number): Entity {
  return { id: 'rect-1', type: 'rectangle', layer: '0', x, y, width: w, height: h } as unknown as Entity;
}

describe('wall-on-entity-preview — generateWallOnEntityPreview', () => {
  afterEach(() => wallPreviewStore.reset());

  it('awaitingStart: hover over a line → WYSIWYG wall ghost', () => {
    wallPreviewStore.reset();
    const ghost = generateWallOnEntityPreview({ x: 2500, y: 0 }, [lineEntity(0, 0, 5000, 0)], SU);
    expect(ghost).not.toBeNull();
    expect((ghost as { wysiwygPreview?: boolean }).wysiwygPreview).toBe(true);
    expect((ghost as { preview?: boolean }).preview).toBe(true);
    expect('params' in (ghost as object)).toBe(true);
  });

  it('awaitingStart: hover over empty space → null', () => {
    wallPreviewStore.reset();
    const ghost = generateWallOnEntityPreview({ x: 99999, y: 99999 }, [lineEntity(0, 0, 5000, 0)], SU);
    expect(ghost).toBeNull();
  });

  it('awaitingStart: hover over a closed rectangle → null (region dashed handles it)', () => {
    wallPreviewStore.reset();
    const ghost = generateWallOnEntityPreview({ x: 2500, y: 0 }, [rectEntity(0, 0, 5000, 3000)], SU);
    expect(ghost).toBeNull();
  });

  it('awaitingSide: picked line surfaced in the store → wall ghost on that line', () => {
    wallPreviewStore.set({
      startPoint: { x: 0, y: 0 },
      endPoint: { x: 5000, y: 0 },
      curveControl: null,
      polylineVertices: [],
      overrides: {},
    });
    // No scene entities needed — the picked line comes from the store (awaitingSide).
    const ghost = generateWallOnEntityPreview({ x: 2500, y: 500 }, [], SU);
    expect(ghost).not.toBeNull();
    expect((ghost as { wysiwygPreview?: boolean }).wysiwygPreview).toBe(true);
  });
});
