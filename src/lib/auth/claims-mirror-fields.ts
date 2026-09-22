/**
 * @fileoverview **ΤΙ ΚΑΘΡΕΦΤΙΖΕΙ ΤΟ `users/{uid}` ΑΠΟ ΤΑ CLAIMS** — ADR-853 §16 (Ε-Α) · ADR-360.
 * @related lib/auth/identity-materialisation.ts (`MATERIALISED_FIELDS`) · lib/auth/set-claims-with-mirror.ts
 * @module lib/auth/claims-mirror-fields
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΕΥΡΗΜΑ (ζωντανό, 2026-09-22)
 * ─────────────────────────────────────────────────────────────────────────────
 * Μετά την αποδοχή πρόσκλησης, το claim έλεγε `companyId`/`globalRole` και το έγγραφο
 * `null` **ως την επόμενη σύνδεση**. Δύο δρόμοι ένταξης, ασύμμετροι: η έγκριση έγραφε το
 * κάτοπτρο **με το χέρι** μετά το `setClaimsWithMirror`, η πρόσκληση όχι. Η κλάση, όχι το
 * δείγμα: **κάθε** γραφέας claims ξαναέγραφε (ή ξεχνούσε) το ίδιο ζευγάρι πεδίων.
 *
 * 🔑 **Η ΘΕΡΑΠΕΙΑ**: ο **ΕΝΑΣ** γραφέας claims γράφει και το κάτοπτρό τους, στην ίδια πράξη.
 * Νέος δρόμος που δίνει claims **δεν μπορεί** να ξεχάσει το κάτοπτρο.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠️ ΤΑ ΠΕΔΙΑ ΔΕΝ ΔΗΛΩΝΟΝΤΑΙ ΕΔΩ — ΠΑΡΑΓΟΝΤΑΙ
 * ─────────────────────────────────────────────────────────────────────────────
 * Το ερώτημα «ποιο μητρώο κατέχει ποιο πεδίο του `users/{uid}`» έχει **ήδη** απάντηση:
 * `MATERIALISED_FIELDS` (ADR-822 §4.7). Τα πεδία εδώ είναι **όσα δηλώνονται `'claims'`
 * εκεί** — δεύτερη λίστα θα ήταν δεύτερη απάντηση (ADR-749). Η τρίτη πηγή, οι κανόνες
 * (`mirrorsOwnClaims`), δεν μπορεί να εισαγάγει TS· την ισοτιμία τη φυλά άγκυρα.
 *
 * ⛔ **ΤΟ `emailVerified` ΔΕΝ ΕΙΝΑΙ ΕΔΩ, ΕΠΙΤΗΔΕΣ.** Κάτοχός του είναι το **Auth**, όχι τα
 * claims (`MATERIALISED_FIELDS.emailVerified === 'auth'`), και ο ένας γραφέας του μένει ο
 * `auth-context-profile.ts`. Μετρημένο 2026-09-22: **κανένας** αναγνώστης δεν αποφασίζει
 * από το `users.emailVerified` (οι κρίσεις ρωτούν το Auth, `provenMailboxAccountOf`) ⇒ η
 * καθυστέρηση ως την επόμενη σύνδεση είναι καλλωπιστική, όχι λειτουργική.
 */

import { MATERIALISED_FIELDS } from './identity-materialisation';

type MaterialisedField = keyof typeof MATERIALISED_FIELDS;

/** Τα πεδία του εγγράφου που **κατέχουν τα claims** — ονομαστικά, από τον πίνακα. */
export type ClaimMirroredField = {
  [K in MaterialisedField]: (typeof MATERIALISED_FIELDS)[K] extends 'claims' ? K : never;
}[MaterialisedField];

/** Παραγόμενα από το `MATERIALISED_FIELDS` — ποτέ χειρόγραφα. */
export const CLAIM_MIRRORED_FIELDS: readonly ClaimMirroredField[] = (
  Object.keys(MATERIALISED_FIELDS) as MaterialisedField[]
).filter((field): field is ClaimMirroredField => MATERIALISED_FIELDS[field] === 'claims');

export type ClaimMirror = Readonly<Record<ClaimMirroredField, string | null>>;

/**
 * *«Τι πρέπει να λέει το έγγραφο, αν λέει ό,τι το claim;»*
 *
 * 🔑 **Απουσία ⇒ `null`, ΠΟΤΕ «κράτα την παλιά τιμή»**: claim χωρίς `companyId` σημαίνει
 * «δεν έχει χώρο» — ένα κάτοπτρο που κρατά τον παλιό λέει ψέμα με σχήμα εγγράφου. Και το
 * `null` είναι ακριβώς ό,τι δέχονται οι κανόνες (`token.get('companyId', null)`).
 * ⚠️ Μη-συμβολοσειρά ή κενό ⇒ `null`: το κάτοπτρο δεν μεταφέρει σκουπίδια.
 */
export function claimMirrorOf(claims: Readonly<Record<string, unknown>>): ClaimMirror {
  const mirror = {} as Record<ClaimMirroredField, string | null>;
  for (const field of CLAIM_MIRRORED_FIELDS) {
    const value = claims[field];
    mirror[field] = typeof value === 'string' && value.length > 0 ? value : null;
  }
  return mirror;
}
