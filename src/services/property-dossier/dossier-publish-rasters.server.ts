/**
 * @fileoverview **ΤΟ ΔΙΧΤΥ ΑΣΦΑΛΕΙΑΣ ΤΗΣ ΔΗΜΟΣΙΕΥΣΗΣ** — δηλωμένο DXF χωρίς εικόνα δημοσίευσης την αποκτά εδώ (ADR-922).
 * @module services/property-dossier/dossier-publish-rasters.server
 * @related services/floorplans/dxf-publish-raster.service (ο ΕΝΑΣ γραφέας) · services/property-dossier/dossier-media.reader
 *
 * 🔑 **Ο κύριος δρόμος είναι η φόρμα** (`useDxfPublishRasterRequests`): το PNG φτιάχνεται μόλις φανεί το DXF, και το
 * κουτάκι «Δημοσίευση» εμφανίζεται μόνο όταν είναι έτοιμο. Εδώ πιάνεται ό,τι ξέφυγε (N.7.2 #4 — belt-and-suspenders):
 * δήλωση από άλλη συσκευή, αίτημα που χάθηκε στο δίκτυο, εγγραφή χωρίς έκβαση.
 *
 * ⚠️ **ΜΟΝΟ ΔΗΛΩΜΕΝΑ, ΜΟΝΟ ΧΩΡΙΣ ΕΚΒΑΣΗ**: κανένα DXF που δεν θα φύγει δεν αποδίδεται στη διαδρομή της δημοσίευσης,
 * και καμία καταγεγραμμένη αποτυχία δεν ξαναδοκιμάζεται εδώ (θα κόστιζε CPU σε **κάθε** ξαναδημοσίευση).
 * ⚠️ **Βλάβη υποδομής ΔΕΝ ρίχνει τη δημοσίευση**: το αρχείο απλώς δεν φεύγει αυτή τη φορά — ακριβώς ό,τι συνέβαινε πριν
 * το ADR-922 — και η επόμενη ξαναδημοσίευση ξαναδοκιμάζει. Να έπεφτε όλη η βιτρίνα για μία κάτοψη θα ήταν χειρότερο.
 */

import 'server-only';

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import type { DeclaredFileIds } from '@/lib/listings/declared-file-ids';
import { createModuleLogger } from '@/lib/telemetry';
import { needsDxfPublishRaster } from '@/services/floorplans/dxf-publish-raster';
import { ensureDxfPublishRaster } from '@/services/floorplans/dxf-publish-raster.service';

import type { DossierMediaCandidate, DossierMediaRead } from './dossier-media-publication';

const logger = createModuleLogger('dossier-publish-rasters');

async function withPublishRaster(
  adminDb: AdminFirestore,
  file: DossierMediaCandidate,
): Promise<DossierMediaCandidate> {
  try {
    // Ο φάκελος είναι **πάντα** προσωπικό διαμέρισμα (ADR-866 §5.2) — τα αρχεία τα έφερε ο αναγνώστης από `files_personal`.
    const state = await ensureDxfPublishRaster(adminDb, { custody: 'personal', fileId: file.id, record: file });
    return state === null ? file : { ...file, publishRaster: state };
  } catch (cause) {
    logger.warn('DXF publish raster: safety net could not render — the file is skipped this time', {
      fileId: file.id,
      error: cause instanceof Error ? cause.message : String(cause),
    });
    return file;
  }
}

/**
 * Η ανάγνωση του φακέλου, με εικόνα δημοσίευσης σε κάθε **δηλωμένο** DXF που δεν είχε έκβαση. Σειριακά: τα DXF
 * μιας αγγελίας είναι λίγα, και η απόδοση είναι βαριά — παράλληλη θα έβαζε N σχέδια ταυτόχρονα στη μνήμη.
 */
export async function withDossierPublishRasters(
  adminDb: AdminFirestore,
  read: DossierMediaRead | null,
  declared: DeclaredFileIds,
): Promise<DossierMediaRead | null> {
  if (read === null) return null;
  const declaredIds = new Set<string>(declared);
  if (!read.files.some((file) => declaredIds.has(file.id) && needsDxfPublishRaster(file))) return read;

  const files: DossierMediaCandidate[] = [];
  for (const file of read.files) {
    files.push(declaredIds.has(file.id) && needsDxfPublishRaster(file) ? await withPublishRaster(adminDb, file) : file);
  }
  return { ...read, files };
}
