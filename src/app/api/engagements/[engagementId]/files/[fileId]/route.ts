/**
 * ADR-901 Φ4 §5.4 · §5.9 · ADR-942 Φ2 — ο επαγγελματίας **ανοίγει/κατεβάζει** ένα αρχείο της υπόθεσής του.
 * Τι ανοίγει το κρίνει ο προσαρμογέας του **είδους** της συμμετοχής (`engaged-file-openers.ts`): τεκμήριο ορατής γραμμής
 * (μεταβίβαση) · αρχείο που του **δόθηκε** ως απάντηση σε αίτημα (ανάθεση έκδοσης).
 *
 * POST /api/engagements/{engagementId}/files/{fileId} { mode: 'view' | 'download' }
 *   → `{ url, expiresAt, fileName, contentType }` (σύνδεσμος 15′)
 *   - **POST, όχι GET**: το άνοιγμα **γράφει** ίχνος (`document_accessed`). Το σύνορο ιδεμποτίας (ADR-872) κάνει
 *     την αυτόματη επανάληψη να επιστρέφει την **ίδια** απάντηση, χωρίς δεύτερο ίχνος
 *   - αρχείο που δεν είναι ορατό σε αυτόν τον θεατή ⇒ 404, ίδιο με ανύπαρκτο (Α19)
 *   - δική μου συμμετοχή χωρίς πρόσβαση τώρα ⇒ 403 με **ονομασμένο** λόγο · «δεν μπόρεσα» ⇒ 503
 *
 * @module api/engagements/[engagementId]/files/[fileId]
 */

import { z } from 'zod';
import { withPersonalOrOrgAuth } from '@/lib/auth/personal-scope-middleware';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { CASE_FILE_MODES } from '@/lib/conveyance/case-activity';
import { openFileAsEngaged } from '@/server/engagement-files/engaged-file-openers';
import { caseFileResponse } from '../../../_shared/case-file-response';
import { engagementPost } from '../../../_shared/engagement-post';

const bodySchema = z.object({ mode: z.enum(CASE_FILE_MODES) });

const handler = engagementPost<{ fileId: string }, typeof bodySchema>(bodySchema, async ({ db, uid, email, engagementId, param, body }) =>
  caseFileResponse(await openFileAsEngaged(db, { uid, email, engagementId, fileId: param('fileId'), mode: body.mode, nowMs: Date.now() })));

export const POST = withStandardRateLimit(withPersonalOrOrgAuth(handler));
