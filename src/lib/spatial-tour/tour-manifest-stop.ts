/**
 * @fileoverview **ΛΗΨΗ → ΣΤΑΣΗ ΘΕΑΤΗ** — πότε μια λήψη έχει κάτι να δείξει, και τι χρειάζεται ο θεατής για να ζητήσει
 * τα πλακίδιά της (ADR-884 Κ3β · Φ2α · §4.10). Καθαρό.
 * @related `server/spatial-tour/tour-viewer-stops.ts` (ο κριτής των στάσεων του κοινού — ρωτά **αυτό**) ·
 *   `lib/spatial-tour/tour-editor-model.ts` (η οθόνη τοποθέτησης — ρωτά **αυτό**) ·
 *   `lib/spatial-tour/tour-graph-edit.ts` (τοποθετείται μόνο λήψη με στάση)
 * @module lib/spatial-tour/tour-manifest-stop
 *
 * 🔴 **Γιατί υπάρχει** (§4.10): ο όρος «έτοιμη» ζούσε inline μέσα στον κριτή του διακομιστή. Η οθόνη τοποθέτησης και ο
 * γραφέας του γράφου χρειάζονται την **ίδια** απάντηση — τρία αντίγραφα του «`ready` + hash + `faceSize`» θα
 * απέκλιναν (το `faceSize` προστέθηκε στη Φ2α, και ένα αντίγραφο θα το ξεχνούσε).
 */

import type { TourCapture } from '@/types/spatial-tour';

/** Μία στάση του θεατή — ό,τι χρειάζεται ο θεατής για να ζητήσει πλακίδια. */
export interface TourManifestStop {
  readonly captureId: string;
  readonly nodeId: string;
  readonly capturedAt: string;
  readonly headingRad: number;
  /** Το περιεχόμενο του tileset — μέρος της διεύθυνσης μέσων, ώστε νέα έκδοση = νέο URL (αμετάβλητη cache). */
  readonly tilesetHash: string;
  /** Πλευρά όψης του ψημένου κύβου — από αυτήν η πηγή πλακιδίων παράγει τα επίπεδα (ADR-884 Φ2α). */
  readonly faceSize: number;
}

type StopFields = Pick<TourCapture, 'id' | 'capturedAt' | 'headingRad' | 'tileset'>;

/** **Έχει πλακίδια να δείξει;** — `ready` **και** hash **και** μέγεθος όψης. Ο ΕΝΑΣ ορισμός του «έτοιμη». */
export function isCaptureViewable(capture: Pick<TourCapture, 'tileset'>): boolean {
  const { tileset } = capture;
  return tileset.state === 'ready' && tileset.contentHash !== null && tileset.faceSize !== null;
}

/**
 * Η στάση μιας λήψης **σε έναν κόμβο** — `null` αν δεν έχει ακόμη πλακίδια. Ο κόμβος δίνεται ρητά: η οθόνη
 * τοποθέτησης δείχνει και **ατοποθέτητη** λήψη (προεπισκόπηση πριν αποφασιστεί το σημείο).
 */
export function stopOfCapture(capture: StopFields, nodeId: string): TourManifestStop | null {
  const { contentHash, faceSize } = capture.tileset;
  if (!isCaptureViewable(capture) || contentHash === null || faceSize === null) return null;
  return {
    captureId: capture.id, nodeId, capturedAt: capture.capturedAt,
    headingRad: capture.headingRad, tilesetHash: contentHash, faceSize,
  };
}
