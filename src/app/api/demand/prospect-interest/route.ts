/**
 * @fileoverview **«ΔΕΣ ΑΝ ΚΑΠΟΙΟΣ ΕΝΔΙΑΦΕΡΕΤΑΙ ΓΙΑ ΤΟ ΑΚΙΝΗΤΟ ΣΟΥ»** — η απάντηση πριν την απόδειξη κατοχής.
 * @related ADR-900 · lib/demand/prospect-interest.ts · services/demand/prospect-interest.service.ts ·
 *   app/api/demand/interest/route.ts (η δίδυμη διαδρομή, ΜΕΤΑ την καταχώριση κατοχής)
 * @module app/api/demand/prospect-interest/route
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΔΕΥΤΕΡΗ ΔΙΑΔΡΟΜΗ ΚΑΙ ΟΧΙ ΠΑΡΑΜΕΤΡΟΣ ΤΟΥ `/api/demand/interest`
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ίδιο σκεπτικό με το `/interest` απέναντι στο `/competition`: το κριτήριο είναι η **εξουσιοδότηση**.
 *
 * | | `/interest` | `/prospect-interest` *(εδώ)* |
 * |---|---|---|
 * | Είσοδος | `propertyId` | κτίριο + περιγραφή |
 * | Απόδειξη | «το ακίνητο είναι δικό σου» | **καμία** |
 * | Ακροατήριο | `place-owner` (κατώφλι 1) | `prospective-owner` (κατώφλι 5, βήμα 5) |
 *
 * Μια διαδρομή με «προαιρετική» απόδειξη θα είχε δύο κατώφλια πίσω από ένα `if` — και η μέρα που
 * κάποιος θα το αντέστρεφε, το κατώφλι 1 θα έφτανε **σιωπηλά** σε όποιον δείχνει το σπίτι του γείτονα.
 *
 * ⚠️ **Ό,τι φεύγει: `stance` + `disclosure`. ΤΙΠΟΤΑ άλλο** — ίδιο συμβόλαιο με το `/interest`.
 * ⚠️ **GET, άρα εκτός του συνόρου ιδεμποτίας (CHECK 3.92)**: τίποτα δεν γράφεται.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { withPersonalOrOrgAuth, type ApiActor } from '@/lib/auth/personal-scope-middleware';
import { PROSPECT_INTEREST_DAILY_QUOTA } from '@/lib/middleware/rate-limit-config';
import { withinSubjectQuota } from '@/lib/middleware/subject-quota';
import { withHeavyRateLimit } from '@/lib/middleware/with-rate-limit';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { nowISO, todayLocalDate } from '@/lib/date-local';
import { createModuleLogger } from '@/lib/telemetry';
import { discloseInterest, type PlaceInterest } from '@/lib/demand/demand-interest';
import { parseProspectQuery } from '@/lib/demand/prospect-interest';
import { readLiveDemands } from '@/services/demand/live-demands.reader';
import { prospectFactsOf } from '@/services/demand/prospect-interest.service';

const logger = createModuleLogger('api/demand/prospect-interest');

/** Ό,τι φεύγει. **Ήδη λογοκριμένο** από το κατώφλι και το βήμα του `prospective-owner`. */
interface ProspectInterestResponse {
  readonly interest: PlaceInterest;
}

/** Η ημερήσια ποσόστωση ανά καλούντα. ⚠️ Όχι `export`: το `route.ts` δέχεται μόνο εξαγωγές διαδρομής (Next). */
const PROSPECT_INTEREST_QUOTA_SCOPE = 'demand:prospect-interest' as const;

async function handler(
  request: NextRequest,
  actor: ApiActor,
): Promise<NextResponse<ProspectInterestResponse | { error: string }>> {
  const parsed = parseProspectQuery(request.nextUrl.searchParams);
  if (parsed.kind === 'invalid') {
    return NextResponse.json({ error: `INVALID_QUERY:${parsed.defect}` }, { status: 400 });
  }

  // 🔑 ADR-900 §8 #4 — μετρούν μόνο **έγκυρα** ερωτήματα (το 400 δεν αγγίζει τη ζήτηση). Σε σκιά σήμερα
  //    ⇒ πάντα `true`· η μέρα που η δήλωση γίνει `'enforce'`, αυτή η γραμμή αρνείται χωρίς άλλη αλλαγή.
  if (!(await withinSubjectQuota(PROSPECT_INTEREST_QUOTA_SCOPE, actor.ctx.uid, PROSPECT_INTEREST_DAILY_QUOTA))) {
    return NextResponse.json({ error: 'DAILY_QUOTA_EXCEEDED' }, { status: 429 });
  }

  const db = getAdminFirestore();
  // ⚠️ Το ρολόι διαβάζεται **εδώ, στο σύνορο** (CHECK 3.7) — μία στιγμή για προβολή ΚΑΙ κρίση.
  const at = nowISO();

  try {
    const place = await prospectFactsOf(db, parsed.query, at);
    if (place.kind === 'invalid') return NextResponse.json({ error: 'NOT_A_PLACE' }, { status: 422 });
    if (place.kind === 'unavailable') return NextResponse.json({ error: 'PLACE_UNAVAILABLE' }, { status: 503 });

    const { demands } = await readLiveDemands(db, 'demand/prospect-interest');
    const { interest } = discloseInterest(place.facts, demands, at, todayLocalDate(), 'prospective-owner');
    return NextResponse.json({ interest });
  } catch (error) {
    logger.error('Το ενδιαφέρον υποψήφιου ιδιοκτήτη δεν υπολογίστηκε', {
      data: { landId: parsed.query.ref.landId },
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'AGGREGATE_FAILED' }, { status: 500 });
  }
}

// 🔑 Απαιτείται ταυτότητα (ιδιώτης ή γραφείο) — όχι για κατοχή, για **λογοδοσία** και όριο ρυθμού.
// 🔴 **HEAVY (10/λεπτό, fail-closed), ΟΧΙ STANDARD — και είναι ο φρουρός, όχι λεπτομέρεια.** Αυτή η
//    διαδρομή δέχεται **κριτήρια** (κτίριο + περιγραφή), δηλαδή είναι ακριβώς το «ελεύθερο ερωτητήριο
//    πάνω στη ζήτηση» που το `usePlaceInterest` αρνείται να ανοίξει: με 60/λεπτό, ένα script θα
//    σάρωνε κτίρια και θα ανασύνθετε τον θερμοχάρτη του Ε2. Κατώφλι 5 + βήμα 5 κρύβουν το ΠΡΟΣΩΠΟ·
//    το όριο ρυθμού κρύβει τον ΧΑΡΤΗ. Καμία γραμμή στον πίνακα προθεμάτων ⇒ `declared-over-default`
//    (CHECK 3.78: μία απάντηση, καμία νεκρή γραμμή).
export const GET = withHeavyRateLimit(withPersonalOrOrgAuth(handler));
