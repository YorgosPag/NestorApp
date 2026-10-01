/**
 * @fileoverview 🎯 **ΟΙ ΛΑΒΕΣ ΜΕΝΟΥΝ ΣΤΗΝ ΕΙΚΟΝΑ** — `CaptureSpotEditSurface` (ADR-897 §6, ζωντανός έλεγχος 01/10).
 * @related ../CaptureSpotEditSurface.tsx · lib/geometry/view-cone.ts (`reachInsideBox`)
 *
 * Λ1 — σημείο στο πάνω άκρο που κοιτά **πάνω**: στόχος και άκρες πεδίου ΜΕΣΑ στην εικόνα (αλλιώς τους κόβει το SVG);
 * Λ2 — η λαβή κοντεύει, η **κατεύθυνση** όμως μένει ίδια (ο στόχος κάθεται ακριβώς πάνω από το σημείο);
 *
 * Μετρημένο ζωντανά: «Εξωτερικό» στο `y = 0,21` με κατεύθυνση 0 ⇒ στόχος μισοκομμένος στο πάνω άκρο. Μετάλλαξη
 * (χωρίς `reachInsideBox`) ⇒ Λ1 κόκκινο.
 */

import React from 'react';
import { render } from '@testing-library/react';

import type { PhotoCaptureSpot } from '@/lib/listings/photo-capture-spot';

import { CaptureSpotEditSurface } from '../CaptureSpotEditSurface';

const SIZE = { width: 1200, height: 800 };
const noop = () => undefined;
const NEAR_TOP: PhotoCaptureSpot = { floorplanFileId: 'plan', x: 0.5, y: 0.05, headingRad: 0, fovRad: 1.2 };

function handles() {
  const { container } = render(
    <CaptureSpotEditSurface src="blob:plan" alt="" size={SIZE} onSize={noop} onError={noop} floorplanId="plan"
      markers={[]} selectedPhotoId="photo" selected={NEAR_TOP} onSelect={noop} onChange={noop}
      labels={{ surface: 's', target: 't', fovEdge: 'f', northGlyph: 'N', northArrow: 'n' }}
      northRad={null} onNorth={noop} />,
  );
  // Οι λαβές είναι οι κύκλοι με `<title>` (στόχος + δύο άκρες πεδίου).
  return [...container.querySelectorAll('circle')].filter((circle) => circle.querySelector('title') !== null)
    .map((circle) => ({ cx: Number(circle.getAttribute('cx')), cy: Number(circle.getAttribute('cy')),
      r: Number(circle.getAttribute('r')), title: circle.querySelector('title')?.textContent }));
}

describe('CaptureSpotEditSurface — λαβές', () => {
  it('Λ1 — καμία λαβή έξω από την εικόνα', () => {
    const all = handles();
    expect(all).toHaveLength(3);
    for (const handle of all) {
      expect(handle.cy - handle.r).toBeGreaterThanOrEqual(-1e-6);
      expect(handle.cx).toBeGreaterThanOrEqual(0);
      expect(handle.cx).toBeLessThanOrEqual(SIZE.width);
    }
  });

  it('Λ2 — ο στόχος κοντεύει αλλά δείχνει ακόμα ΠΑΝΩ', () => {
    const target = handles().find((handle) => handle.title === 't');
    expect(target?.cx).toBeCloseTo(SIZE.width * NEAR_TOP.x);
    expect(target?.cy).toBeLessThan(SIZE.height * NEAR_TOP.y);
  });
});
