import 'server-only';

/**
 * @fileoverview **Η ΠΟΡΤΑ ΤΟΥ Σ1 — «ΑΝΑΛΑΒΕ ΤΗΝ ΑΓΓΕΛΙΑ ΜΟΥ»** (ADR-827 §9.17).
 * @related services/mandate/mandate-request.service.ts · lib/auth/personal-scope-middleware.ts
 * @module app/api/mandate-requests/route
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 `withPersonalOrOrgAuth`, ΚΑΙ ΟΧΙ `withAuth` — ΟΥΤΕ `gateBrokerage`
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Αυτό το κουμπί το πατά **ιδιώτης**, που **δεν έχει οργανισμό**. Οι δύο προφανείς
 * φρουροί είναι και οι δύο **λάθος ερώτηση**:
 *
 * | Υποψήφιος | Τι ρωτά | Γιατί όχι εδώ |
 * |---|---|---|
 * | `gateBrokerage` | *«έχει **αυτός ο οργανισμός** ενεργή μεσιτική ικανότητα;»* | Φρουρός της **πλευράς του γραφείου**. Ο καλών εδώ δεν είναι γραφείο |
 * | `withAuth` | εγγυάται **μισθωτή** | Θα απαντούσε **401** σε ακριβώς τον πληθυσμό που η διαδρομή εξυπηρετεί — η μετρημένη βλάβη του **ADR-817 §2.2** |
 *
 * ⛔ **ΤΟ ΣΥΝΟΛΟ ΚΑΤΑΝΑΛΩΤΩΝ ΕΙΝΑΙ ΚΛΕΙΣΤΟ** (ADR-817 §5): αυτή η διαδρομή είναι
 * δηλωμένη **με λόγο** στο `lib/auth/__tests__/personal-scope-consumers.test.ts`.
 * ⚠️ Η άγκυρα τρέχει **`git grep`** ⇒ είναι **τυφλή σε αδέσμευτα αρχεία`.
 * **Σταδιοποίησε πριν την πιστέψεις.**
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΔΕΝ ΥΠΑΡΧΕΙ `GET` — ΚΑΙ ΔΕΝ ΠΡΕΠΕΙ ΝΑ ΥΠΑΡΞΕΙ ΕΔΩ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `mandate_requests` είναι **`read: false` ΚΑΙ `write: false`** — το αυστηρότερο
 * ζεύγος του έργου. Η **ανάγνωση** δεν λείπει από αμέλεια: ό,τι βλέπει ο καθένας
 * είναι **προβολή** (`MandateRequestForAgency` για το γραφείο, `disclosedTo` για τον
 * ιδιώτη), και **ποια** προβολή εξαρτάται από **ποιος ρωτά**. Ένα γενικό `GET` εδώ θα
 * ήταν μία απάντηση για δύο ακροατήρια — δηλαδή θα διάλεγε **το ένα**, σιωπηλά.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΚΑΝΕΝΑ `min(1)` ΣΤΟ ΣΧΗΜΑ, ΚΑΙ ΕΙΝΑΙ ΑΠΟΦΑΣΗ (§5.16)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το *«ποια αγγελία;»* το απαντά ο **γραφέας**, με **όνομα** (`listing-absent`), που
 * γίνεται κλειδί i18n. Ένα `min(1)` εδώ θα το απαντούσε **πρώτο**, ως `MALFORMED_BODY`,
 * και θα έκανε τους ονομαστικούς λόγους **ανεκτέλεστους**: κάλυψη σε **νεκρό** κλάδο
 * δεν είναι κάλυψη, και ο άνθρωπος θα έβλεπε *«κακό σώμα»* αντί για *«αυτή η αγγελία
 * δεν είναι δική σου»*. Τα `max` **μένουν**: είναι **μορφή**, φρουρός πόρου.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { readJsonBody } from '@/lib/api/json-body';
// ⛔ ΤΟ ΡΟΛΟΪ ΕΧΕΙ ΜΙΑ ΠΗΓΗ (`.ssot-registry.json` → module `date-local`, CHECK 3.7):
// ωμό `new Date().toISOString()` εδώ θα ήταν η Ν-οστή γραφή του ίδιου στιγμιότυπου —
// και σε αυτή τη διαδρομή η στιγμή **κρίνεται** (λήξη εντολής, AK 243), δεν τυπώνεται.
import { nowISO } from '@/lib/date-local';
import {
  withPersonalOrOrgAuth,
  actorWorkspace,
  type ApiActor,
} from '@/lib/auth/personal-scope-middleware';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import {
  submitMandateRequest,
  type MandateRequestRejection,
} from '@/services/mandate/mandate-request.service';
import { LISTING_AGREEMENTS } from '@/types/listing-agreement';
import type { MandateRequest, MandateRequestInvariant } from '@/types/mandate-request';

/**
 * **Οι όροι, όπως τους προτείνει ο ΙΔΙΩΤΗΣ** (Δ5).
 *
 * ⚠️ **Διακριτή ένωση για την αμοιβή, ποτέ πεδία με `null`** — ίδιο σχήμα με τον τύπο
 * {@link MandateCompensation}. Ένα «ποσοστό χωρίς ποσοστό» πρέπει να είναι **αδύνατο
 * να εκφραστεί**, όχι να απορρίπτεται από έλεγχο που κάποιος θα ξεχάσει.
 *
 * ⚠️ **Το `expiresAt` ΔΕΝ ελέγχεται εδώ ως προς τον νόμο.** Ο κριτής είναι το
 * `exceedsStatutoryTerm`, μέσω των αμετάβλητων του αιτήματος — ο **ίδιος** που κρίνει
 * τη φόρμα. Δεύτερο όριο γραμμένο εδώ θα ήταν ο **τρίτος** αριθμός για το ίδιο ερώτημα.
 */
const termsSchema = z.object({
  agreement: z.enum(LISTING_AGREEMENTS),
  expiresAt: z.string().max(64),
  compensation: z.discriminatedUnion('type', [
    z.object({
      type: z.literal('percentage'),
      percentage: z.number().nonnegative().max(100),
      vatIncluded: z.boolean(),
    }),
    z.object({
      type: z.literal('fixed'),
      amountEUR: z.number().nonnegative(),
      vatIncluded: z.boolean(),
    }),
  ]),
});

const requestSchema = z.object({
  ownerPropertyId: z.string().max(128),
  agencyCompanyId: z.string().max(128),
  terms: termsSchema,
});

type MandateRequestResponse =
  /** 🔑 Και το `unchanged` επιστρέφει το αίτημα: η ιδεμποτησία είναι **επιτυχία**. */
  | { readonly request: MandateRequest; readonly created: boolean }
  | { readonly error: 'REQUEST_REFUSED'; readonly reason: MandateRequestRejection }
  | { readonly error: 'INVALID_REQUEST'; readonly violations: readonly MandateRequestInvariant[] }
  /** 🔴 **Δεν μάθαμε** — ποτέ ίδιο με άρνηση (N.12). */
  | { readonly error: 'REQUEST_UNVERIFIED' }
  | { readonly error: 'WRITE_FAILED' };

async function submitHandler(
  request: NextRequest,
  actor: ApiActor,
): Promise<NextResponse<MandateRequestResponse>> {
  const parsed = await readJsonBody(request, requestSchema);
  if ('rejected' in parsed) return parsed.rejected;

  const result = await submitMandateRequest(
    getAdminFirestore(),
    // 🔑 **Η ΜΟΝΗ νόμιμη μετάφραση προς `ListingActor`** ζει στο `actorWorkspace`
    //    (ADR-817). ⛔ **ΜΗΝ γράψεις `?? ''`**: κενή εταιρεία δεν ταιριάζει με τίποτα
    //    — ούτε με κενή — και είναι ακριβώς ό,τι κυνηγά η CHECK 3.35.
    { uid: actor.ctx.uid, companyId: actorWorkspace(actor) },
    parsed.data,
    // ⚠️ Το ρολόι διαβάζεται **εδώ, στο σύνορο**, και περνά ως τιμή. Κάθε συνάρτηση
    //    πιο μέσα είναι καθαρή — γι' αυτό τα άκρα του νόμου είναι δοκιμάσιμα.
    nowISO(),
  );

  // ⚠️ Κλειστό σύνολο, **χωρίς `default`**: έβδομη κατάσταση του γραφέα **δεν
  //    μεταγλωττίζεται** μέχρι κάποιος να πει τι σημαίνει για το δίκτυο.
  switch (result.kind) {
    case 'created':
      return NextResponse.json({ request: result.request, created: true }, { status: 201 });
    case 'unchanged':
      // 🔑 **200, όχι 201 και όχι 409.** Δεν δημιουργήθηκε τίποτα, αλλά τίποτα δεν
      //    πήγε στραβά: ο άνθρωπος έχει το αίτημά του. Ίδια σημασιολογία με την
      //    επανάληψη κλειδιού ιδεμποτησίας στο Stripe.
      return NextResponse.json({ request: result.request, created: false });
    case 'rejected':
      return NextResponse.json(
        { error: 'REQUEST_REFUSED', reason: result.reason } as const,
        // ⚠️ **422, ποτέ 404 και ποτέ 403.** Το αίτημα ήταν **κατανοητό**· η πράξη
        //    δεν επιτρέπεται. Ένα 403 σε `listing-absent` θα **επιβεβαίωνε** την
        //    ύπαρξη ξένου εγγράφου — η ακριβής διαρροή που ο γραφέας κλείνει.
        { status: 422 },
      );
    case 'invalid':
      return NextResponse.json(
        { error: 'INVALID_REQUEST', violations: result.violations } as const,
        { status: 422 },
      );
    case 'unavailable':
      // 🔴 **503, ΠΟΤΕ 422.** *«Δεν μάθαμε»* ≠ *«δεν υπάρχει»*: ένα 422 εδώ θα έλεγε
      //    στον ιδιοκτήτη ότι **η αγγελία του δεν υπάρχει**, ή ότι το γραφείο που
      //    κρατά στο χέρι του **δεν δημοσιεύεται**. Το 503 λέει *«ξαναδοκίμασε, μην
      //    αλλάξεις τίποτα»*, όπως ήδη κάνουν το `/api/places/resolve` και το
      //    `ALIAS_UNVERIFIED` της γειτονικής πόρτας.
      return NextResponse.json({ error: 'REQUEST_UNVERIFIED' } as const, { status: 503 });
    case 'failed':
      return NextResponse.json({ error: 'WRITE_FAILED' } as const, { status: 500 });
  }
}

export const POST = withStandardRateLimit(
  withPersonalOrOrgAuth<MandateRequestResponse>(submitHandler),
);
