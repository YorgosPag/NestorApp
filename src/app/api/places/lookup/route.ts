/**
 * @fileoverview **«ΠΟΙΟ ΚΤΙΡΙΟ ΕΙΝΑΙ ΕΔΩ;»** — η ερώτηση του επιλογέα, πριν από κάθε γραφή.
 * @related ADR-777 · SPEC-777A §13.4 (ODbL) · §13.6 · lib/geo/osm/osm-building.ts
 * @module app/api/places/lookup/route
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΞΕΧΩΡΙΣΤΗ ΔΙΑΔΡΟΜΗ ΑΠΟ ΤΟ `/resolve`
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Οι δύο μοιάζουν περιττές μαζί, και **δεν** είναι: ανάμεσά τους ο άνθρωπος
 * **κοιτάζει και αποφασίζει**, και αυτό μπορεί να πάρει λεπτά. Αυτή εδώ **δεν γράφει
 * τίποτα** — δείχνει. Η γραφή ξαναρωτά την πηγή τη στιγμή που γράφει, γιατί το OSM
 * αλλάζει και η **εγγραφή** είναι που το βλέπουν όλοι (§14.4).
 *
 * ⚠️ **Απαιτεί ταυτότητα, παρότι δεν γράφει.** Είναι μεσολαβητής προς **δημόσιο κοινό
 * πόρο**: ανώνυμη πόρτα μας κάνει ενισχυτή προς το Overpass, με πρώτο θύμα τον δικό
 * μας UA. Και ο **ρυθμιστής** είναι «βαρύς» (10/λεπτό) για τον ίδιο λόγο — μία
 * ανθρώπινη χειρονομία τη φορά (§13.5).
 *
 * ⛔ **ΜΗΝ δεχτείς ποτέ πλαίσιο (bbox) εδώ.** Το σημείο είναι **μία** χειρονομία· ένα
 * πλαίσιο είναι **σάρωση**, και η σάρωση είναι ακριβώς αυτό που ενεργοποιεί το
 * share-alike (§13.4). Ο τύπος `GeoBoundingBox` υπάρχει για **αίτημα προς** το
 * Overpass, όχι για **αίτημα από** τον πελάτη.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { withAuth } from '@/lib/auth/middleware';
import type { AuthContext } from '@/lib/auth/types';
import { withHeavyRateLimit } from '@/lib/middleware/with-rate-limit';
import { isWithinServedArea } from '@/lib/places/place-claim-validation';
import { placeAddressLine } from '@/lib/places/place-facts';
import { lookupOsmBuildingAt } from '@/services/places/place-source-verification';
import type { GeoOutline } from '@/types/geo/coordinates';
import type { OsmElementType } from '@/types/geo/public-place';

/**
 * Ό,τι χρειάζεται η οθόνη για να **δείξει** το κτίριο και να το υποβάλει μετά.
 *
 * ⚠️ Το `outline` ταξιδεύει **για να ζωγραφιστεί** και **δεν αποθηκεύεται πουθενά**
 * (§13.4). Ο τύπος `PlacePosition` κάνει την αποθήκευσή του σφάλμα μεταγλώττισης· εδώ
 * είναι απλώς ζωντανή απάντηση, όπως θα ήταν ένα καρέ χάρτη.
 */
interface BuildingLookupResponse {
  readonly found: true;
  readonly elementType: OsmElementType;
  readonly elementId: string;
  readonly outline: GeoOutline;
  readonly displayAddress: string | null;
}

interface BuildingAbsentResponse {
  /** **Δεν υπάρχει κτίριο εκεί** — ο άνθρωπος πάει στην εναλλακτική του §13.6. */
  readonly found: false;
}

interface LookupErrorResponse {
  readonly error: string;
}

type LookupResponse = BuildingLookupResponse | BuildingAbsentResponse | LookupErrorResponse;

function numberParam(request: NextRequest, name: string): number | null {
  const raw = new URL(request.url).searchParams.get(name);
  if (raw === null) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

async function handler(
  request: NextRequest,
  _ctx: AuthContext,
): Promise<NextResponse<LookupResponse>> {
  const lat = numberParam(request, 'lat');
  const lng = numberParam(request, 'lng');

  if (lat === null || lng === null) {
    return NextResponse.json({ error: 'MISSING_COORDINATES' }, { status: 400 });
  }
  if (!isWithinServedArea({ lat, lng })) {
    // ⚠️ Ίδιο σύνορο με τη γραφή, και επίτηδες **εδώ κιόλας**: μια ερώτηση εκτός
    // περιοχής θα κατέληγε ούτως ή άλλως σε άρνηση, αφού πρώτα είχαμε φορτώσει το
    // Overpass για λογαριασμό της.
    return NextResponse.json({ error: 'OUTSIDE_SERVED_AREA' }, { status: 422 });
  }

  const pick = await lookupOsmBuildingAt({ lat, lng });

  switch (pick.kind) {
    case 'found':
      return NextResponse.json({
        found: true,
        elementType: pick.fact.elementType,
        elementId: pick.fact.elementId,
        outline: pick.outline,
        // ⚠️ **Η ίδια σύνθεση με τη γραφή** (`placeAddressLine`), ώστε αυτό που βλέπει
        // ο άνθρωπος **πριν** υποβάλει να είναι κατά λέξη αυτό που θα αποθηκευτεί.
        // Μετρημένο: **46 %** των κτιρίων στο κέντρο Θεσσαλονίκης έχουν διεύθυνση στο
        // OSM — στα υπόλοιπα το `null` λέει ειλικρινά «δεν έχει λυθεί».
        displayAddress: placeAddressLine(pick.fact.address),
      });

    case 'none':
      return NextResponse.json({ found: false });

    case 'unavailable':
      // 🔴 **503, ποτέ «δεν βρέθηκε»**: αλλιώς μια διακοπή δικτύου θα έσπρωχνε τον
      // άνθρωπο στη σχεδίαση περιγράμματος για κτίριο που **υπάρχει** στο OSM — και
      // θα γεννούσε δεύτερη ταυτότητα για ένα φυσικό κτίριο (§14.5).
      return NextResponse.json(
        { error: 'OSM_UNAVAILABLE' },
        { status: 503, headers: { 'Retry-After': '5' } },
      );
  }
}

export const GET = withHeavyRateLimit(withAuth(handler));
