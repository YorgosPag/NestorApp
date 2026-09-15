/**
 * @fileoverview **Η ΣΕΛΙΔΑ ΤΗΣ ΕΡΩΤΗΣΗΣ ΑΡΓΙΩΝ** — δείχνει, δεν αποφασίζει (ADR-841 §7 Α21.21 Φάση Β).
 * @related services/mandate/holiday-hours-question-decision.ts · app/(auth)/card-email/[token]/page.tsx (το πρότυπο) ·
 *   app/api/holiday-hours-questions/[token]/route.ts (η μόνη πόρτα που γράφει)
 * @module app/(auth)/hours-question/[token]/page
 *
 * 🔴 **ΚΑΜΙΑ ΕΓΓΡΑΦΗ ΣΕ ΑΥΤΗ ΤΗ ΣΕΛΙΔΑ.** Τα τρία κουμπιά του email («Κλειστά» · «Κανονικά» · «Άλλο ωράριο») οδηγούν **εδώ**,
 * και το email καταλήγει συχνά πίσω από Microsoft Defender Safe Links (*«URLs are scanned prior to message delivery»*): μηχανή
 * ανοίγει τον σύνδεσμο πριν τον άνθρωπο. Το `?answer=` είναι **μόνο προσυμπλήρωση**.
 *
 * 🔑 **ΣΤΟ `(auth)`**: ο άνθρωπος φτάνει από email, χωρίς ταυτότητα — ίδια δήλωση με τα `card-email/[token]` · `mandate/[token]`.
 * ⚠️ `force-dynamic` (CHECK 3.55) · `noindex` · `no-referrer`: ο σύνδεσμος **είναι** διαπιστευτήριο και δεν διαρρέει ως `Referer`
 * όταν ο άνθρωπος πατήσει «Άλλο ωράριο».
 */

import 'server-only';

import type { Metadata } from 'next';

import { HolidayQuestionContent } from '@/components/mandate/HolidayQuestionContent';
import { HOLIDAY_ANSWER_KINDS } from '@/lib/calendar/holiday-question';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { decodeRouteParam } from '@/lib/routes/route-param';
import { readHolidayQuestion } from '@/services/mandate/holiday-hours-question-decision';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export default async function HolidayQuestionPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ answer?: string | string[] }>;
}): Promise<React.ReactElement> {
  const [{ token: raw }, { answer }] = await Promise.all([params, searchParams]);
  const token = decodeRouteParam(raw);
  const lookup = await readHolidayQuestion(getAdminFirestore(), token);
  // ⚠️ Μόνο γνωστή τιμή γίνεται προεπιλογή — πίνακας ή σκουπίδι ⇒ καμία.
  const preset = HOLIDAY_ANSWER_KINDS.find((kind) => kind === answer) ?? null;

  return <HolidayQuestionContent token={token} lookup={lookup} preset={preset} />;
}
