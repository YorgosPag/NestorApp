import 'server-only';

/**
 * =============================================================================
 * ΤΟ ΡΗΜΑ «ΔΗΜΙΟΥΡΓΗΣΕ ΚΤΗΡΙΑ ΑΠΟ ΠΡΟΤΥΠΑ» — μία φορά (ADR-245)
 * =============================================================================
 *
 * **Το γεγονός**: τα `/api/buildings/seed` και `/api/buildings/populate` το έγραφαν
 * **δύο φορές**, και το έλεγαν μόνα τους στο docblock τους: *«This route is
 * functionally identical to /api/buildings/populate»*. Το ίδιο `handleBuildingInstantiation`
 * καλούνταν και από τα δύο — αλλά **γύρω** του ήταν αντιγραμμένα:
 *
 *   1. ο τύπος απάντησης (`SeedResponse` ↔ `PopulateResponse`, **ταυτόσημα πεδία**,
 *      και τα δύο = `HandlerResponse` **μείον** το `statusCode`),
 *   2. η προβολή των **οκτώ** πεδίων σε `NextResponse.json`,
 *   3. η αλυσίδα εξουσιοδότησης (`withStandardRateLimit` → `withAuth` → ταβάνι ρόλου).
 *
 * ⚠️ **Το σχόλιο «είναι ίδια» δεν είναι φρουρός** (μάθημα CHECK 3.36): μέχρι σήμερα
 * τίποτα δεν εμπόδιζε το ένα route να αποκτήσει ένατο πεδίο ή άλλο ταβάνι ρόλου, και
 * η απόκλιση θα φαινόταν **μόνο** σε κάποιον που θα άνοιγε **και τα δύο** αρχεία.
 * Το CHECK 3.28 το κατήγγειλε ως κλώνο· η θεραπεία δεν είναι να μοιάζουν λιγότερο,
 * είναι **να μην υπάρχει δεύτερο αντίγραφο**.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔑 ΤΙ ΜΕΝΕΙ ΣΤΟ ROUTE — Η ΤΑΥΤΟΤΗΤΑ, ΟΧΙ Η ΜΗΧΑΝΙΚΗ
 * ─────────────────────────────────────────────────────────────────────────────
 * Κάθε route εξακολουθεί να γράφει `export const POST = …` και **τη δική του**
 * `HandlerOptions` (`source` · `operationPrefix` · `createdBy`) — δηλαδή ό,τι το
 * ξεχωρίζει στα audit ίχνη. Εδώ ζει μόνο ό,τι είναι ίδιο **εξ ορισμού**.
 *
 * ⚠️ **ΤΟ `statusCode` ΔΕΝ ΕΙΝΑΙ ΠΕΔΙΟ ΣΩΜΑΤΟΣ**: ταξιδεύει ως HTTP status, γι' αυτό
 * ο τύπος είναι `Omit<HandlerResponse, 'statusCode'>` και **παράγεται** από τον
 * κανονικό τύπο του χειριστή — νέο πεδίο εκεί ταξιδεύει εδώ **δωρεάν**, ενώ ένας
 * χειρόγραφος καθρέφτης θα αποκλίνει σιωπηλά (σχήμα CHECK 3.34).
 *
 * @module server/admin/building-instantiation-route
 * @see server/admin/building-instantiation-handler — η λογική· εδώ μόνο το σύνορο HTTP
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { withAuth, BYPASS_ROLES } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';

import {
  handleBuildingInstantiation,
  type HandlerOptions,
  type HandlerResponse,
} from './building-instantiation-handler';

/**
 * Το σώμα της απάντησης: ό,τι επιστρέφει ο χειριστής **εκτός** από το `statusCode`,
 * που ταξιδεύει ως HTTP status και όχι μέσα στο JSON.
 */
export type BuildingInstantiationResponse = Omit<HandlerResponse, 'statusCode'>;

/**
 * Το **ΕΝΑ** POST route για δημιουργία κτηρίων από πρότυπα.
 *
 * @rateLimit STANDARD (60 req/min) - CRUD
 * @security server-only · `withAuth` · ταβάνι ρόλου `BYPASS_ROLES` (super_admin)
 */
export function buildingInstantiationRoute(options: HandlerOptions) {
  return withStandardRateLimit(
    withAuth<BuildingInstantiationResponse>(
      async (request: NextRequest, _ctx: AuthContext, _cache: PermissionCache) => {
        const { statusCode, ...body } = await handleBuildingInstantiation(request, options);
        return NextResponse.json(body, { status: statusCode });
      },
      { requiredGlobalRoles: BYPASS_ROLES },
    ),
  );
}
