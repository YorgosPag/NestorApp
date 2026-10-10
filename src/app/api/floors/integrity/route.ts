/**
 * FLOORS INTEGRITY — αναφορά συγκρούσεων της στοίβας ορόφων σε ΟΛΑ τα κτίρια (μόνο ανάγνωση).
 *
 * @module api/floors/integrity
 * @see ./floor-stack-scan — η κρίση · @see lib/floor/floor-stack-integrity — ο κανόνας
 *
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ (2026-10-10): το σύνορο της στοίβας κάνει τη μοναδικότητα ατομική για **κάθε διαδρομή της
 * εφαρμογής** — αλλά τίποτα στον κώδικα δεν σταματά μια απευθείας εγγραφή με Admin SDK (κονσόλα, script). Έτσι
 * γεννήθηκαν δύο «Ισόγειο» στο ίδιο κτίριο: έγγραφα χωρίς `createdAt` και χωρίς γραμμή ιστορικού. Ό,τι δεν
 * μπορεί να **αποτραπεί** πρέπει να μπορεί να **βρεθεί**.
 *
 * ⚠️ **Δεν διορθώνει τίποτα.** Ποιος όροφος μένει είναι απόφαση ανθρώπου (ο ένας μπορεί να έχει ακίνητα και
 * κατόψεις) — η επίλυση γίνεται από την καρτέλα «Όροφοι» του κτιρίου, με τη διαδρομή διαγραφής της εφαρμογής.
 *
 * 🔒 Global role: super_admin. Admin SDK, όλοι οι ενοικιαστές.
 *
 * @rateLimit SENSITIVE (20 req/min) — σαρώνει ολόκληρη τη συλλογή `floors`
 */

import { NextRequest, NextResponse } from 'next/server';

import { COLLECTIONS } from '@/config/firestore-collections';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { BYPASS_ROLES } from '@/lib/auth/roles';
import { getErrorMessage } from '@/lib/error-utils';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';
import { judgeFloorStacks, scanFloor, type FloorsIntegrityReport } from './floor-stack-scan';

const logger = createModuleLogger('FloorsIntegrityRoute');

type FloorsIntegrityResponse = FloorsIntegrityReport | { success: false; error: string; details?: string };

export const GET = withSensitiveRateLimit(
  withAuth<FloorsIntegrityResponse>(
    async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse<FloorsIntegrityResponse>> => {
      try {
        // tenant-scope-exempt: αναφορά ακεραιότητας super-admin πάνω σε ΟΛΟΥΣ τους ενοικιαστές· η στοίβα κάθε
        //   ορόφου ομαδοποιείται με το `companyId` ΤΟΥ ΟΡΟΦΟΥ, ποτέ του καλούντος. Μόνο ανάγνωση.
        const snapshot = await getAdminFirestore().collection(COLLECTIONS.FLOORS).get();
        const report = judgeFloorStacks(snapshot.docs.map((doc) => scanFloor(doc.id, doc.data())));

        logger.info('[Floors/Integrity] Scan complete', {
          userId: ctx.uid,
          floors: report.floorsScanned,
          buildings: report.buildingsScanned,
          conflicts: report.conflicts.length,
        });
        return NextResponse.json(report);
      } catch (error) {
        logger.error('[Floors/Integrity] Error', { error: getErrorMessage(error), userId: ctx.uid });
        return NextResponse.json(
          { success: false, error: 'Failed to scan floor stacks', details: getErrorMessage(error) },
          { status: 500 },
        );
      }
    },
    { requiredGlobalRoles: BYPASS_ROLES },
  ),
);
