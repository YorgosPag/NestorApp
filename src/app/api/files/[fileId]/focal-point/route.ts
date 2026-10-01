/**
 * =============================================================================
 * ΠΡΟΤΑΣΗ ΣΗΜΕΙΟΥ ΕΣΤΙΑΣΗΣ — ό,τι θα βρει το ράφι, ΠΡΙΝ δημοσιευτεί (ADR-880)
 * =============================================================================
 * `GET /api/files/{fileId}/focal-point` — τρέχει τον **ίδιο** κινητήρα με το δημόσιο ράφι
 * (`detectFocalPointInBytes`) πάνω στο ιδιωτικό πρωτότυπο, ώστε ο επεξεργαστής να δείξει στον
 * άνθρωπο το **αυτόματο** σημείο πριν αποφασίσει αν θα το διορθώσει.
 *
 * @module api/files/[fileId]/focal-point
 *
 * 🔒 **ΚΑΝΕΝΑΣ ΝΕΟΣ ΦΡΟΥΡΟΣ — Η ΙΔΙΑ ΑΛΥΣΙΔΑ ΜΕ ΤΗ ΛΗΨΗ.** Η απάντηση είναι δύο αριθμοί, αλλά για να
 * βγουν διαβάζονται **bytes**: ταυτότητα (`withFileCustodyAuth`, εταιρεία **ή** προσωπικός φάκελος) →
 * κάτοχος → ορατότητα δοχείου → bytes, όλα στο `loadOwnedFileBytes`, με **αυτή** τη σειρά. Ένα
 * δεύτερο σύνορο εδώ θα ήταν η πρώτη φορά που η σειρά γίνεται θέμα προσοχής.
 *
 * ⚠️ **Δεν αποθηκεύει τίποτα.** Η αλήθεια του αυτόματου είναι το ράφι (μεταδεδομένο των παραγώγων)·
 * αυτό είναι **προεπισκόπηση** της ίδιας συνάρτησης — ίδιες είσοδοι ⇒ ίδιο σημείο.
 * ⚠️ **`heavy`**: κάθε κλήση αποκωδικοποιεί εικόνα χρήστη — ίδια βαθμίδα με το `files/classify`.
 * ⚠️ **Κάθε άρνηση είναι το ΙΔΙΟ 404** (όχι μαντείο ύπαρξης) — ίδιο συμβόλαιο με τη `download`.
 */

import { withHeavyRateLimit } from '@/lib/middleware/with-rate-limit';
import { detectFocalPointInBytes } from '@/services/listings/public-shelf-focal-point';
import type { FileSegment } from '../../_shared/container-route-responses';
import { withFileCustodyAuth } from '../../_shared/file-custody-route';
import { OWNED_FILE_VIEW_ACTION, ownedFileInsightHandler } from '../../_shared/owned-file-insight-route';

// Το πρωτότυπο κατεβαίνει ολόκληρο (φωτογραφία κινητού: μερικά MB) — ίδιο περιθώριο με τη λήψη.
export const maxDuration = 30;

/**
 * Ο σκελετός (αλυσίδα → bytes → απάντηση) ζει στο `owned-file-insight-route` (ADR-897 Φ5 — δεύτερος καταναλωτής)·
 * εδώ μόνο **τι** υπολογίζεται. `null` = «κανένα σήμα» (επίπεδη εικόνα ή μη-εικόνα) — ο επεξεργαστής δείχνει κέντρο.
 */
const handleGet = ownedFileInsightHandler({
  action: 'focal-point',
  compute: detectFocalPointInBytes,
  toBody: (focalPoint) => ({ focalPoint }),
});

export const GET = withHeavyRateLimit(
  withFileCustodyAuth<FileSegment>(handleGet, { permissions: OWNED_FILE_VIEW_ACTION }),
);
