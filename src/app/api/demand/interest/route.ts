/**
 * @fileoverview **«ΠΟΣΟΙ ΖΗΤΟΥΝ ΤΟ ΑΚΙΝΗΤΟ ΜΟΥ»** — το δόλωμα του §12.6, προς τον κάτοχο.
 * @related ADR-777 §7 (Α9 · Α12 · Α14) · SPEC-777A §14.2 · SPEC-777B §12.6 · §12.7
 * @module app/api/demand/interest/route
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΔΕΥΤΕΡΗ ΔΙΑΔΡΟΜΗ ΚΑΙ ΟΧΙ ΕΠΕΚΤΑΣΗ ΤΟΥ `/api/demand/competition`
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Οι δύο μοιάζουν: και οι δύο διαβάζουν τις ίδιες ζητήσεις και επιστρέφουν **έναν
 * αριθμό ή τίποτα**. Η ομοιότητα σταματά εκεί — και το κριτήριο **δεν είναι η
 * ευκολία, είναι η ΕΞΟΥΣΙΟΔΟΤΗΣΗ**:
 *
 * | | `/competition` | `/interest` *(εδώ)* |
 * |---|---|---|
 * | Είσοδος | `demandId` | `propertyId` |
 * | Υποκείμενο | ο **ζητών** | ο **ιδιοκτήτης** |
 * | Απόδειξη | «η ζήτηση είναι δική σου» — **ένα** πεδίο | «το ακίνητο είναι δικό σου» — **δύο συλλογές, δύο άξονες απομόνωσης** |
 * | Ακροατήριο | `area-market` (κατώφλι **5**) | `place-owner` (κατώφλι **1**) |
 *
 * 🔑 Μία διαδρομή με δύο εισόδους, δύο αποδείξεις κατοχής και **δύο κατώφλια** θα ήταν
 * χειριστής που απαντά **δύο ερωτήσεις** — και η μέρα που κάποιος θα πρόσθετε τρίτη
 * περίπτωση, το λάθος κατώφλι θα ταξίδευε **σιωπηλά**. Το ίδιο σκεπτικό με το οποίο
 * το ADR-775 αρνήθηκε να φιλοξενήσει την πύλη e2e μέσα σε workflow χρώματος.
 *
 * ⚠️ **Ό,τι φεύγει: `stance` + `disclosure`. ΤΙΠΟΤΑ άλλο.** Καμία ταυτότητα ζητούντος,
 * κανένα κριτήριο, καμία ημερομηνία, **και ποτέ η λογιστική** — το `interested` της
 * είναι ο **ωμός** αριθμός, ακριβώς αυτό που το κατώφλι υπάρχει για να κρύψει.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { withAuth } from '@/lib/auth/middleware';
import type { AuthContext } from '@/lib/auth/types';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { nowISO, todayLocalDate } from '@/lib/date-local';
import { createModuleLogger } from '@/lib/telemetry';
import { discloseInterest, type PlaceInterest } from '@/lib/demand/demand-interest';
import { readLiveDemands } from '@/services/demand/live-demands.reader';
import { lookupOwnedPlace } from '@/services/demand/place-interest.service';

const logger = createModuleLogger('api/demand/interest');

/** Ό,τι φεύγει. **Ήδη λογοκριμένο** από το κατώφλι του `place-owner`. */
interface InterestResponse {
  readonly interest: PlaceInterest;
}

async function handler(
  request: NextRequest,
  ctx: AuthContext,
): Promise<NextResponse<InterestResponse | { error: string }>> {
  const propertyId = request.nextUrl.searchParams.get('propertyId')?.trim() ?? '';
  if (propertyId === '') {
    return NextResponse.json({ error: 'MISSING_PROPERTY_ID' }, { status: 400 });
  }

  const db = getAdminFirestore();

  try {
    const place = await lookupOwnedPlace(db, propertyId, ctx.uid, ctx.companyId);

    // 🔴 «Δεν υπάρχει» και «δεν είναι δικό σου» απαντώνται **ΤΟ ΙΔΙΟ**, επίτηδες: μια
    // ξεχωριστή άρνηση θα επιβεβαίωνε την ύπαρξη της ταυτότητας, δηλαδή θα επέτρεπε
    // απογραφή ξένου χαρτοφυλακίου με μαντεψιά ταυτοτήτων.
    if (place.kind === 'absent') {
      return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    }

    const { demands } = await readLiveDemands(db, 'demand/interest');
    const { interest } = discloseInterest(
      place.facts,
      demands,
      // ⚠️ Το ρολόι διαβάζεται **εδώ, στο σύνορο**, μέσω του SSoT `date-local`
      // (CHECK 3.7) — η μηχανή μένει καθαρή και δοκιμάσιμη.
      nowISO(),
      todayLocalDate(),
    );

    return NextResponse.json({ interest });
  } catch (error) {
    logger.error('Το ενδιαφέρον δεν υπολογίστηκε', {
      data: { propertyId },
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'AGGREGATE_FAILED' }, { status: 500 });
  }
}

export const GET = withStandardRateLimit(withAuth(handler));
