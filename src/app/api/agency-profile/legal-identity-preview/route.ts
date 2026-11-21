/**
 * =============================================================================
 * GET /api/agency-profile/legal-identity-preview — «ΤΙ ΘΑ ΔΕΙ Ο ΚΟΣΜΟΣ» (ADR-841 §7 Α23.14)
 * =============================================================================
 *
 * Για **κάθε** επιλογή έδρας και δημόσιου ονόματος: το **ακριβές** κείμενο που θα δημοσιευτεί, ή ο **ίδιος** λόγος
 * άρνησης που θα έδινε ο γραφέας — **πριν** πατηθεί «Δημοσίευση». Καμία εγγραφή, καμία κλήση ΓΕΜΗ.
 *
 * ⚠️ **Ο οργανισμός ΔΕΝ έρχεται από το αίτημα** — από το `ctx.companyId` (πρότυπο `registry-verification`).
 *
 * 🔒 `ADMINISTRATIVE_ROLES`: η απάντηση περιέχει την **πλήρη** καταστατική έδρα — σε ατομική, συχνά η **κατοικία**.
 * Ίδια βαθμίδα με το `GET /api/companies/registry-verification`, που δείχνει την ίδια έδρα από το μητρώο.
 *
 * ⏱️ **Βαθμίδα ρυθμού δηλωμένη ΕΔΩ** (CHECK 3.78): `standard` — ανάγνωση τριών εγγράφων.
 *
 * @module api/agency-profile/legal-identity-preview
 */

import 'server-only';

import { NextResponse, type NextRequest } from 'next/server';

import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { ADMINISTRATIVE_ROLES } from '@/lib/auth/roles';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';
import { readShowcaseLegalPreview } from '@/services/mandate/showcase-legal-preview.service';

const logger = createModuleLogger('api/agency-profile/legal-identity-preview');

export const GET = withStandardRateLimit(
  withAuth(
    async (_request: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      // 🔴 fail-closed, πρότυπο `extractCustomClaims`: «κενή συμβολοσειρά = απουσία».
      const companyId = ctx.companyId?.trim() ?? '';
      if (companyId === '') return NextResponse.json({ error: 'NO_ORGANIZATION' }, { status: 403 });
      try {
        return NextResponse.json({ success: true, data: await readShowcaseLegalPreview(getAdminFirestore(), companyId) });
      } catch (error) {
        // **503**, όχι 422: άγνωστο ≠ «λείπει» (N.12).
        logger.error('Η προεπισκόπηση της νομικής ταυτότητας δεν διαβάστηκε', {
          companyId,
          error: error instanceof Error ? error.message : String(error),
        });
        return NextResponse.json({ error: 'PREVIEW_UNAVAILABLE' }, { status: 503 });
      }
    },
    { requiredGlobalRoles: ADMINISTRATIVE_ROLES },
  ),
);
