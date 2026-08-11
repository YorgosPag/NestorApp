/**
 * @fileoverview **Η ΠΟΡΤΑ ΤΟΥ ΕΝΤΟΠΙΣΜΟΥ** — ο άνθρωπος δείχνει, ο τόπος αποκτά ταυτότητα.
 * @related ADR-777 · SPEC-777A §13.4 · §13.5 · §14.4 · services/places/public-place-write.service
 * @module app/api/places/resolve/route
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΑΠΑΙΤΕΙ ΤΑΥΤΟΤΗΤΑ, ΕΝΩ ΤΟ ΑΠΟΤΕΛΕΣΜΑ ΕΙΝΑΙ **ΔΗΜΟΣΙΟ**
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `public_lands` το διαβάζουν **όλοι** (`read: if true`), άρα θα φαινόταν λογικό να
 * γράφει και οποιοσδήποτε. Δεν είναι:
 *
 * 1. **§14.4** — *«ένα λάθος εκεί είναι λάθος για **όλους** ταυτόχρονα, και μια
 *    κακόβουλη εγγραφή γίνεται φορέας επίθεσης προς **κάθε** πελάτη μαζί»*. Η
 *    ταυτότητα δεν εμποδίζει το λάθος· κάνει τον **ρυθμό** πεπερασμένο και το
 *    περιστατικό **αποδώσιμο** στα ίχνη του διακομιστή.
 * 2. **§13.4 (ODbL)** — η άμυνά μας είναι ότι κάθε ταυτότητα γεννιέται *«επειδή τη
 *    ζήτησε **άνθρωπος**»*. Ανώνυμη πόρτα καθιστά αυτή τη διατύπωση **ανεπαλήθευτη**.
 *
 * ⚠️ **Καμία ταυτότητα χρήστη ΔΕΝ φτάνει στο έγγραφο** — δες την επικεφαλίδα της
 * υπηρεσίας γραφής: η συλλογή είναι δημόσια στην ανάγνωση, οπότε ένα `proposedBy`
 * εκεί θα ήταν διαρροή προσώπου προς κάθε επισκέπτη (§21.6).
 *
 * ⚠️ **Καμία άδεια (`permissions`)** — ίδιος λόγος με το `/api/owner-properties`: τα
 * δικαιώματα είναι **εμβέλειας εταιρείας** και ο ιδιώτης **δεν έχει εταιρεία**. Ένας
 * τέτοιος φρουρός θα ήταν κλειστός για **όλους** όσους υπάρχει για να μπουν.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { withAuth } from '@/lib/auth/middleware';
import type { AuthContext } from '@/lib/auth/types';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { nowISO } from '@/lib/date-local';
import { placeResolveRequestFrom } from '@/lib/places/place-claim';
import { resolvePlace } from '@/services/places/public-place-write.service';

import {
  respondToMalformedBody,
  respondToResolution,
  type PlaceApiResponse,
} from '../_shared/respond';

/**
 * **Χειρονομία → ταυτότητα τόπου.**
 *
 * Το σώμα είναι `{ claim, target, distinctFromNearby? }`, όπου το `claim` είναι
 * **αυστηρά** μία από τις τέσσερις ανθρώπινες χειρονομίες. Δεν υπάρχει πεδίο
 * `provenance` και δεν πρόκειται να υπάρξει: η προέλευση **συνάγεται** από τη
 * χειρονομία, και ό,τι είναι **παράγωγο** (σημείο κτιρίου OSM, σημείο διεύθυνσης) το
 * ξαναβγάζει ο διακομιστής από την πηγή.
 */
async function handler(
  request: NextRequest,
  _ctx: AuthContext,
): Promise<NextResponse<PlaceApiResponse>> {
  const body: unknown = await request.json().catch(() => null);

  const parsed = placeResolveRequestFrom(body);
  if (!parsed.ok) return respondToMalformedBody(parsed.malformed);

  // ⚠️ **Εκτός σχήματος επίτηδες**: το `distinctFromNearby` δεν είναι μέρος της
  // χειρονομίας — είναι **απάντηση σε ερώτηση που έκανε ο διακομιστής**. Μέσα στο
  // `claim` θα ήταν πεδίο που ο πελάτης «δηλώνει», δηλαδή ακριβώς το σχήμα που το
  // `place-claim.ts` υπάρχει για να αποκλείσει.
  const distinctFromNearby = (body as { distinctFromNearby?: unknown } | null)
    ?.distinctFromNearby === true;

  return respondToResolution(
    await resolvePlace(
      getAdminFirestore(),
      { ...parsed.request, distinctFromNearby },
      nowISO(),
    ),
  );
}

export const POST = withStandardRateLimit(withAuth(handler));
