/**
 * ⚓ ADR-929 Φ5.3β — η γέφυρα όψη ↔ σκηνή (μέσω των δύο SSoT: ομογραφία Φ1 + `rasterPixelToScene`) και οι χειρονομίες
 * του φύλλου ως καθαρή κατάσταση: φάντασμα όσο σέρνεις, **μία** νέα όψη στο άφημα, τίποτα όταν δεν άλλαξε κάτι.
 */

import { invertHomography, type Homography } from '@/lib/geometry/homography';
import type { PlanReadingView } from '../../../bim/plan-recognition/reading/plan-reading-view';
import type { RasterPlacement } from '../../../floorplan-background/geometry/raster-scene-mapping';
import { alignedPointToScene, alignedRectToSceneQuad, rectHandlePoint, sceneToAlignedPoint } from '../plan-reading-view-geometry';
import { advanceGesture, commitGesture, previewView, type ViewGesture } from '../plan-reading-view-gesture';

/** Στροφή 1,3° γύρω από το (500, 400) + μετατόπιση: σάρωση λίγο στραβή, όπως στο ζωντανό δείγμα. */
function skewed(): Homography {
  const r = (1.3 * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  return { a: cos, b: -sin, c: 500 - 500 * cos + 400 * sin + 12, d: sin, e: cos, f: 400 - 500 * sin - 400 * cos - 7, g: 0, h: 0 };
}

const A2O = skewed();
const ALIGNMENT = { alignedToOriginal: A2O, originalToAligned: invertHomography(A2O)! };
const PLACEMENT: RasterPlacement = {
  naturalBounds: { width: 1000, height: 800 },
  transform: { translateX: 2500, translateY: -1200, scaleX: 8.78, scaleY: 8.82, rotation: 0 },
};

const SIZE = { width: 1000, height: 800 };
const VIEW: PlanReadingView = { crop: { minX: 50, minY: 50, maxX: 950, maxY: 750 }, redacted: [{ minX: 700, minY: 600, maxX: 900, maxY: 700 }] };

describe('γέφυρα aligned px ↔ σκηνή', () => {
  it('μετάβαση και επιστροφή ≤ 1e-6 px σε στραβή εικόνα', () => {
    for (const p of [{ x: 0, y: 0 }, { x: 123.4, y: 567.8 }, { x: 1000, y: 800 }]) {
      const back = sceneToAlignedPoint(alignedPointToScene(p, ALIGNMENT, PLACEMENT), ALIGNMENT, PLACEMENT);
      expect(back!.x).toBeCloseTo(p.x, 6);
      expect(back!.y).toBeCloseTo(p.y, 6);
    }
  });

  it('το ορθογώνιο της όψης είναι τετράπλευρο που ακολουθεί την ευθυγράμμιση, γωνίες στη σειρά πάνω-αριστερά → κάτω-αριστερά', () => {
    const quad = alignedRectToSceneQuad(VIEW.crop, ALIGNMENT, PLACEMENT);
    expect(quad[0]).toEqual(alignedPointToScene({ x: 50, y: 50 }, ALIGNMENT, PLACEMENT));
    expect(quad[2]).toEqual(alignedPointToScene({ x: 950, y: 750 }, ALIGNMENT, PLACEMENT));
    expect(quad[1].y).not.toBeCloseTo(quad[0].y, 3); // στραβό στη σκηνή: η πάνω πλευρά δεν είναι οριζόντια
  });

  it('θέσεις λαβών: γωνίες στα άκρα, πλευρές στο μέσο', () => {
    expect(rectHandlePoint(VIEW.crop, 'nw')).toEqual({ x: 50, y: 50 });
    expect(rectHandlePoint(VIEW.crop, 'e')).toEqual({ x: 950, y: 400 });
    expect(rectHandlePoint(VIEW.crop, 's')).toEqual({ x: 500, y: 750 });
  });
});

describe('χειρονομίες', () => {
  it('μετακίνηση περιοχής: φάντασμα κατά τη διάρκεια, μία νέα όψη στο άφημα, μέσα στο crop', () => {
    const start: ViewGesture = { mode: 'move', target: { kind: 'redaction', index: 0 }, start: { x: 800, y: 650 }, origin: VIEW.redacted[0], current: VIEW.redacted[0] };
    const moved = advanceGesture(start, { x: 900, y: 700 }, VIEW, SIZE);
    expect(previewView(VIEW, moved).redacted[0]).toEqual({ minX: 750, minY: 650, maxX: 950, maxY: 750 });
    expect(commitGesture(VIEW, moved, SIZE)?.redacted[0]).toEqual({ minX: 750, minY: 650, maxX: 950, maxY: 750 });
  });

  it('κλικ χωρίς σύρσιμο ⇒ καμία εγγραφή', () => {
    const still: ViewGesture = { mode: 'resize', target: { kind: 'crop' }, handle: 'se', origin: VIEW.crop, current: VIEW.crop };
    expect(commitGesture(VIEW, still, SIZE)).toBeNull();
  });

  it('αλλαγή μεγέθους crop: ακέραια pixel, οι περιοχές κόβονται μαζί', () => {
    const g: ViewGesture = { mode: 'resize', target: { kind: 'crop' }, handle: 'e', origin: VIEW.crop, current: VIEW.crop };
    const next = commitGesture(VIEW, advanceGesture(g, { x: 800.4, y: 0 }, VIEW, SIZE), SIZE);
    expect(next?.crop).toEqual({ minX: 50, minY: 50, maxX: 800, maxY: 750 });
    expect(next?.redacted).toEqual([{ minX: 700, minY: 600, maxX: 800, maxY: 700 }]);
  });

  it('σχεδίαση: νέα περιοχή μέσα στο crop· πολύ μικρή ⇒ τίποτα', () => {
    const g: ViewGesture = { mode: 'draw', start: { x: 100, y: 100 }, current: { minX: 100, minY: 100, maxX: 100, maxY: 100 } };
    const drawn = advanceGesture(g, { x: 20, y: 300 }, VIEW, SIZE);
    expect(drawn.current).toEqual({ minX: 50, minY: 100, maxX: 100, maxY: 300 });
    expect(commitGesture(VIEW, drawn, SIZE)?.redacted).toHaveLength(2);
    expect(commitGesture(VIEW, advanceGesture(g, { x: 101, y: 101 }, VIEW, SIZE), SIZE)).toBeNull();
  });
});
