/**
 * ADR-539 Φ4b — PolygonMode3DStore multi-face selection set.
 * `selectedFaces` is the SSoT; `selectedFace` is the anchor (last toggled/selected).
 * Verifies replace-select, Shift-toggle add/remove, anchor tracking, clear, and that
 * `setActive(false)` / `reset()` wipe the set.
 */

import { usePolygonMode3DStore } from '../PolygonMode3DStore';

const face = (bimId: string, faceKey: string) => ({ bimId, faceKey });

beforeEach(() => {
  usePolygonMode3DStore.getState().reset();
  usePolygonMode3DStore.getState().setActive(true, 'col-1');
});

describe('PolygonMode3DStore — multi-face select', () => {
  it('selectFace replaces the set with a single face (anchor = that face)', () => {
    usePolygonMode3DStore.getState().selectFace(face('col-1', 'top'));
    expect(usePolygonMode3DStore.getState().selectedFaces).toEqual([face('col-1', 'top')]);
    expect(usePolygonMode3DStore.getState().selectedFace).toEqual(face('col-1', 'top'));

    usePolygonMode3DStore.getState().selectFace(face('col-1', 'bottom'));
    expect(usePolygonMode3DStore.getState().selectedFaces).toEqual([face('col-1', 'bottom')]);
  });

  it('selectFace(null) clears the set and the anchor', () => {
    usePolygonMode3DStore.getState().selectFace(face('col-1', 'top'));
    usePolygonMode3DStore.getState().selectFace(null);
    expect(usePolygonMode3DStore.getState().selectedFaces).toEqual([]);
    expect(usePolygonMode3DStore.getState().selectedFace).toBeNull();
  });

  it('toggleFace adds a missing face and moves the anchor onto it', () => {
    usePolygonMode3DStore.getState().selectFace(face('col-1', 'top'));
    usePolygonMode3DStore.getState().toggleFace(face('col-2', 'top'));
    expect(usePolygonMode3DStore.getState().selectedFaces).toEqual([
      face('col-1', 'top'), face('col-2', 'top'),
    ]);
    expect(usePolygonMode3DStore.getState().selectedFace).toEqual(face('col-2', 'top'));
  });

  it('toggleFace removes an existing face (anchor falls back to last remaining)', () => {
    usePolygonMode3DStore.getState().selectFace(face('col-1', 'top'));
    usePolygonMode3DStore.getState().toggleFace(face('col-2', 'top'));
    usePolygonMode3DStore.getState().toggleFace(face('col-2', 'top')); // remove it again
    expect(usePolygonMode3DStore.getState().selectedFaces).toEqual([face('col-1', 'top')]);
    expect(usePolygonMode3DStore.getState().selectedFace).toEqual(face('col-1', 'top'));
  });

  it('toggleFace distinguishes faces cross-entity by bimId|faceKey identity', () => {
    usePolygonMode3DStore.getState().toggleFace(face('col-1', 'top'));
    usePolygonMode3DStore.getState().toggleFace(face('col-2', 'top')); // same faceKey, other entity
    expect(usePolygonMode3DStore.getState().selectedFaces).toHaveLength(2);
  });

  it('removing the only face leaves an empty set and a null anchor', () => {
    usePolygonMode3DStore.getState().toggleFace(face('col-1', 'top'));
    usePolygonMode3DStore.getState().toggleFace(face('col-1', 'top'));
    expect(usePolygonMode3DStore.getState().selectedFaces).toEqual([]);
    expect(usePolygonMode3DStore.getState().selectedFace).toBeNull();
  });

  it('clearFaces empties the set but keeps active/target', () => {
    usePolygonMode3DStore.getState().toggleFace(face('col-1', 'top'));
    usePolygonMode3DStore.getState().clearFaces();
    expect(usePolygonMode3DStore.getState().selectedFaces).toEqual([]);
    expect(usePolygonMode3DStore.getState().selectedFace).toBeNull();
    expect(usePolygonMode3DStore.getState().active).toBe(true);
    expect(usePolygonMode3DStore.getState().targetBimId).toBe('col-1');
  });

  it('setActive(false) wipes the selection set', () => {
    usePolygonMode3DStore.getState().toggleFace(face('col-1', 'top'));
    usePolygonMode3DStore.getState().setActive(false);
    expect(usePolygonMode3DStore.getState().selectedFaces).toEqual([]);
    expect(usePolygonMode3DStore.getState().selectedFace).toBeNull();
  });
});

// ADR-539 (Giorgio 2026-07-22) — τρία modes βαφής (ΣΩΜΑ/ΣΟΒΑΣ/ΠΟΛΥΓΩΝΑ)· `active` = derived
// (`targetLayer === 'polygon'`), ώστε το per-face picking/faced-render να ισχύει ΜΟΝΟ στο polygon.
describe('PolygonMode3DStore — paint mode (body/finish/polygon)', () => {
  it('setTargetLayer("polygon") activates per-face picking', () => {
    usePolygonMode3DStore.getState().setTargetLayer('polygon');
    expect(usePolygonMode3DStore.getState().targetLayer).toBe('polygon');
    expect(usePolygonMode3DStore.getState().active).toBe(true);
  });

  it('setTargetLayer("body"/"finish") is entity-level → active is false', () => {
    usePolygonMode3DStore.getState().setTargetLayer('body');
    expect(usePolygonMode3DStore.getState().active).toBe(false);
    usePolygonMode3DStore.getState().setTargetLayer('finish');
    expect(usePolygonMode3DStore.getState().active).toBe(false);
  });

  it('leaving polygon mode clears the per-face selection', () => {
    usePolygonMode3DStore.getState().setTargetLayer('polygon');
    usePolygonMode3DStore.getState().selectFace(face('col-1', 'top'));
    usePolygonMode3DStore.getState().setTargetLayer('finish');
    expect(usePolygonMode3DStore.getState().selectedFaces).toEqual([]);
    expect(usePolygonMode3DStore.getState().selectedFace).toBeNull();
  });

  it('setActive(true) maps to polygon mode; reset returns to body', () => {
    usePolygonMode3DStore.getState().setActive(true, 'col-9');
    expect(usePolygonMode3DStore.getState().targetLayer).toBe('polygon');
    usePolygonMode3DStore.getState().reset();
    expect(usePolygonMode3DStore.getState().targetLayer).toBe('body');
    expect(usePolygonMode3DStore.getState().active).toBe(false);
  });
});
