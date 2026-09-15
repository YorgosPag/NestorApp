/**
 * @fileoverview **ΚΛΕΙΣΜΕΝΗ ΣΤΟ ΓΕΜΗ;** — η μία ερώτηση που κάνουν κατάλογος και πόρτες ενεργειών
 * (ADR-841 §7 Α23 Φ3.2, Απόφαση 1).
 * @related types/showcase-legal-identity.ts (`RegistryClosure`) · lib/agency/showcase-legal-identity.ts (ο κριτής)
 * @module lib/agency/showcase-registry-closure
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΤΕΣΣΕΡΙΣ ΚΑΤΑΝΑΛΩΤΕΣ, ΜΙΑ ΑΠΑΝΤΗΣΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * | Καταναλωτής | Τι κάνει με την απάντηση | Πρότυπο |
 * |---|---|---|
 * | `usePublicAgencies` (κατάλογος **και** αρχική αναζήτηση) | **εκτός** πληθυσμού — ο σύνδεσμος δουλεύει | Google Business Profile: «Οριστικά κλειστή» μένει ορατή σε όποιον την αναζητήσει, με ετικέτα |
 * | `submitMandateRequest` · φόρμα εντολής · βιτρίνα (`mandateRefusalOf`) | `agency-closed` | Google Actions Center: οριστικά κλειστή δεν δέχεται κράτηση · ν. 4072/2012 άρθ. 200 (η σύμβαση μεσιτείας φέρει αριθμό ΓΕΜΗ) |
 * | `resolveTarget` (πρώτη επαφή) | `target-closed` | ίδιο |
 * | `ShowcaseView` (`contactableShowcase`) | κανένα κουμπί καναλιού — διεύθυνση/ωράριο μένουν | Google Business Profile |
 *
 * ⚠️ **Καμία διαγραφή, καμία συγκάλυψη.** Η άρνηση **δεν** αποκαλύπτει τίποτα που η σελίδα δεν γράφει
 * ήδη (δημόσιο μητρώο, άρθ. 14 GDPR με πηγή «ΓΕΜΗ»). Και η αφαίρεση από τον κατάλογο **μειώνει** την
 * έκθεση (άρθ. 5(1)(γ)) χωρίς να αφήνει ανακριβή ζωντανή βιτρίνα (άρθ. 5(1)(δ)).
 *
 * **Layering**: leaf — καθαρό, πελάτης και διακομιστής.
 */

import { acceptsMandate } from '@/lib/professional/showcase-acts';
import type { MandateRequestRejection } from '@/services/mandate/mandate-request-vocabulary';
import type { PublicShowcase } from '@/types/agency-profile';
import type { RegistryClosure } from '@/types/showcase-legal-identity';

/** Το κλείσιμο που δήλωσε το ΓΕΜΗ, ή `null` (ενεργή · δεν ρωτήθηκε · βιτρίνα πριν την Α23). */
export function registryClosureOf(showcase: Pick<PublicShowcase, 'legalIdentity'>): RegistryClosure | null {
  return showcase.legalIdentity?.registryClosure ?? null;
}

/** **Ανήκει στον δημόσιο κατάλογο;** — όχι όταν το ΓΕΜΗ λέει ότι έκλεισε. */
export function isListedInDirectory(showcase: Pick<PublicShowcase, 'legalIdentity'>): boolean {
  return registryClosureOf(showcase) === null;
}

/** Οι δύο λόγοι για τους οποίους μια **δημοσιευμένη** βιτρίνα δεν δέχεται νέα εντολή. */
export type MandateRefusal = Extract<MandateRequestRejection, 'agency-closed' | 'agency-not-brokerage'>;

/**
 * **«Δέχεται νέα εντολή μεσιτείας;»** — `null` = ναι· αλλιώς **ο λόγος** (Α23.1 Ε1 · Α5).
 *
 * 🔴 **Η ΣΕΙΡΑ ΕΙΝΑΙ Η ΑΠΟΦΑΣΗ**: κλειστή **πριν** από «ασκεί μεσιτεία;» — ο λόγος είναι θεμελιωδέστερος, και ένα
 * `agency-not-brokerage` θα έστελνε τον άνθρωπο να ζητήσει **άλλη** πράξη από επιχείρηση που δεν λειτουργεί.
 * Τρεις καταναλωτές, **μία** σειρά: ο γραφέας (`submitMandateRequest` — ο **μόνος** φρουρός), η σελίδα της φόρμας
 * (ανοίγω;) και η βιτρίνα (δείχνω το κουμπί;).
 */
export function mandateRefusalOf(showcase: Pick<PublicShowcase, 'legalIdentity' | 'credentials'>): MandateRefusal | null {
  if (registryClosureOf(showcase) !== null) return 'agency-closed';
  return acceptsMandate(showcase.credentials) ? null : 'agency-not-brokerage';
}

/**
 * **Η βιτρίνα όπως τη βλέπει ο επισκέπτης** (Α23.8 Γ4 φέτα 2): κλειστή ⇒ καταστήματα **χωρίς κανάλια**.
 *
 * 🔑 Η οθόνη ρωτά τη **δήλωση** καναλιού (`channelKinds`) — με κενή δήλωση σωπαίνουν «Εμφάνιση», «Αποθήκευση επαφής»
 * και η μεσιτική υπενθύμιση, **και** η σύνοψη «Επικοινωνία» (`primaryChannelLocation`). Διεύθυνση, οδηγίες, ωράριο
 * **μένουν** (Google Business Profile). Το `emailConfirmedAt` σβήνει μαζί — ίδιος κανόνας με τον αναγνώστη
 * (`showcase-read-locations.ts`: καμία ένδειξη χωρίς κανάλι).
 *
 * ⚠️ **Ευγένεια, όχι φρουρός**: οι πόρτες αρνούνται ήδη στον server (`revealLocationCard`, φέτα 1).
 */
export function contactableShowcase<T extends Pick<PublicShowcase, 'legalIdentity' | 'locations'>>(showcase: T): T {
  if (registryClosureOf(showcase) === null) return showcase;
  return {
    ...showcase,
    locations: showcase.locations.map((location) => ({ ...location, channelKinds: [], emailConfirmedAt: null })),
  };
}
