import 'server-only';

/**
 * @fileoverview **ΠΟΡΤΑ Β — Ο ΕΞΑΨΗΦΙΟΣ ΚΩΔΙΚΟΣ** (ADR-844).
 * @related services/contact/first-contact-guest.service.ts
 * @module app/api/first-contacts/guest/confirm/route
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ ΥΠΑΡΧΕΙ ΞΕΧΩΡΙΣΤΗ ΑΠΟ ΤΗ ΣΕΛΙΔΑ ΤΟΥ ΣΥΝΔΕΣΜΟΥ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο σύνδεσμος **φεύγει από τη σελίδα**: ο άνθρωπος τον πατά στο email του και
 * προσγειώνεται σε **νέα** διεύθυνση — γι' αυτό η πόρτα Α είναι **σελίδα**
 * (`app/(auth)/contact/[token]`), όχι διαδρομή API.
 *
 * Ο κωδικός κάνει το **αντίθετο**: ο άνθρωπος **μένει** στην καρτέλα της αγγελίας και
 * ο διάλογος ρωτά από κάτω. Άρα χρειάζεται **διαδρομή**, όχι πλοήγηση — αλλιώς θα τον
 * ξερίζωνε από τη σελίδα που ήρθε να διαβάσει, ακυρώνοντας ακριβώς το πλεονέκτημα
 * του κωδικού.
 *
 * ⛔ **Δύο είσοδοι, ΜΙΑ κλειδαριά**: και οι δύο καταλήγουν στο
 * `first-contact-guest.service`, που καλεί τον **ΕΝΑΝ** γραφέα. Καμία απόφαση εδώ.
 *
 * ⚠️ `withHeavyRateLimit` (10/λεπτό) — **αντι-ωμή-βία**, ίδιο μοτίβο με το
 * `attendance/qr/validate`. ⚠️ **Δεν είναι ο κύριος φρουρός**: εκείνος είναι οι
 * **πέντε δοκιμές ανά πρόσκληση**, που ζουν στο έγγραφο και **δεν παρακάμπτονται με
 * αλλαγή IP**.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { readJsonBody } from '@/lib/api/json-body';
import { nowISO } from '@/lib/date-local';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withHeavyRateLimit } from '@/lib/middleware/with-rate-limit';
import { redeemGuestContactByCode } from '@/services/contact/first-contact-guest.service';
import type { GuestContactOutcome } from '@/services/contact/first-contact-guest.service';
import type { FirstContactRejection } from '@/services/contact/first-contact-vocabulary';
import type { FirstContactForSeeker, FirstContactInvariant } from '@/types/first-contact';
import type { FirstContactInvitationRefusal } from '@/types/first-contact-invitation';
import { guestConfirmBodySchema } from '../guest-contact-body';

type GuestConfirmResponse =
  | {
      readonly contact: FirstContactForSeeker;
      readonly created: boolean;
      /** Για `signInWithCustomToken`. **Άνεση, όχι προϋπόθεση** — η πράξη έχει ήδη γραφτεί. */
      readonly customToken: string;
    }
  | { readonly error: 'LINK_REFUSED'; readonly reason: FirstContactInvitationRefusal }
  | { readonly error: 'CONTACT_REFUSED'; readonly reason: FirstContactRejection }
  | { readonly error: 'INVALID_CONTACT'; readonly violations: readonly FirstContactInvariant[] }
  | { readonly error: 'IDENTITY_REFUSED' }
  | { readonly error: 'WRITE_FAILED' };

async function confirmHandler(request: NextRequest): Promise<NextResponse<GuestConfirmResponse>> {
  const parsed = await readJsonBody(request, guestConfirmBodySchema);
  if ('rejected' in parsed) return parsed.rejected;

  const outcome = await redeemGuestContactByCode(
    getAdminFirestore(), parsed.data.invitationId, parsed.data.code, nowISO(),
  );

  return respond(outcome);
}

/**
 * **Έκβαση → HTTP**, κάθε λόγος ρητά και **χωρίς `default`**.
 *
 * ⚠️ Κλειστό σύνολο: **έβδομη** έκβαση **δεν μεταγλωττίζεται** μέχρι κάποιος να πει
 * τι σημαίνει για το δίκτυο. Ίδιο ιδίωμα με την αδελφή πόρτα.
 */
export function respond(outcome: GuestContactOutcome): NextResponse<GuestConfirmResponse> {
  switch (outcome.kind) {
    case 'contacted':
      return NextResponse.json({
        contact: outcome.contact,
        created: outcome.created,
        customToken: outcome.customToken,
      }, { status: outcome.created ? 201 : 200 });

    case 'link-refused':
      // ⚠️ **422, ΠΟΤΕ 404 ή 403.** Το αίτημα ήταν κατανοητό· ο **κόσμος** δεν το
      //    επιτρέπει. Και ο ονομαστικός λόγος ταξιδεύει: «έληξε», «ήδη
      //    χρησιμοποιήθηκε» και «λάθος κωδικός» είναι **τρία διαφορετικά** επόμενα
      //    βήματα για τον άνθρωπο.
      return NextResponse.json(
        { error: 'LINK_REFUSED', reason: outcome.reason } as const, { status: 422 },
      );

    case 'contact-refused':
      return NextResponse.json(
        { error: 'CONTACT_REFUSED', reason: outcome.reason } as const, { status: 422 },
      );

    case 'invalid':
      return NextResponse.json(
        { error: 'INVALID_CONTACT', violations: outcome.violations } as const, { status: 422 },
      );

    case 'identity-refused':
      // 🔴 **403, και ΧΩΡΙΣ τον λόγο.** Οι λόγοι εδώ *(απενεργοποιημένος λογαριασμός,
      //    μυστικό που λείπει)* μιλούν για **εμάς**, όχι για την πράξη του ανθρώπου.
      //    Ένα «ο λογαριασμός σας είναι απενεργοποιημένος» σε **δημόσια** διαδρομή
      //    επιβεβαιώνει σε τρίτον ότι η διεύθυνση **υπάρχει** και ότι κάποιος την
      //    έκλεισε — απαρίθμηση λογαριασμών, δωρεάν.
      return NextResponse.json({ error: 'IDENTITY_REFUSED' } as const, { status: 403 });

    case 'unavailable':
      // 🔴 **503, ΠΟΤΕ 422**: *«δεν μάθαμε»* ≠ *«δεν επιτρέπεσαι»* (N.12).
      return NextResponse.json({ error: 'WRITE_FAILED' } as const, { status: 503 });
  }
}

export const POST = withHeavyRateLimit(confirmHandler);
