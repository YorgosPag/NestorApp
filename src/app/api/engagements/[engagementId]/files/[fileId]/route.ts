/**
 * ADR-901 Φ4 §5.4 · §5.9 — ο επαγγελματίας **ανοίγει/κατεβάζει** ένα τεκμήριο της υπόθεσης.
 *
 * POST /api/engagements/{engagementId}/files/{fileId} { mode: 'view' | 'download' }
 *   → `{ url, expiresAt, fileName, contentType }` (σύνδεσμος 15′)
 *   - **POST, όχι GET**: το άνοιγμα **γράφει** ίχνος (`document_accessed`). Το σύνορο ιδεμποτίας (ADR-872) κάνει
 *     την αυτόματη επανάληψη να επιστρέφει την **ίδια** απάντηση, χωρίς δεύτερο ίχνος
 *   - αρχείο εκτός των ορατών γραμμών του ρόλου ⇒ 404, ίδιο με ανύπαρκτο (Α19)
 *   - δική μου συμμετοχή χωρίς πρόσβαση τώρα ⇒ 403 με **ονομασμένο** λόγο · «δεν μπόρεσα» ⇒ 503
 *
 * @module api/engagements/[engagementId]/files/[fileId]
 */

import { z } from 'zod';
import { withPersonalOrOrgAuth } from '@/lib/auth/personal-scope-middleware';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { CASE_FILE_MODES } from '@/lib/conveyance/case-activity';
import { openCaseFile } from '@/services/conveyance/conveyance-case-file-access.service';
import { caseFileResponse } from '../../../_shared/case-file-response';
import { engagementPost } from '../../../_shared/engagement-post';

const bodySchema = z.object({ mode: z.enum(CASE_FILE_MODES) });

const handler = engagementPost<{ fileId: string }, typeof bodySchema>(bodySchema, async ({ db, uid, email, engagementId, param, body }) =>
  caseFileResponse(await openCaseFile(db, { uid, email, engagementId, fileId: param('fileId'), mode: body.mode, nowMs: Date.now() })));

export const POST = withStandardRateLimit(withPersonalOrOrgAuth(handler));
