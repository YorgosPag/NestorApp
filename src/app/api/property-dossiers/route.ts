/**
 * @fileoverview **Η ΠΟΡΤΑ ΓΕΝΝΗΣΗΣ ΦΑΚΕΛΟΥ** — ο ιδιώτης ανοίγει φάκελο για ένα σπίτι του.
 * @related ADR-866 Φ1.1 · §2.8.7 (Δ1 · Δ3 · Δ4) · services/property-dossier/property-dossier-write.service.ts
 * @module app/api/property-dossiers/route
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΜΟΝΟ `POST` — Η ΑΝΑΓΝΩΣΗ ΔΕΝ ΕΙΝΑΙ ΠΟΡΤΑ (ADR-866 §2.8.7 Δ3)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο κανόνας Firestore δίνει `read` **μόνο** στον κάτοχο, και οι λίστες του ανθρώπου διαβάζονται
 * **ζωντανά** από τον πελάτη μέσω της **μίας** μηχανής `useOwnedDocuments` — όπως η αγγελία και η
 * ζήτηση, όπως στο Drive και στο Figma. Ένα `GET` εδώ θα ήταν δεύτερη διαδρομή ανάγνωσης για την ίδια
 * ερώτηση, χωρίς ζωντανή ενημέρωση. Η γραφή όμως **είναι** πόρτα: ο κανόνας λέει `create: false`.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΚΑΝΕΝΑ `permission` — ΚΑΙ Ο ΚΑΤΟΧΟΣ ΔΕΝ ΕΡΧΕΤΑΙ ΑΠΟ ΤΟ ΣΩΜΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ίδιο σκεπτικό με το `api/owner-properties/route.ts` (ADR-817): τα δικαιώματα του έργου είναι
 * **εμβέλειας εταιρείας**, και ο ιδιώτης **δεν έχει εταιρεία** — ένα permission εδώ θα έκλεινε την
 * πόρτα ακριβώς για όσους υπάρχει. Η εξουσιοδότηση είναι η **ταυτότητα**: `withPersonalOrOrgAuth` +
 * κάτοχος = `actor.ctx.uid`, **πάντα** — και για τον υπάλληλο γραφείου που ανοίγει φάκελο για το **δικό
 * του** σπίτι (ο προσωπικός χώρος δεν διευρύνεται ποτέ, ούτε προς τα πάνω).
 *
 * | Έκβαση | Κωδικός | Γιατί |
 * |---|---|---|
 * | νέος φάκελος | **201** | γεννήθηκε πόρος |
 * | επανάληψη ίδιας γέννησης (ίδιος κάτοχος) | **200** | ιδεμπότητο — ο **υπάρχων** φάκελος, ποτέ δεύτερος |
 * | σώμα που δεν είναι σχήμα | **400** `MALFORMED_BODY` + πεδία | `readJsonBody` |
 * | άκυρο προσχέδιο | **422** `INVALID_DOSSIER` + κωδικοί | κατανοητό αίτημα, άκυρη οντότητα· κωδικοί = κλειδιά i18n στην οθόνη (N.11) |
 * | ταυτότητα ξένου φακέλου | **404** | ποτέ 403/409: θα **επιβεβαίωνε** ότι υπάρχει |
 * | αστοχία βάσης | **500** | ο άνθρωπος δεν έχει τι να διορθώσει |
 */

import type { NextRequest, NextResponse } from 'next/server';

import { readJsonBody } from '@/lib/api/json-body';
import { withPersonalOrOrgAuth, type ApiActor } from '@/lib/auth/personal-scope-middleware';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import {
  propertyDossierBirthRequestSchema,
  propertyDossierDraftOf,
} from '@/lib/property-dossier/property-dossier-request-schema';
import { createPropertyDossier } from '@/services/property-dossier/property-dossier-write.service';

import { respondToDossierWrite } from './_shared/respond';

async function handler(request: NextRequest, actor: ApiActor): Promise<NextResponse> {
  const parsed = await readJsonBody(request, propertyDossierBirthRequestSchema);
  if ('rejected' in parsed) return parsed.rejected;

  return respondToDossierWrite(
    await createPropertyDossier(
      getAdminFirestore(),
      // 🔴 Ο κάτοχος = ο αιτών. `userId` στο σώμα το έχει ήδη αφαιρέσει το σχήμα (zod `strip`).
      { id: parsed.data.id, userId: actor.ctx.uid },
      propertyDossierDraftOf(parsed.data),
    ),
    'birth',
  );
}

export const POST = withStandardRateLimit(withPersonalOrOrgAuth(handler));
