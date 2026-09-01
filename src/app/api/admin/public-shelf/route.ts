/**
 * @fileoverview **Η ΠΡΟΜΗΘΕΙΑ ΤΟΥ ΔΗΜΟΣΙΟΥ ΡΑΦΙΟΥ** — `GET` παρατηρεί, `POST` πράττει.
 * @related ADR-841 §7 Α12.4 · services/listings/public-shelf-provision
 * @module api/admin/public-shelf
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ Η ΔΗΜΙΟΥΡΓΙΑ ΤΟΥ ΚΑΔΟΥ ΕΙΝΑΙ ΔΙΑΔΡΟΜΗ ΚΑΙ ΟΧΙ ΑΥΤΟΜΑΤΙΣΜΟΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο γραφέας του ραφιού (`public-shelf.service`) **δεν** δημιουργεί κάδο: αν το έκανε,
 * ένας δημόσιος κάδος θα γεννιόταν επειδή κάποιος πάτησε «αποθήκευση» σε μια αγγελία.
 * Η χορήγηση `allUsers` είναι **πράξη με συνέπειες στον έξω κόσμο** και θέλει
 * **πρόθεση** — δηλαδή κάποιον που τη ζήτησε ονομαστικά.
 *
 * 🔑 **Και γι' αυτό το `GET` υπάρχει χωριστά**: ο ισχυρισμός *«ο κάδος είναι δημόσιος»*
 * πρέπει να μπορεί να **επαληθευτεί χωρίς να αλλάξει τίποτα**. Ένα σύστημα όπου η μόνη
 * διαδρομή προς την αλήθεια είναι η διαδρομή που τη μεταβάλλει δεν είναι ελέγξιμο.
 *
 * 🔒 SECURITY: super_admin ONLY (`BYPASS_ROLES`) + `withSensitiveRateLimit`.
 */

import { NextRequest, NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { BYPASS_ROLES } from '@/lib/auth/roles';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import {
  ensurePublicShelfBucket,
  inspectPublicShelfBucket,
} from '@/services/listings/public-shelf-provision';

const logger = createModuleLogger('admin-public-shelf');

/**
 * ⚠️ **`ctx.globalRole`, ΠΟΤΕ `ctx.role`** — το `AuthContext` δεν έχει `role`, και η
 * απόκλιση είχε κοστίσει **403 για κάθε χρήστη** σε αδελφή διαδρομή (ADR-777 Β2β).
 * Εδώ ο έλεγχος γίνεται ολόκληρος από το `withAuth({ requiredGlobalRoles })`.
 */
async function handle(mutate: boolean): Promise<NextResponse> {
  try {
    const state = mutate ? await ensurePublicShelfBucket() : await inspectPublicShelfBucket();

    if (mutate) {
      logger.warn('🔴 Η προμήθεια του δημόσιου ραφιού εκτελέστηκε', { ...state });
    }

    return NextResponse.json({ mutated: mutate, state });
  } catch (error) {
    logger.error('Η προμήθεια του δημόσιου ραφιού απέτυχε', { error: getErrorMessage(error) });
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

/** **Παρατήρηση** — τι ισχύει τώρα, χωρίς καμία αλλαγή. */
export const GET = withSensitiveRateLimit(
  withAuth(
    async (_request: NextRequest, _ctx: AuthContext, _cache: PermissionCache) => handle(false),
    { requiredGlobalRoles: BYPASS_ROLES },
  ),
);

/** **Πράξη** — δημιουργεί τον κάδο αν λείπει και χορηγεί `allUsers:objectViewer`. */
export const POST = withSensitiveRateLimit(
  withAuth(
    async (_request: NextRequest, _ctx: AuthContext, _cache: PermissionCache) => handle(true),
    { requiredGlobalRoles: BYPASS_ROLES },
  ),
);
