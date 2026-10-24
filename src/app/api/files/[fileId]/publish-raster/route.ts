/**
 * =============================================================================
 * Η ΕΙΚΟΝΑ ΔΗΜΟΣΙΕΥΣΗΣ ΕΝΟΣ DXF — «ΖΗΤΑ ΤΗΝ ΚΑΙ ΦΤΙΑΧΝΕΤΑΙ» (ADR-922)
 * =============================================================================
 * `POST /api/files/{fileId}/publish-raster` — εξασφαλίζει το PNG δημοσίευσης ενός DXF και απαντά την καταγεγραμμένη
 * έκβαση (`ready` | `failed`). Ιδεμπότητο: δεύτερη κλήση επιστρέφει την ίδια έκβαση χωρίς απόδοση.
 *
 * @module api/files/[fileId]/publish-raster
 *
 * 🔒 **ΚΑΝΕΝΑΣ ΝΕΟΣ ΦΡΟΥΡΟΣ — Η ΙΔΙΑ ΑΛΥΣΙΔΑ ΜΕ ΤΗ ΛΗΨΗ** (`loadOwnedFileBytes`): ταυτότητα (`withFileCustodyAuth`,
 * εταιρεία **ή** προσωπικός φάκελος) → κάτοχος → ορατότητα δοχείου / ρίζα Storage → bytes, με **αυτή** τη σειρά.
 * Για να βγει εικόνα από τα bytes πρέπει να **βλέπεις** τα bytes ⇒ ίδια ικανότητα με τη λήψη.
 * ⚠️ **`heavy`**: κάθε κλήση αναλύει και αποδίδει σχέδιο χρήστη — ίδια βαθμίδα με το `files/classify`.
 * ⚠️ **Κάθε άρνηση είναι το ΙΔΙΟ 404** (όχι μαντείο ύπαρξης) — ίδιο συμβόλαιο με τη `download`.
 */

import { NextRequest, NextResponse } from 'next/server';

import { getErrorMessage } from '@/lib/error-utils';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withHeavyRateLimit } from '@/lib/middleware/with-rate-limit';
import { ensureDxfPublishRaster } from '@/services/floorplans/dxf-publish-raster.service';
import { isDxfFile } from '@/services/floorplans/dxf-publish-raster';

import { authorityUnavailableResponse, fileNotFoundResponse, type FileSegment } from '../../_shared/container-route-responses';
import { withFileCustodyAuth, type FileCustodyCaller } from '../../_shared/file-custody-route';
import { OWNED_FILE_VIEW_ACTION } from '../../_shared/owned-file-insight-route';
import { loadOwnedFileBytes } from '../../_shared/owned-file-bytes';

// Ανάλυση DXF + απόδοση 3000px: μερικά δευτερόλεπτα για μεγάλο τοπογραφικό — ίδιο περιθώριο με την επεξεργασία κάτοψης.
export const maxDuration = 60;

async function handlePost(
  _request: NextRequest,
  caller: FileCustodyCaller,
  segment?: FileSegment,
): Promise<NextResponse> {
  const fileId = segment ? (await segment.params).fileId : undefined;
  if (!fileId) return NextResponse.json({ error: 'Missing fileId' }, { status: 400 });

  try {
    const owned = await loadOwnedFileBytes({
      fileId,
      caller,
      action: 'publish-raster',
      capability: OWNED_FILE_VIEW_ACTION,
    });
    if (owned.outcome === 'unavailable') return authorityUnavailableResponse();
    if (owned.outcome === 'refused') return fileNotFoundResponse();
    if (!isDxfFile(owned.record)) {
      return NextResponse.json({ error: 'Not a DXF', errorCode: 'NOT_DXF' }, { status: 422 });
    }

    const publishRaster = await ensureDxfPublishRaster(
      getAdminFirestore(),
      { custody: caller.custody, fileId, record: owned.record },
      owned.buffer,
    );
    return NextResponse.json({ publishRaster }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

export const POST = withHeavyRateLimit(
  withFileCustodyAuth<FileSegment>(handlePost, { permissions: OWNED_FILE_VIEW_ACTION }),
);
