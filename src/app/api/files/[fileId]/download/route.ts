/**
 * =============================================================================
 * FILE DOWNLOAD PROXY — Server-side Storage access
 * =============================================================================
 *
 * Downloads a file from Firebase Storage using Admin SDK.
 * Bypasses client-side CORS and Storage security rules.
 *
 * @module api/files/[fileId]/download
 * @enterprise ADR-031 - Canonical File Storage System
 *
 * 🔒 SECURITY: `withAuth` + δικαίωμα `dxf:files:view` **και** ιδιοκτησία tenant.
 *
 * 🔴 **ΜΕΧΡΙ ΤΙΣ 2026-08-01 Ο ΤΕΛΕΥΤΑΙΟΣ ΕΛΕΓΧΟΣ ΕΛΕΙΠΕ ΕΝΤΕΛΩΣ** (ADR-742
 * §7undecies). Το `_ctx` ήταν **αχρησιμοποίητο**: οποιοσδήποτε συνδεδεμένος
 * χρήστης, **οποιασδήποτε** εταιρείας, κατέβαζε ξένο αρχείο δίνοντας το id του.
 * Δεν ήταν μαντείο ύπαρξης — ήταν **διαρροή περιεχομένου**, το ίδιο σχήμα με
 * τις τέσσερις αφύλακτες `contact preview` της §7octies.
 *
 * Καμία σάρωση της εκστρατείας δεν μπορούσε να το δείξει: όλοι οι ανιχνευτές
 * ψάχνουν **λάθος σύγκριση**, και εδώ δεν υπήρχε σύγκριση **καθόλου**.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminStorage } from '@/lib/firebaseAdmin';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { getErrorMessage } from '@/lib/error-utils';
import { fileResource } from '../../_shared/file-ownership';

// 🏢 ENTERPRISE: Extended timeout for Storage downloads
export const maxDuration = 30;

interface FileRecordData {
  storagePath?: string;
  contentType?: string;
  companyId?: string;
  isDeleted?: boolean;
  status?: string;
}

/**
 * Το **ένα** «δεν βρέθηκε» αυτής της διαδρομής — ADR-742 §7.1.
 *
 * Το σχήμα (`{ error }` σκέτο, χωρίς `success`) είναι **ακριβώς** αυτό που
 * έγραφε ο γνήσιος κλάδος εδώ· το `floorplans/process` γράφει άλλο και **πρέπει**
 * να γράφει άλλο. Κοινό είναι το **κείμενο**, το μόνο που ο πελάτης μπορεί να
 * συγκρίνει μεταξύ αδελφικών διαδρομών.
 */
const fileNotFoundResponse = (): NextResponse =>
  NextResponse.json({ error: fileResource.notFoundMessage }, { status: 404 });

export async function GET(
  request: NextRequest,
  segmentData: { params: Promise<{ fileId: string }> }
): Promise<Response> {
  const handler = withAuth(
    async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      const params = await segmentData.params;
      const fileId = params?.fileId;

      if (!fileId) {
        return NextResponse.json({ error: 'Missing fileId' }, { status: 400 });
      }

      try {
        // Φόρτωση + ύπαρξη + ιδιοκτησία σε **μία** πράξη. Και τα δύο «όχι» —
        // ανύπαρκτο και ξένο — βγαίνουν από το **ίδιο** εργοστάσιο, οπότε ο
        // καλών δεν τα ξεχωρίζει σε κανένα πεδίο του σύρματος (ADR-742 §7.1).
        const owned = await fileResource.load({
          docId: fileId,
          caller: ctx,
          action: 'download',
          refusal: fileNotFoundResponse,
        });
        if (owned.refusal) {
          return owned.refusal;
        }

        const fileData = owned.doc.data as FileRecordData;

        if (fileData.isDeleted) {
          return NextResponse.json({ error: 'File has been deleted' }, { status: 404 });
        }

        if (!fileData.storagePath) {
          return NextResponse.json({ error: 'No storage path' }, { status: 404 });
        }

        // Download from Firebase Storage via Admin SDK (no CORS/rules issues)
        const bucketName = process.env.FIREBASE_STORAGE_BUCKET || 'pagonis-87766.firebasestorage.app';
        const bucket = getAdminStorage().bucket(bucketName);
        const file = bucket.file(fileData.storagePath);

        const [fileBuffer] = await file.download();

        const body = new ReadableStream({
          start(controller) {
            controller.enqueue(new Uint8Array(fileBuffer));
            controller.close();
          },
        });

        return new NextResponse(body, {
          status: 200,
          headers: {
            'Content-Type': fileData.contentType || 'application/octet-stream',
            'Cache-Control': 'private, max-age=3600',
          },
        });
      } catch (error) {
        const errorMessage = getErrorMessage(error);
        return NextResponse.json({ error: errorMessage }, { status: 500 });
      }
    },
    { permissions: 'dxf:files:view' }
  );

  return handler(request);
}
