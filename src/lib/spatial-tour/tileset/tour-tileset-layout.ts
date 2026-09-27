/**
 * @fileoverview **Η ΔΙΑΤΑΞΗ ΤΟΥ TILESET** — πόσο μεγάλη είναι μια όψη, ποια επίπεδα ανάλυσης υπάρχουν, πού ζει κάθε
 * πλακίδιο (ADR-884 Φ2α · §4.9). Καθαρό· το διαβάζουν **και** ο ψήστης (γραφέας) **και** η πηγή πλακιδίων (αναγνώστης)
 * — μία διάταξη, όχι δύο που «συμφωνούν».
 * @related `server/spatial-tour/tour-tileset-baker.ts` (γράφει) · `components/spatial-tour/viewer/tile-panorama-source.ts`
 *   (διαβάζει) · `lib/spatial-tour/tour-media-path.ts` (τα επιτρεπτά τμήματα) · `viewer/tour-cube-faces.ts` (οι όψεις)
 * @module lib/spatial-tour/tileset/tour-tileset-layout
 *
 * 📏 **Γιατί αυτοί οι αριθμοί** (§4.9, έρευνα): πλακίδιο **512** — Pannellum `generate.py`, Marzipano, krpano («η καλύτερη
 * ισορροπία ανεβάσματος υφής / κλήσεων σχεδίασης»), Street View. Όψη ≈ `πλάτος / π` (Pannellum), σε πολλαπλάσιο του
 * πλακιδίου (krpano), με ταβάνι **4096**. Επίπεδα 512·2ᵏ ως την όψη (Marzipano/Pannellum). Προεπισκόπηση **256** ανά όψη
 * σε **ένα** αρχείο (Marzipano `cubeMapPreviewUrl` + `fallbackOnly`) — ένα αίτημα, πάντα πρώτο.
 *
 * 🔑 **Η διαδρομή φέρει hash ΚΑΙ έκδοση διάταξης**: `{hash}/{έκδοση}/…`. Η κρυφή μνήμη είναι `immutable` — αλλαγή ποιότητας
 * ή μεγέθους πλακιδίου χωρίς νέα έκδοση θα σέρβιρε παλιά πλακίδια με νέα γεωμετρία. Νέα διάταξη ⇒ νέα σταθερά ⇒ ξαναψήσιμο.
 */

import { TOUR_CUBE_FACES, type TourCubeFace } from '../viewer/tour-cube-faces';

/** Πλευρά πλακιδίου σε εικονοστοιχεία. */
export const TOUR_TILE_SIZE = 512;
/** Πλευρά όψης της προεπισκόπησης. */
export const TOUR_PREVIEW_FACE_SIZE = 256;
/** Ταβάνι όψης — πάνω από αυτό ένα πανόραμα 360° δεν κερδίζει τίποτα ορατό σε οθόνη. */
export const TOUR_FACE_SIZE_CEILING = 4096;
/** Η έκδοση της διάταξης — μέρος κάθε διαδρομής. */
const TOUR_TILESET_LAYOUT_VERSION = 'v1';
export const TOUR_TILE_CONTENT_TYPE = 'image/jpeg';
export const TOUR_TILE_JPEG_QUALITY = 80;

/** Η πλευρά όψης που αντιστοιχεί σε equirect πλάτους `width`: `width/π`, στο πλησιέστερο πολλαπλάσιο του πλακιδίου. */
export function faceSizeForEquirect(width: number): number {
  const tiles = Math.max(1, Math.round(width / Math.PI / TOUR_TILE_SIZE));
  return Math.min(TOUR_FACE_SIZE_CEILING, tiles * TOUR_TILE_SIZE);
}

/** Τα επίπεδα ανάλυσης (πλευρά όψης), από το μικρότερο: 512, 1024, … και τελευταίο η ίδια η όψη. */
export function tilesetLevels(faceSize: number): readonly number[] {
  const levels: number[] = [];
  for (let size = TOUR_TILE_SIZE; size < faceSize; size *= 2) levels.push(size);
  levels.push(faceSize);
  return levels;
}

/** Πόσα πλακίδια ανά πλευρά έχει ένα επίπεδο. */
export function tilesPerSide(levelSize: number): number {
  return Math.ceil(levelSize / TOUR_TILE_SIZE);
}

/** Το μεγαλύτερο επίπεδο που χωρά στο όριο της συσκευής — ποτέ κάτω από το πρώτο. */
export function levelIndexFor(faceSize: number, maxFaceSize: number): number {
  const levels = tilesetLevels(faceSize);
  let chosen = 0;
  levels.forEach((size, index) => {
    if (size <= maxFaceSize) chosen = index;
  });
  return chosen;
}

/** Τμήματα διαδρομής ενός πλακιδίου (μετά το `tour-tiles/{tourId}/`). */
export function tileSegments(hash: string, level: number, face: TourCubeFace, row: number, col: number): readonly string[] {
  return [hash, TOUR_TILESET_LAYOUT_VERSION, `l${level}`, face, `${row}_${col}.jpg`];
}

/** Τμήματα διαδρομής της προεπισκόπησης: οι έξι όψεις σε κατακόρυφη λωρίδα, με τη σειρά του `TOUR_CUBE_FACES`. */
export function previewSegments(hash: string): readonly string[] {
  return [hash, TOUR_TILESET_LAYOUT_VERSION, 'preview.jpg'];
}

/** Η γραμμή της λωρίδας προεπισκόπησης όπου ζει μια όψη. */
export function previewRowOf(face: TourCubeFace): number {
  return TOUR_CUBE_FACES.indexOf(face);
}
