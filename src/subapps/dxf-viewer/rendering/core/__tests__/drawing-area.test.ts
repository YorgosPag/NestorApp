/**
 * Η **μέτρηση** των δύο συμπτωμάτων, με κλειδωμένο transform.
 *
 * 🔑 **Γιατί εδώ και όχι ζωντανά.** Το προηγούμενο πέρασμα προσπάθησε να μετρήσει το σύμπτωμα Β
 * τοποθετώντας οντότητα και βγάζοντας screenshot — και η μέτρηση βγήκε **άκυρη**, γιατί το
 * transform άλλαξε ανάμεσα στη μέτρηση και το στιγμιότυπο. Το σύμπτωμα Β όμως **δεν είναι
 * παρατήρηση, είναι αριθμητική ταυτότητα**: η μετατόπιση προκύπτει ίδια για κάθε zoom, pan και
 * μέγεθος καμβά. Ένα test με σταθερό transform **ΕΙΝΑΙ** η «κλειδωμένη» μέτρηση που ζητούσε το
 * handoff — και είναι αυστηρότερο, γιατί δεν μπορεί να ξεκλειδώσει.
 */

import type { ViewTransform, Viewport } from '../../types/Types';
import { CoordinateTransforms } from '../CoordinateTransforms';
import {
  DRAWING_AREA_CHROME,
  getBottomRulerBand,
  getDrawingAreaRect,
  getLeftRulerBand,
  isPointInRulerBand,
} from '../drawing-area';

/** Κλειδωμένο transform — καμία πηγή μεταβλητότητας. */
const LOCKED: ViewTransform = { scale: 0.001607, offsetX: 501, offsetY: 44 };
const VIEWPORT: Viewport = { width: 1240, height: 720 };

const { leftRulerWidth: LEFT, bottomRulerHeight: BOTTOM } = DRAWING_AREA_CHROME;

describe('getDrawingAreaRect — η μία απάντηση', () => {
  it('αφαιρεί τον αριστερό και τον κάτω χάρακα, τίποτε άλλο', () => {
    const area = getDrawingAreaRect(VIEWPORT);
    expect(area).toMatchObject({
      x: LEFT,
      y: 0,
      width: VIEWPORT.width - LEFT,
      height: VIEWPORT.height - BOTTOM,
      right: VIEWPORT.width,
      bottom: VIEWPORT.height - BOTTOM,
    });
  });

  it('το κέντρο του είναι ΤΟ ΚΕΝΤΡΟ ΤΗΣ ΟΡΑΤΗΣ ΠΕΡΙΟΧΗΣ, όχι του καμβά', () => {
    const area = getDrawingAreaRect(VIEWPORT);
    expect(area.centerX).toBe(VIEWPORT.width / 2 + LEFT / 2);
    expect(area.centerY).toBe(VIEWPORT.height / 2 - BOTTOM / 2);
  });

  it('🔴 εκφυλισμένο viewport ⇒ 0, ΠΟΤΕ αρνητικό (αρνητικό rect ⇒ αντεστραμμένο clip)', () => {
    for (const vp of [{ width: 0, height: 0 }, { width: 10, height: 5 }]) {
      const area = getDrawingAreaRect(vp);
      expect(area.width).toBeGreaterThanOrEqual(0);
      expect(area.height).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('🔑 Η ΑΓΚΥΡΑ ΕΙΝΑΙ Η ΚΑΤΩ-ΑΡΙΣΤΕΡΗ ΓΩΝΙΑ ΤΗΣ ΠΕΡΙΟΧΗΣ ΣΧΕΔΙΑΣΗΣ', () => {
  it('το world (0,0) προσγειώνεται ΑΚΡΙΒΩΣ στη γωνία (area.x, area.bottom)', () => {
    const area = getDrawingAreaRect(VIEWPORT);
    const identity: ViewTransform = { scale: 1, offsetX: 0, offsetY: 0 };
    const screen = CoordinateTransforms.worldToScreen({ x: 0, y: 0 }, identity, VIEWPORT);
    expect(screen).toEqual({ x: area.x, y: area.bottom });
  });

  it('η γωνία της άγκυρας ταυτίζεται με την άνω ακμή της ζώνης του κάτω χάρακα', () => {
    // Αυτό είναι το εύρημα που ενοποίησε τα δύο στρατόπεδα: το «MARGINS.top» ΕΙΝΑΙ το bottom.
    expect(getDrawingAreaRect(VIEWPORT).bottom).toBe(getBottomRulerBand(VIEWPORT).y);
  });

  it('screenToWorld είναι ακριβώς αντίστροφη της worldToScreen (round-trip)', () => {
    const world = { x: -171.4127, y: 421.527 };
    const screen = CoordinateTransforms.worldToScreen(world, LOCKED, VIEWPORT);
    const back = CoordinateTransforms.screenToWorld(screen, LOCKED, VIEWPORT);
    expect(back.x).toBeCloseTo(world.x, 6);
    expect(back.y).toBeCloseTo(world.y, 6);
  });
});

describe('🔴 ΣΥΜΠΤΩΜΑ Β — μετρημένο, όχι υποτιθέμενο', () => {
  /** Ό,τι έκανε το `readViewportWorldMetrics` ΠΡΙΝ: όλο το `<canvas>`. */
  const centerOfWholeCanvas = (vp: Viewport) =>
    CoordinateTransforms.screenToWorld({ x: vp.width / 2, y: vp.height / 2 }, LOCKED, vp);

  /** Ό,τι κάνει ΤΩΡΑ: μόνο η ορατή περιοχή. */
  const centerOfDrawingArea = (vp: Viewport) => {
    const a = getDrawingAreaRect(vp);
    return CoordinateTransforms.screenToWorld({ x: a.centerX, y: a.centerY }, LOCKED, vp);
  };

  it('η μετατόπιση είναι ΑΚΡΙΒΩΣ (−left/2, +bottom/2) σε CSS px', () => {
    const a = getDrawingAreaRect(VIEWPORT);
    expect(VIEWPORT.width / 2 - a.centerX).toBe(-LEFT / 2);
    expect(VIEWPORT.height / 2 - a.centerY).toBe(+BOTTOM / 2);
  });

  it('🔑 …και είναι ΑΝΕΞΑΡΤΗΤΗ από zoom, pan και μέγεθος καμβά', () => {
    const viewports: Viewport[] = [
      { width: 1240, height: 720 },
      { width: 640, height: 480 },
      { width: 3840, height: 2160 },
    ];
    const transforms: ViewTransform[] = [
      LOCKED,
      { scale: 1, offsetX: 0, offsetY: 0 },
      { scale: 250, offsetX: -9000, offsetY: 12345 },
    ];
    for (const vp of viewports) {
      for (const t of transforms) {
        const a = getDrawingAreaRect(vp);
        const wrong = CoordinateTransforms.screenToWorld({ x: vp.width / 2, y: vp.height / 2 }, t, vp);
        const right = CoordinateTransforms.screenToWorld({ x: a.centerX, y: a.centerY }, t, vp);
        // Σε μονάδες κόσμου: ακριβώς half-chrome διαιρεμένο με το scale, και στους δύο άξονες.
        expect(right.x - wrong.x).toBeCloseTo(LEFT / 2 / t.scale, 6);
        expect(right.y - wrong.y).toBeCloseTo(BOTTOM / 2 / t.scale, 6);
      }
    }
  });

  it('στο ζωντανό zoom του σχεδίου (scale 0,001607) η απόκλιση είναι ~9,3 m', () => {
    const delta = centerOfDrawingArea(VIEWPORT).x - centerOfWholeCanvas(VIEWPORT).x;
    expect(delta).toBeCloseTo(LEFT / 2 / LOCKED.scale, 3);
    expect(delta).toBeGreaterThan(9000); // «οπτικά ασήμαντο» μόνο σε pixels οθόνης
  });

  it('το ΟΡΑΤΟ πλάτος είναι μικρότερο από το πλάτος του καμβά κατά ακριβώς τον χάρακα', () => {
    const a = getDrawingAreaRect(VIEWPORT);
    const toWorldX = (x: number) => CoordinateTransforms.screenToWorld({ x, y: 0 }, LOCKED, VIEWPORT).x;
    const visible = Math.abs(toWorldX(a.right) - toWorldX(a.x));
    const wholeCanvas = Math.abs(toWorldX(VIEWPORT.width) - toWorldX(0));
    expect(wholeCanvas - visible).toBeCloseTo(LEFT / LOCKED.scale, 3);
  });
});

describe('ζώνες χαράκων — συμπλήρωμα, όχι δεύτερος ορισμός', () => {
  it('οι δύο ζώνες εφάπτονται στην περιοχή σχεδίασης χωρίς κενό και χωρίς επικάλυψη', () => {
    const area = getDrawingAreaRect(VIEWPORT);
    const left = getLeftRulerBand(VIEWPORT);
    const bottom = getBottomRulerBand(VIEWPORT);
    expect(left.x + left.width).toBe(area.x);
    expect(bottom.y).toBe(area.bottom);
    expect(bottom.y + bottom.height).toBe(VIEWPORT.height);
  });

  it('isPointInRulerBand συμφωνεί με το ορθογώνιο σε κάθε γωνία', () => {
    const a = getDrawingAreaRect(VIEWPORT);
    expect(isPointInRulerBand(a.x - 1, a.centerY, VIEWPORT)).toBe(true); // αριστερός χάρακας
    expect(isPointInRulerBand(a.centerX, a.bottom + 1, VIEWPORT)).toBe(true); // κάτω χάρακας
    expect(isPointInRulerBand(a.x, a.y, VIEWPORT)).toBe(false); // πάνω-αριστερά της περιοχής
    expect(isPointInRulerBand(a.right - 1, a.bottom - 1, VIEWPORT)).toBe(false); // κάτω-δεξιά
    expect(isPointInRulerBand(-5, 10, VIEWPORT)).toBe(false); // εκτός καμβά
  });
});
