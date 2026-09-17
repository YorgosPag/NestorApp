/**
 * @fileoverview **Ο ΙΔΙΟΚΤΗΤΗΣ ΧΩΡΙΣ ΛΟΓΑΡΙΑΣΜΟ ΚΑΤΕΒΑΖΕΙ ΤΟ ΕΝΤΥΠΟ ΠΟΥ ΒΕΒΑΙΩΘΗΚΕ ΣΤΟ ΟΝΟΜΑ ΤΟΥ** (ADR-864 §19 · Α33).
 * @related services/mandate/mandate-evidence-access.ts · app/api/mandate/[token]/route.ts
 * @module app/api/mandate/[token]/evidence/[evidenceId]/route
 *
 * 🌐 DocuSign: ο παραλήπτης **χωρίς λογαριασμό** ανοίγει το ολοκληρωμένο έγγραφο από τον σύνδεσμο του email,
 * και ο σύνδεσμος **λήγει** — νέος κατόπιν αιτήματος. Ίδιο συμβόλαιο εδώ: η εξουσιοδότηση **είναι** ο
 * σύνδεσμος, κριμένος **ακριβώς** όπως στην απόφαση εντολής (ίδιες ονομασμένες αρνήσεις).
 *
 * ⚠️ Χωρίς `withAuth` για τον **ίδιο** λόγο με τη γονική διαδρομή (δες εκεί)· ο ρυθμιστής ρυθμού μένει.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { decodeRouteParam } from '@/lib/routes/route-param';
import { readMandateConsentRequest } from '@/services/mandate/mandate-consent.service';
import { openMandateEvidence } from '@/services/mandate/mandate-evidence-access';

import { respondToEvidenceDownload } from '@/app/api/owner-properties/_shared/evidence-download-response';

type RouteContext = { params: Promise<{ token: string; evidenceId: string }> };

async function handler(_request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const params = await context.params;
  const adminDb = getAdminFirestore();

  const lookup = await readMandateConsentRequest(adminDb, decodeRouteParam(params.token));
  if (!lookup.ok) return respondToEvidenceDownload({ kind: 'absent' });

  const { ownerPropertyId, nonce, clientContactId } = lookup.request;
  return respondToEvidenceDownload(
    await openMandateEvidence(adminDb, {
      ownerPropertyId,
      who: { kind: 'owner-link', nonce, clientContactId },
      evidenceId: decodeRouteParam(params.evidenceId),
    }),
  );
}

export const GET = withStandardRateLimit(handler);
