import 'server-only';

/**
 * @fileoverview **«ΠΟΙΟΙ ΜΕ ΠΛΗΣΙΑΣΑΝ»** — η όψη του προσφέροντος (ADR-843 ΠΕ1).
 * @related services/contact/first-contact-projection.ts · types/first-contact.ts
 * @module app/api/first-contacts/inbox/route
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 `withPersonalOrOrgAuth` ΚΑΙ ΕΔΩ — ΚΑΙ ΕΙΝΑΙ Η ΔΙΑΦΟΡΑ ΑΠΟ ΤΟ `mandate-requests`
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο γειτονικός κατάλογος εντολών φυλάγεται με `withAuth` + `gateBrokerage`, γιατί
 * εκεί ο παραλήπτης είναι **πάντα γραφείο**. Εδώ **δεν είναι**: ο προσφέρων μπορεί να
 * είναι ο **ιδιώτης** που ανέβασε το σπίτι του — και ένα `gateBrokerage` θα του
 * απαντούσε ότι δεν έχει μεσιτική ικανότητα για να διαβάσει **τα δικά του** μηνύματα.
 *
 * ⚠️ **Η εμβέλεια βγαίνει από την ΑΠΟΔΕΙΞΗ, ποτέ από παράμετρο**: οι αγγελίες του
 * καλούντος *(προσωπικές **και** εταιρικές, όσες διαχειρίζεται)* και ο χώρος του.
 * Δεν υπάρχει `?listingId=` και δεν υπάρχει `?companyId=` — άρα η κατάχρηση δεν
 * απαγορεύεται, είναι **ανέκφραστη**.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ `GET` ΓΡΑΦΕΙ — ΚΑΙ ΠΑΡΑΜΕΝΕΙ ΙΔΕΜΠΟΤΕΝΤ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το άνοιγμα σφραγίζει το `seenAt`. Η παρενέργεια είναι **write-once** *(γράφει μόνο
 * όταν το πεδίο είναι `null`)*, άρα η δεύτερη και η εκατοστή κλήση **δεν αλλάζουν
 * τίποτα** — η ιδεμποτησία του ρήματος διατηρείται με την αυστηρή έννοια του HTTP.
 *
 * 🔑 **ΚΑΙ ΓΙΑΤΙ ΕΔΩ, ΕΝΩ ΤΟ ΓΕΙΤΟΝΙΚΟ ΤΟ ΑΠΑΓΟΡΕΥΕΙ ΡΗΤΑ ΣΤΗ ΛΙΣΤΑ**: εκεί υπάρχει
 * οθόνη λεπτομέρειας, και *«η σφραγίδα ζει εκεί που όντως αποδίδεται σελίδα»*. **Εδώ
 * δεν υπάρχει οθόνη λεπτομέρειας** — ο φρουρός **Κ7 #1** επιβάλλει τα στοιχεία του
 * ζητούντος να φαίνονται **ΔΙΠΛΑ, πάντα, χωρίς κλικ**. Άρα το άνοιγμα της λίστας
 * **είναι** η στιγμή που ο προσφέρων είδε το τηλέφωνο. Σφραγίδα αλλού θα ήταν ψέμα
 * προς τον ζητούντα, τη στιγμή που ρωτά *«το είδε;»* (Κ10).
 *
 * ⛔ **ΤΟ ΣΥΝΟΛΟ ΚΑΤΑΝΑΛΩΤΩΝ ΕΙΝΑΙ ΚΛΕΙΣΤΟ** (ADR-817 §5) — δηλωμένη **με λόγο** στο
 * `lib/auth/__tests__/personal-scope-consumers.test.ts`.
 */

import { NextResponse, type NextRequest } from 'next/server';

import {
  withPersonalOrOrgAuth,
  type ApiActor,
} from '@/lib/auth/personal-scope-middleware';
import { firstContactRequestContext } from '../first-contact-request-context';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { readOffererInbox } from '@/services/contact/first-contact-projection';
import type { FirstContactInboxEntry } from '@/services/contact/first-contact-vocabulary';

type InboxResponse =
  | { readonly entries: readonly FirstContactInboxEntry[] }
  /** 🔴 **Δεν μάθαμε** — ποτέ ίδιο με «κανείς δεν σε πλησίασε» (N.12). */
  | { readonly error: 'INBOX_UNVERIFIED' };

async function inboxHandler(
  _request: NextRequest,
  actor: ApiActor,
): Promise<NextResponse<InboxResponse>> {
  const { db, seeker, at } = firstContactRequestContext(actor);
  const load = await readOffererInbox(db, seeker, at);

  // 🔴 **503, ΠΟΤΕ 200 ΜΕ ΑΔΕΙΑ ΛΙΣΤΑ.** Ένα «κανείς» σε βλάβη λέει στον ιδιοκτήτη ότι
  //    **κανείς δεν τον ζήτησε** — ακριβώς το αντίθετο του λόγου που υπάρχει η κάρτα.
  if (load.kind === 'unavailable') {
    return NextResponse.json({ error: 'INBOX_UNVERIFIED' } as const, { status: 503 });
  }

  return NextResponse.json({ entries: load.entries });
}

export const GET = withStandardRateLimit(
  withPersonalOrOrgAuth<InboxResponse>(inboxHandler),
);
