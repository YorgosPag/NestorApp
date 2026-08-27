/**
 * =============================================================================
 * ΕΠΑΝΑΣΥΝΘΕΣΗ ΔΗΜΟΣΙΩΝ ΠΡΟΒΟΛΩΝ (ADR-777 Α3/Α5)
 * =============================================================================
 *
 * Ξαναχτίζει **από την αρχή** το `public_listings` για κάθε ακίνητο.
 *
 * 🔑 **Είναι το δηλωμένο δίχτυ ασφαλείας**, όχι εργαλείο έκτακτης ανάγκης. Η προβολή
 * γράφεται στη διαδρομή γραφής (`/api/properties/[id]` · `/api/properties/create`),
 * που καλύπτει κάθε αλλαγή μέσω της εφαρμογής. **Δεν** καλύπτει γραφή με Admin SDK,
 * μαζική εισαγωγή, ή χειροκίνητη επεξεργασία στην κονσόλα Firebase — και αντί να
 * ελπίζουμε ότι δεν συμβαίνουν, υπάρχει πράξη που τις διορθώνει και τις **μετρά**.
 *
 * ⚠️ **ΚΛΕΙΣΤΗ ΛΟΓΙΣΤΙΚΗ, fail-closed** — το ίδιο εργαλείο που επιβάλλουμε στις πύλες
 * μας: κάθε ακίνητο καταλήγει σε **έναν** ονομασμένο κάδο, το άθροισμα **πρέπει** να
 * κλείνει, και η αναφορά το λέει ρητά. Μια επανασύνθεση που τυπώνει «ok» χωρίς να πει
 * **πόσα** κοίταξε είναι το «0 = κανείς δεν κοίταξε» με άλλο ρούχο.
 *
 * 🔴 **Επιπλέον σβήνει ΟΡΦΑΝΕΣ προβολές**: έγγραφα στο `public_listings` των οποίων το
 * ακίνητο δεν υπάρχει πια. Χωρίς αυτό, ένα διαγραμμένο ακίνητο θα έμενε **δημόσια
 * ορατό για πάντα** — ακριβώς το είδος σιωπηλού υπολείμματος που ο κύκλος ζωής της
 * κατηγορίας `published-projection` υπάρχει για να αποκλείσει.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴🔴 ΔΥΟ ΟΙΚΟΓΕΝΕΙΕΣ ΓΡΑΦΟΥΝ ΕΔΩ — ΚΑΙ ΤΟ ΑΡΧΕΙΟ ΗΞΕΡΕ ΜΟΝΟ ΤΗ ΜΙΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `public_listings` δέχεται προβολές από **δύο** πηγές (ADR-777 Α14): τον
 * **επαγγελματία** (`properties/{prop_*}`, ο τόπος λύνεται ανεβαίνοντας ακίνητο →
 * κτίριο → έργο) και τον **ιδιώτη** (`owner_properties/{ownp_*}`, ο τόπος είναι η
 * **δήλωσή** του). Μέχρι τις 2026-08-27 αυτή η πράξη σάρωνε **μόνο** το `properties`.
 *
 * ⛔ **Και δεν ήταν απλώς ελλιπής — ήταν ΚΑΤΑΣΤΡΟΦΙΚΗ.** Το `removeOrphanListings`
 * σβήνει κάθε προβολή της οποίας η ταυτότητα **δεν βρέθηκε στη σάρωση**. Καμία
 * ταυτότητα `ownp_*` δεν ήταν ποτέ εκεί ⇒ **μία εκτέλεση θα διέγραφε ΚΑΘΕ αγγελία
 * ιδιώτη από τον δημόσιο χάρτη**, και θα το ανέφερε ως **επιτυχία** («orphansRemoved»).
 * Η ίδια η αναφορά ήταν το σχήμα «*0 = κανείς δεν κοίταξε*» που η επικεφαλίδα από πάνω
 * απαγορεύει: η λογιστική **έκλεινε**, επειδή μετρούσε **λάθος σύμπαν**.
 *
 * 🔑 **Η θεραπεία ΔΕΝ είναι δεύτερος γραφέας.** Κάθε οικογένεια επανασυντίθεται από
 * τη **δική της** υπάρχουσα διαδρομή —`republishListing` ⇄ `republishOwnerProperty`—
 * που είναι οι ίδιες που τρέχουν στη γραφή. Ένας «ενοποιημένος» γραφέας εδώ θα ήταν
 * **τρίτος** και θα απέκλινε από αμφότερους (ADR-749).
 *
 * - GET  = στεγνή εκτέλεση (μετράει, **μηδέν** εγγραφές)
 * - POST = εκτέλεση
 *
 * 🔒 SECURITY: super_admin ONLY + withSensitiveRateLimit
 *
 * @module api/admin/rebuild-public-listings
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import { BYPASS_ROLES } from '@/lib/auth/roles';
import { rebuildAllPublicListings } from '@/services/listings/rebuild-public-listings.service';

const logger = createModuleLogger('rebuild-public-listings');

async function handle(request: NextRequest, ctx: AuthContext, dryRun: boolean) {
  // ⚠️ `ctx.globalRole`, ΠΟΤΕ `ctx.role`: το `AuthContext` (lib/auth/types.ts:262) **δεν
  // έχει** πεδίο `role`. Το `ctx.role` έδινε `undefined` ⇒ `PREDEFINED_ROLES[undefined]`
  // ⇒ `isRoleBypass` = `false` ⇒ **403 για ΚΑΘΕ χρήστη, συμπεριλαμβανομένου του
  // super_admin** — δηλαδή η επανασύνθεση ήταν δομικά μη εκτελέσιμη. Το βρήκε η
  // **εκτέλεση**, όχι η ανάγνωση (2026-08-10, ADR-777 Β2β). Και τα **20** άλλα admin
  // routes γράφουν ήδη `ctx.globalRole` — αυτό ήταν το μοναδικό που απέκλινε.
  try {
    const report = await rebuildAllPublicListings(getAdminFirestore(), dryRun);
    logger.info(dryRun ? 'Στεγνή επανασύνθεση' : 'Επανασύνθεση προβολών', { ...report });
    return NextResponse.json({ dryRun, report });
  } catch (error) {
    logger.error('Η επανασύνθεση απέτυχε', { error: getErrorMessage(error) });
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

export const GET = withSensitiveRateLimit(
  withAuth(
    async (request: NextRequest, ctx: AuthContext, _cache: PermissionCache) =>
      handle(request, ctx, true),
    { requiredGlobalRoles: BYPASS_ROLES },
  )
);

export const POST = withSensitiveRateLimit(
  withAuth(
    async (request: NextRequest, ctx: AuthContext, _cache: PermissionCache) =>
      handle(request, ctx, false),
    { requiredGlobalRoles: BYPASS_ROLES },
  )
);
