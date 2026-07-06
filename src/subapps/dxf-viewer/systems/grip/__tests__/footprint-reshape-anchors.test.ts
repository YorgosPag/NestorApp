/**
 * SSoT των «σταθερών σημείων» μιας reshape λαβής πολυγωνικού footprint (ADR-508 §grip-tracking).
 * Κλειδώνει: alignment anchors = σταθερές κορυφές· polar origin = prev γείτονας (vertex) / edge-start
 * (midpoint) / null (παρειά)· ενεργό footprint grip-kind priority.
 */

import {
  getFootprintReshapeAlignmentAnchors,
  getFootprintReshapePolarAnchor,
  resolveActiveFootprintGripKind,
} from '../footprint-reshape-anchors';

// Τετράγωνο (CCW), 4 κορυφές — ordered polygon winding.
const SQUARE = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 10 },
  { x: 0, y: 10 },
];

describe('getFootprintReshapeAlignmentAnchors', () => {
  it('vertex grip → όλες οι κορυφές ΕΚΤΟΣ της κινούμενης', () => {
    const anchors = getFootprintReshapeAlignmentAnchors(SQUARE, 'slab-vertex-1');
    expect(anchors).toHaveLength(3);
    expect(anchors).not.toContainEqual({ x: 10, y: 0 }); // η κινούμενη (idx 1) εξαιρείται
    expect(anchors).toContainEqual({ x: 0, y: 0 });
  });

  it('column poly-vertex grip → ίδιος κανόνας (εξαιρεί την κινούμενη)', () => {
    const anchors = getFootprintReshapeAlignmentAnchors(SQUARE, 'column-poly-vertex-2');
    expect(anchors).toHaveLength(3);
    expect(anchors).not.toContainEqual({ x: 10, y: 10 });
  });

  it('edge-midpoint grip → ΟΛΕΣ οι κορυφές (η νέα κορυφή δεν υπάρχει ακόμα)', () => {
    expect(getFootprintReshapeAlignmentAnchors(SQUARE, 'slab-edge-midpoint-0')).toHaveLength(4);
  });

  it('παρειά/parametric → όλες οι κορυφές (καμία υπάρχουσα δεν φεύγει)', () => {
    expect(getFootprintReshapeAlignmentAnchors(SQUARE, 'column-width')).toHaveLength(4);
  });

  it('undefined kind ή <2 κορυφές → []', () => {
    expect(getFootprintReshapeAlignmentAnchors(SQUARE, undefined)).toEqual([]);
    expect(getFootprintReshapeAlignmentAnchors([{ x: 0, y: 0 }], 'slab-vertex-0')).toEqual([]);
  });
});

describe('getFootprintReshapePolarAnchor', () => {
  it('vertex grip → ο prev γείτονας (closed ring)', () => {
    // idx 2 → prev = idx 1 = (10,0)
    expect(getFootprintReshapePolarAnchor(SQUARE, 'slab-vertex-2')).toEqual({ x: 10, y: 0 });
  });

  it('vertex grip idx 0 → wraparound prev = τελευταία κορυφή', () => {
    expect(getFootprintReshapePolarAnchor(SQUARE, 'column-poly-vertex-0')).toEqual({ x: 0, y: 10 });
  });

  it('edge-midpoint grip → το πρώτο άκρο της ακμής', () => {
    // slab-edge-midpoint-1 → ακμή 1 = [v1, v2], πρώτο άκρο = v1 = (10,0)
    expect(getFootprintReshapePolarAnchor(SQUARE, 'slab-edge-midpoint-1')).toEqual({ x: 10, y: 0 });
  });

  it('column-poly-edge (insert) → πρώτο άκρο ακμής', () => {
    expect(getFootprintReshapePolarAnchor(SQUARE, 'column-poly-edge-0')).toEqual({ x: 0, y: 0 });
  });

  it('παρειά κολόνας (single-axis) → null (POLAR άσχετο)', () => {
    expect(getFootprintReshapePolarAnchor(SQUARE, 'column-width')).toBeNull();
    expect(getFootprintReshapePolarAnchor(SQUARE, 'column-depth')).toBeNull();
  });

  it('undefined / out-of-range → null', () => {
    expect(getFootprintReshapePolarAnchor(SQUARE, undefined)).toBeNull();
    expect(getFootprintReshapePolarAnchor(SQUARE, 'slab-vertex-9')).toBeNull();
  });
});

describe('resolveActiveFootprintGripKind', () => {
  it('επιστρέφει το ενεργό footprint grip-kind (priority column→…→mep)', () => {
    expect(resolveActiveFootprintGripKind({ slabGripKind: 'slab-vertex-0' })).toBe('slab-vertex-0');
    expect(resolveActiveFootprintGripKind({ roofGripKind: 'roof-edge-midpoint-1' })).toBe('roof-edge-midpoint-1');
    expect(resolveActiveFootprintGripKind({
      columnGripKind: 'column-poly-vertex-1', slabGripKind: 'slab-vertex-0',
    })).toBe('column-poly-vertex-1');
  });

  it('κανένα footprint grip → undefined', () => {
    expect(resolveActiveFootprintGripKind({})).toBeUndefined();
  });
});
