/**
 * 🔴 Ο φρουρός του **συμπτώματος Β** — στην ίδια τη συνάρτηση, όχι σε αντίγραφο της αριθμητικής.
 *
 * Χωρίς αυτό, μια αναίρεση της διόρθωσης (επιστροφή σε `viewport.width/2, viewport.height/2`)
 * θα περνούσε **αθόρυβα**: τα υπόλοιπα tests μετρούν το `getDrawingAreaRect`, όχι τον καταναλωτή.
 * Mutation-verified — βλ. ADR-741 §7.
 *
 * Το transform είναι **κλειδωμένο** (σταθερό mock): αυτό ζητούσε το handoff για τη μέτρηση του Β,
 * και εδώ είναι κλειδωμένο εξ ορισμού — δεν μπορεί να αλλάξει μεταξύ μέτρησης και ελέγχου.
 */

import type { ViewTransform } from '../../types/Types';

const LOCKED: ViewTransform = { scale: 0.001607, offsetX: 501, offsetY: 44 };
const RECT = { width: 1240, height: 720 };

jest.mock('../../../systems/cursor/ImmediateTransformStore', () => ({
  getImmediateTransform: () => LOCKED,
}));

let canvasRect: { width: number; height: number } = RECT;
jest.mock('../main-canvas-element', () => ({
  getMainDxfCanvas: () => ({
    getBoundingClientRect: () => ({ width: canvasRect.width, height: canvasRect.height }),
  }),
}));

import { readViewportWorldMetrics } from '../viewport-world-metrics';
import { CoordinateTransforms } from '../../core/CoordinateTransforms';
import { DRAWING_AREA_CHROME, getDrawingAreaRect } from '../../core/drawing-area';

const { leftRulerWidth: LEFT, bottomRulerHeight: BOTTOM } = DRAWING_AREA_CHROME;

beforeEach(() => { canvasRect = RECT; });

describe('readViewportWorldMetrics — μετρά την ΟΡΑΤΗ περιοχή, όχι τον καμβά', () => {
  it('🔴 το κέντρο είναι το κέντρο της περιοχής σχεδίασης', () => {
    const area = getDrawingAreaRect(RECT);
    const expected = CoordinateTransforms.screenToWorld(
      { x: area.centerX, y: area.centerY }, LOCKED, RECT,
    );
    const metrics = readViewportWorldMetrics();
    expect(metrics).not.toBeNull();
    expect(metrics!.center.x).toBeCloseTo(expected.x, 6);
    expect(metrics!.center.y).toBeCloseTo(expected.y, 6);
  });

  it('🔴 …και ΔΕΝ είναι το κέντρο του καμβά (η ακριβής διαφορά που ήταν το σφάλμα)', () => {
    const canvasCentre = CoordinateTransforms.screenToWorld(
      { x: RECT.width / 2, y: RECT.height / 2 }, LOCKED, RECT,
    );
    const metrics = readViewportWorldMetrics()!;
    // Ακριβώς half-chrome ανά άξονα, διαιρεμένο με το scale.
    expect(metrics.center.x - canvasCentre.x).toBeCloseTo(LEFT / 2 / LOCKED.scale, 3);
    expect(metrics.center.y - canvasCentre.y).toBeCloseTo(BOTTOM / 2 / LOCKED.scale, 3);
  });

  it('🔴 το ορατό πλάτος αγνοεί τη ζώνη του αριστερού χάρακα', () => {
    const metrics = readViewportWorldMetrics()!;
    const wholeCanvasWidth = RECT.width / LOCKED.scale;
    expect(metrics.visibleWorldWidth).toBeCloseTo((RECT.width - LEFT) / LOCKED.scale, 3);
    // Η εικόνα έμπαινε μεγαλύτερη κατά ακριβώς τη ζώνη του χάρακα (~2,4% στο 1240 px).
    expect(wholeCanvasWidth - metrics.visibleWorldWidth).toBeCloseTo(LEFT / LOCKED.scale, 3);
  });

  it('καμβάς μικρότερος από το chrome ⇒ null («δεν ξέρω»), ποτέ αρνητικό μέγεθος', () => {
    canvasRect = { width: LEFT, height: BOTTOM };
    expect(readViewportWorldMetrics()).toBeNull();
  });

  it('καμβάς 0×0 (πριν το layout) ⇒ null', () => {
    canvasRect = { width: 0, height: 0 };
    expect(readViewportWorldMetrics()).toBeNull();
  });
});
