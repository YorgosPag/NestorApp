import 'server-only';

/**
 * @fileoverview **Η ΠΟΡΤΑ ΤΗΣ ΕΠΑΓΓΕΛΜΑΤΙΚΗΣ ΑΠΟΔΕΙΞΗΣ** — η μόνη γραφή του
 * `users/{uid}.occupationVerification`.
 * @related ADR-841 Α9 · ADR-798 §7 · services/account/professional-registration.service.ts
 * @module app/api/account/professional-registration/route
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ ΔΙΑΔΡΟΜΗ ΓΙΑ ΠΕΔΙΟ ΠΟΥ ΔΗΛΩΝΕΙ Ο ΙΔΙΟΣ Ο ΑΝΘΡΩΠΟΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `occupationVerification` μπήκε στο `serverOwnedUserFields()` **πριν
 * υπάρξει**, με ρητή προειδοποίηση ότι *«αν η Φάση 5 διαλέξει άλλο όνομα, ο
 * φρουρός θα είναι πράσινος και **ανενεργός**»*. Ο λόγος: αν ο πελάτης μπορεί να
 * γράψει `{state:'verified'}`, τότε *«επαληθευμένο»* σημαίνει *«το είπα μόνος
 * μου»* — και η διάκριση **δηλωμένο ≠ επαληθευμένο** πεθαίνει τη στιγμή που
 * γεννιέται.
 *
 * ⚠️ Ο περιορισμός είναι στον **δρόμο**, όχι στο **πρόσωπο**: γράφει πάντα ο
 * ίδιος ο άνθρωπος, απλώς περνά από εκεί όπου η **κατάσταση** αποφασίζεται από
 * τον διακομιστή και **ποτέ** από το σώμα.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 `withPersonalOrOrgAuth`, ΚΑΙ ΟΧΙ `withAuth` — ΤΟ ΙΔΙΟ ΛΑΘΟΣ ΜΕ ΤΟ ΑΦΜ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο **υδραυλικός δηλώνει την άδειά του πριν φτιάξει χώρο** — και η πόρτα του
 * `/profile` (Φ6-Β6) υπάρχει ακριβώς γι' αυτόν τον άνθρωπο. Το `withAuth`
 * εγγυάται μισθωτή, άρα θα απαντούσε **401** σε ακριβώς τον πληθυσμό που η
 * διαδρομή εξυπηρετεί: η μετρημένη βλάβη του **ADR-817 §2.2**.
 *
 * 🔑 **Το `uid` έρχεται ΜΟΝΟ από το σύνορο** (`actor.ctx.uid`) και **ποτέ** από το
 * σώμα. Γι' αυτό δεν υπάρχει πεδίο `uid` στο σχήμα: γραφή σε **ξένο** προφίλ δεν
 * απαγορεύεται — **δεν εκφράζεται**.
 *
 * ⛔ **ΚΛΕΙΣΤΟ ΣΥΝΟΛΟ ΚΑΤΑΝΑΛΩΤΩΝ** (ADR-817 §5): δηλωμένη **με λόγο** στο
 * `lib/auth/__tests__/personal-scope-consumers.test.ts`. Η άγκυρα τρέχει `git grep`
 * ⇒ είναι **τυφλή σε αδέσμευτα αρχεία** — **σταδιοποίησε πριν την πιστέψεις**.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΚΑΝΕΝΑ `min(1)` ΣΤΟ ΣΧΗΜΑ, ΚΑΙ ΕΙΝΑΙ ΑΠΟΦΑΣΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το *«γιατί δεν δέχτηκε τη δήλωσή μου;»* το απαντά ο **γραφέας**, με **όνομα**
 * (`registration-number-missing` · `registration-chapter-missing`), που γίνεται
 * κλειδί i18n. Ένα `min(1)` εδώ θα το απαντούσε **πρώτο**, ως `MALFORMED_BODY`,
 * και ο ονομαστικός λόγος θα γινόταν **ανεκτέλεστος**. Το **κενό** είναι
 * **νόμιμο σώμα** — σημαίνει **ανάκληση**.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { readJsonBody } from '@/lib/api/json-body';
import { withPersonalOrOrgAuth, type ApiActor } from '@/lib/auth/personal-scope-middleware';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import {
  setOwnProfessionalRegistration,
  type ProfessionalRegistrationRejection,
} from '@/services/account/professional-registration.service';
import type { ProfessionalAttestation } from '@/types/professional-identity';

/**
 * ⚠️ **Κανένα `state`, κανένα `uid`.** Η **κατάσταση** δεν είναι είσοδος *(θα
 * επέτρεπε αυτο-ανακήρυξη σε `verified`)*, και η **ταυτότητα** δεν είναι είσοδος
 * *(θα επέτρεπε γραφή σε ξένο προφίλ)*.
 */
const registrationSchema = z.object({
  authority: z.string().max(64),
  number: z.string().max(64),
  chapter: z.string().max(128).optional(),
});

export type ProfessionalRegistrationResponse =
  | { readonly attestation: ProfessionalAttestation | null }
  | { readonly error: 'REGISTRATION_REFUSED'; readonly reason: ProfessionalRegistrationRejection }
  | { readonly error: 'WRITE_FAILED' };

async function saveHandler(
  request: NextRequest,
  actor: ApiActor,
): Promise<NextResponse<ProfessionalRegistrationResponse>> {
  const parsed = await readJsonBody(request, registrationSchema);
  if ('rejected' in parsed) return parsed.rejected;

  const result = await setOwnProfessionalRegistration(getAdminFirestore(), actor.ctx.uid, {
    authority: parsed.data.authority,
    number: parsed.data.number,
    chapter: parsed.data.chapter ?? '',
  });

  // ⚠️ Κλειστό σύνολο, **χωρίς `default`**: πέμπτη κατάσταση του γραφέα **δεν
  //    μεταγλωττίζεται** μέχρι κάποιος να πει τι σημαίνει για το δίκτυο.
  switch (result.kind) {
    case 'saved':
      return NextResponse.json({ attestation: result.attestation });
    case 'cleared':
      return NextResponse.json({ attestation: null });
    case 'rejected':
      // **422, ποτέ 400.** Το σώμα ήταν **κατανοητό**· η δήλωση δεν είναι έγκυρη.
      return NextResponse.json(
        { error: 'REGISTRATION_REFUSED', reason: result.reason } as const,
        { status: 422 },
      );
    case 'failed':
      // 🔴 **500, ΠΟΤΕ 422**: *«δεν μπόρεσα να γράψω»* ≠ *«ο αριθμός σου είναι λάθος»*.
      return NextResponse.json({ error: 'WRITE_FAILED' } as const, { status: 500 });
  }
}

export const PATCH = withStandardRateLimit(
  withPersonalOrOrgAuth<ProfessionalRegistrationResponse>(saveHandler),
);
