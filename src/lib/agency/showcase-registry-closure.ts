/**
 * @fileoverview **ΚΛΕΙΣΜΕΝΗ ΣΤΟ ΓΕΜΗ;** — η μία ερώτηση που κάνουν κατάλογος και πόρτες ενεργειών
 * (ADR-841 §7 Α23 Φ3.2, Απόφαση 1).
 * @related types/showcase-legal-identity.ts (`RegistryClosure`) · lib/agency/showcase-legal-identity.ts (ο κριτής)
 * @module lib/agency/showcase-registry-closure
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΤΡΕΙΣ ΚΑΤΑΝΑΛΩΤΕΣ, ΜΙΑ ΑΠΑΝΤΗΣΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * | Καταναλωτής | Τι κάνει με την απάντηση | Πρότυπο |
 * |---|---|---|
 * | `usePublicAgencies` (κατάλογος **και** αρχική αναζήτηση) | **εκτός** πληθυσμού — ο σύνδεσμος δουλεύει | Google Business Profile: «Οριστικά κλειστή» μένει ορατή σε όποιον την αναζητήσει, με ετικέτα |
 * | `submitMandateRequest` | `agency-closed` | Google Actions Center: οριστικά κλειστή δεν δέχεται κράτηση · ν. 4072/2012 άρθ. 200 (η σύμβαση μεσιτείας φέρει αριθμό ΓΕΜΗ) |
 * | `resolveTarget` (πρώτη επαφή) | `target-closed` | ίδιο |
 *
 * ⚠️ **Καμία διαγραφή, καμία συγκάλυψη.** Η άρνηση **δεν** αποκαλύπτει τίποτα που η σελίδα δεν γράφει
 * ήδη (δημόσιο μητρώο, άρθ. 14 GDPR με πηγή «ΓΕΜΗ»). Και η αφαίρεση από τον κατάλογο **μειώνει** την
 * έκθεση (άρθ. 5(1)(γ)) χωρίς να αφήνει ανακριβή ζωντανή βιτρίνα (άρθ. 5(1)(δ)).
 *
 * **Layering**: leaf — καθαρό, πελάτης και διακομιστής.
 */

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
