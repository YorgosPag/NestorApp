/**
 * ADR-915 §20 — «Ανάγνωση από το έγγραφο» στον διάλογο ελέγχου της μεταβίβασης.
 *
 * POST /api/conveyance-cases/{id}/document-text { itemId, fileId }
 *   → `{ result: CaseDocumentTextResult }` — η έκβαση είναι **πεδίο**, όχι κωδικός HTTP: «δεν αναγνωρίστηκε» ή «είναι
 *     άλλο έγγραφο» είναι απάντηση για τον άνθρωπο, όχι σφάλμα του αιτήματος.
 *   - `fileId` = το αρχείο που βλέπει ο άνθρωπος· αν η γραμμή έχει νεότερο ⇒ `refused: stale` (CAS)
 *   - γράφει **μόνο** τα γεγονότα του ίδιου του αρχείου, μέσω του ΕΝΟΣ γραφέα· την όψη την ανανεώνει το CDC
 *   - σύνορο ιδεμποτίας ADR-872 μέσα στο `withAuth` (και η ίδια η ανάγνωση είναι ιδεμπότητη)
 *
 * Δικαίωμα: `legal:conveyance:manage` (ίδιο με την αποδοχή που προετοιμάζει), με το έργο του ακινήτου.
 * ⚠️ `withHeavyRateLimit`: κάθε αίτημα κατεβάζει αρχείο και αναλύει PDF — βαρύ έργο ανά κλήση.
 *
 * @module api/conveyance-cases/[id]/document-text
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { apiSuccess } from '@/lib/api/ApiErrorHandler';
import { withHeavyRateLimit } from '@/lib/middleware/with-rate-limit';
import { decodeRouteParam } from '@/lib/routes/route-param';
import { safeParseBody } from '@/lib/validation/shared-schemas';
import { readCaseRowDocumentText } from '@/services/conveyance/conveyance-document-text.server';
import { extractPdfText } from '@/services/pdf/pdf-rasterize.service';
import { CONVEYANCE_MANAGE, readAuthorizedCase } from '../../_shared/conveyance-route-support';

const PATH = '/api/conveyance-cases/[id]/document-text';

const documentTextBody = z.object({
  itemId: z.string().min(1).max(200),
  fileId: z.string().min(1).max(200),
});

type Segment = { params: Promise<{ id: string }> };

export const POST = withHeavyRateLimit(
  withAuth(async (request: NextRequest, ctx: AuthContext, cache: PermissionCache, segmentData?: Segment) => {
    const params = await segmentData!.params;
    const parsed = safeParseBody(documentTextBody, await request.json());
    if (parsed.error) return parsed.error;
    const { db, actor, record } = await readAuthorizedCase({
      ctx, cache, caseId: decodeRouteParam(params.id), permission: CONVEYANCE_MANAGE, path: PATH, intent: 'write',
    });
    const result = await readCaseRowDocumentText(
      db,
      { record, itemId: parsed.data.itemId, fileId: parsed.data.fileId, actorUid: actor.uid },
      { readPdfText: extractPdfText },
    );
    return apiSuccess({ result });
  }),
);
