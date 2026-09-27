/**
 * @fileoverview **ΑΠΟ ΠΟΥ ΕΡΧΟΝΤΑΙ ΟΙ ΕΙΚΟΝΕΣ** — η διεπαφή «δώσε μου τις έξι όψεις αυτής της στάσης» (ADR-884 Φ1 · §4.8).
 * @related `demo/demo-panorama-source.ts` (εικονικές όψεις — Φ1) · `tile-panorama-source.ts` (πλακίδια μέσω `GET …/media/…`, Φ2γ)
 * @module components/spatial-tour/viewer/tour-panorama-source
 *
 * 🔑 **Ο θεατής δεν ξέρει από πού ήρθε η εικόνα** (ADR-884 Α6): κάμερα 360°, κινητό, απόδοση BIM, εικονικά δεδομένα —
 * όλα φτάνουν ως έξι όψεις. Υλοποιήσεις: `demo/demo-panorama-source.ts` (Φ1) · `tile-panorama-source.ts` (Φ2γ, πλακίδια).
 * 🔑 **Το όριο μεγέθους το λέει η συσκευή** (`maxFaceSize` από τη μηχανή): η πηγή διαλέγει επίπεδο ανάλυσης που χωρά.
 * 🔑 **Ακύρωση** (`signal`): ο επισκέπτης που πατά τρία σημεία στη σειρά δεν κατεβάζει τρία πανοράματα.
 */

import type { TourManifestStop } from '@/lib/spatial-tour/tour-manifest-stop';
import type { TourCubeFace } from '@/lib/spatial-tour/viewer/tour-cube-faces';

/**
 * Μία εικόνα ανά όψη — ό,τι δέχεται μια υφή WebGL **με τον ίδιο προσανατολισμό**.
 * 🔴 **Χωρίς `ImageBitmap`, επίτηδες** (ζωντανή επαλήθευση ADR-884 Φ2δ, 2026-09-27): το three.js **αγνοεί το `flipY`** στα
 * `ImageBitmap` — η προεπισκόπηση που ερχόταν ως `ImageBitmap` ανέβαινε στη GPU **ανάποδα** (ουρανός κάτω) ενώ οι καθαρές
 * όψεις (`canvas`) σωστά. Ο τύπος κλείνει την κλάση: κάθε πηγή περνά από καμβά.
 */
export type TourCubeFaceImages = Readonly<Record<TourCubeFace, HTMLCanvasElement | HTMLImageElement>>;

export interface TourPanoramaLoadOptions {
  readonly signal: AbortSignal;
  /** Μέγιστη πλευρά όψης σε εικονοστοιχεία που αντέχει η συσκευή. */
  readonly maxFaceSize: number;
  /**
   * Προεπισκόπηση χαμηλής ανάλυσης, **αν** φτάσει πριν τις καθαρές όψεις (ADR-884 Φ2γ, πρότυπο Marzipano
   * `cubeMapPreviewUrl`). Ποτέ μετά — η πηγή δεν υποβαθμίζει. Η εικονική πηγή δεν την καλεί.
   */
  readonly onPreview?: (faces: TourCubeFaceImages) => void;
}

export interface TourPanoramaSource {
  load(stop: TourManifestStop, options: TourPanoramaLoadOptions): Promise<TourCubeFaceImages>;
}
