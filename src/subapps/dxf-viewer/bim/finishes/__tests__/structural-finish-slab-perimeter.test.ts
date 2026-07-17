/**
 * ADR-534 Φ5c — Η ΠΛΑΚΑ ως silhouette member: η κατακόρυφη περιμετρική «φάσα»/fascia.
 *
 * Integration πάνω στην `computeStructuralFinishSilhouette` (mirror του `wall-finish-source.test.ts`
 * §«ο τοίχος ως member»). Επαληθεύει ότι μια flat finish-member πλάκα:
 *   (1) παράγει band σοβά στο περίγραμμά της·
 *   (2) `ground`/χωρίς-finish → καμία band (τα ΙΔΙΑ gates του `slabIsFinishMember`)·
 *   (3) tilted → εξαιρείται (flat union μόνο, ADR-404)·
 *   (4) πλάκα + τοίχος με συνεπίπεδη ακμή → η φάσα **σβήνει στην επαφή** (union < separate).
 *
 * Όλα σε **mm** (sceneUnits 'mm' → s=1). Δεν δοκιμάζει το ΟΠΤΙΚΟ αποτέλεσμα της φάσας
 * (μπαλκόνι/δώμα/ενδιάμεσο) — αυτό απαιτεί C4D έλεγχο, δεν προβλέπεται από κώδικα.
 */

import { computeStructuralFinishSilhouette, type SlabFinishMemberSource } from '../structural-finish-scene-silhouette';
import { type WallFinishObstacle } from '../structural-finish-scene';
import { createDefaultStructuralFinishSpec, type StructuralFinishSpec } from '../structural-finish-types';
import { buildDefaultWallParams } from '../../../hooks/drawing/wall-completion';
import type { SlabKind, SlabSlope } from '../../types/slab-types';

/** Ορθογώνια flat πλάκα (mm). `top` = πάνω παρειά (FFL)· κρέμεται κάτω 200mm. */
function slab(
  outline: readonly { x: number; y: number }[],
  opts: {
    kind?: SlabKind;
    finish?: StructuralFinishSpec | undefined;
    top?: number;
    geometryType?: 'box' | 'tilted';
    slope?: SlabSlope;
  } = {},
): SlabFinishMemberSource {
  return {
    params: {
      kind: opts.kind ?? 'floor',
      finish: 'finish' in opts ? opts.finish : createDefaultStructuralFinishSpec(),
      dna: undefined,
      outline: { vertices: outline.map((p) => ({ x: p.x, y: p.y, z: 0 })) },
      levelElevation: opts.top ?? 3000,
      heightOffsetFromLevel: 0,
      thickness: 200,
      geometryType: opts.geometryType ?? 'box',
      slope: opts.slope,
      sceneUnits: 'mm',
    },
  };
}

/** Ορθογώνιο footprint (CCW) γύρω από ένα rect. */
const rect = (x0: number, y0: number, x1: number, y1: number) =>
  [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];

/** Τοίχος (mm) με ελεύθερη κορυφή 3000 → z-band [0, 3000] που καλύπτει τη ζώνη της πλάκας. */
const wall = (id: string, x0: number, y0: number, x1: number, y1: number): WallFinishObstacle => ({
  id,
  kind: 'straight',
  params: buildDefaultWallParams({ x: x0, y: y0 }, { x: x1, y: y1 }, { height: 3000 }, 'mm'),
});

const totalLength = (segs: readonly { lengthM: number }[]): number =>
  segs.reduce((s, seg) => s + seg.lengthM, 0);
const bandsLength = (bands: readonly { faces: { segments: readonly { lengthM: number }[] } }[]): number =>
  bands.reduce((s, b) => s + totalLength(b.faces.segments), 0);

describe('computeStructuralFinishSilhouette — η πλάκα ως member (ADR-534 Φ5c)', () => {
  it('flat floor slab (active finish) → παράγει band σοβά στο περίγραμμα', () => {
    const bands = computeStructuralFinishSilhouette({
      columns: [], beams: [], walls: [], floorElevationMm: 0,
      slabs: [slab(rect(0, 0, 4000, 3000))],
    });
    expect(bands.length).toBeGreaterThanOrEqual(1);
    expect(bands[0].faces.segments.length).toBeGreaterThan(0);
  });

  it('ground slab → καμία band (kind gate — ίδιο με slabIsFinishMember)', () => {
    const bands = computeStructuralFinishSilhouette({
      columns: [], beams: [], walls: [], floorElevationMm: 0,
      slabs: [slab(rect(0, 0, 4000, 3000), { kind: 'ground' })],
    });
    expect(bands).toHaveLength(0);
  });

  it('floor slab ΧΩΡΙΣ finish spec (legacy) → καμία band', () => {
    const bands = computeStructuralFinishSilhouette({
      columns: [], beams: [], walls: [], floorElevationMm: 0,
      slabs: [slab(rect(0, 0, 4000, 3000), { finish: undefined })],
    });
    expect(bands).toHaveLength(0);
  });

  it('tilted floor slab → εξαιρείται από το flat union (ADR-404)', () => {
    const bands = computeStructuralFinishSilhouette({
      columns: [], beams: [], walls: [], floorElevationMm: 0,
      slabs: [slab(rect(0, 0, 4000, 3000), { geometryType: 'tilted', slope: { direction: 0, angle: 2 } })],
    });
    expect(bands).toHaveLength(0);
  });

  it('πλάκα + τοίχος με συνεπίπεδη ακμή → η φάσα σβήνει στην επαφή (union < separate)', () => {
    const floorSlab = slab(rect(0, 0, 4000, 3000));
    // Τοίχος πάνω στην κάτω ακμή της πλάκας (y=0) → footprints επικαλύπτονται στη ζώνη [2800,3000] →
    // το union τα ενώνει → ο σοβάς της κοινής ακμής εξαφανίζεται.
    const joined = computeStructuralFinishSilhouette({
      columns: [], beams: [], walls: [wall('w', 0, 0, 4000, 0)], floorElevationMm: 0,
      slabs: [floorSlab],
    });
    // Ο ίδιος τοίχος μακριά από την πλάκα → κανένα union → πλήρες περίγραμμα και των δύο.
    const separate = computeStructuralFinishSilhouette({
      columns: [], beams: [], walls: [wall('w', 0, 20000, 4000, 20000)], floorElevationMm: 0,
      slabs: [floorSlab],
    });
    expect(bandsLength(joined)).toBeLessThan(bandsLength(separate));
  });
});
