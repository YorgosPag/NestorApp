/**
 * **Γκρι εικόνα σε κείμενο RLE** (ADR-929 §6.21.3 / §6.21.5): η μορφή με την οποία μεταφέρθηκε pixel προς pixel η απόδοση
 * του Chrome της παραγωγής (το εργαλείο του browser αποκλείει base64 και κόβει την έξοδο). Ένας αποκωδικοποιητής, για κάθε
 * test που τρέχει την αναγνώριση πάνω σε τέτοια εικόνα.
 *
 * Μορφή: `y|x0:v,v*n,...` — `v` σε base36, `v*n` = n φορές, `a-b|=` = ίδια με την προηγούμενη γραμμή, ό,τι λείπει = χαρτί (255).
 *
 * @module subapps/dxf-viewer/bim/plan-recognition/testing/gray-rle-raster
 */

import type { PlanRaster } from '@/lib/geometry/raster/plan-raster';

export interface GrayImage {
  /** Ένα κανάλι, γραμμή προς γραμμή (`y · width + x`). */
  readonly gray: Uint8Array;
  readonly width: number;
  readonly height: number;
}

const PAPER = 255;

function decodeRow(body: string): Map<number, number> {
  const row = new Map<number, number>();
  for (const run of body.split(' ')) {
    const [x0, values] = run.split(':');
    let x = Number(x0);
    for (const token of values.split(',')) {
      const [v, n] = token.split('*');
      for (let k = 0; k < Number(n ?? 1); k++) row.set(x++, parseInt(v, 36));
    }
  }
  return row;
}

/** Αποκωδικοποίηση του κειμένου RLE σε εικόνα `width × height`. */
export function decodeGrayRle(text: string, width: number, height: number): GrayImage {
  const gray = new Uint8Array(width * height).fill(PAPER);
  let previous = new Map<number, number>();
  for (const line of text.trim().split(/\r?\n/)) {
    const [ys, body] = line.split('|');
    const [a, b] = ys.split('-').map(Number);
    const row = body === '=' ? previous : decodeRow(body);
    for (let y = a; y <= (b ?? a); y++) for (const [x, v] of row) gray[y * width + x] = v;
    previous = row;
  }
  return { gray, width, height };
}

/** Το άθροισμα ελέγχου που μετρήθηκε στον browser: `h = h·31 + R` (mod 2³²) σε όλα τα pixel, κανάλι R. */
export function grayChecksum(gray: Uint8Array): number {
  let h = 0;
  for (const v of gray) h = (Math.imul(h, 31) + v) >>> 0;
  return h;
}

/** Η γκρι εικόνα ως `PlanRaster` (RGBA, αδιαφανής) — η είσοδος της αναγνώρισης. */
export function grayToPlanRaster({ gray, width, height }: GrayImage): PlanRaster {
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < gray.length; i++) {
    rgba[i * 4] = rgba[i * 4 + 1] = rgba[i * 4 + 2] = gray[i];
    rgba[i * 4 + 3] = 255;
  }
  return { rgba, width, height };
}
