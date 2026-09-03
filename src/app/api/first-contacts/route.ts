import 'server-only';

/**
 * @fileoverview **Η ΠΟΡΤΑ ΤΗΣ ΠΡΩΤΗΣ ΕΠΑΦΗΣ — «ΣΕ ΠΛΗΣΙΑΖΩ»** (ADR-843 ΠΕ1).
 * @related services/contact/first-contact.service.ts · lib/auth/personal-scope-middleware.ts
 * @module app/api/first-contacts/route
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 `withPersonalOrOrgAuth`, ΚΑΙ ΟΧΙ `withAuth` — ΟΥΤΕ `gateBrokerage`
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Αυτό το κουμπί το πατά **ο ζητών**, που στη συντριπτική πλειοψηφία είναι **ιδιώτης
 * χωρίς οργανισμό**. Το `withAuth` θα απαντούσε **401** σε ακριβώς τον πληθυσμό που η
 * διαδρομή υπάρχει για να εξυπηρετήσει — η μετρημένη βλάβη του **ADR-817 §2.2**. Το
 * `gateBrokerage` είναι φρουρός της **άλλης** πλευράς: ο καλών εδώ δεν είναι γραφείο.
 *
 * ⛔ **ΤΟ ΣΥΝΟΛΟ ΚΑΤΑΝΑΛΩΤΩΝ ΕΙΝΑΙ ΚΛΕΙΣΤΟ** (ADR-817 §5): η διαδρομή είναι δηλωμένη
 * **με λόγο** στο `lib/auth/__tests__/personal-scope-consumers.test.ts`.
 * ⚠️ Η άγκυρα τρέχει **`git grep`** ⇒ είναι **τυφλή σε αδέσμευτα αρχεία**.
 * **Σταδιοποίησε πριν την πιστέψεις.**
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΔΕΝ ΥΠΑΡΧΕΙ `GET` ΕΔΩ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η πράξη έχει **δύο ακροατήρια με αντίθετα δικαιώματα**: ο ζητών βλέπει τη δική του
 * πράξη **πλήρη**· ο προσφέρων βλέπει **προβολή** που κρύβει τη ζήτηση, τα μεγέθη και
 * κάθε άλλη πράξη του ίδιου ανθρώπου. Ένα γενικό `GET` εδώ θα ήταν **μία** απάντηση
 * για δύο ακροατήρια — δηλαδή θα διάλεγε **το ένα, σιωπηλά**. Δύο διευθύνσεις:
 * `/mine` (ο ζητών) και `/inbox` (ο προσφέρων).
 *
 * ⚠️ **`withStandardRateLimit`, όχι το «ευαίσθητο»** — και ο λόγος είναι ότι **ο
 * πραγματικός φρουρός του Κ5 δεν είναι το rate limit**: είναι η **χωρητικότητα**
 * ({@link OPEN_CONTACT_CAPACITY}), που φράζει στις **δέκα ανοιχτές** ανεξάρτητα από
 * ρυθμό. Ένα σφιχτότερο rate limit θα τιμωρούσε τον σοβαρό άνθρωπο *(«ο σοβαρός δεν
 * πρέπει να συναντήσει ΠΟΤΕ αυτό το μήνυμα»)* χωρίς να προσθέτει τίποτα στον μαζικό.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { readJsonBody } from '@/lib/api/json-body';
import {
  withPersonalOrOrgAuth,
  type ApiActor,
} from '@/lib/auth/personal-scope-middleware';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { openFirstContact } from '@/services/contact/first-contact.service';
import type {
  FirstContactRejection,
  FirstContactWriteResult,
} from '@/services/contact/first-contact-vocabulary';
import type { FirstContactForSeeker, FirstContactInvariant } from '@/types/first-contact';
import { firstContactBodySchema } from './first-contact-body';
import { firstContactRequestContext } from './first-contact-request-context';
import { firstContactWriteFailure } from './first-contact-write-failure';

type FirstContactResponse =
  /** 🔑 Και το `created: false` επιστρέφει την πράξη: η ιδεμποτησία είναι **επιτυχία**. */
  | { readonly contact: FirstContactForSeeker; readonly created: boolean }
  | { readonly error: 'CONTACT_REFUSED'; readonly reason: FirstContactRejection }
  | { readonly error: 'INVALID_CONTACT'; readonly violations: readonly FirstContactInvariant[] }
  /** 🔴 **Δεν μάθαμε** — ποτέ ίδιο με άρνηση (N.12). */
  | { readonly error: 'CONTACT_UNVERIFIED' }
  | { readonly error: 'WRITE_FAILED' };

async function openHandler(
  request: NextRequest,
  actor: ApiActor,
): Promise<NextResponse<FirstContactResponse>> {
  const parsed = await readJsonBody(request, firstContactBodySchema);
  if ('rejected' in parsed) return parsed.rejected;

  // ⚠️ Βάση, δρών και ρολόι έρχονται **μαζί, από ένα σημείο** (ADR-843): το ρολόι
  //    διαβάζεται **στο σύνορο** και περνά ως τιμή, ώστε κάθε συνάρτηση πιο μέσα να
  //    είναι καθαρή — γι' αυτό η φρεσκάδα της ζήτησης είναι δοκιμάσιμη.
  const { db, seeker, at } = firstContactRequestContext(actor);
  const result = await openFirstContact(db, seeker, parsed.data, at);

  return respond(result);
}

/**
 * **Έκβαση → HTTP**, κάθε λόγος ρητά και **χωρίς `default`**.
 *
 * ⚠️ Κλειστό σύνολο: **έβδομη** κατάσταση του γραφέα **δεν μεταγλωττίζεται** μέχρι
 * κάποιος να πει τι σημαίνει για το δίκτυο.
 */
function respond(result: FirstContactWriteResult): NextResponse<FirstContactResponse> {
  switch (result.kind) {
    case 'created':
      return NextResponse.json({ contact: result.contact, created: true }, { status: 201 });
    case 'unchanged':
      // 🔑 **200, όχι 201 και όχι 409.** Δεν γεννήθηκε τίποτα, αλλά τίποτα δεν πήγε
      //    στραβά: ο άνθρωπος έχει την πράξη του — και **δεν** πλήρωσε δεύτερη θέση
      //    χωρητικότητας. Ίδια σημασιολογία με επανάληψη κλειδιού ιδεμποτησίας.
      return NextResponse.json({ contact: result.contact, created: false });
    case 'rejected':
      // ⚠️ **422, ποτέ 404 και ποτέ 403.** Το αίτημα ήταν **κατανοητό**· η πράξη δεν
      //    επιτρέπεται από την κατάσταση του κόσμου. Και ο ονομαστικός λόγος
      //    ταξιδεύει: «γέμισε» και «είναι δική σου» είναι δύο εντελώς διαφορετικά
      //    επόμενα βήματα για τον άνθρωπο.
      return NextResponse.json(
        { error: 'CONTACT_REFUSED', reason: result.reason } as const,
        { status: 422 },
      );
    case 'invalid':
      return NextResponse.json(
        { error: 'INVALID_CONTACT', violations: result.violations } as const,
        { status: 422 },
      );
    case 'unavailable':
    case 'failed':
      // 🔴 **503, ΠΟΤΕ 422** για το `unavailable`: *«Δεν μάθαμε»* ≠ *«δεν υπάρχει»* —
      //    ένα 422 εδώ θα έλεγε στον άνθρωπο ότι η αγγελία που μόλις διάβαζε **δεν
      //    υπάρχει**. Ο γραφέας των δύο απαντήσεων είναι **ένας** (ADR-843).
      return firstContactWriteFailure(result.kind);
  }
}

export const POST = withStandardRateLimit(
  withPersonalOrOrgAuth<FirstContactResponse>(openHandler),
);
