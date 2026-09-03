import 'server-only';

/**
 * @fileoverview **«ΠΟΙΟΥΣ ΠΛΗΣΙΑΣΑ, ΚΑΙ ΤΙ ΜΟΥ ΜΕΝΕΙ»** — η όψη του ζητούντος.
 * @related services/contact/first-contact-projection.ts · lib/contact/first-contact-capacity.ts
 * @module app/api/first-contacts/mine/route
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 Η ΧΩΡΗΤΙΚΟΤΗΤΑ ΤΑΞΙΔΕΥΕΙ ΜΑΖΙ ΜΕ ΤΙΣ ΠΡΑΞΕΙΣ, ΟΧΙ ΣΕ ΔΕΥΤΕΡΗ ΔΙΕΥΘΥΝΣΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το *«απομένουν 3»* και η λίστα που το παράγει είναι **η ίδια ανάγνωση**. Δύο
 * διευθύνσεις θα σήμαιναν δύο στιγμές, και η οθόνη θα μπορούσε να δείξει δέκα ανοιχτές
 * δίπλα σε «απομένουν 2» — τον αριθμό που ο άνθρωπος **μπορεί να μετρήσει μόνος του**.
 *
 * ⛔ **ΚΑΙ Η ΟΘΟΝΗ ΠΟΥ ΤΟ ΔΕΙΧΝΕΙ ΔΕΝ ΠΟΥΛΑΕΙ ΤΙΠΟΤΑ** (Κ9, απόλυτο). Όταν γεμίσει,
 * λέει *«κλείσε κάποια από τις ανοιχτές»* — **ποτέ** *«αναβάθμισε»*. Το όριο είναι
 * **σταθερά module**, ίδια για όλους: δεν υπάρχει πεδίο σε χρήστη ή πακέτο να
 * αλλάξει, άρα *δεν υπάρχει τίποτα να πουληθεί*.
 *
 * ⚠️ **ΚΑΜΙΑ παράμετρος από το δίκτυο δεν αγγίζει την εμβέλεια**: δεν υπάρχει
 * `?userId=` και δεν υπάρχει φίλτρο κατάστασης. Η εμβέλεια είναι το `ctx.uid` και
 * **μόνο** — και οι αποσυρμένες επιστρέφονται **μαζί**, γιατί ο μετρητής και η λίστα
 * οφείλουν να βγαίνουν από το **ίδιο** σύνολο.
 *
 * ⛔ **ΤΟ ΣΥΝΟΛΟ ΚΑΤΑΝΑΛΩΤΩΝ ΕΙΝΑΙ ΚΛΕΙΣΤΟ** (ADR-817 §5) — δηλωμένη **με λόγο** στο
 * `lib/auth/__tests__/personal-scope-consumers.test.ts`.
 */

import { NextResponse, type NextRequest } from 'next/server';

import {
  withPersonalOrOrgAuth,
  type ApiActor,
} from '@/lib/auth/personal-scope-middleware';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import {
  readSeekerContacts,
  type SeekerContactView,
} from '@/services/contact/first-contact-projection';

type MyContactsResponse =
  | SeekerContactView
  /** 🔴 **Δεν μάθαμε** — ποτέ ίδιο με «καμία επαφή» (N.12). */
  | { readonly error: 'CONTACTS_UNVERIFIED' };

async function myContactsHandler(
  _request: NextRequest,
  actor: ApiActor,
): Promise<NextResponse<MyContactsResponse>> {
  const load = await readSeekerContacts(getAdminFirestore(), actor.ctx.uid);

  // 🔴 **503, ΠΟΤΕ 200 ΜΕ ΑΔΕΙΑ ΛΙΣΤΑ.** Ένα «καμία επαφή» σε βλάβη λέει στον άνθρωπο
  //    ότι **δεν πλησίασε ποτέ κανέναν** — και μαζί ότι έχει **δέκα ελεύθερες θέσεις**.
  //    Θα το πίστευε, και θα ξόδευε θέσεις που ήδη είναι πιασμένες.
  if (load.kind === 'unavailable') {
    return NextResponse.json({ error: 'CONTACTS_UNVERIFIED' } as const, { status: 503 });
  }

  return NextResponse.json(load.view);
}

export const GET = withStandardRateLimit(
  withPersonalOrOrgAuth<MyContactsResponse>(myContactsHandler),
);
