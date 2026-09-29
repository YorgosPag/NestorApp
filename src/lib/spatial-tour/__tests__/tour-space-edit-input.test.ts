/**
 * @jest-environment node
 *
 * @fileoverview **ΠΟΥ ΠΕΦΤΕΙ ΜΙΑ ΓΩΝΙΑ · ΤΙ ΕΙΝΑΙ ΕΝΑ ΔΗΛΩΜΕΝΟ ΕΜΒΑΔΟΝ** (ADR-884 Φ2στ-γ Γ3γ-2β · §12 Δ8.4 · Δ8.6 · Δ9.5 · Δ9.6).
 */

import { TOUR_DECLARED_AREA_MAX_M2 } from '@/constants/spatial-tour-vocabulary';

import { readDeclaredArea } from '../space-edit/declared-area-input';
import { SPACE_SNAP_PX, resolveSpacePoint, type SpacePointContext } from '../space-edit/space-edit-point';

const KITCHEN = [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 3, y: -4 }, { x: 0, y: -4 }];
/** 1 css px = 1 cm ⇒ η ανοχή έλξης (8 px) είναι 8 cm. */
const CTX: SpacePointContext = {
  rings: [KITCHEN], shiftFrom: null, shiftKey: false, metresPerPx: 0.01, planSize: { width: 10, height: 5 },
};

describe('resolveSpacePoint', () => {
  it('μέσα στα 8 px ⇒ ακριβώς στη γωνία της κουζίνας · έξω ⇒ εκεί που πάτησε', () => {
    expect(SPACE_SNAP_PX).toBe(8);
    expect(resolveSpacePoint({ x: 3.05, y: -0.04 }, CTX)).toEqual({ point: { x: 3, y: 0 }, snap: 'vertex' });
    expect(resolveSpacePoint({ x: 3.2, y: -2 }, CTX)).toEqual({ point: { x: 3.2, y: -2 }, snap: 'none' });
  });

  it('η ανοχή είναι σε PIXEL: σε μεγέθυνση ×4 τα ίδια 5 cm δεν «κολλάνε» πια', () => {
    expect(resolveSpacePoint({ x: 3.05, y: -2 }, CTX).snap).toBe('edge');
    expect(resolveSpacePoint({ x: 3.05, y: -2 }, { ...CTX, metresPerPx: 0.0025 }).snap).toBe('none');
  });

  it('Shift ⇒ ορθή γωνία ως προς την προηγούμενη, ΑΝΤΙ για έλξη', () => {
    const shift = { ...CTX, shiftKey: true, shiftFrom: { x: 5, y: -1 } };
    expect(resolveSpacePoint({ x: 3.04, y: -1.3 }, shift)).toEqual({ point: { x: 3.04, y: -1 }, snap: 'orthogonal' });
  });

  it('πάντα μέσα στην κάτοψη (0..πλάτος, −ύψος..0)', () => {
    expect(resolveSpacePoint({ x: -1, y: 2 }, CTX).point).toEqual({ x: 0, y: 0 });
    expect(resolveSpacePoint({ x: 12, y: -9 }, CTX).point).toEqual({ x: 10, y: -5 });
  });
});

describe('readDeclaredArea', () => {
  it('κενό ⇒ καμία δήλωση · «12,40» και «12.40» ⇒ 12,4 με πηγή', () => {
    expect(readDeclaredArea('  ', null)).toEqual({ kind: 'none' });
    expect(readDeclaredArea('12,40', 'engineer-study')).toEqual({ kind: 'ok', value: { areaM2: 12.4, source: 'engineer-study' } });
    expect(readDeclaredArea('12.40', 'owner-declared')).toMatchObject({ kind: 'ok', value: { areaM2: 12.4 } });
  });

  it('χωρίς πηγή ⇒ `source-missing` (Δ8.6) · 0, αρνητικό, λέξεις, πάνω από το όριο ⇒ `invalid` (ίδια όρια με τον γραφέα)', () => {
    expect(readDeclaredArea('20', null)).toEqual({ kind: 'source-missing', areaM2: 20 });
    for (const text of ['0', '-3', 'abc', String(TOUR_DECLARED_AREA_MAX_M2 + 1)]) {
      expect([text, readDeclaredArea(text, 'site-measurement').kind]).toEqual([text, 'invalid']);
    }
    expect(readDeclaredArea(String(TOUR_DECLARED_AREA_MAX_M2), 'site-measurement').kind).toBe('ok');
  });
});
