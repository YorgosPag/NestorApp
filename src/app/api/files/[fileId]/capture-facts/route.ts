/**
 * =============================================================================
 * ΣΤΟΙΧΕΙΑ ΛΗΨΗΣ ΑΠΟ ΤΟ EXIF — οπτικό πεδίο και πυξίδα, για τον επεξεργαστή σημείων (ADR-897 Φ5)
 * =============================================================================
 * `GET /api/files/{fileId}/capture-facts` — διαβάζει από το **ιδιωτικό** πρωτότυπο το πεδίο του φακού και την
 * κατεύθυνση πυξίδας, ώστε ο κώνος μιας νέας τοποθέτησης να ξεκινά με το **πραγματικό** πλάτος.
 *
 * @module api/files/[fileId]/capture-facts
 *
 * 🔒 **Η ΙΔΙΑ αλυσίδα με τη λήψη και την πρόταση εστίασης** (`owned-file-insight-route`). Η απάντηση **δεν** περιέχει
 * γεωγραφικές συντεταγμένες — μόνο κατεύθυνση (βλ. `photo-capture-facts`).
 * ⚠️ **Δεν αποθηκεύει τίποτα**: πρόταση· η δήλωση γίνεται από τον άνθρωπο, στον χώρο εργασίας.
 */

import { withHeavyRateLimit } from '@/lib/middleware/with-rate-limit';
import { readPhotoCaptureFacts } from '@/services/listings/photo-capture-facts';
import type { FileSegment } from '../../_shared/container-route-responses';
import { withFileCustodyAuth } from '../../_shared/file-custody-route';
import { OWNED_FILE_VIEW_ACTION, ownedFileInsightHandler } from '../../_shared/owned-file-insight-route';

// Το πρωτότυπο κατεβαίνει ολόκληρο — ίδιο περιθώριο με τη λήψη και την πρόταση εστίασης.
export const maxDuration = 30;

const handleGet = ownedFileInsightHandler({
  action: 'capture-facts',
  compute: readPhotoCaptureFacts,
  toBody: (facts) => ({ facts }),
});

export const GET = withHeavyRateLimit(
  withFileCustodyAuth<FileSegment>(handleGet, { permissions: OWNED_FILE_VIEW_ACTION }),
);
