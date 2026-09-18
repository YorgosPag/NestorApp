/**
 * Firestore Rules Test Coverage — **ΔΙΚΤΥΟ ΣΥΝΕΡΓΑΤΩΝ** (ADR-867 Β4)
 *
 * Δύο πρότυπα, και **κανένα** από τα δύο δεν είναι παραλλαγή υπάρχοντος:
 *
 *   - `networkActTeamMatrix()`  → `network_act_teams` — κλειστή **και στις δύο** πλευρές.
 *   - `networkThreadMatrix()`   → `network_threads` — ανάγνωση **από το ΑΚΡΟΑΤΗΡΙΟ**.
 *
 * ---------------------------------------------------------------------------
 * 🔴 ΓΙΑΤΙ ΟΧΙ `denyAllMatrix()` ΓΙΑ ΤΟ ΠΡΩΤΟ — ΚΑΙ ΕΙΝΑΙ ΑΠΟΦΑΣΗ, ΟΧΙ ΑΝΤΙΓΡΑΦΗ
 * ---------------------------------------------------------------------------
 *
 * Το `denyAllMatrix()` δηλώνει **15 από 35** κελιά και **ομολογεί 20 ως ανοιχτά**
 * (`crossTenantUserUnmeasured`, `externalUserOpenDecision`, …). Είναι έντιμο για τις
 * συλλογές που το κληρονόμησαν — εκεί **κανείς δεν μέτρησε**. Εδώ όμως ο κανόνας είναι
 * κυριολεκτικά `if false` σε **κάθε** πράξη, άρα η πρόθεση **κάθε** κελιού είναι γνωστή
 * **πριν** τρέξει τίποτα: δεν υπάρχει πρόσωπο για το οποίο η απάντηση να είναι ανοιχτή.
 *
 * ⇒ Μια εξαίρεση εδώ θα ήταν **ψεύτικη ομολογία άγνοιας** — και θα φόρτωνε το ratchet
 * του CHECK 3.16 (Κ3, ανά (συλλογή, κελί)) με χρέος **που δεν υπάρχει**. Το κόστος του
 * να τα γράψουμε και τα 35 είναι 35 γραμμές· το κόστος του να μην τα γράψουμε είναι μια
 * μήτρα που *μοιάζει* επικυρωμένη στο 43%.
 *
 * ⚠️ **ΜΗΝ το «ενοποιήσεις» με το `denyAllMatrix`.** Η διαφορά δεν είναι στο σχήμα του
 * κανόνα (ίδιο) — είναι στο **τι ξέρουμε**. Ένα κοινό builder θα ανάγκαζε τη μία από τις
 * δύο ομάδες συλλογών να πει ψέματα.
 *
 * @module tests/firestore-rules/_registry/coverage-matrices-network
 * @since 2026-09-17 (ADR-867 Β4)
 */

import { cell } from './coverage-matrices';
import { defineMatrix, type CoverageDefinition } from './coverage-completeness';
import { ALL_OPERATIONS, type Operation } from './operations';
import { ALL_PERSONAS, type Persona } from './personas';

/** Οι πιστοποιημένοι — ο `anonymous` κόβεται **νωρίτερα** (`missing_claim`), πάντα. */
const AUTHENTICATED: readonly Persona[] = ALL_PERSONAS.filter((p) => p !== 'anonymous');

/**
 * **ΚΛΕΙΣΤΟ ΚΑΙ ΣΤΙΣ ΔΥΟ ΠΛΕΥΡΕΣ, ΓΙΑ ΚΑΘΕΝΑΝ** — το πρότυπο των συλλογών του δικτύου
 * που **μόνο ο διακομιστής** αγγίζει. **Τρεις** καταναλωτές, **ένα** πρότυπο:
 *
 * | Συλλογή | Τι θα έδινε μια ανάγνωση | Τι θα έκανε μια γραφή |
 * |---|---|---|
 * | `network_act_teams` (§4.3) | **οργανόγραμμα του γραφείου ανά πελάτη** (`memberUids`) | **αυτοπρόσκληση** στο ακροατήριο **κάθε** νήματος |
 * | `network_message_retractions` (§4.1) | **το κείμενο που ο άνθρωπος πήρε πίσω** | πλαστό τεκμήριο |
 * | `network_away` (§4.4, Β5) | **το ημερολόγιο απουσιών** ενός γραφείου, απαριθμήσιμο | ψεύτικη «απουσία» άλλου ⇒ οι ειδοποιήσεις του (Β6) πάνε αλλού |
 *
 * 🔑 **Γιατί ούτε ανάγνωση στην ομάδα**: η οθόνη παίρνει τη λίστα «ποιοι διαβάζουν» από το
 * **ακροατήριο του νήματος** — προβολή της ομάδας, **για το δικό του** νήμα. Εκεί ο πελάτης
 * **δικαιούται** να τη δει· εδώ θα έβλεπε **όλες** τις πράξεις του γραφείου.
 *
 * 🔴 **Γιατί ούτε ανάγνωση στις ανακλήσεις, ούτε από τον ΙΔΙΟ τον αποστολέα**: αυτό είναι
 * το σημείο όπου η ανάκληση γίνεται **αληθινή**. Αν ο πελάτης μπορούσε να διαβάσει, ο
 * άνθρωπος θα νόμιζε ότι πήρε πίσω τα λόγια του ενώ θα ήταν **ένα ερώτημα μακριά**.
 */
export function networkServerOnlyMatrix(): CoverageDefinition {
  return defineMatrix('networkServerOnlyMatrix', [
    ...ALL_OPERATIONS.flatMap((operation: Operation) => [
      ...AUTHENTICATED.map((p) => cell(p, operation, 'deny', 'server_only')),
      cell('anonymous', operation, 'deny', 'missing_claim'),
    ]),
  ]);
}

/**
 * **Το νήμα** (`network_threads`) — **διαβάζει όποιος έχει ΖΩΝΤΑΝΗ γραμμή ακροατηρίου**.
 *
 * Σχήμα κανόνα (`firestore.rules`):
 *   - `get`:                 `exists(network_audience/{uid}) && until == null`
 *   - `list`:                `if false` — το ακροατήριο είναι **υποσυλλογή**, δεν φιλτράρεται
 *   - `create/update/delete`: `if false` — **ένας** γραφέας, μέσα σε συναλλαγή
 *
 * 🔑 **ΤΟ ΚΕΛΙ ΠΟΥ ΚΑΝΕΙ ΟΛΗ ΤΗ ΔΟΥΛΕΙΑ ΕΙΝΑΙ ΤΟ `same_tenant_admin × read → deny`.**
 * Ο σπαρμένος αναγνώστης (`same_tenant_user`) και ο διαχειριστής είναι στον **ίδιο**
 * χώρο· τους ξεχωρίζει **μόνο** η γραμμή ακροατηρίου. Αν κάποιος «διορθώσει» τον κανόνα
 * σε `belongsToCompany(...)` — την προφανή κίνηση για κάθε άλλη συλλογή του αρχείου —
 * **αυτό** το κελί κοκκινίζει, και είναι ακριβώς η άγκυρα Α4 του ADR-867 §7.
 *
 * ⚠️ Ο `super_admin` **δεν** εξαιρείται, και είναι το ίδιο δόγμα με το `owner_properties`:
 * καμία διαδρομή που να κάνει τον ρόλο **εργαλείο πίεσης**. Η σιωπηλή ανάγνωση από
 * διαχειριστή απορρίφθηκε ονομαστικά (ADR-834 §5 Β (ε), πρότυπο Follow Up Boss/idealista).
 */
export function networkThreadMatrix(): CoverageDefinition {
  /** Πιστοποιημένοι **εκτός** ακροατηρίου — μαζί ο `super_admin` και ο διαχειριστής χώρου. */
  const OUTSIDERS: readonly Persona[] = AUTHENTICATED.filter((p) => p !== 'same_tenant_user');

  return defineMatrix('networkThreadMatrix', [
    // ── READ (get): ΜΟΝΟ η ζωντανή γραμμή ακροατηρίου.
    cell('same_tenant_user', 'read', 'allow'),
    ...OUTSIDERS.map((p) => cell(p, 'read', 'deny', 'not_audience')),
    cell('anonymous', 'read', 'deny', 'missing_claim'),

    // ── LIST: κανείς, **ούτε το ίδιο το μέλος του ακροατηρίου**. Ο κατάλογος νημάτων
    //    σερβίρεται από τον διακομιστή· ένα `list` εδώ δεν μπορεί να ρωτήσει υποσυλλογή.
    ...AUTHENTICATED.map((p) => cell(p, 'list', 'deny', 'server_only')),
    cell('anonymous', 'list', 'deny', 'missing_claim'),

    // ── CREATE / UPDATE / DELETE: κανείς. Το νήμα **δεν ανοίγει** — υπάρχει επειδή
    //    υπάρχει ακμή (§3), και η ακμή δεν δηλώνεται από πελάτη.
    ...(['create', 'update', 'delete'] as const).flatMap((operation) => [
      ...AUTHENTICATED.map((p) => cell(p, operation, 'deny', 'server_only')),
      cell('anonymous', operation, 'deny', 'missing_claim'),
    ]),
  ]);
}
