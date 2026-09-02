/**
 * ADR-841 **Φ6-Β** — Η ΣΥΝΘΕΣΗ ΤΩΝ ΔΥΟ ΕΡΩΤΗΜΑΤΩΝ ΤΗΣ ΑΞΙΟΠΙΣΤΙΑΣ.
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * 🔑 ΓΙΑΤΙ ΥΠΑΡΧΕΙ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ — Η Φ6-Α ΚΡΑΤΗΣΕ ΤΑ ΔΥΟ ΧΩΡΙΣΤΑ, ΕΠΙΤΗΔΕΣ
 *
 * Δύο **ανεξάρτητα** ερωτήματα ζουν σε δύο σχήματα, και η **οθόνη** είναι ο
 * μόνος τόπος όπου ενώνονται:
 *
 *   ΕΡΩΤΗΜΑ Α — του **ΕΠΑΓΓΕΛΜΑΤΟΣ**      ΕΡΩΤΗΜΑ Β — του **ΑΝΘΡΩΠΟΥ**
 *   `resolveRegistryAuthority(iscoCode)`   `ProfessionalAttestation.state`
 *   ├─ authority   → υπάρχει μητρώο        ├─ unknown  → δεν δήλωσε
 *   ├─ no-registry → ΔΕΝ υπάρχει (ΓΝΩΣΗ)   ├─ declared → δήλωσε, κανείς δεν έλεγξε
 *   ├─ unexamined  → δεν ξέρουμε (ΑΓΝΟΙΑ)  └─ verified → ρωτήθηκε η αρχή
 *   ├─ absent      → ελεύθερο κείμενο
 *   └─ malformed   → σφάλμα, ορατό
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * 🔴 ΤΟ ΠΙΟ ΕΥΚΟΛΟ ΛΑΘΟΣ: **ΜΙΑ** ΠΡΟΤΑΣΗ ΑΝΤΙ ΓΙΑ **ΔΥΟ ΓΡΑΜΜΕΣ**
 *
 * Η προφανής γραφή είναι ένα `switch` 15 περιπτώσεων που βγάζει **μία** πρόταση.
 * Είναι λάθος, και ο λόγος είναι μετρήσιμος: **μια ενιαία πρόταση είναι ακριβώς
 * ο τόπος όπου το `declared` φοράει τη στολή του `verified`**. «Δικηγόρος, ΔΣΘ
 * 1234» — *ποιος το είπε αυτό;* Η πρόταση δεν το λέει, και ο αναγνώστης
 * υποθέτει το χειρότερο για εμάς: ότι το ελέγξαμε.
 *
 * ⇒ Δύο **ανεξάρτητες** γραμμές, μία ανά ερώτημα:
 *   • **Ο ΙΣΧΥΡΙΣΜΟΣ** — *«τι δήλωσε **αυτός**;»*   (attestation **μόνο**)
 *   • **ΤΟ ΣΗΜΕΙΩΜΑ**  — *«τι ισχύει για **το επάγγελμα**;»* (verdict + σύγκριση)
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * 🔴 Ο ΚΑΝΟΝΑΣ ΤΟΥ ΕΛΑΙΟΧΡΩΜΑΤΙΣΤΗ — ΚΑΙ Η ΑΠΟΔΕΙΞΗ ΟΤΙ Η ΣΥΝΘΕΣΗ ΕΙΝΑΙ ΠΡΑΓΜΑΤΙΚΗ
 *
 *   **Ο ΙΣΧΥΡΙΣΜΟΣ ΣΩΠΑΙΝΕΙ ΟΤΑΝ ΤΟ ΕΠΑΓΓΕΛΜΑ ΔΕΝ ΕΧΕΙ ΜΗΤΡΩΟ.**
 *   Η απουσία δήλωσης γίνεται ορατή **μόνο** όταν υπάρχει κάτι να δηλωθεί.
 *
 * Αν το σημείωμα ήταν συνάρτηση **μόνο** του verdict, τότε στον ελαιοχρωματιστή
 * η γραμμή του ισχυρισμού θα έλεγε *«δεν έχει δηλώσει αριθμό»* — δηλαδή
 * **έλλειψη**, για κάποιον που **δεν έχει πού να γραφτεί**. Αυτό είναι το ίδιο
 * το σχήμα «0 = κανείς δεν κοίταξε» *(N.11 · N.12 · N.18)*, στραμμένο πάνω σε
 * άνθρωπο.
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * ⛔ ΜΗΝ ΤΗΝ ΕΝΣΩΜΑΤΩΣΕΙΣ ΣΕ JSX
 *
 * Η {@link composeCredibility} είναι **καθαρή, χωρίς React**, ώστε ολόκληρη η
 * 5×3 να δοκιμάζεται εκτελεσμένα. Μέσα σε component, τα 15 κελιά δοκιμάζονται
 * μόνο μέσω render — και η μετάλλαξη *«δύο κελιά λένε το ίδιο»* γίνεται
 * **αόρατη**, που είναι ακριβώς η μετάλλαξη που έχει σημασία εδώ.
 *
 * @module lib/professional/professional-credibility
 * @see docs/centralized-systems/reference/adrs/ADR-841-public-listing-body-and-platform-verticals.md — Α9
 * @see docs/centralized-systems/reference/adrs/ADR-798-person-professional-identity.md — §7
 */

import type { RegistryAuthorityVerdict } from '@/config/isco-registry-authority';
import type { RegistryAuthorityId } from '@/constants/professional-registries';
import type {
  ProfessionalAttestation,
  ProfessionalRegistration,
} from '@/types/professional-identity';

// =============================================================================
// Ο ΙΣΧΥΡΙΣΜΟΣ — τι δήλωσε ο ΑΝΘΡΩΠΟΣ
// =============================================================================

/**
 * Τι δήλωσε ο άνθρωπος — ή `null` όταν **δεν υπάρχει ισχυρισμός να δειχθεί**.
 *
 * ⚠️ **ΠΟΤΕ boolean.** Το `declared` και το `verified` έχουν **δικό τους**
 * εικονίδιο **και** δικό τους κείμενο· ένα `isVerified: boolean` θα είχε δύο
 * τιμές για τρεις καταστάσεις — δες ADR-798 §7.
 */
export interface CredibilityClaim {
  readonly state: 'declared' | 'verified';
  readonly registration: ProfessionalRegistration;
}

// =============================================================================
// ΤΟ ΣΗΜΕΙΩΜΑ — τι ισχύει για το ΕΠΑΓΓΕΛΜΑ
// =============================================================================

/**
 * Έξι διακριτά σημειώματα, και **κανένα δεν είναι σιωπή**.
 *
 * 🔴 **ΤΑ ΤΡΙΑ ΠΡΩΤΑ ΔΕΝ ΣΥΓΧΩΝΕΥΟΝΤΑΙ ΠΟΤΕ** — είναι όλη η Φ6:
 * τρεις διαφορετικές προτάσεις με **τρία διαφορετικά υποκείμενα**.
 *
 *   `registry-absent-by-nature`  → το **ΕΠΑΓΓΕΛΜΑ** *(«δεν υπάρχει μητρώο»)*
 *   `registry-unexamined`        → **ΕΜΕΙΣ**       *(«δεν το εξετάσαμε»)*
 *   `registry-exists-undeclared` → **ΑΥΤΟΣ**       *(«δεν δήλωσε αριθμό»)*
 */
export type CredibilityNote =
  /** Τηρείται μητρώο, η βιτρίνα δεν δηλώνει αριθμό. **Ουδέτερο — ΠΟΤΕ «όχι».** */
  | { readonly kind: 'registry-exists-undeclared'; readonly authority: RegistryAuthorityId }
  /** 🔑 **ΓΝΩΣΗ**: δεν τηρείται μητρώο πουθενά. Ο ελαιοχρωματιστής. */
  | { readonly kind: 'registry-absent-by-nature' }
  /** 🔑 **ΑΓΝΟΙΑ**: κανείς **δικός μας** δεν το εξέτασε. */
  | { readonly kind: 'registry-unexamined' }
  /** Δηλώθηκε αριθμός **άλλης** αρχής από εκείνη του επαγγέλματος. */
  | { readonly kind: 'authority-mismatch'; readonly expected: RegistryAuthorityId }
  /** Δηλώθηκε αριθμός ενώ για το επάγγελμα δεν γνωρίζουμε μητρώο. */
  | { readonly kind: 'registry-absent-yet-declared' }
  /** 🔴 **ΔΙΚΗ ΜΑΣ βλάβη** — δεν διαβάστηκε η ταξινόμηση. Ο άνθρωπος ΔΕΝ κατηγορείται. */
  | { readonly kind: 'classification-unreadable' };

/**
 * Τι δείχνει η οθόνη για **έναν** επαγγελματία.
 *
 * ⚠️ **ΤΟ ΑΜΕΤΑΒΛΗΤΟ**: `claim === null && note === null` είναι **αδύνατο** — η
 * οθόνη **δεν σωπαίνει ποτέ**. Ο τύπος δεν μπορεί να το επιβάλει *(θα απαιτούσε
 * ένωση 15 σκελών που κανείς δεν διαβάζει)*· το επιβάλλει η **άγκυρα** που
 * περνά και τα 15 κελιά.
 */
export interface CredibilityStatement {
  readonly claim: CredibilityClaim | null;
  readonly note: CredibilityNote | null;
}

// =============================================================================
// Η ΜΙΑ ΣΥΝΘΕΣΗ
// =============================================================================

/**
 * Ενώνει τα δύο ερωτήματα σε **δύο γραμμές** — δες την επικεφαλίδα.
 *
 * @param verdict Τι ισχύει για το **επάγγελμα** *(`resolveRegistryAuthority`)*.
 * @param attestation Τι δήλωσε ο **άνθρωπος**.
 */
export function composeCredibility(
  verdict: RegistryAuthorityVerdict,
  attestation: ProfessionalAttestation,
): CredibilityStatement {
  const claim: CredibilityClaim | null =
    attestation.state === 'unknown'
      ? null
      : { state: attestation.state, registration: attestation.registration };

  switch (verdict.kind) {
    case 'authority':
      if (claim === null) {
        return {
          claim: null,
          note: { kind: 'registry-exists-undeclared', authority: verdict.authority },
        };
      }
      // ✅ Ταιριάζουν ⇒ **καμία υποσημείωση**. Η σιωπή εδώ είναι πληροφορία: δεν
      //    υπάρχει τίποτα να επισημανθεί, και μια «όλα καλά» γραμμή θα ήταν
      //    ακριβώς η επιβεβαίωση που ΔΕΝ έχουμε κάνει (Σ5).
      return claim.registration.authority === verdict.authority
        ? { claim, note: null }
        : { claim, note: { kind: 'authority-mismatch', expected: verdict.authority } };

    case 'no-registry':
      // 🔴 ΕΔΩ ΖΕΙ Ο ΚΑΝΟΝΑΣ ΤΟΥ ΕΛΑΙΟΧΡΩΜΑΤΙΣΤΗ. Χωρίς ισχυρισμό, το σημείωμα
      //    λέει «ΔΕΝ ΥΠΑΡΧΕΙ» — ποτέ «δεν δήλωσε».
      return claim === null
        ? { claim: null, note: { kind: 'registry-absent-by-nature' } }
        : { claim, note: { kind: 'registry-absent-yet-declared' } };

    case 'unexamined':
      // ⚠️ ΤΟ ΙΔΙΟ σημείωμα ΚΑΙ με ισχυρισμό: «δεν το εξετάσαμε» παραμένει
      //    αληθές δίπλα σε δηλωμένο αριθμό. Δεύτερο σημείωμα εδώ θα ήταν δύο
      //    διατυπώσεις της ΙΔΙΑΣ άγνοιας (ADR-749 σε μία συνάρτηση).
      return { claim, note: { kind: 'registry-unexamined' } };

    // 🔴 ΑΠΡΟΣΙΤΑ ΑΠΟ ΤΟΝ ΓΡΑΦΕΑ — ΚΑΙ ΟΜΩΣ ΓΡΑΜΜΕΝΑ.
    //    Ο τύπος `ClassifiedOccupation` απαιτεί `iscoCode`, άρα το `absent` δεν
    //    παράγεται· το `malformed` σημαίνει ότι η ΔΙΚΗ ΜΑΣ ταξινομία έσπασε.
    //    Συγχωνεύονται στην ΟΘΟΝΗ (η θεραπεία του επισκέπτη είναι ταυτόσημη:
    //    καμία) και μένουν ΧΩΡΙΑ στον κώδικα (άλλο log) — ίδιο δόγμα με το
    //    `not-published` ⇄ `unavailable` του AgencyProfileLookup.
    case 'absent':
    case 'malformed':
      return { claim, note: { kind: 'classification-unreadable' } };
  }
}
