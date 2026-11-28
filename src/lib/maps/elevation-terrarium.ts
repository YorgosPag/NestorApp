/**
 * ADR-920 §14.12 Β3 — **η κωδικοποίηση Terrarium**: ύψος ⇄ τρία bytes ενός pixel. Η ΜΙΑ διατύπωση (ADR-891).
 *
 *   ύψος (m) = R · 256 + G + B / 256 − 32768            βήμα 1/256 m ≈ 3,9 mm · εύρος −32768 … +32767,996 m
 *
 * Είναι η `encoding: 'terrarium'` της πηγής `raster-dem` της MapLibre (`ElevationEncoding`, `basemap-catalog.ts`): με
 * αυτήν **διαβάζεται** το χοντρό αρχείο υψομέτρου και με αυτήν **γράφεται** το πλακίδιο της σύντηξης. Δύο αντίγραφα του
 * τύπου θα μπορούσαν να αποκλίνουν κατά ένα bit στη στρογγύλευση χωρίς να το δει κανείς — η ραφή θα «σκαλοπάτιαζε».
 *
 * 🔑 **Στρογγύλευση στο πλησιέστερο βήμα**, όχι αποκοπή: το σφάλμα εγγραφής είναι ±1/512 m (≈ 2 mm), συμμετρικό. Με αποκοπή
 * κάθε ύψος θα έβγαινε συστηματικά χαμηλότερο έως 3,9 mm.
 *
 * Καθαρό, χωρίς εισαγωγές: τρέχει ίδιο στο κύριο νήμα και σε Worker.
 *
 * @module lib/maps/elevation-terrarium
 */

/** Το ύψος που γράφεται ως (0, 0, 0). */
const TERRARIUM_OFFSET_M = 32768;

/** Βήματα ανά μέτρο (το byte Β μετρά 1/256 m). */
const TERRARIUM_STEPS_PER_M = 256;

/** Το μεγαλύτερο ύψος που χωρά σε 24 bit, σε βήματα. */
const TERRARIUM_MAX_STEPS = 2 ** 24 - 1;

/** Bytes ανά pixel (RGBA). */
export const TERRARIUM_BYTES_PER_PIXEL = 4;

/** Γράφει το ύψος στα 4 bytes `out[offset…]` (αδιαφανές). Ύψος έξω από το εύρος κόβεται στο άκρο του. */
export function writeTerrarium(out: Uint8ClampedArray, offset: number, elevationM: number): void {
  const steps = Math.min(TERRARIUM_MAX_STEPS, Math.max(0, Math.round((elevationM + TERRARIUM_OFFSET_M) * TERRARIUM_STEPS_PER_M)));
  out[offset] = steps >>> 16;
  out[offset + 1] = (steps >>> 8) & 255;
  out[offset + 2] = steps & 255;
  out[offset + 3] = 255;
}

/** Το ύψος ενός pixel, σε μέτρα. */
export function readTerrarium(r: number, g: number, b: number): number {
  return r * 256 + g + b / TERRARIUM_STEPS_PER_M - TERRARIUM_OFFSET_M;
}

/** Ολόκληρη εικόνα RGBA → ύψη σε μέτρα, γραμμή-γραμμή όπως η εικόνα (πρώτη γραμμή = βορράς). */
export function decodeTerrarium(rgba: Uint8ClampedArray | Uint8Array): Float32Array {
  const heights = new Float32Array(Math.floor(rgba.length / TERRARIUM_BYTES_PER_PIXEL));
  for (let i = 0; i < heights.length; i++) {
    const at = i * TERRARIUM_BYTES_PER_PIXEL;
    heights[i] = readTerrarium(rgba[at], rgba[at + 1], rgba[at + 2]);
  }
  return heights;
}
