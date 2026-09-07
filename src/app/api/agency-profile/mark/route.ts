/**
 * @fileoverview 🏆 **ΤΟ ΣΗΜΑ ΤΟΥ ΕΠΑΓΓΕΛΜΑΤΙΑ** — δήλωση και απόσυρση, ως δική τους
 *   πράξη (ADR-841 §7 Α21, Φάση 2).
 * @related services/mandate/showcase-mark-custody · app/api/agency-profile/mark-request
 * @module app/api/agency-profile/mark/route
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ ΔΕΥΤΕΡΗ ΔΙΑΔΡΟΜΗ ΔΙΠΛΑ ΣΤΗ ΓΕΙΤΟΝΙΚΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Επειδή είναι **δεύτερη πράξη**, όχι δεύτερο πεδίο. Στη Φάση 1 το σήμα ταξίδευε μέσα
 * στη δήλωση της βιτρίνας, και εκείνο **δεν μπορούσε να δουλέψει**: η οθόνη διαβάζει
 * πίσω το ίδιο έγγραφο με τον κόσμο, όπου το σήμα ζει ως **δημόσιο URL** — το ιδιωτικό
 * μονοπάτι που ζητά το σύρμα δεν επιστρέφει ποτέ, και **δεν επιτρέπεται** να επιστρέψει.
 * Άρα κάθε δεύτερη αποθήκευση έστελνε «κανένα σήμα» και **έσβηνε το λογότυπο**.
 *
 * 🏆 **Και η χωριστή πράξη είναι το καθολικό πρότυπο**: GitHub · Slack · LinkedIn ·
 * Clerk — **το avatar δεν έχει «Αποθήκευση»**. Αλλάζει τη στιγμή που το ανεβάζεις, και ο
 * άνθρωπος δεν αναρωτιέται ποτέ αν πρέπει να πατήσει κάτι για να μείνει.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔒 ΟΙ ΦΡΟΥΡΟΙ — ΚΑΙ ΕΝΑΣ ΠΟΥ **ΛΕΙΠΕΙ ΕΠΙΤΗΔΕΣ**
 * ────────────────────────────────────────────────────────────────────────────
 *
 * `withAuth` *(απαιτεί οργανισμό)* + standard rate limit. **Κανένας `gateShowcase`**, και
 * είναι το ίδιο σκεπτικό που διόρθωσε το `DELETE` της γειτονικής διαδρομής στη Φ6-Β3:
 *
 * > *«Ο ελαιοχρωματιστής δεν είχε ΠΟΤΕ ικανότητα ⇒ δεν μπορούσε να αποσύρει τη βιτρίνα
 * > που μόλις δημοσίευσε. **Φρουρός που κάνει τη θεραπεία αδύνατη.**»*
 *
 * Το σήμα **δεν είναι ρυθμιζόμενη πράξη**: είναι *«ποιος είσαι;»*, όχι *«επιτρέπεσαι να
 * μεσιτεύεις;»*. Ένας φρουρός ικανότητας εδώ θα ζητούσε από τον υδραυλικό **άδεια
 * μεσιτείας** για να ανεβάσει τη φωτογραφία του — δηλαδή θα έκανε την απουσία μητρώου
 * **ποινή** (Α9.3).
 *
 * ⚠️ **Και δεν ανοίγει τίποτα**: το κλειδί είναι το `ctx.companyId` **από τα claims**,
 * ποτέ από το σώμα ⇒ ξένη βιτρίνα παραμένει **μη εκφράσιμη**. Και το ίδιο το αρχείο που
 * δηλώνεται ελέγχεται από τον `markSourceForCompany` απέναντι στην **ίδια** ταυτότητα.
 */

import 'server-only';

import { NextResponse, type NextRequest } from 'next/server';

import { readJsonBody } from '@/lib/api/json-body';
import { withAuth } from '@/lib/auth/middleware';
import type { AuthContext } from '@/lib/auth/types';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import {
  declareShowcaseMark,
  retractShowcaseMark,
  type ShowcaseMarkWriteResult,
} from '@/services/mandate/showcase-mark-custody';
import { declaredMark, markSchema, type ShowcaseMarkWriteResponse } from '../mark-request';

/**
 * **Ό,τι απαντά ο γραφέας → δίκτυο** — γραμμένο **μία** φορά για τους δύο χειριστές.
 *
 * ⚠️ **Κλειστό `switch` χωρίς `default`**: πέμπτη κατάσταση του γραφέα **δεν
 * μεταγλωττίζεται** μέχρι κάποιος να πει τι σημαίνει για το δίκτυο. Ένα σιωπηλό
 * `default` θα την έκρυβε ως `200` με κενό σώμα — η χειρότερη απάντηση, γιατί μοιάζει
 * με επιτυχία.
 *
 * 🔑 **`422` και όχι `400` για κάθε άρνηση**: το σώμα ήταν **έγκυρο** — το αίτημα
 * απορρίφθηκε για λόγο που ο άνθρωπος μπορεί να **διορθώσει**, και τον ονομάζουμε.
 */
function respond(result: ShowcaseMarkWriteResult): NextResponse<ShowcaseMarkWriteResponse> {
  switch (result.kind) {
    case 'declared':
      return NextResponse.json({ mark: result.mark });
    case 'retracted':
      return NextResponse.json({ retracted: true } as const);
    case 'rejected':
      return NextResponse.json(
        { error: 'INVALID_MARK', reason: result.reason } as const,
        { status: 422 },
      );
    case 'failed':
      return NextResponse.json({ error: 'WRITE_FAILED' } as const, { status: 500 });
  }
}

/** **«Αυτό είναι το σήμα μου.»** */
async function declareHandler(
  request: NextRequest,
  ctx: AuthContext,
): Promise<NextResponse<ShowcaseMarkWriteResponse>> {
  const parsed = await readJsonBody(request, markSchema);
  if ('rejected' in parsed) return parsed.rejected;

  // ⚠️ **Πριν από κάθε I/O**: άγνωστο είδος είναι λάθος του **αιτήματος**, και δεν αξίζει
  //    ούτε ανάγνωση εγγράφου. Ίδιο σχήμα με το `locate` της γειτονικής διαδρομής.
  const mark = declaredMark(parsed.data);
  if ('rejected' in mark) return mark.rejected;

  return respond(await declareShowcaseMark(getAdminFirestore(), ctx.companyId, mark.mark));
}

/**
 * **«Δεν θέλω πια σήμα.»**
 *
 * 🔑 **Χωρίς σώμα**: η ταυτότητα έρχεται από τα claims και το αντικείμενο είναι
 * μοναδικό — **ένα** σήμα ανά επαγγελματία. Ένα σώμα εδώ θα ρωτούσε *«ποιο;»* σε
 * ερώτηση που έχει μία απάντηση.
 */
async function retractHandler(
  _request: NextRequest,
  ctx: AuthContext,
): Promise<NextResponse<ShowcaseMarkWriteResponse>> {
  return respond(await retractShowcaseMark(getAdminFirestore(), ctx.companyId));
}

export const POST = withStandardRateLimit(withAuth<ShowcaseMarkWriteResponse>(declareHandler));
export const DELETE = withStandardRateLimit(withAuth<ShowcaseMarkWriteResponse>(retractHandler));
