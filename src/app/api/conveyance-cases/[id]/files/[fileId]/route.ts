/**
 * ADR-901 Φ4.4 — ο **οικοδεσπότης** ανοίγει/κατεβάζει ένα τεκμήριο από τον κατάλογο της υπόθεσης — και ό,τι του
 * **στάλθηκε** από επαγγελματία (transmittal), που **δεν** κατέχει ο ίδιος (ζει στον χώρο του συντάκτη).
 *
 * POST /api/conveyance-cases/{id}/files/{fileId} { mode: 'view' | 'download' }
 *   → `{ url, expiresAt, fileName, contentType }` (σύνδεσμος 15′)
 *   - **POST**: το άνοιγμα **γράφει** ίχνος (`document_accessed`, ρόλος `host`) — ο συντάκτης βλέπει «ο υπεύθυνος
 *     της υπόθεσης άνοιξε το έγγραφό σας». Σύνορο ιδεμποτίας ADR-872 μέσα στο `withAuth`
 *   - αρχείο εκτός του **δικού του** καταλόγου ⇒ 404 — και η έκθεση του δικηγόρου του αγοραστή (Α23)
 *
 * Δικαίωμα: `legal:conveyance:view`, με το έργο του ακινήτου. Υπόθεση **άλλου** μισθωτή ≡ ανύπαρκτη (404).
 *
 * @module api/conveyance-cases/[id]/files/[fileId]
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { decodeRouteParam } from '@/lib/routes/route-param';
import { safeParseBody } from '@/lib/validation/shared-schemas';
import { CASE_FILE_MODES } from '@/lib/conveyance/case-activity';
import { openHostCaseFile } from '@/services/conveyance/conveyance-case-file-access.service';
import { caseFileResponse } from '../../../../engagements/_shared/case-file-response';
import { CONVEYANCE_VIEW, readAuthorizedCase } from '../../../_shared/conveyance-route-support';

const PATH = '/api/conveyance-cases/[id]/files/[fileId]';

type Segment = { params: Promise<{ id: string; fileId: string }> };

const bodySchema = z.object({ mode: z.enum(CASE_FILE_MODES) });

export const POST = withStandardRateLimit(
  withAuth(async (request: NextRequest, ctx: AuthContext, cache: PermissionCache, segmentData?: Segment) => {
    const params = await segmentData!.params;
    const parsed = safeParseBody(bodySchema, await request.json());
    if (parsed.error) return parsed.error;
    const { db, actor, record } = await readAuthorizedCase({
      ctx, cache, caseId: decodeRouteParam(params.id), permission: CONVEYANCE_VIEW, path: PATH, intent: 'read',
    });

    const outcome = await openHostCaseFile(db, {
      uid: actor.uid,
      email: actor.email,
      record,
      fileId: decodeRouteParam(params.fileId),
      mode: parsed.data.mode,
    });
    return caseFileResponse(outcome);
  }),
);
