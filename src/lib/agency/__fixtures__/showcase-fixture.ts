/**
 * ADR-841 **Φ6-Β** — Η **ΜΙΑ** δημοσιευμένη βιτρίνα των δοκιμών.
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ — Ο **N.18** ΤΟ ΑΠΑΙΤΕΙ, ΚΑΙ ΗΤΑΝ ΗΔΗ ΤΡΙΑ ΑΝΤΙΓΡΑΦΑ
 *
 * Το ίδιο αντικείμενο-δείγμα ζούσε **αυτούσιο** σε τρεις σουίτες
 * *(`agency-directory-order` · `agency-showcase-listings` ·
 * `organization-capability`)*, και η Φ6-Β θα το έκανε **τέσσερα**. Είναι
 * κυριολεκτικά το σχήμα που το `CLAUDE.md` N.18 ονομάζει: *«κεντρικοποιείς το Α,
 * γράφεις Β+Γ ως δίδυμα»*.
 *
 * 🔑 **ΚΑΙ ΤΟ ΚΟΣΤΟΣ ΤΟΥ ΗΤΑΝ ΜΕΤΡΗΣΙΜΟ**: όταν το `gemiNumber` γενικεύτηκε σε
 * `credentials[]`, **τρεις** σουίτες έσπασαν ταυτόχρονα — και καμία δεν το είδε,
 * γιατί το Jest **δεν κάνει type-check**. Ένα κοινό fixture σπάει **μία** φορά,
 * σε **ένα** αρχείο, με **ένα** μήνυμα.
 *
 * ⚠️ **Είναι δείγμα, ΟΧΙ εργοστάσιο παραγωγής.** ⛔ Μην το εισαγάγεις σε κώδικα
 * προϊόντος: η μόνη διαδρομή που γεννά βιτρίνα είναι ο γραφέας, και ένα δεύτερο
 * σημείο κατασκευής θα ήταν δεύτερη απάντηση στο *«τι είναι έγκυρη βιτρίνα;»*.
 *
 * @module lib/agency/__fixtures__/showcase-fixture
 */

import type { PublicShowcase, ShowcaseCredential } from '@/types/agency-profile';

/**
 * Η **επαληθευμένη** ειδικότητα του μεσίτη *(ESCO API, 2026-09-02)* — η **ίδια**
 * που χρησιμοποιεί η μετανάστευση στο `showcase-read.ts`.
 *
 * ⚠️ Δεν εισάγεται από εκεί **επίτηδες**: εκείνη είναι ιδιωτική στη μηχανή, και
 * ένα test που δανείζεται τη σταθερά του κώδικα που δοκιμάζει **δεν μπορεί να
 * τον διαψεύσει**. Εδώ είναι ανεξάρτητη αντιγραφή, και υπάρχει άγκυρα που
 * ελέγχει ότι οι δύο **συμφωνούν**.
 */
export const BROKER_CREDENTIAL: ShowcaseCredential = {
  standing: 'regulated',
  occupation: {
    escoUri: 'http://data.europa.eu/esco/occupation/8ec8df02-e9dd-43b7-b416-5846ae0414ab',
    label: {
      el: 'μεσίτης ακίνητης περιουσίας/μεσίτρια ακίνητης περιουσίας',
      en: 'real estate agent',
    },
    iscoCode: '3334',
  },
  attestation: {
    state: 'declared',
    registration: { authorityKind: 'national', authority: 'gemi', number: '123456789000' },
  },
};

/**
 * Μια δημοσιευμένη βιτρίνα μεσιτικού γραφείου.
 *
 * @param overrides Ό,τι αφορά **τη συγκεκριμένη δοκιμή** — τα υπόλοιπα είναι
 *   θόρυβος που κρύβει το ερώτημα.
 */
export function showcaseFixture(overrides: Partial<PublicShowcase> = {}): PublicShowcase {
  return {
    companyId: 'comp_00000000-0000-4000-8000-000000000000',
    alias: 'a',
    displayName: 'Α',
    credentials: [BROKER_CREDENTIAL],
    place: null,
    position: null,
    publishedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

/**
 * **Το ΑΠΟΘΗΚΕΥΜΕΝΟ έγγραφο** — ό,τι ζει πραγματικά στο Firestore.
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * 🔴 ΔΕΝ ΕΙΝΑΙ ΤΟ ΙΔΙΟ ΜΕ ΤΟ {@link showcaseFixture}, ΚΑΙ Η ΔΙΑΦΟΡΑ ΕΙΝΑΙ ΟΛΟ
 *    ΤΟ ΝΟΗΜΑ: **το `standing` ΔΕΝ αποθηκεύεται.**
 *
 * Το `showcaseFixture()` δίνει τον τύπο του **καταναλωτή** — εκείνο που
 * επιστρέφει το `readShowcase`, με το `standing` **υπολογισμένο**. Αυτό εδώ
 * δίνει τον τύπο του **δίσκου**: σκέτα ζεύγη `{occupation, attestation}`.
 *
 * Αν αποθηκευόταν, μια σημαία `self-declared` γραμμένη πάνω σε μεσίτη θα
 * παρέκαμπτε τον φρουρό του ΓΕΜΗ **με μία λέξη σε ένα JSON** — ακριβώς η
 * διαφωνία σημαίας-με-περιεχόμενο που το ADR-749 ονομάζει. Ο φρουρός είναι ότι
 * το `readShowcase` **δεν διαβάζει ποτέ** το πεδίο· αυτό το εργοστάσιο είναι η
 * απόδειξη ότι δεν χρειάζεται να υπάρχει.
 *
 * ⚠️ **Σπείρε ΑΥΤΟ σε πλαστό Firestore**, ποτέ το `showcaseFixture()`: ένα test
 * που σπέρνει τον τύπο του καταναλωτή δοκιμάζει έγγραφο **που ο γραφέας δεν
 * γράφει**, δηλαδή είναι πράσινο για κόσμο που δεν υπάρχει.
 */
export function storedShowcaseDoc(
  overrides: Partial<PublicShowcase> = {},
): Record<string, unknown> {
  const { credentials, ...rest } = showcaseFixture(overrides);
  return {
    ...rest,
    // 🔑 Η ΑΦΑΙΡΕΣΗ ΕΙΝΑΙ ΤΟ ΣΗΜΕΙΟ — `standing` έξω, τα δύο μέσα.
    credentials: credentials.map(({ occupation, attestation }) => ({ occupation, attestation })),
  };
}
