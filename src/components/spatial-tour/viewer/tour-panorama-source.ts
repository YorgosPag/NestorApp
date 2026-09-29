/**
 * @fileoverview **ΑΠΟ ΠΟΥ ΕΡΧΟΝΤΑΙ ΟΙ ΕΙΚΟΝΕΣ** — μια **βάση** που καλύπτει όλη τη σφαίρα, και (προαιρετικά) **πλακίδια**
 * πολλαπλής ανάλυσης που ζητούνται ένα-ένα, όσα φαίνονται (ADR-884 Φ1 · Φ2ε · §4.8 · §4.11).
 * @related `demo/demo-panorama-source.ts` (εικονικές όψεις, χωρίς πλακίδια) · `tile-panorama-source.ts` (προεπισκόπηση +
 *   πλακίδια μέσω `GET …/media/…`) · `tour-tile-streamer.ts` (ποια πλακίδια, πότε)
 * @module components/spatial-tour/viewer/tour-panorama-source
 *
 * 🔑 **Ο θεατής δεν ξέρει από πού ήρθε η εικόνα** (ADR-884 Α6): κάμερα 360°, κινητό, απόδοση BIM, εικονικά δεδομένα.
 * 🔑 **Βάση + πλακίδια, όπως οι μεγάλοι** (Marzipano `pinFirstLevel` · PSV CubemapTiles `baseUrl`): η βάση φτάνει με ένα
 *   αίτημα και η άφιξη δεν περιμένει τίποτα άλλο· τα πλακίδια καθαρίζουν **μόνο ό,τι βλέπει ο επισκέπτης**.
 *   🔴 Πριν (Φ2γ): «όλο το επίπεδο-στόχο, όλες οι όψεις, μετά δείξε» — 96–150 πλακίδια ανά σημείο με πραγματική λήψη 8K.
 * 🔑 **Ακύρωση** (`signal`): ο επισκέπτης που πατά τρία σημεία στη σειρά δεν κατεβάζει τρία πανοράματα.
 */

import type { TourManifestStop } from '@/lib/spatial-tour/tour-manifest-stop';
import type { TourCubeFace } from '@/lib/spatial-tour/viewer/tour-cube-faces';
import type { TourTileAddress } from '@/lib/spatial-tour/viewer/tour-tile-visibility';
import type { TourViewerPlan } from '@/lib/spatial-tour/viewer/tour-viewer-graph';

/**
 * Μία εικόνα ανά όψη — ό,τι δέχεται μια υφή WebGL **με τον ίδιο προσανατολισμό**.
 * 🔴 **Χωρίς `ImageBitmap`, επίτηδες** (ζωντανή επαλήθευση ADR-884 Φ2δ, 2026-09-27): το three.js **αγνοεί το `flipY`** στα
 * `ImageBitmap` — η προεπισκόπηση που ερχόταν ως `ImageBitmap` ανέβαινε στη GPU **ανάποδα** (ουρανός κάτω) ενώ οι καθαρές
 * όψεις (`canvas`) σωστά. Ο τύπος κλείνει την κλάση: κάθε πηγή περνά από καμβά.
 */
export type TourFaceImage = HTMLCanvasElement | HTMLImageElement;
export type TourCubeFaceImages = Readonly<Record<TourCubeFace, TourFaceImage>>;

/** Πλακίδια πολλαπλής ανάλυσης μιας στάσης. */
export interface TourTileProvider {
  /** Οι πλευρές όψης ανά επίπεδο, από το μικρότερο (`tilesetLevels`). */
  levels(stop: TourManifestStop): readonly number[];
  /** Ένα πλακίδιο — ίδιος κανόνας με τις όψεις: καμβάς, ποτέ `ImageBitmap`. */
  tile(stop: TourManifestStop, address: TourTileAddress, signal: AbortSignal): Promise<TourFaceImage>;
}

export interface TourPanoramaSource {
  /** Όλη η σφαίρα σε χαμηλή (ή, για την εικονική πηγή, πλήρη) ανάλυση — αυτό περιμένει η άφιξη. */
  base(stop: TourManifestStop, signal: AbortSignal): Promise<TourCubeFaceImages>;
  /** `null` ⇒ η βάση είναι και η τελική εικόνα (εικονική πηγή). */
  readonly tiles: TourTileProvider | null;
  /**
   * **Η διεύθυνση της εικόνας κάτοψης** ενός ορόφου σε πλάτος που φτάνει για `cssWidth` (ADR-884 Φ2στ-β · §4.13) — `null`
   * όταν η πηγή δεν σερβίρει κατόψεις (εικονική). Ζει στην πηγή γιατί **μόνο** η πηγή ξέρει τη ρίζα των μέσων.
   */
  planImageUrl(plan: TourViewerPlan, cssWidth: number): string | null;
}

/**
 * «Όσο πιο λεπτομερές γίνεται» — με αυτό το πλάτος το `planImageUrl` δίνει το **μεγαλύτερο** παράγωγο (ανάγνωση pixel για την
 * ανίχνευση χώρων, Γ3γ-2α: 2048 px ⇒ ~7 mm/pixel σε κάτοψη 15 m). Όχι για εμφάνιση.
 */
export const PLAN_LARGEST_CSS_WIDTH = Number.POSITIVE_INFINITY;
