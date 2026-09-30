import 'server-only';

/**
 * @fileoverview **Η ΣΑΡΩΣΗ ΠΡΟΣΩΠΩΝ ΜΙΑΣ ΛΗΨΗΣ** — equirect → 6 όψεις (με επικάλυψη) × πυραμίδα × πλακίδια → YuNet → κύκλοι
 * στη σφαίρα (ADR-884 Φ2ζ ζ4 · §4.15 · Δ10.1). Μόνο υπολογισμός — η εγγραφή είναι του γραφέα (`recordFaceScan`).
 * @related `face-detection/yunet-session.ts` (η εκτέλεση) · `face-detection/yunet-decode.ts` (οι αριθμοί) ·
 *   `lib/spatial-tour/tileset/tour-face-regions.ts` (πλαίσιο → κύκλος, διπλά) · `tour-tileset-baker.ts` (ο καταναλωτής)
 * @module server/spatial-tour/tour-face-scan
 *
 * 🏆 **Στις όψεις του κύβου, όχι στο equirect**: το equirect παραμορφώνει τα πρόσωπα προς τους πόλους και σπάει όσα κάθονται στη
 *   ραφή ±180° — η ορθογραφική όψη δείχνει ό,τι είδε ο φακός. Κάθε όψη αποδίδεται **πλατύτερη** (`TOUR_FACE_SCAN_OVERSCAN`) ώστε
 *   ένα πρόσωπο πάνω σε ακμή να βρίσκεται ολόκληρο σε μία από τις δύο γειτονικές.
 * 🏆 **Πυραμίδα**: το YuNet πιάνει ~10–300 px ⇒ τρεις οκτάβες, από το μακρινό πρόσωπο ως εκείνο δίπλα στον φακό.
 * 🧠 **Φραγμένη μνήμη**: η μεγάλη βαθμίδα σε πλακίδια με επικάλυψη· μία όψη τη φορά.
 */

import {
  TOUR_FACE_SCAN_MAX_FACE_PX,
  TOUR_FACE_SCAN_MAX_TILE_PX,
  TOUR_FACE_SCAN_OCTAVES,
  TOUR_FACE_SCAN_OVERSCAN,
  TOUR_FACE_SCAN_TILE_OVERLAP_PX,
} from '@/constants/spatial-tour-vocabulary';
import { renderCubeFace, type RawImage } from '@/lib/spatial-tour/tileset/equirect-to-cube';
import { distinctFaces, faceOnSphereOf, type FaceBox, type FaceOnSphere } from '@/lib/spatial-tour/tileset/tour-face-regions';
import { faceSizeForEquirect } from '@/lib/spatial-tour/tileset/tour-tileset-layout';
import { TOUR_CUBE_FACES, type TourCubeFace } from '@/lib/spatial-tour/viewer/tour-cube-faces';

import { decodeYunet, yunetInputOf, type PixelRect } from './face-detection/yunet-decode';
import { runFaceDetector } from './face-detection/yunet-session';
import { resized } from './tour-tileset-render';

/**
 * **Οι πλευρές της πυραμίδας** για equirect πλάτους `width`: η εγγενής όψη (με ταβάνι), και κάθε επόμενη στη μισή. Ποτέ πάνω από
 * την εγγενή — η μεγέθυνση δεν φέρνει πρόσωπα που δεν υπάρχουν στα pixel.
 */
export function faceScanSizes(width: number): readonly number[] {
  const first = Math.min(TOUR_FACE_SCAN_MAX_FACE_PX, faceSizeForEquirect(width));
  return Array.from({ length: TOUR_FACE_SCAN_OCTAVES }, (_, octave) => Math.max(1, Math.round(first / 2 ** octave)));
}

/** Οι αρχές των πλακιδίων σε έναν άξονα μήκους `length`: όσο λιγότερα χωρούν με επικάλυψη ≥ `TOUR_FACE_SCAN_TILE_OVERLAP_PX`. */
function tileStarts(length: number): { readonly starts: readonly number[]; readonly span: number } {
  if (length <= TOUR_FACE_SCAN_MAX_TILE_PX) return { starts: [0], span: length };
  const overlap = TOUR_FACE_SCAN_TILE_OVERLAP_PX;
  const count = Math.ceil((length - overlap) / (TOUR_FACE_SCAN_MAX_TILE_PX - overlap));
  const span = Math.ceil((length + (count - 1) * overlap) / count);
  return { starts: Array.from({ length: count }, (_, k) => Math.min(k * (span - overlap), length - span)), span };
}

/** **Τα πλακίδια σάρωσης** μιας τετράγωνης εικόνας πλευράς `size` — ένα, αν χωρά. Καλύπτουν ολόκληρη την εικόνα. */
export function faceScanTiles(size: number): readonly PixelRect[] {
  const { starts, span } = tileStarts(size);
  return starts.flatMap((top) => starts.map((left) => ({ left, top, width: span, height: span })));
}

/** Τα πλαίσια μιας εικόνας (σε pixel **της εικόνας**) — πλακίδιο-πλακίδιο. */
async function boxesOfImage(image: RawImage): Promise<readonly FaceBox[]> {
  const boxes: FaceBox[] = [];
  for (const tile of faceScanTiles(image.width)) {
    const input = yunetInputOf(image, tile);
    for (const box of decodeYunet(await runFaceDetector(input), input)) boxes.push({ ...box, x: box.x + tile.left, y: box.y + tile.top });
  }
  return boxes;
}

/** Τα πρόσωπα μιας όψης, σε όλες τις δοσμένες βαθμίδες (η πρώτη αποδίδεται, οι υπόλοιπες σμικρύνονται από αυτήν). */
export async function facesOfCubeFace(equirect: RawImage, face: TourCubeFace, sizes: readonly number[]): Promise<FaceOnSphere[]> {
  const [first, ...rest] = sizes;
  const largest = renderCubeFace(equirect, face, first, TOUR_FACE_SCAN_OVERSCAN);
  const found: FaceOnSphere[] = [];
  for (const size of [first, ...rest]) {
    const image = size === first ? largest : await resized(largest, size);
    const raster = { face, size, overscan: TOUR_FACE_SCAN_OVERSCAN };
    for (const box of await boxesOfImage(image)) found.push(faceOnSphereOf(raster, box));
  }
  return found;
}

/**
 * **Σάρωσε μια λήψη.** Διαβάζει μόνο — το equirect μένει ανέπαφο (το θόλωμα του ψήστη γίνεται **μετά**, επί τόπου). Σφάλμα του
 * ανιχνευτή **πετά**: ο ψήστης το κάνει αναβολή, ποτέ «καθαρή λήψη».
 */
export async function scanFaces(equirect: RawImage): Promise<readonly FaceOnSphere[]> {
  const sizes = faceScanSizes(equirect.width);
  const found: FaceOnSphere[] = [];
  for (const face of TOUR_CUBE_FACES) found.push(...(await facesOfCubeFace(equirect, face, sizes)));
  return distinctFaces(found);
}
