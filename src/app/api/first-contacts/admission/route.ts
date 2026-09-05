import 'server-only';

/**
 * @fileoverview **Η ΗΣΥΧΗ ΕΡΩΤΗΣΗ** — *«αν πατούσα τώρα, θα με δεχόσουν;»* (ADR-843 §10.18).
 * @related services/contact/first-contact-admission.ts *(ο ΕΝΑΣ κριτής — και τον καλεί και ο γραφέας)*
 * @related components/contact/FirstContactAction.tsx *(ο μοναδικός καλών)*
 * @module app/api/first-contacts/admission/route
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΔΙΕΥΘΥΝΣΗ ΚΑΙ ΟΧΙ ΠΕΔΙΟ ΣΤΟ ΔΗΜΟΣΙΟ ΣΧΗΜΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το §10.13 έγραψε ότι η θεραπεία είναι *«πεδίο `viewerCanContact` στην απάντηση της
 * σελίδας»*. **Δεν υπάρχει απάντηση σελίδας**: η δημόσια αγγελία είναι **κοινό έγγραφο**
 * (`public_listings`), το διαβάζει ο **πελάτης**, και είναι ίδιο για **κάθε** επισκέπτη.
 * Ένα *«ο θεατής μπορεί;»* εκεί δεν έχει θεατή να μιλήσει γι' αυτόν.
 *
 * 🏆 **ΚΑΙ ΕΤΣΙ ΤΟ ΚΑΝΟΥΝ ΟΙ ΜΕΓΑΛΟΙ, ΓΙΑ ΤΟΝ ΙΔΙΟ ΛΟΓΟ.** Το πρότυπο λέγεται *late
 * personalization* / *hole-punching*: το κοινό φορτίο μένει **ταυτόσημο και
 * μοιραζόμενο**, και η προσωποποίηση έρχεται με **ξεχωριστό αίτημα του θεατή**. Η
 * διατύπωση της πατέντας edge-caching είναι κυριολεκτικά ο κανόνας αυτού του αρχείου:
 * *«information about the user is not passed in the request for content»*.
 *
 * ⇒ **Το δημόσιο σχήμα δεν αποκτά ούτε ένα πεδίο**, και ο κόσμος δεν μαθαίνει τίποτα:
 * η μόνη απάντηση που δίνεται εδώ αφορά **τον ίδιο τον ρωτώντα**, και μόνο αυτόν.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ `withPersonalOrOrgAuth` — ΚΑΙ ΓΙΑΤΙ Η ΤΑΥΤΟΤΗΤΑ ΕΙΝΑΙ ΠΡΟΫΠΟΘΕΣΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ίδια πόρτα με την ίδια την πράξη *(ο ζητών είναι συνήθως **ιδιώτης χωρίς οργανισμό**
 * — το `withAuth` θα απαντούσε `401` σε ακριβώς το ακροατήριο που εξυπηρετεί)*.
 *
 * ⚠️ **Ο ανώνυμος ΔΕΝ ρωτά ποτέ, και δεν είναι παράλειψη**: χωρίς ταυτότητα **δεν
 * μπορείς να είσαι ο ιδιοκτήτης**, δεν έχεις ανοιχτές πράξεις και δεν έχεις
 * χωρητικότητα να γεμίσει. Η οθόνη το ξέρει και **δεν κάνει το αίτημα** — άρα η
 * συντριπτική πλειοψηφία των επισκεπτών μιας δημόσιας αγγελίας πληρώνει **μηδέν**.
 *
 * ⛔ **ΤΟ ΣΥΝΟΛΟ ΚΑΤΑΝΑΛΩΤΩΝ ΕΙΝΑΙ ΚΛΕΙΣΤΟ** (ADR-817 §5): δηλωμένη **με λόγο** στο
 * `lib/auth/__tests__/personal-scope-consumers.test.ts`. ⚠️ Η άγκυρα τρέχει `git grep`
 * ⇒ είναι **τυφλή σε αδέσμευτα αρχεία**. **Σταδιοποίησε πριν την πιστέψεις.**
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ `GET` ΕΔΩ, ΕΝΩ Η ΡΙΖΑ ΤΟ ΑΡΝΕΙΤΑΙ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η ρίζα (`/api/first-contacts`) αρνείται `GET` επειδή *«η πράξη έχει **δύο
 * ακροατήρια με αντίθετα δικαιώματα**»* — και ένα γενικό `GET` θα διάλεγε το ένα
 * σιωπηλά. Εδώ **δεν υπάρχει δεύτερο ακροατήριο**: η απάντηση αφορά **μόνο τον
 * ρωτώντα**, και είναι ένα από τρία ρήματα. Καμία πράξη δεν επιστρέφεται.
 *
 * ⚠️ **Ο στόχος ταξιδεύει σε παραμέτρους διαδρομής, και το σχήμα είναι ΤΟ ΙΔΙΟ**
 * (`firstContactTargetSchema`). Ένας δεύτερος αναλυτής εδώ θα ήταν **δεύτερος ορισμός
 * του τι είναι στόχος** — και θα απέκλινε την πρώτη φορά που το `POST` μάθαινε τρίτο
 * είδος.
 */

import { NextResponse, type NextRequest } from 'next/server';

import {
  withPersonalOrOrgAuth,
  type ApiActor,
} from '@/lib/auth/personal-scope-middleware';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import {
  admitFirstContact,
  manageHrefOfOwnTarget,
} from '@/services/contact/first-contact-admission';
import type { FirstContactRejection } from '@/services/contact/first-contact-vocabulary';
import { firstContactTargetSchema } from '../first-contact-body';
import { firstContactRequestContext } from '../first-contact-request-context';

/**
 * **Τι μαθαίνει η οθόνη** — τρία ρήματα και **καμία** πράξη.
 *
 * 🔑 **Το `reason` είναι το ΥΠΑΡΧΟΝ κλειστό λεξιλόγιο** ({@link FirstContactRejection}),
 * όχι δεύτερο: κάθε κωδικός έχει **ήδη** κλειδί i18n στο `REJECTION_KEYS` και **ήδη**
 * διέξοδο στο `REJECTION_REMEDY`. Η οθόνη δεν μαθαίνει καινούργια γλώσσα — μαθαίνει
 * **νωρίτερα** αυτά που θα άκουγε ούτως ή άλλως.
 */
type ContactAdmissionResponse =
  /** ✅ Πάτα — το κουμπί μένει όπως είναι. */
  | { readonly verdict: 'open' }
  /** 🔑 **Επιτυχία, όχι σφάλμα**: την έχεις ήδη ανοιχτή προς αυτόν τον στόχο. */
  | { readonly verdict: 'already' }
  | {
      readonly verdict: 'refused';
      readonly reason: FirstContactRejection;
      /**
       * **Πού τη διαχειρίζεσαι** — αποκλειστικά στο `contact-own-target`, `null` παντού
       * αλλού. Δες `manageHrefOfOwnTarget` για το γιατί ο **εταιρικός** χώρος δεν
       * ονομάζεται από δημόσια σελίδα: είναι **ονομασμένη απουσία**, όχι παράλειψη.
       */
      readonly manageHref: string | null;
    }
  /** Ο στόχος στη διεύθυνση δεν είναι στόχος. */
  | { readonly error: 'ADMISSION_MALFORMED' }
  /** 🔴 **Δεν μάθαμε** — ποτέ ίδιο με «δεν επιτρέπεσαι» (N.12). Η οθόνη δείχνει το κουμπί. */
  | { readonly error: 'ADMISSION_UNVERIFIED' };

async function admissionHandler(
  request: NextRequest,
  actor: ApiActor,
): Promise<NextResponse<ContactAdmissionResponse>> {
  // ⚠️ **Ολόκληρο το query, ωμό, στο ΙΔΙΟ σχήμα με το σώμα του `POST`.** Το zod κρατά
  //    μόνο τα δηλωμένα κλειδιά ⇒ ό,τι άλλο κολλήσει στη διεύθυνση **δεν υπάρχει**.
  const parsed = firstContactTargetSchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  );
  if (!parsed.success) {
    return NextResponse.json({ error: 'ADMISSION_MALFORMED' } as const, { status: 400 });
  }

  const target = parsed.data;
  const { db, seeker, at } = firstContactRequestContext(actor);
  const admission = await admitFirstContact(db, seeker, target, at);

  switch (admission.kind) {
    case 'admitted':
      return NextResponse.json({ verdict: 'open' } as const);

    case 'unchanged':
      // ⛔ **Η ΠΡΑΞΗ ΔΕΝ ΤΑΞΙΔΕΥΕΙ, ΠΑΡΟΤΙ ΕΙΝΑΙ ΔΙΚΗ ΤΟΥ.** Η οθόνη χρειάζεται **ένα
      //    ρήμα** για να διαλέξει τι θα δείξει· τα στοιχεία της πράξης ζουν στο
      //    `/mine`, που είναι η οθόνη που τα **παρουσιάζει**. Ό,τι στέλνουμε χωρίς
      //    καταναλωτή είναι επιφάνεια χωρίς φύλακα.
      return NextResponse.json({ verdict: 'already' } as const);

    case 'unavailable':
      return NextResponse.json({ error: 'ADMISSION_UNVERIFIED' } as const, { status: 503 });

    case 'rejected': {
      // 🔑 Η επιπλέον ανάγνωση γίνεται **μόνο** για τον ιδιοκτήτη, **μόνο** στη δική
      //    του σελίδα, και **μόνο** για να του δώσουμε τον δρόμο προς τα δικά του.
      const manageHref = admission.reason === 'contact-own-target'
        ? await manageHrefOfOwnTarget(db, target, at)
        : null;

      return NextResponse.json({
        verdict: 'refused',
        reason: admission.reason,
        manageHref,
      } as const);
    }

    default: {
      // Πέμπτη κατάσταση του κριτή κοκκινίζει ΕΔΩ, στη μεταγλώττιση — ποτέ σιωπηλά
      // ως «ανοιχτό», που θα ήταν το επιεικές και λάθος.
      const exhaustive: never = admission;
      return exhaustive;
    }
  }
}

export const GET = withStandardRateLimit(
  withPersonalOrOrgAuth<ContactAdmissionResponse>(admissionHandler),
);
