/**
 * =============================================================================
 * PATCH /api/ika/employment-records/[id]/apd-status — Update APD status
 * =============================================================================
 *
 * Migrated from client-side write (useEmploymentRecords.ts) to server-side.
 *
 * @module api/ika/employment-records/[id]/apd-status
 * @enterprise ADR-090 — IKA/EFKA Labor Compliance System
 * @security SPEC-255C — Client-Side Writes Migration (CRITICAL)
 */

import 'server-only';

import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { withAuth, logAuditEvent } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { requireEmploymentRecordInTenant } from '@/lib/auth/tenant-isolation';
import { guardParentScope } from '@/lib/api/tenant-scope-http';
import { COLLECTIONS } from '@/config/firestore-collections';
import { getErrorMessage } from '@/lib/error-utils';
import { safeParseBody } from '@/lib/validation/shared-schemas';
import { nowISO } from '@/lib/date-local';

type SegmentData = { params: Promise<{ id: string }> };

/** Η διαδρομή, μία φορά — μπαίνει **αυτούσια** στο ίχνος ελέγχου κάθε άρνησης. */
const APD_STATUS_PATH = '/api/ika/employment-records/[id]/apd-status';

const PatchApdStatusSchema = z.object({
  status: z.enum(['pending', 'submitted', 'accepted', 'rejected']),
  referenceNumber: z.string().max(100).optional(),
});

// =============================================================================
// PATCH — Update APD Status
// =============================================================================

async function handlePatch(
  request: NextRequest,
  segmentData?: SegmentData
): Promise<NextResponse> {
  const { id } = await segmentData!.params;

  const handler = withAuth(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const parsed = safeParseBody(PatchApdStatusSchema, await req.json());
        if (parsed.error) return parsed.error;
        const body = parsed.data;

        // 🔒 **Η ΙΔΙΟΚΤΗΣΙΑ ΠΡΙΝ ΤΗ ΓΡΑΦΗ** — ADR-747 §13.7.
        //
        // Μέχρι τις 2026-09-21 εδώ υπήρχε `.doc(id).get()` και **σκέτος έλεγχος
        // ύπαρξης**: κάθε πιστοποιημένος χρήστης που ήξερε ένα `emrec_*` άλλαζε την
        // κατάσταση ΑΠΔ **ξένου** εργαζομένου. Δεν είναι ανάγνωση ξένων δεδομένων —
        // είναι **γραφή σε ασφαλιστικό ιστορικό τρίτου**, και το `withAuth` από πάνω
        // απαντά *«είσαι συνδεδεμένος;»*, ποτέ *«είναι δικό σου;»*.
        //
        // Ο φύλακας φέρνει το έγγραφο, κρίνει την ιδιοκτησία, **καταγράφει** την
        // άρνηση και μεταμφιέζει το «ξένο» σε «δεν βρέθηκε» (§7septies) — δηλαδή
        // αντικαθιστά **και** τον έλεγχο ύπαρξης παραπάνω: μία ανάγνωση, όχι δύο.
        // Μέσω του κεντρικού `guardParentScope` — βλ. το αδελφό route για το γιατί
        // δεν ξαναγράφεται εδώ `catch (e instanceof TenantIsolationError)`.
        const refusal = await guardParentScope(
          () => requireEmploymentRecordInTenant({
            ctx,
            employmentRecordId: id,
            path: APD_STATUS_PATH,
          }),
          'Employment record not found',
        );
        if (refusal) return refusal;

        const db = getAdminFirestore();
        const docRef = db.collection(COLLECTIONS.EMPLOYMENT_RECORDS).doc(id);

        const now = nowISO();
        const updateData: Record<string, unknown> = {
          apdStatus: body.status,
          updatedAt: now,
        };

        if (body.status === 'submitted') {
          updateData.apdSubmissionDate = now;
        }

        if (body.referenceNumber !== undefined) {
          updateData.apdReferenceNumber = body.referenceNumber;
        }

        await docRef.update(updateData);

        // ⚠️ `'employment_record'`, **όχι** `'project'`: το ίχνος κατέγραφε το id ενός
        //    ενσήμου κάτω από τύπο «έργο», οπότε η ερώτηση *«ποιος πείραξε τα ένσημα
        //    ποιου;»* **δεν απαντιόταν από το ίδιο το ίχνος**.
        await logAuditEvent(ctx, 'data_updated', id, 'employment_record', {
          metadata: { reason: `APD status → ${body.status}` },
        }).catch(() => {/* non-blocking */});

        return NextResponse.json({ success: true });
      } catch (error) {
        const message = getErrorMessage(error, 'Failed to update APD status');
        return NextResponse.json({ success: false, error: message }, { status: 500 });
      }
    }
  );

  return handler(request);
}

export const PATCH = withStandardRateLimit(handlePatch);
