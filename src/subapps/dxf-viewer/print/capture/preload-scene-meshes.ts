/**
 * ADR-909 Γ1β / ADR-411 — **τα σχήματα 3Δ ενός σχεδίου, έτοιμα ΠΡΙΝ από τη σύγχρονη απόδοση.**
 *
 * Αδελφός του `preload-scene-images`, για τον ίδιο λόγο: η λήψη εκτός οθόνης ζωγραφίζει **μία φορά, σύγχρονα**.
 * Έπιπλο, είδος υγιεινής και εισαγόμενο πλέγμα παίρνουν την κάτοψή τους από `.glb` του `bimMeshCache`· σε cache
 * miss ο ζωγράφος βγάζει κουτί (ή γενικό σύμβολο) και ζητά τη φόρτωση «για αργότερα». Στην οθόνη το διορθώνει το
 * επόμενο frame· στη λήψη **δεν υπάρχει επόμενο frame**, και το κουτί θα δημοσιευόταν.
 *
 * 1. {@link preloadSceneMeshes} — **ασύγχρονο**, **πριν** από την απόδοση και **έξω** από κάθε όψη/πολιτική.
 * 2. {@link missingSceneMeshWarnings} — **σύγχρονο**, πάνω σε **ό,τι πράγματι ζωγραφίστηκε**: ονομάζει κάθε
 *    στοιχείο που ζωγραφίστηκε χωρίς το σχήμα του. Κανένα σιωπηλό κουτί.
 *
 * 🔑 Και τα δύο μισά ρωτούν το **ίδιο** κλειδί με τον ζωγράφο (`meshAssetOf`).
 *
 * @module subapps/dxf-viewer/print/capture/preload-scene-meshes
 * @see ../../bim/mesh-library/entity-mesh-asset.ts — «ποιο σχήμα ζητώ» (SSoT)
 * @see ../print-fidelity.ts — οι κωδικοί απώλειας (SSoT)
 */

import { DXF_TIMING } from '../../config/dxf-timing';
import { withTimeout } from '../../export/core/image-export-shared';
import { bimMeshCache } from '../../bim-3d/library/bim-mesh-library/bim-mesh-cache';
import { meshAssetOf, type MeshBearingProbe } from '../../bim/mesh-library/entity-mesh-asset';

/** Ο κωδικός απώλειας ενός στοιχείου που ζωγραφίστηκε χωρίς το σχήμα του (βλ. `print-fidelity`). */
export const MESH_NOT_LOADED_WARNING = 'mesh:not-loaded';

const MESH_PRELOAD_TIMEOUT_MS = DXF_TIMING.lifecycle.MESH_PRELOAD_TIMEOUT;

/**
 * **Φέρε κάθε σχήμα της σκηνής.** Δεν πετά ποτέ, δεν κρεμά ποτέ.
 *
 * Ζητά όλα τα σχήματα **πρώτα** και περιμένει **μία** φορά: αρχεία φορτωμένα (ή αποτυχημένα) **και** ακριβή
 * περιγράμματα στη θέση τους (`awaitSettled`) — αλλιώς δύο λήψεις του ίδιου σχεδίου μπορούν να διαφέρουν.
 * Με **όριο χρόνου**: μια λήψη που περιμένει για πάντα είναι χειρότερη από μια λήψη που λέει «δεν φόρτωσε».
 *
 * ⚠️ Δεν επιστρέφει «τι απέτυχε»: το ρωτά το {@link missingSceneMeshWarnings}, πάνω στη σκηνή που ζωγραφίστηκε.
 */
export async function preloadSceneMeshes(entities: readonly MeshBearingProbe[]): Promise<void> {
  let requested = false;
  for (const entity of entities) {
    const asset = meshAssetOf(entity);
    if (asset === null) continue;
    bimMeshCache.preload(asset.category, asset.assetId);
    requested = true;
  }
  if (!requested) return;
  await withTimeout(bimMeshCache.awaitSettled(), MESH_PRELOAD_TIMEOUT_MS).catch(() => undefined);
}

/**
 * **Ποια στοιχεία ζωγραφίστηκαν ΧΩΡΙΣ το σχήμα τους** — ένας κωδικός ανά στοιχείο. Σύγχρονο, χωρίς παρενέργειες.
 * Κενός πίνακας ⇒ κάθε σχήμα ήταν έτοιμο.
 */
export function missingSceneMeshWarnings(entities: readonly MeshBearingProbe[]): string[] {
  const warnings: string[] = [];
  for (const entity of entities) {
    const asset = meshAssetOf(entity);
    if (asset !== null && bimMeshCache.getLoadState(asset.category, asset.assetId) !== 'ready') {
      warnings.push(MESH_NOT_LOADED_WARNING);
    }
  }
  return warnings;
}

/**
 * Ρητή **νέα προσπάθεια** για κάθε σχήμα της σκηνής που απέτυχε (το «Δοκίμασε ξανά» του διαλόγου — πρακτική
 * «Reload» των Revit / ArchiCAD). Σβήνει μόνο τους δείκτες σφάλματος· τη φόρτωση τη ζητά η επόμενη λήψη.
 */
export function retryFailedSceneMeshes(entities: readonly MeshBearingProbe[]): void {
  for (const entity of entities) {
    const asset = meshAssetOf(entity);
    if (asset !== null) bimMeshCache.retryFailed(asset.category, asset.assetId);
  }
}
