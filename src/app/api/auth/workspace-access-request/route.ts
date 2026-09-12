/**
 * GET /api/auth/workspace-access-request — **τι απέγινε το αίτημά μου ένταξης;** (ADR-660 §6 · ADR-853 Α4).
 *
 * Ο καλών είναι **ο ίδιος** ο αιτών (ID token). **Όχι** `withAuth`: ο αιτών **δεν έχει** claims —
 * αυτός ακριβώς είναι ο λόγος που περιμένει. Επιστρέφει **μόνο** τη δική του κατάσταση· κανένα
 * όνομα διαχειριστή, καμία ημερομηνία που δεν χρειάζεται η οθόνη.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΙ ΑΛΛΑΞΕ (ADR-853 Α4) — ΚΑΙ ΓΙΑΤΙ ΔΕΝ ΗΤΑΝ ΚΑΛΛΩΠΙΣΜΟΣ
 * ─────────────────────────────────────────────────────────────────────────────
 * Μέχρι σήμερα η γραμμή ήταν `readOwnAccessState(getCompanyId(), uid)` — δηλαδή
 * *«τι απέγινε το αίτημά μου **στην ΠΑΓΩΝΗΣ**;»*, για **κάθε** άνθρωπο της
 * πλατφόρμας. Με τη σταθερή εταιρεία να φεύγει (ADR-853 Α4), το ερώτημα
 * **έχανε το υποκείμενό του**: ποιο αίτημα, σε ποιον χώρο;
 *
 * 🔑 Η απάντηση **δεν** είναι να περάσει ο πελάτης `companyId` — θα ήταν
 *    **τέταρτο κανάλι χώρου** (CHECK 3.58, κλειστό σύνολο τριών) και μάλιστα
 *    αναξιόπιστο. Είναι να ρωτά ο άνθρωπος **για τον εαυτό του**: ο άξονας
 *    είναι το `uid`, που έρχεται από **υπογεγραμμένο** token και ποτέ από το
 *    σύρμα. Ίδιο σχήμα με το `listMemberWorkspaces` (ADR-787 §5.1).
 *
 * @module api/auth/workspace-access-request
 */

import 'server-only';

import { NextResponse, type NextRequest } from 'next/server';

import { verifiedBearerUid } from '@/lib/auth/token-credentials';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { readOwnAccessState } from '@/server/auth/workspace-access-request';

async function handler(request: NextRequest): Promise<NextResponse> {
  const uid = await verifiedBearerUid(request);
  if (uid === null) return NextResponse.json({ error: 'UNAUTHENTICATED' } as const, { status: 401 });
  return NextResponse.json({ state: await readOwnAccessState(uid) } as const);
}

export const GET = withStandardRateLimit(handler);
