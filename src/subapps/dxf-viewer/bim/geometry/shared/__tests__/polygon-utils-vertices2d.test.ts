/**
 * `projectVerticesTo2D` — SSoT projection `{x,y}`-vertices → `Point2D[]` (ADR-597 §17.11).
 * Αντικαθιστά το διάσπαρτο idiom `footprint.vertices.map((v) => ({ x: v.x, y: v.y }))`
 * σε corner-projection snap paths (κολόνα/θεμέλιο/δοκός) + characteristic points.
 */

import { projectVerticesTo2D } from '../polygon-utils';

describe('projectVerticesTo2D', () => {
  it('προβάλλει Point3D footprint → Point2D (z αφαιρείται)', () => {
    const src = [
      { x: 0, y: 0, z: 10 },
      { x: 1000, y: 0, z: 10 },
      { x: 1000, y: 500, z: 10 },
    ];
    expect(projectVerticesTo2D(src)).toEqual([
      { x: 0, y: 0 },
      { x: 1000, y: 0 },
      { x: 1000, y: 500 },
    ]);
  });

  it('διατηρεί ακριβώς το winding order (μηδέν αναδιάταξη — κρίσιμο για L/Γ/T/U)', () => {
    // Κοίλο L σε winding order· το output πρέπει να είναι ίδιας σειράς.
    const lShape = [
      { x: 0, y: 0 }, { x: 600, y: 0 }, { x: 600, y: 200 },
      { x: 200, y: 200 }, { x: 200, y: 600 }, { x: 0, y: 600 },
    ];
    expect(projectVerticesTo2D(lShape)).toEqual(lShape.map((v) => ({ x: v.x, y: v.y })));
  });

  it('επιστρέφει fresh objects — δεν κάνει alias την είσοδο', () => {
    const src = [{ x: 5, y: 7 }];
    const out = projectVerticesTo2D(src);
    expect(out[0]).not.toBe(src[0]);
    expect(out[0]).toEqual({ x: 5, y: 7 });
  });

  it('άδειο input → άδειο array', () => {
    expect(projectVerticesTo2D([])).toEqual([]);
  });
});
