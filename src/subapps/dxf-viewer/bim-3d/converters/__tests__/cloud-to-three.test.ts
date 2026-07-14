/**
 * ADR-650 M8β/Β — ο converter του νέφους: `PointCloudPreview` → `BufferGeometry`.
 *
 * Ground truth (χειρόγραφα, όχι «ό,τι βγάλει ο κώδικας»): το preview κουβαλά LOCAL mm x/y + WORLD
 * mm z, και το three είναι μέτρα Y-up με z = −north. Άρα για origin (1000, 2000) mm:
 *   local (0, 0, 0)          → world mm (1000, 2000, 0)    → three (1, 0, −2)
 *   local (1000, 2000, 3000) → world mm (2000, 4000, 3000) → three (2, 3, −4)
 * Αν κάποιος «διορθώσει» τον άξονα ή προσθέσει το origin στο Z, αυτό το test πέφτει.
 */

import { cloudPreviewToBufferGeometry } from '../cloud-to-three';
import { PREVIEW_COLOR_FALLBACK } from '../../../systems/topography/pointcloud/asprs-las-spec';
import { makeWorldToDisplayProjector } from '../../../systems/geo-referencing/geo-transform';
import type { PointCloudPreview } from '../../../systems/topography/pointcloud/pointcloud-types';

function preview(positions: number[], colors: number[] | null): PointCloudPreview {
  return {
    count: positions.length / 3,
    positions: new Float32Array(positions),
    colors: colors ? new Float32Array(colors) : null,
    origin: { x: 1000, y: 2000 },
  };
}

describe('cloudPreviewToBufferGeometry (ADR-650 M8β/Β)', () => {
  it('μεταφέρει LOCAL mm → three-world m (Y-up, z = −north) και δεν μετατοπίζει ΠΟΤΕ το Z', () => {
    const geometry = cloudPreviewToBufferGeometry(preview([0, 0, 0, 1000, 2000, 3000], [1, 0, 0, 0, 1, 0]));

    const position = geometry!.getAttribute('position');
    expect(position.count).toBe(2);
    expect(Array.from(position.array)).toEqual([1, 0, -2, 2, 3, -4]);
  });

  it('περνά τα χρώματα ASPRS αυτούσια (per-vertex, ίδια σειρά με τις θέσεις)', () => {
    const geometry = cloudPreviewToBufferGeometry(preview([0, 0, 0, 1000, 2000, 3000], [1, 0, 0, 0, 1, 0]));

    const color = geometry!.getAttribute('color');
    expect(color.count).toBe(2);
    expect(Array.from(color.array)).toEqual([1, 0, 0, 0, 1, 0]);
  });

  it('χωρίς ταξινόμηση πηγής, κάθε σημείο παίρνει το ΕΝΑ κοινό fallback (SSoT asprs-las-spec)', () => {
    const geometry = cloudPreviewToBufferGeometry(preview([0, 0, 0], null));

    // toBeCloseTo, όχι toEqual: το 0.8 δεν είναι ακριβώς αναπαραστάσιμο σε Float32.
    const channels = Array.from(geometry!.getAttribute('color').array);
    expect(channels).toHaveLength(3);
    channels.forEach((channel, i) => expect(channel).toBeCloseTo(PREVIEW_COLOR_FALLBACK[i]!, 6));
  });

  it('πετά το μη-πεπερασμένο σημείο αντί να ακυρώσει το νέφος (NaN bbox → μαύρη σκηνή, ADR-537)', () => {
    const geometry = cloudPreviewToBufferGeometry(
      preview([0, 0, 0, NaN, 0, 0, 1000, 2000, 3000], [1, 0, 0, 0, 1, 0, 0, 0, 1]),
    );

    const position = geometry!.getAttribute('position');
    expect(position.count).toBe(2); // το μεσαίο έφυγε…
    expect(Array.from(position.array)).toEqual([1, 0, -2, 2, 3, -4]);
    // …και τα χρώματα έμειναν συγχρονισμένα με τις θέσεις που ΕΠΕΖΗΣΑΝ (όχι με τα αρχικά index).
    expect(Array.from(geometry!.getAttribute('color').array)).toEqual([1, 0, 0, 0, 0, 1]);
  });

  it('επιστρέφει null όταν δεν υπάρχει τίποτα να ζωγραφιστεί (άδειο ή όλο NaN)', () => {
    expect(cloudPreviewToBufferGeometry(preview([], []))).toBeNull();
    expect(cloudPreviewToBufferGeometry(preview([NaN, NaN, NaN], [1, 1, 1]))).toBeNull();
  });

  it('ADR-650 M10b — ένας ΜΗ-identity projector κάθεται το νέφος στο building-DISPLAY frame (κάτω από το κτίριο)', () => {
    // Ground truth: origin (1000,2000)· projector = καθαρή μετατόπιση με originWorld = (1000,2000),
    // άρα ΕΓΣΑ world → display = world − (1000,2000).
    //   local (0,1000,0)      → world (1000,3000,0)    → display (0,1000)    → three (0, 0, -1)
    //   local (1000,2000,3000)→ world (2000,4000,3000) → display (1000,2000) → three (1, 3, -2)
    const projector = makeWorldToDisplayProjector({ originWorld: { x: 1000, y: 2000 }, rotationDeg: 0 });
    const geometry = cloudPreviewToBufferGeometry(preview([0, 1000, 0, 1000, 2000, 3000], [1, 0, 0, 0, 1, 0]), projector);

    expect(Array.from(geometry!.getAttribute('position').array)).toEqual([0, 0, -1, 1, 3, -2]);
  });

  it('ADR-650 M10b — identity/unset projector είναι byte-for-byte το προηγούμενο (ΕΓΣΑ world)', () => {
    const identity = makeWorldToDisplayProjector(null);
    const withIdentity = cloudPreviewToBufferGeometry(preview([0, 0, 0, 1000, 2000, 3000], [1, 0, 0, 0, 1, 0]), identity);
    const without = cloudPreviewToBufferGeometry(preview([0, 0, 0, 1000, 2000, 3000], [1, 0, 0, 0, 1, 0]));

    expect(Array.from(withIdentity!.getAttribute('position').array)).toEqual(
      Array.from(without!.getAttribute('position').array),
    );
  });
});
