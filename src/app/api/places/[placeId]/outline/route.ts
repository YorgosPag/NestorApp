/**
 * @fileoverview **ΤΟ ΠΕΡΙΓΡΑΜΜΑ, ΖΩΝΤΑΝΑ** — και ο λόγος που δεν αποθηκεύεται ποτέ.
 * @related ADR-777 · SPEC-777A §13.4 (ODbL) · types/geo/public-place.ts
 * @module app/api/places/[placeId]/outline/route
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΑΥΤΗ Η ΔΙΑΔΡΟΜΗ **ΕΙΝΑΙ** ΤΟ ΝΟΜΙΚΟ ΟΡΙΟ ΤΟΥ §13.4
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το OSMF Geocoding Guideline επιτρέπει αποθήκευση «*names, addresses, and/or
 * latitude/longitude*». Το **περίγραμμα δεν αναφέρεται** — άρα η γεωμετρία OSM
 * **δείχνεται** και δεν **κρατιέται**. Ο τύπος το επιβάλλει (`outline?: never` στον
 * κλάδο `osm`)· αυτή η διαδρομή είναι το **πώς φαίνεται παρ' όλα αυτά στην οθόνη**.
 *
 * ⛔ **ΜΗΝ βάλεις εδώ προσωρινή μνήμη περιγραμμάτων σε δική μας βάση.** Η μνήμη του
 * **περιηγητή** και οι κεφαλίδες HTTP είναι θεμιτές (είναι ο ίδιος μηχανισμός που
 * κάνει ένα καρέ χάρτη να μη ζητιέται δύο φορές)· μια **συλλογή** περιγραμμάτων είναι
 * *«συστηματική συγκέντρωση»* και ενεργοποιεί το share-alike.
 *
 * ⚠️ **Δημόσια, χωρίς ταυτότητα — και είναι απόφαση, όχι παράλειψη.** Η αγγελία είναι
 * δημόσια (`(light)`, `read: if true`), οπότε ο ανώνυμος επισκέπτης **πρέπει** να δει
 * το σχήμα του κτιρίου. Η επιφάνεια κατάχρησης είναι **φραγμένη από το ίδιο το
 * μοντέλο**: η διαδρομή δέχεται **μόνο δική μας ταυτότητα** που **ήδη υπάρχει**, άρα
 * δεν μπορεί να χρησιμοποιηθεί για σάρωση του OSM — σε αντίθεση με το `/lookup`, που
 * δέχεται **αυθαίρετο** σημείο και γι' αυτό απαιτεί ταυτότητα.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { withHeavyRateLimit } from '@/lib/middleware/with-rate-limit';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { fetchOsmBuildingOutline } from '@/lib/geo/osm/osm-building';
import { placeKindOf, readPlaceOsmRef } from '@/services/places/public-place-read.service';
import type { GeoOutline } from '@/types/geo/coordinates';

type RouteContext = { params: Promise<{ placeId: string }> };

interface OutlineResponse {
  /**
   * `null` = **δεν υπάρχει σχήμα να δειχθεί**, και καλύπτει τρεις περιπτώσεις που
   * έχουν **την ίδια** θεραπεία για τον καταναλωτή: ο τόπος δεν ήρθε από OSM· είναι
   * `node`/`relation` (**0,24 %** των κτιρίων, μετρημένο)· ή το στοιχείο έσβησε.
   *
   * 🔴 **Το «δεν μάθαμε» ΔΕΝ είναι εδώ μέσα** — φεύγει ως **503**. Η πρώτη γραφή τα
   * συγχώνευε, και το αποκάλυψε **ζωντανή δοκιμή**: όταν το δημόσιο Overpass μας
   * έκοψε (όριο **2 slots ανά IP**), η διαδρομή απάντησε *«αυτό το κτίριο δεν έχει
   * σχήμα»* για περίγραμμα που είχαμε δει **δύο λεπτά νωρίτερα**.
   */
  readonly outline: GeoOutline | null;
}

async function handler(
  _request: NextRequest,
  context?: RouteContext,
): Promise<NextResponse<OutlineResponse | { error: string }>> {
  // ⚠️ Next 15: το `params` είναι **Promise**.
  const placeId = (await context?.params)?.placeId ?? '';

  // Το **πρόθεμα της ταυτότητας** είναι ο διαχωριστής τύπου — καμία δεύτερη παράμετρος.
  if (placeKindOf(placeId) === null) {
    return NextResponse.json({ error: 'NOT_A_PLACE_ID' }, { status: 400 });
  }

  const ref = await readPlaceOsmRef(getAdminFirestore(), placeId);
  if (ref === null) return NextResponse.json({ outline: null });

  const fetched = await fetchOsmBuildingOutline(ref.elementType, ref.elementId);

  switch (fetched.kind) {
    case 'outline':
      return NextResponse.json({ outline: fetched.outline });
    case 'no-shape':
      return NextResponse.json({ outline: null });
    case 'unavailable':
      return NextResponse.json(
        { error: 'OSM_UNAVAILABLE' },
        { status: 503, headers: { 'Retry-After': '5' } },
      );
  }
}

export const GET = withHeavyRateLimit<RouteContext>(handler);
