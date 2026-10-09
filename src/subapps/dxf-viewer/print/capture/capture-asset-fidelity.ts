/**
 * ADR-909 Γ1β — **τι έχασε μια raster λήψη από όσα έπρεπε να έχουν φορτώσει** (εικόνες + σχήματα 3Δ), σε ένα σημείο.
 *
 * Το ρωτούν και οι δύο raster λήψεις (raster PDF, δημόσια κάτοψη), πάνω σε **ό,τι πράγματι ζωγραφίστηκε**. Αν
 * η καθεμία ένωνε μόνη της τις λίστες, το επόμενο είδος πόρου (π.χ. γραμματοσειρές) θα έμπαινε στη μία και θα
 * ξεχνιόταν στην άλλη — και η απώλεια θα ήταν σιωπηλή ακριβώς εκεί.
 *
 * @module subapps/dxf-viewer/print/capture/capture-asset-fidelity
 * @see ./preload-scene-images.ts · ./preload-scene-meshes.ts — τα δύο είδη πόρων
 * @see ../print-fidelity.ts — οι κωδικοί απώλειας (SSoT)
 */

import type { PrintPlotStyle } from '../../config/print-color-policy';
import { summarizePrintFidelity, type PrintFidelityNote } from '../print-fidelity';
import { missingSceneImageWarnings } from './preload-scene-images';
import { missingSceneMeshWarnings } from './preload-scene-meshes';

type DrawnEntities = Parameters<typeof missingSceneImageWarnings>[0] & Parameters<typeof missingSceneMeshWarnings>[0];

/** Οι απώλειες πόρων για τις οντότητες που ζωγραφίστηκαν — κενό ⇒ η εικόνα είναι πιστή. Σύγχρονο. */
export function captureAssetFidelity(
  entities: DrawnEntities,
  plotStyle: PrintPlotStyle,
): readonly PrintFidelityNote[] {
  return summarizePrintFidelity([
    ...missingSceneImageWarnings(entities, plotStyle),
    ...missingSceneMeshWarnings(entities),
  ]);
}
