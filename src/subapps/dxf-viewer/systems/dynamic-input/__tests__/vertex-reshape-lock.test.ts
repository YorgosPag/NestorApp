/**
 * ADR-513 §grip-parity — DISPLACEMENT (Model A) lock for arc/polyline vertex + straight edge reshape.
 *
 * Giorgio 2026-07-18: ORTHO κλειδώνει την κατεύθυνση, το πληκτρολογούμενο «Μήκος» δίνει το μέγεθος →
 * η κορυφή μετακινείται ΚΑΤΑ την τιμή προς εκείνη την κατεύθυνση (τραπέζιο). Ελέγχει: gating (no lock /
 * ineligible → null), ORTHO+typed composition (fixes the line resolver's ORTHO-ignoring gap), free dir.
 */

import { resolveVertexReshapeLockedDelta } from '../vertex-reshape-lock';
import { DynamicInputLockStore } from '../DynamicInputLockStore';
import { cadToggleState } from '../../constraints/cad-toggle-state';

const anchor = { x: 0, y: 0 };
const polyVertex = { gripIndex: 0, movesEntity: false, polylineKind: 'polyline-vertex-0', isEdge: false };

afterEach(() => {
  DynamicInputLockStore.unlock();
  cadToggleState.set(false, false); // ortho off, polar off
});

describe('resolveVertexReshapeLockedDelta — gating', () => {
  it('no active length/angle lock → null (caller keeps raw delta)', () => {
    cadToggleState.set(true, false);
    expect(resolveVertexReshapeLockedDelta({ type: 'polyline' }, polyVertex, anchor, { x: 300, y: 40 })).toBeNull();
  });
  it('lock active but INELIGIBLE grip (line) → null', () => {
    DynamicInputLockStore.lockLength(500);
    expect(resolveVertexReshapeLockedDelta({ type: 'line' }, polyVertex, anchor, { x: 300, y: 40 })).toBeNull();
  });
});

describe('resolveVertexReshapeLockedDelta — ORTHO + typed length (displacement)', () => {
  it('ORTHO on, cursor mostly horizontal, typed 500 → moves 500 along +X (τραπέζιο)', () => {
    cadToggleState.set(true, false); // ORTHO
    DynamicInputLockStore.lockLength(500);
    const d = resolveVertexReshapeLockedDelta({ type: 'polyline' }, polyVertex, anchor, { x: 300, y: 40 });
    expect(d).not.toBeNull();
    expect(d!.x).toBeCloseTo(500, 6);
    expect(d!.y).toBeCloseTo(0, 6);   // ORTHO snapped to the horizontal axis
  });

  it('ORTHO on, cursor mostly vertical, typed 250 → moves 250 along −Y', () => {
    cadToggleState.set(true, false);
    DynamicInputLockStore.lockLength(250);
    const d = resolveVertexReshapeLockedDelta({ type: 'polyline' }, polyVertex, anchor, { x: -30, y: -400 });
    expect(d).not.toBeNull();
    expect(d!.x).toBeCloseTo(0, 6);
    expect(d!.y).toBeCloseTo(-250, 6);
  });

  it('a projected-rectangle corner (raw type rectangle) is eligible', () => {
    cadToggleState.set(true, false);
    DynamicInputLockStore.lockLength(500);
    const d = resolveVertexReshapeLockedDelta({ type: 'rectangle' }, polyVertex, anchor, { x: 300, y: 40 });
    expect(d).not.toBeNull();
    expect(d!.x).toBeCloseTo(500, 6);
    expect(d!.y).toBeCloseTo(0, 6);
  });

  it('NO ortho/polar → typed length in the free cursor direction', () => {
    DynamicInputLockStore.lockLength(500); // ortho/polar off (afterEach reset)
    // cursor along (3,4) → unit (0.6,0.8) × 500 = (300,400)
    const d = resolveVertexReshapeLockedDelta({ type: 'polyline' }, polyVertex, anchor, { x: 30, y: 40 });
    expect(d).not.toBeNull();
    expect(d!.x).toBeCloseTo(300, 6);
    expect(d!.y).toBeCloseTo(400, 6);
  });
});
