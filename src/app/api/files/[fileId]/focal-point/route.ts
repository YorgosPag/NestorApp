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

import { NextRequest, NextResponse } from 'next/server';

import { getErrorMessage } from '@/lib/error-utils';
import { withHeavyRateLimit } from '@/lib/middleware/with-rate-limit';
import { detectFocalPointInBytes } from '@/services/listings/public-shelf-focal-point';
import {
  authorityUnavailableResponse,
  fileNotFoundResponse,
  type FileSegment,
} from '../../_shared/container-route-responses';
import { withFileCustodyAuth, type FileCustodyCaller } from '../../_shared/file-custody-route';
import { loadOwnedFileBytes } from '../../_shared/owned-file-bytes';

// Το πρωτότυπο κατεβαίνει ολόκληρο (φωτογραφία κινητού: μερικά MB) — ίδιο περιθώριο με τη λήψη.
export const maxDuration = 30;

/** Ίδια ικανότητα με τη `download`: για να βρεις το θέμα, **βλέπεις** τα bytes. */
const VIEW_ACTION = 'dxf:files:view';

async function handleGet(
  _request: NextRequest,
  caller: FileCustodyCaller,
  segment?: FileSegment,
): Promise<NextResponse> {
  const fileId = segment ? (await segment.params).fileId : undefined;
  if (!fileId) return NextResponse.json({ error: 'Missing fileId' }, { status: 400 });

  try {
    const result = await loadOwnedFileBytes({ fileId, caller, action: 'focal-point', capability: VIEW_ACTION });
    if (result.outcome === 'unavailable') return authorityUnavailableResponse();
    if (result.outcome === 'refused') return fileNotFoundResponse();

    // `null` = «κανένα σήμα» (επίπεδη εικόνα ή μη-εικόνα) — ο επεξεργαστής δείχνει κέντρο.
    const focalPoint = await detectFocalPointInBytes(result.buffer);
    return NextResponse.json({ focalPoint }, { status: 200, headers: { 'Cache-Control': 'private, max-age=3600' } });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

export const GET = withHeavyRateLimit(
  withFileCustodyAuth<FileSegment>(handleGet, { permissions: VIEW_ACTION }),
);
