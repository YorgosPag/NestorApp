/**
 * ADR-651 Φάση Η — `POST /api/dxf/text-templates/ai/revision-changelog`
 *
 * «Τι άλλαξε από την προηγούμενη έκδοση;» (§8 #6, Απόφαση #9).
 *
 * Ο client στέλνει **μόνο** το αποτύπωμα της τρέχουσας κατάστασης· ο server φέρνει το
 * αποτύπωμα της **προηγούμενης** αναθεώρησης από το Firestore, τα συγκρίνει με την **καθαρή,
 * ντετερμινιστική** `diffRevisionSnapshots` και μετά ζητά από το AI **μόνο τη διατύπωση**.
 * Έτσι τα νούμερα είναι πάντα ακριβή (τα μετράει ο κώδικας) και η γλώσσα επαγγελματική
 * (τη γράφει το μοντέλο).
 *
 * Επιστρέφει **και τα δύο**: τον diff (πάντα — ο χρήστης βλέπει τι άλλαξε ακόμη κι αν το AI
 * πέσει) και την **πρόταση** περιγραφής (`null` σε αποτυχία ⇒ ο μηχανικός γράφει μόνος του —
 * **graceful, ποτέ μπλοκάρισμα**). Η αναθεώρηση **δεν** γράφεται εδώ: γράφεται μόνο όταν ο
 * χρήστης εγκρίνει (`POST /api/dxf/revisions`).
 *
 * Κέλυφος ασφαλείας: το **κοινό** `_ai-route-helpers` της Φάσης Δ (rate limit + `withAuth` +
 * try/catch· κλειδί OpenAI ποτέ στον client) — μηδέν δίδυμο boilerplate (N.18).
 */
import { NextRequest, NextResponse } from 'next/server';
import type { AuthContext } from '@/lib/auth';
import { createModuleLogger } from '@/lib/telemetry';
import { suggestRevisionChangelog } from '@/subapps/dxf-viewer/text-engine/title-block/ai/ai-revision-changelog';
import { latestRevision } from '@/subapps/dxf-viewer/text-engine/title-block/revisions/drawing-revision.service';
import { diffRevisionSnapshots } from '@/subapps/dxf-viewer/text-engine/title-block/revisions/revision-diff';
import {
  invalidRevisionRequest,
  readRevisionRequest,
  type RevisionRequestBody,
} from '../../../revisions/_revision-route-helpers';
import { aiTitleBlockRoutePOST, readJsonBody, readLocale } from '../_ai-route-helpers';

export const dynamic = 'force-dynamic';

const logger = createModuleLogger('AiRevisionChangelogRoute');

export const POST = aiTitleBlockRoutePOST(logger, async (req: NextRequest, ctx: AuthContext) => {
  const body = await readJsonBody<RevisionRequestBody>(req);
  const request = readRevisionRequest(body);
  if (!request) return invalidRevisionRequest();

  const previous = await latestRevision(ctx.companyId, request.projectId);
  const diff = diffRevisionSnapshots(previous?.snapshot ?? null, request.snapshot);

  // Graceful: το AI είναι το «κερασάκι» — ο ντετερμινιστικός diff φεύγει πάντα.
  const suggestion = await suggestRevisionChangelog({
    userId: ctx.uid,
    diff,
    locale: readLocale(body.locale),
  });

  return NextResponse.json({ success: true, diff, suggestion });
});
