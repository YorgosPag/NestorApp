/**
 * «Ανήκει ΑΥΤΟ το κτήριο;» — το λεξιλόγιο του πόρου πάνω στην κοινή απόφαση
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΤΙ ΥΠΗΡΧΕ ΠΡΙΝ (μετρημένο 2026-08-01, ADR-742 §7octies)
 * ─────────────────────────────────────────────────────────────────────────────
 * Τρία σημεία (`[buildingId]/route.ts` DELETE · `building-update.handler.ts` ·
 * `[buildingId]/link-project/route.ts`) έγραφαν την ίδια τριάδα με το χέρι, και
 * και τα τρία απαντούσαν **403** σε άρνηση ιδιοκτησίας ενώ ο γνήσιος κλάδος
 * δίπλα τους απαντούσε **404 `'Building not found'`**:
 *
 * ```ts
 * if (!buildingDoc.exists) throw new ApiError(404, 'Building not found');
 * const isSuperAdmin = isRoleBypass(ctx.globalRole);
 * if (!isSuperAdmin && buildingData?.companyId !== ctx.companyId) {
 *   throw new ApiError(403, 'Unauthorized: Building belongs to different company');
 * }
 * ```
 *
 * 🔴 Το μήνυμα εδώ ήταν **χειρότερο** από τη μισογραμμένη μεταμφίεση των έργων
 * και των επαφών: δεν προσποιούνταν καν. Το `'belongs to different company'`
 * **ονομάζει** τον λόγο — επιβεβαιώνει και ότι το id υπάρχει και ότι ανήκει σε
 * **άλλον πελάτη**. Δύο από τα τρία σημεία είναι **μεταλλάξεις** (delete,
 * update), οπότε η παγίδα του κενού (§4) εκεί δεν διέρρεε: **έγραφε**.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠️ ΤΟ ΚΤΗΡΙΟ ΗΤΑΝ ΗΔΗ ΜΙΣΟ-ΚΑΛΥΜΜΕΝΟ — ΓΙ' ΑΥΤΟ Η ΑΠΟΚΛΙΣΗ ΜΕΤΡΑΕΙ ΔΙΠΛΑ
 * ─────────────────────────────────────────────────────────────────────────────
 * Το §7septies έκανε το `requireDocInTenant` να επιστρέφει `404 NOT_FOUND` και
 * για την άρνηση ιδιοκτησίας, καλύπτοντας **έξι** οντότητες — μεταξύ τους το
 * `building`. Άρα οι διαδρομές που περνούσαν από εκείνον τον πυρήνα **ήδη**
 * μεταμφιέζονταν. Αυτά τα τρία σημεία δεν περνούσαν, οπότε ο πόρος μιλούσε με
 * **δύο φωνές** για το ίδιο `buildings/{id}`: 404 από τη μία μεριά, 403 από την
 * άλλη. **Μία διαδρομή που αποκλίνει ακυρώνει όλες τις υπόλοιπες** (§7septies).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΤΟ ΔΟΓΜΑ BYPASS
 * ─────────────────────────────────────────────────────────────────────────────
 * Και τα τρία σημεία είχαν **ήδη** `!isSuperAdmin &&`, οπότε εδώ δεν υπήρχε
 * ασυμμετρία να λυθεί — αντίθετα με τις επαφές. Κρατιέται ως έχει, ως
 * **ονομασμένη κατάσταση**, και παραμένει το γνωστό χρέος «standing
 * cross-tenant privilege» του §7ter.3.
 *
 * @module app/api/buildings/_shared/building-ownership
 * @see @/lib/auth/resource-ownership-guard — η κοινή απόφαση (μην την ξαναγράψεις)
 * @see ../../contacts/_shared/contact-ownership — αδελφικό δέσιμο, ίδιο σχήμα
 */

import { ApiError } from '@/lib/api/api-error-types';
import type { MaybeTenantOwned } from '@/lib/auth/tenant-ownership';
import {
  createOwnershipDecision,
  type ResourceAccessCaller,
  type ResourceAccessVerdict,
} from '@/lib/auth/resource-ownership-guard';

/**
 * Η διαδικασία απόφασης, δεμένη στο λεξιλόγιο των κτηρίων.
 *
 * ⚠️ **Μην ξαναγράψεις εδώ τη λογική** — ζει στο
 * `lib/auth/resource-ownership-guard.ts`. Τρία αντίγραφά της υπήρξαν και το
 * `jscpd` τα βρήκε **καθαρά**, επειδή τα ονόματα διέφεραν (§7octies).
 */
const decide = createOwnershipDecision('Building', 'buildingId');

/**
 * Το κείμενο του «δεν βρέθηκε» — **SSoT**.
 *
 * ⚠️ Είναι **ακριβώς** η τιμή που έγραφε ο γνήσιος κλάδος των τριών σημείων.
 * Το σύρμα του γνήσιου «δεν βρέθηκε» δεν αλλάζει — αλλιώς το ίδιο το κείμενο
 * γίνεται μαντείο ύπαρξης.
 */
export const BUILDING_NOT_FOUND_MESSAGE = 'Building not found';

/**
 * Το **ένα** εργοστάσιο του «δεν βρέθηκε».
 *
 * Μηδέν ορίσματα **επίτηδες**: δεν υπάρχει τιμή που θα μπορούσε να διαφέρει
 * ανάμεσα στον γνήσιο κλάδο και στην άρνηση, άρα δεν υπάρχει τρόπος να
 * αποκλίνουν χωρίς να αλλάξει **αυτό** το αρχείο (§7.1).
 */
export function buildingNotFound(): ApiError {
  return new ApiError(404, BUILDING_NOT_FOUND_MESSAGE);
}

export type BuildingAccessCaller = ResourceAccessCaller;
export type BuildingAccessVerdict = ResourceAccessVerdict;

export interface BuildingAccessSpec {
  /** Το φορτίο **όπως βγήκε από τη βάση**. Ποτέ στενεμένο (§7.5). */
  readonly buildingData: MaybeTenantOwned | null | undefined;
  readonly caller: BuildingAccessCaller;
  readonly buildingId: string;
  /** Ποιο μονοπάτι ρώτησε, π.χ. `'delete'`, `'update'`, `'link-project'`. */
  readonly action: string;
}

/** **Η απόφαση (PDP)** για τα κτήρια — ολική, χωρίς ρίψη. */
export function checkBuildingAccess(spec: BuildingAccessSpec): BuildingAccessVerdict {
  return decide({
    data: spec.buildingData,
    caller: spec.caller,
    resourceId: spec.buildingId,
    action: spec.action,
  });
}

/**
 * **Η επιβολή (PEP)** — ρίχνει το μεταμφιεσμένο «δεν βρέθηκε» όταν η απόφαση
 * είναι `denied`, από το **ίδιο** εργοστάσιο με τον γνήσιο κλάδο.
 */
export function requireBuildingAccess(spec: BuildingAccessSpec): void {
  if (checkBuildingAccess(spec) === 'denied') {
    throw buildingNotFound();
  }
}
