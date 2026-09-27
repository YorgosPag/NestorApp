/**
 * @fileoverview **Η ΔΙΑΤΑΞΗ ΚΑΙ Η ΓΕΩΜΕΤΡΙΑ ΤΟΥ TILESET** (ADR-884 Φ2α · §4.9).
 *
 * - **Δ** — διάταξη: μέγεθος όψης από το πλάτος (Pannellum `width/π`, πολλαπλάσιο 512, ταβάνι 4096), επίπεδα, επιλογή
 *   επιπέδου ≤ όριο συσκευής, διαδρομές που **δέχεται** το `tourMediaObjectPath`.
 * - **Γ** — γεωμετρία: ένα σημάδι σε γνωστό yaw/κλίση του equirect καταλήγει στην όψη/θέση που λέει η **ίδια** σύμβαση
 *   (`directionToCubeFace`) — ο ψήστης και ο θεατής δεν μπορούν να διαφωνήσουν χωρίς να κοκκινίσει αυτό.
 * - **Ρ** — ραφή: η αναδίπλωση στις 180° δεν αφήνει γραμμή.
 */

import { renderCubeFace, type RawImage } from '../equirect-to-cube';
import {
  TOUR_FACE_SIZE_CEILING,
  faceSizeForEquirect,
  levelIndexFor,
  previewSegments,
  tileSegments,
  tilesPerSide,
  tilesetLevels,
} from '../tour-tileset-layout';
import { tourMediaObjectPath } from '../../tour-media-path';
import { TOUR_CUBE_FACES, directionToCubeFace, yawPitchToDirection, type TourCubeFace } from '../../viewer/tour-cube-faces';

const HASH = 'a'.repeat(64);
const deg = (d: number) => (d * Math.PI) / 180;

describe('Δ — διάταξη', () => {
  it.each([
    [1024, 512], [4096, 1536], [5760, 2048], [7680, 2560], [11968, 3584], [30000, TOUR_FACE_SIZE_CEILING],
  ])('equirect %i ⇒ όψη %i (πολλαπλάσιο του πλακιδίου)', (width, face) => {
    expect(faceSizeForEquirect(width)).toBe(face);
    expect(face % 512).toBe(0);
  });

  it('επίπεδα 512·2ᵏ ως την όψη, τελευταίο η ίδια η όψη', () => {
    expect(tilesetLevels(512)).toEqual([512]);
    expect(tilesetLevels(2560)).toEqual([512, 1024, 2048, 2560]);
    expect(tilesetLevels(4096)).toEqual([512, 1024, 2048, 4096]);
    expect(tilesPerSide(2560)).toBe(5);
  });

  it('επιλογή επιπέδου: το μεγαλύτερο που χωρά — ποτέ κάτω από το πρώτο', () => {
    expect(levelIndexFor(2560, 2048)).toBe(2);
    expect(levelIndexFor(2560, 4096)).toBe(3);
    expect(levelIndexFor(2560, 256)).toBe(0);
  });

  it('κάθε διαδρομή περνά από τα επιτρεπτά τμήματα του media route', () => {
    for (const face of TOUR_CUBE_FACES) expect(tourMediaObjectPath('stour_1', tileSegments(HASH, 3, face, 4, 4))).not.toBeNull();
    expect(tourMediaObjectPath('stour_1', previewSegments(HASH))).toBe(`tour-tiles/stour_1/${HASH}/v1/preview.jpg`);
  });
});

/** Equirect μαύρο με λευκό σημάδι γύρω από (yaw, κλίση). */
function markedEquirect(yaw: number, pitch: number, width = 720): RawImage {
  const height = width / 2;
  const data = new Uint8Array(width * height * 3);
  const cx = (yaw / (2 * Math.PI) + 0.5) * width;
  const cy = (0.5 - pitch / Math.PI) * height;
  for (let y = Math.floor(cy) - 2; y <= Math.floor(cy) + 2; y++) {
    for (let x = Math.floor(cx) - 2; x <= Math.floor(cx) + 2; x++) {
      const at = (Math.max(0, Math.min(height - 1, y)) * width + ((x % width) + width) % width) * 3;
      data.fill(255, at, at + 3);
    }
  }
  return { data, width, height, channels: 3 };
}

function brightestOf(image: RawImage): { readonly value: number; readonly u: number; readonly v: number } {
  let best = { value: -1, u: 0, v: 0 };
  for (let j = 0; j < image.height; j++) {
    for (let i = 0; i < image.width; i++) {
      const value = image.data[(j * image.width + i) * 3];
      if (value > best.value) best = { value, u: (i + 0.5) / image.width, v: 1 - (j + 0.5) / image.height };
    }
  }
  return best;
}

describe('Γ — το σημάδι πέφτει εκεί που λέει η σύμβαση', () => {
  const SIZE = 96;
  it.each([
    ['μπροστά, κέντρο', 0, 0],
    ['δεξιά', 90, 10],
    ['πίσω, πάνω στη ραφή', 180, -15],
    ['αριστερά', -90, 25],
    ['ψηλά', 30, 70],
    ['χαμηλά', -120, -65],
    ['γωνία όψεων', 40, 20],
  ])('%s (yaw %i°, κλίση %i°)', (_label, yawDeg, pitchDeg) => {
    const expected = directionToCubeFace(yawPitchToDirection(deg(yawDeg), deg(pitchDeg)));
    const source = markedEquirect(deg(yawDeg), deg(pitchDeg));
    const found = brightestOf(renderCubeFace(source, expected.face, SIZE));
    expect(found.value).toBeGreaterThan(0);
    expect(Math.abs(found.u - expected.u)).toBeLessThan(4 / SIZE);
    expect(Math.abs(found.v - expected.v)).toBeLessThan(4 / SIZE);
    for (const other of TOUR_CUBE_FACES.filter((f): f is TourCubeFace => f !== expected.face)) {
      // Το σημάδι ζει σε ΜΙΑ όψη — εκτός αν πέφτει στην ακμή (δεν διαλέγουμε τέτοιες θέσεις).
      expect(brightestOf(renderCubeFace(source, other, SIZE)).value).toBe(0);
    }
  });
});

describe('Ρ — ραφή 180°', () => {
  it('ομαλή κλίση φωτεινότητας κατά το μήκος ⇒ καμία απότομη στήλη στην πίσω όψη', () => {
    const width = 720;
    const height = 360;
    const data = new Uint8Array(width * height * 3);
    // Φωτεινότητα = |μήκος| — συνεχής και στη ραφή (±180° ⇒ ίδια τιμή).
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const lon = ((x + 0.5) / width - 0.5) * 360;
        data.fill(Math.round((Math.abs(lon) / 180) * 255), (y * width + x) * 3, (y * width + x) * 3 + 3);
      }
    }
    const back = renderCubeFace({ data, width, height, channels: 3 }, 'back', 64);
    const row = 32;
    let maxJump = 0;
    for (let i = 1; i < 64; i++) {
      maxJump = Math.max(maxJump, Math.abs(back.data[(row * 64 + i) * 3] - back.data[(row * 64 + i - 1) * 3]));
    }
    expect(maxJump).toBeLessThan(12);
  });

  it('το εικονοστοιχείο ΠΑΝΩ στη ραφή μιγνύει την πρώτη και την τελευταία στήλη (αναδίπλωση, όχι σύσφιξη)', () => {
    // Αριστερό μισό μαύρο, δεξί λευκό ⇒ στήλη 0 = 0, τελευταία = 255. Μονή πλευρά ⇒ το κέντρο της πίσω όψης είναι
    // ακριβώς yaw 180° — ανάμεσα στις δύο στήλες. Σύσφιξη θα έδινε 255· αναδίπλωση δίνει το μέσο.
    const width = 720;
    const height = 360;
    const data = new Uint8Array(width * height * 3);
    for (let y = 0; y < height; y++) data.fill(255, (y * width + width / 2) * 3, (y * width + width) * 3);
    const size = 63;
    const back = renderCubeFace({ data, width, height, channels: 3 }, 'back', size);
    const centre = back.data[((31 * size) + 31) * 3];
    expect(centre).toBeGreaterThan(100);
    expect(centre).toBeLessThan(160);
  });
});
