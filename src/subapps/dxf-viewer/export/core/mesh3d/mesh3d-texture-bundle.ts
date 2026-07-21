/**
 * ADR-679 Φ5.1b — COLLADA texture-byte bundling.
 *
 * Ο `.dae` writer γράφει `<image><init_from>textures/x.jpg</init_from></image>` από το
 * `ExportMaterialEntry.map.fileName`, αλλά τα BYTES της εικόνας δεν ταξιδεύουν μαζί. Ο Cinema
 * 4D R15 βλέπει το ref, δεν βρίσκει το αρχείο → καμία υφή. Εδώ κατεβάζουμε τα bytes από το
 * `map.url` (Storage) ως loose relative-path artifacts, ώστε το `packageArtifacts`
 * (export-service) να τα πακετάρει δίπλα στο `.dae` σε ΕΝΑ `.zip` — industry `.zae` (zipped
 * COLLADA): ο χρήστης αποσυμπιέζει, ο R15 διαβάζει τα loose textures μέσω των relative refs.
 *
 * SSoT reuse (N.12/N.18 — μηδέν νέο dependency, μηδέν δεύτερος packer):
 *   • `fetchArtifactWithTimeout` — το ΙΔΙΟ κοινό fetch-with-timeout που κατεβάζει τα DXF
 *     image-fill rasters (ADR-643)· εδώ με explicit filename = το `init_from` του `.dae`.
 *   • `zip-pack` / `packageArtifacts` — ο ΕΝΑΣ zero-dependency zip mechanism του export.
 *
 * @see ./mesh3d-materials — `ExportMaterialEntry.map` (`ExportTextureRef`)
 * @see ../image-export-shared — `fetchArtifactWithTimeout`
 * @see ../../export-service — `packageArtifacts` (zip delivery)
 * @see docs/centralized-systems/reference/adrs/ADR-679-*.md §5 (Φ5.1b)
 */

import type { ExportArtifact } from '../../types';
import type { ExportMaterialEntry } from './mesh3d-materials';
import { fetchArtifactWithTimeout } from '../image-export-shared';

/** Τα κατεβασμένα texture artifacts + διαγνωστικά warnings (ASCII — logs, όχι user-facing). */
export interface TextureBundleResult {
  readonly artifacts: ExportArtifact[];
  readonly warnings: string[];
}

/**
 * Κατεβάζει τα diffuse-texture bytes κάθε ΜΟΝΑΔΙΚΟΥ `map.fileName` (dedup: πολλά υλικά
 * μοιράζονται μία υφή → ΕΝΑ αρχείο + ΕΝΑ `<image>` στο `.dae`). Παραλείπει flat υλικά
 * (`map` undefined/null) και ref-only entries (`map.url === null`). Αποτυχία fetch → warning
 * + συνέχεια (το `.dae` κρατά την αναφορά· ο χρήστης βάζει την υφή χειροκίνητα) — ποτέ throw.
 *
 * Το `filename` κάθε artifact ΤΑΥΤΙΖΕΤΑΙ με το `map.fileName`, ώστε το zip entry να ταιριάζει
 * byte-για-byte με το `init_from` που ήδη έγραψε ο writer.
 */
export async function bundleTextureArtifacts(
  materials: readonly ExportMaterialEntry[],
): Promise<TextureBundleResult> {
  // fileName → url. Το Map κάνει το dedup ανά αρχείο (κρατά το πρώτο url που το ζήτησε).
  const jobs = new Map<string, string>();
  for (const m of materials) {
    const map = m.map;
    if (!map || !map.url) continue;
    if (!jobs.has(map.fileName)) jobs.set(map.fileName, map.url);
  }

  const entries = [...jobs.entries()];
  const results = await Promise.all(
    entries.map(([fileName, url]) => fetchArtifactWithTimeout(url, fileName)),
  );

  const artifacts: ExportArtifact[] = [];
  const warnings: string[] = [];
  results.forEach((artifact, i) => {
    if (artifact) artifacts.push(artifact);
    else warnings.push(`texture-bundle:fetch-failed:${entries[i][0]}`);
  });
  return { artifacts, warnings };
}
