/**
 * =============================================================================
 * ΜΑΖΙΚΗ ΑΝΑΠΑΡΑΓΩΓΗ ΤΩΝ ΣΗΜΑΤΩΝ (ADR-841 §7 Α21.12)
 * =============================================================================
 *
 * Ξαναδημοσιεύει **κάθε** σήμα του οποίου γνωρίζουμε την προέλευση, ώστε μια βελτίωση
 * στον τρόπο παραγωγής *(π.χ. το τρίμμα και η βαθμίδα 512 της **Α21.10**)* να φτάνει σε
 * όλους — **χωρίς να ενοχληθεί κανένας επαγγελματίας**.
 *
 * 🔴 **ΤΟ ΠΡΟΒΛΗΜΑ ΠΟΥ ΛΥΝΕΙ, ΜΕΤΡΗΜΕΝΟ**: μέχρι την Α21.12 ο μόνος τρόπος να πάρει ένα
 * παλιό σήμα τη βελτίωση ήταν *«ξαναδιάλεξε το αρχείο σου»* — δηλαδή **N άνθρωποι για N
 * σήματα**. Δοκιμάστηκε μία φορά στην πράξη (2026-09-08) και δούλεψε· **δεν κλιμακώνεται**.
 *
 * ⚠️ **ΔΕΝ ΕΙΝΑΙ ΠΑΡΑΚΑΜΨΗ ΤΟΥ ΦΡΟΥΡΟΥ.** Καλεί το `publishShowcaseMark` — **την ίδια**
 * είσοδο με το αίτημα του ανθρώπου — άρα ο `markSourceForCompany` κρίνει **ξανά** ότι το
 * μονοπάτι ανήκει σε αυτήν την εταιρεία, και ο καθαριστής τρέχει **ξανά**. Η σημείωση
 * της προέλευσης είναι **υπόμνηση, ποτέ διαπιστευτήριο**.
 *
 * 🔑 **Ιδεμποτεντικό**: το ράφι είναι content-addressed. Αν τα bytes δεν αλλάξουν, το
 * κλειδί είναι ίδιο ⇒ **καμία εγγραφή**. Δεύτερη εκτέλεση δεν κοστίζει και δεν αλλάζει.
 *
 * - GET  = στεγνή εκτέλεση (μετράει πόσες προελεύσεις ξέρουμε, **μηδέν** εγγραφές)
 * - POST = εκτέλεση
 *
 * 🔒 SECURITY: super_admin ONLY + withSensitiveRateLimit
 *
 * @module api/admin/rebuild-showcase-marks
 */

import { NextRequest, NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import { BYPASS_ROLES } from '@/lib/auth/roles';
import { rebuildAllShowcaseMarks } from '@/services/mandate/rebuild-showcase-marks.service';

const logger = createModuleLogger('rebuild-showcase-marks');

async function handle(_request: NextRequest, _ctx: AuthContext, dryRun: boolean) {
  try {
    const report = await rebuildAllShowcaseMarks(getAdminFirestore(), dryRun);
    logger.info(dryRun ? 'Στεγνή αναπαραγωγή σημάτων' : 'Αναπαραγωγή σημάτων', { ...report });
    return NextResponse.json({ report });
  } catch (error) {
    logger.error('Η αναπαραγωγή σημάτων απέτυχε', { error: getErrorMessage(error) });
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

export const GET = withSensitiveRateLimit(
  withAuth(
    async (request: NextRequest, ctx: AuthContext, _cache: PermissionCache) =>
      handle(request, ctx, true),
    { requiredGlobalRoles: BYPASS_ROLES },
  ),
);

export const POST = withSensitiveRateLimit(
  withAuth(
    async (request: NextRequest, ctx: AuthContext, _cache: PermissionCache) =>
      handle(request, ctx, false),
    { requiredGlobalRoles: BYPASS_ROLES },
  ),
);
