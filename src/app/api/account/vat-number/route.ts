import 'server-only';

/**
 * @fileoverview **Η ΠΟΡΤΑ ΤΟΥ ΑΦΜ** — η μόνη γραφή του `users/{uid}.vatNumber`.
 * @related ADR-827 §9.20 · services/account/tax-identity.service.ts · firestore.rules
 * @module app/api/account/vat-number/route
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ ΔΙΑΔΡΟΜΗ ΓΙΑ ΕΝΑ ΠΕΔΙΟ ΠΟΥ Ο ΑΝΘΡΩΠΟΣ ΔΗΛΩΝΕΙ ΜΟΝΟΣ ΤΟΥ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `vatNumber` μπήκε στο `serverOwnedUserFields()` **επίτηδες**: ο mod-11 ελεγκτής
 * δεν εκφράζεται σε κανόνα Firestore, οπότε ελεύθερη πελατική γραφή θα σήμαινε
 * *«κάθε εννιάδα ψηφίων είναι ΑΦΜ»* — δηλαδή **σύμβαση με άκυρο στοιχείο**.
 *
 * ⚠️ Ο περιορισμός είναι στον **δρόμο**, όχι στο **πρόσωπο**: γράφει πάντα ο ίδιος ο
 * άνθρωπος, απλώς περνά από εκεί που ο επικυρωτής **εκτελείται**.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 `withPersonalOrOrgAuth`, ΚΑΙ ΟΧΙ `withAuth` — ΤΟ ΙΔΙΟ ΛΑΘΟΣ ΜΕ ΤΟ Σ1
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το ΑΦΜ το δηλώνει ο **ιδιώτης** που πάει να αναθέσει εντολή — άνθρωπος **χωρίς
 * οργανισμό**. Το `withAuth` εγγυάται μισθωτή, άρα θα απαντούσε **401** σε ακριβώς
 * τον πληθυσμό που η διαδρομή εξυπηρετεί: η μετρημένη βλάβη του **ADR-817 §2.2**.
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
 * 🔴 ΚΑΝΕΝΑ `min(9)` ΣΤΟ ΣΧΗΜΑ, ΚΑΙ ΕΙΝΑΙ ΑΠΟΦΑΣΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το *«γιατί δεν δέχτηκε τον αριθμό μου;»* το απαντά ο **γραφέας**, με **όνομα**
 * (`vat-format-invalid` · `vat-check-digit-invalid`), που γίνεται κλειδί i18n. Ένα
 * `min(9)` εδώ θα το απαντούσε **πρώτο**, ως `MALFORMED_BODY`, και ο άνθρωπος θα
 * έβλεπε *«κακό σώμα»* αντί για *«ελέγξτε τα ψηφία»* — ενώ ο ονομαστικός λόγος θα
 * γινόταν **ανεκτέλεστος** (κάλυψη σε νεκρό κλάδο). Το `max` **μένει**: είναι
 * **μορφή**, φρουρός πόρου.
 *
 * ⚠️ Το **κενό** είναι **νόμιμο σώμα** — σημαίνει **ανάκληση** (§9.20: δικαίωμα του
 * ανθρώπου, GDPR 5§1ε). Ένα `min(1)` θα το έκανε αδύνατο.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { readJsonBody } from '@/lib/api/json-body';
import {
  withPersonalOrOrgAuth,
  type ApiActor,
} from '@/lib/auth/personal-scope-middleware';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import {
  setOwnVatNumber,
  type TaxIdentityRejection,
} from '@/services/account/tax-identity.service';

/** ⚠️ Κανένα `uid`: η ταυτότητα **δεν είναι είσοδος** αυτής της διαδρομής. */
const vatSchema = z.object({
  vatNumber: z.string().max(32),
});

export type VatNumberResponse =
  | { readonly vatNumber: string | null }
  | { readonly error: 'VAT_REFUSED'; readonly reason: TaxIdentityRejection }
  | { readonly error: 'WRITE_FAILED' };

async function saveHandler(
  request: NextRequest,
  actor: ApiActor,
): Promise<NextResponse<VatNumberResponse>> {
  const parsed = await readJsonBody(request, vatSchema);
  if ('rejected' in parsed) return parsed.rejected;

  const result = await setOwnVatNumber(
    getAdminFirestore(),
    actor.ctx.uid,
    parsed.data.vatNumber,
  );

  // ⚠️ Κλειστό σύνολο, **χωρίς `default`**: πέμπτη κατάσταση του γραφέα **δεν
  //    μεταγλωττίζεται** μέχρι κάποιος να πει τι σημαίνει για το δίκτυο.
  switch (result.kind) {
    case 'saved':
      return NextResponse.json({ vatNumber: result.vatNumber });
    case 'cleared':
      return NextResponse.json({ vatNumber: null });
    case 'rejected':
      // **422, ποτέ 400.** Το σώμα ήταν **κατανοητό**· ο αριθμός δεν είναι έγκυρος.
      return NextResponse.json(
        { error: 'VAT_REFUSED', reason: result.reason } as const,
        { status: 422 },
      );
    case 'failed':
      // 🔴 **500, ΠΟΤΕ 422**: *«δεν μπόρεσα να γράψω»* ≠ *«το ΑΦΜ σου είναι λάθος»*.
      //    Ο άνθρωπος που θα διάβαζε το δεύτερο θα άλλαζε έναν **σωστό** αριθμό.
      return NextResponse.json({ error: 'WRITE_FAILED' } as const, { status: 500 });
  }
}

export const PATCH = withStandardRateLimit(
  withPersonalOrOrgAuth<VatNumberResponse>(saveHandler),
);
