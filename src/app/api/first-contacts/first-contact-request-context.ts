import 'server-only';

/**
 * @fileoverview **ΤΙ ΧΡΕΙΑΖΕΤΑΙ ΚΑΘΕ ΓΡΑΦΕΑΣ ΤΗΣ ΠΡΑΞΗΣ ΓΙΑ ΝΑ ΤΡΕΞΕΙ** (ADR-843).
 * @related lib/auth/personal-scope-middleware.ts · lib/owner-property/listing-custody.ts
 * @module app/api/first-contacts/first-contact-request-context
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ ΥΠΑΡΧΕΙ: ΤΡΕΙΣ ΔΙΑΔΡΟΜΕΣ ΕΓΡΑΦΑΝ ΤΗΝ ΙΔΙΑ ΤΡΙΑΔΑ ΚΑΤΑ ΛΕΞΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η πόρτα (`ΠΕ1`), η απόσυρση (`ΠΕ6`) και το εισερχόμενο (`ΠΕ5`) ζητούσαν και οι τρεις
 * **βάση**, **δρώντα** και **ρολόι** — με τα ίδια τρία `import` και την ίδια γραμμή
 * μετάφρασης. Το CHECK 3.28 το ονόμασε **δίδυμα** (ADR-583), και είχε δίκιο: τρία
 * αντίγραφα μιας μετάφρασης είναι τρεις ευκαιρίες να αποκλίνει.
 *
 * 🔴 **ΚΑΙ Η ΜΕΤΑΦΡΑΣΗ ΕΧΕΙ ΚΑΝΟΝΑ ΠΟΥ ΕΠΑΝΑΛΑΜΒΑΝΟΤΑΝ ΣΕ ΣΧΟΛΙΟ**: *«ΜΗΝ γράψεις
 * `?? ''`»* — κενή εταιρεία **δεν ταιριάζει με τίποτα, ούτε με κενή**, και είναι
 * ακριβώς ό,τι κυνηγά η CHECK 3.35. Οδηγία γραμμένη σε **τρία** σχόλια δεν είναι πύλη·
 * η πύλη είναι να μην υπάρχει τρίτο σημείο να γραφτεί λάθος.
 *
 * ⛔ **ΔΕΝ ΤΥΛΙΓΕΙ ΤΟ `withPersonalOrOrgAuth`** — δες τον ίδιο λόγο στο
 * `first-contact-write-failure.ts`: η άγκυρα του ADR-817 §5 κρατά κλειστό το σύνολο
 * καταναλωτών με **`git grep 'withPersonalOrOrgAuth[<(]'`**, και ένα περιτύλιγμα θα
 * έκρυβε τις τέσσερις διαδρομές από τον μόνο φρουρό τους. Εδώ μετακινείται **μόνο** η
 * μετάφραση `ApiActor → ListingActor`, που είναι **αναφορά** και όχι κλήση.
 */

import type { Firestore } from 'firebase-admin/firestore';

import { actorWorkspace, type ApiActor } from '@/lib/auth/personal-scope-middleware';
// ⛔ ΤΟ ΡΟΛΟΪ ΕΧΕΙ ΜΙΑ ΠΗΓΗ (`.ssot-registry.json` → module `date-local`, CHECK 3.7).
import { nowISO } from '@/lib/date-local';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import type { ListingActor } from '@/lib/owner-property/listing-custody';

/** Τα τρία που κάθε γραφέας της πράξης ζητά — και **τίποτε άλλο**. */
export interface FirstContactRequestContext {
  readonly db: Firestore;
  /** 🔑 Η **μόνη** νόμιμη μετάφραση προς `ListingActor` ζει στο `actorWorkspace` (ADR-817). */
  readonly seeker: ListingActor;
  /** ⚠️ **Μία** στιγμή ανά αίτημα: δύο κλήσεις `nowISO()` είναι δύο διαφορετικά «τώρα». */
  readonly at: string;
}

/**
 * **Η μία προετοιμασία των γραφέων της πράξης.**
 *
 * ⚠️ Το `at` αποτυπώνεται **μία φορά** εδώ, όχι στο σημείο χρήσης: η πράξη γράφει
 * σφραγίδα χρόνου **και** κρίνει χωρητικότητα, και οι δύο οφείλουν να μιλούν για την
 * **ίδια** στιγμή.
 */
export function firstContactRequestContext(actor: ApiActor): FirstContactRequestContext {
  return {
    db: getAdminFirestore(),
    seeker: { uid: actor.ctx.uid, companyId: actorWorkspace(actor) },
    at: nowISO(),
  };
}
