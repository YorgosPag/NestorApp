/**
 * @fileoverview **Η ΚΡΙΣΗ ΤΟΥ ΠΕΡΙΒΑΛΛΟΝΤΟΣ** — «ποια δηλωμένη ρύθμιση λείπει, και τι σπάει;».
 * @related ADR-777 §8.35 · `config/environment-contract.ts` (το μητρώο)
 * @module lib/environment/environment-audit
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΚΑΘΑΡΗ ΣΥΝΑΡΤΗΣΗ — ΤΟ ΠΕΡΙΒΑΛΛΟΝ ΕΙΝΑΙ **ΟΡΙΣΜΑ**, ΟΧΙ ΚΑΘΟΛΙΚΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η κρίση δέχεται το `env` ως **παράμετρο** και δεν διαβάζει ποτέ μόνη της το
 * `process.env`. Δεν είναι καθαρολογία: μια κρίση που διαβάζει καθολικό είναι
 * δοκιμάσιμη **μόνο** μολύνοντας το πραγματικό περιβάλλον της διεργασίας — δηλαδή τα
 * tests θα άφηναν ίχνη το ένα στο άλλο, και μια αποτυχία θα εξαρτιόταν από τη **σειρά**
 * εκτέλεσης. Έτσι, τα τρία σενάρια (όλα παρόντα · λείπει ένα · λείπει `fatal`)
 * δοκιμάζονται **χωρίς** να αγγιχτεί το `process.env`.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΚΑΤΗΓΟΡΗΜΑ «ΥΠΑΡΧΕΙ;» ΕΙΝΑΙ **ΕΝΑ**, ΚΑΙ ΖΕΙ ΕΔΩ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `requireTokenSecret` (`lib/tokens/signed-token.ts`) έκρινε «παρούσα μεταβλητή» με
 * `process.env[x]?.trim()` — δηλαδή **κενή συμβολοσειρά και σκέτα κενά μετρούν ως
 * απουσία**, σωστά (ένα `MANDATE_CONSENT_SECRET=` στο αρχείο ρυθμίσεων *μοιάζει*
 * συμπληρωμένο και **δεν** υπογράφει τίποτα).
 *
 * Αν αυτή η κρίση έγραφε **δικό της** κατηγόρημα — έστω το προφανές `!== undefined` —
 * θα υπήρχαν **δύο απαντήσεις στο ίδιο ερώτημα**: η αναφορά υγείας θα έλεγε «υπάρχει»
 * και η πύλη συνδέσμου θα απαντούσε «άκυρος», ταυτόχρονα. Είναι κατά γράμμα το σχήμα
 * του **ADR-749** (τέσσερις μηχανές, τρεις αριθμοί για το ίδιο δέντρο).
 *
 * Γι' αυτό το κατηγόρημα εξήχθη **εδώ** και το `signed-token.ts` το **καταναλώνει**.
 * ⚠️ **ΜΗΝ ξαναγράψεις έλεγχο «υπάρχει η μεταβλητή;»** αλλού — κάλεσε το
 * `readConfiguredValue`.
 *
 * **Layering**: leaf — μηδέν εισαγωγές πλην τύπων. Δοκιμάσιμο χωρίς δίκτυο, χωρίς δίσκο.
 */

import {
  ENVIRONMENT_CONTRACT,
  type EnvironmentRequirement,
  type EnvironmentSeverity,
} from '@/config/environment-contract';

// =============================================================================
// 1. ΤΟ ΚΑΤΗΓΟΡΗΜΑ — Η ΜΟΝΗ ΑΠΑΝΤΗΣΗ ΣΤΟ «ΥΠΑΡΧΕΙ;»
// =============================================================================

/** Ό,τι μοιάζει με `process.env`, χωρίς να **είναι** το `process.env`. */
export type EnvironmentSource = Readonly<Record<string, string | undefined>>;

/**
 * Η τιμή της ρύθμισης, **ή `null` αν δεν έχει ρυθμιστεί στην πράξη**.
 *
 * «Στην πράξη» σημαίνει: απούσα · κενή · **ή μόνο κενά**. Τα δύο τελευταία είναι ο
 * συνηθισμένος τρόπος με τον οποίο μια ρύθμιση *φαίνεται* συμπληρωμένη ενώ δεν είναι.
 */
export function readConfiguredValue(env: EnvironmentSource, name: string): string | null {
  const trimmed = env[name]?.trim();
  return trimmed ? trimmed : null;
}

// =============================================================================
// 2. Η ΕΤΥΜΗΓΟΡΙΑ
// =============================================================================

/**
 * Η κατάσταση **μίας** δηλωμένης ρύθμισης. Ρητή, ποτέ `boolean`: ένα `false` δεν λέει
 * αν λείπει η ρύθμιση ή αν κανείς δεν κοίταξε.
 */
export type RequirementStatus = 'configured' | 'missing';

/** Μία δηλωμένη ρύθμιση μαζί με την ετυμηγορία της. **Ποτέ η τιμή της.** */
export interface RequirementVerdict {
  readonly requirement: EnvironmentRequirement;
  readonly status: RequirementStatus;
}

/**
 * Η πλήρης εικόνα, με **κλειστή λογιστική**: κάθε δηλωμένη ρύθμιση καταλήγει σε
 * ακριβώς μία κατάσταση, και το άθροισμα οφείλει να κλείνει.
 */
export interface EnvironmentAudit {
  readonly verdicts: readonly RequirementVerdict[];
  /** Λείπουν και είναι `fatal` — η εφαρμογή **δεν πρέπει** να ξεκινήσει. */
  readonly missingFatal: readonly EnvironmentRequirement[];
  /** Λείπουν και είναι `feature` — μία δυνατότητα πέφτει **σιωπηλά**. */
  readonly missingFeature: readonly EnvironmentRequirement[];
  /** Πόσες δηλώθηκαν συνολικά — ο **παρονομαστής**. */
  readonly declared: number;
  /** Πόσες βρέθηκαν ρυθμισμένες. */
  readonly configured: number;
}

// =============================================================================
// 3. Η ΣΑΡΩΣΗ
// =============================================================================

function verdictFor(env: EnvironmentSource, requirement: EnvironmentRequirement): RequirementVerdict {
  return {
    requirement,
    status: readConfiguredValue(env, requirement.name) === null ? 'missing' : 'configured',
  };
}

function missingOf(
  verdicts: readonly RequirementVerdict[],
  severity: EnvironmentSeverity,
): readonly EnvironmentRequirement[] {
  return verdicts
    .filter((v) => v.status === 'missing' && v.requirement.severity === severity)
    .map((v) => v.requirement);
}

/**
 * Κρίνει **ολόκληρο** το συμβόλαιο έναντι μιας πηγής ρυθμίσεων.
 *
 * ⚠️ **Ο παρονομαστής (`declared`) δεν είναι διακοσμητικός.** Χωρίς αυτόν, ένα
 * συμβόλαιο που κατά λάθος άδειασε θα ανέφερε «**0 λείπουν**» — απάντηση που διαβάζεται
 * ως «όλα εντάξει» ενώ σημαίνει «κανείς δεν κοίταξε». Είναι το σχήμα που το ίδιο αυτό
 * repo κυνηγά σε δώδεκα πύλες· δεν επιτρέπεται να γεννηθεί εδώ.
 */
export function auditEnvironment(
  env: EnvironmentSource,
  contract: readonly EnvironmentRequirement[] = ENVIRONMENT_CONTRACT,
): EnvironmentAudit {
  const verdicts = contract.map((requirement) => verdictFor(env, requirement));

  return {
    verdicts,
    missingFatal: missingOf(verdicts, 'fatal'),
    missingFeature: missingOf(verdicts, 'feature'),
    declared: verdicts.length,
    configured: verdicts.filter((v) => v.status === 'configured').length,
  };
}

// =============================================================================
// 4. Η ΔΙΑΤΥΠΩΣΗ — ΤΙ ΔΙΑΒΑΖΕΙ ΑΝΘΡΩΠΟΣ ΣΤΟ ΗΜΕΡΟΛΟΓΙΟ
// =============================================================================

/**
 * Μία γραμμή ανά ρύθμιση που λείπει, με **τη συνέπεια μέσα**.
 *
 * ⚠️ Το όνομα της μεταβλητής **μόνο του** είναι άχρηστο σε όποιον δεν έγραψε τον
 * κώδικα: `MANDATE_CONSENT_SECRET` δεν λέει σε κανέναν ότι «**ο ιδιοκτήτης δεν μπορεί
 * να εγκρίνει**». Η συνέπεια είναι ο λόγος που το μητρώο έχει το πεδίο `consequence`.
 */
export function describeMissing(missing: readonly EnvironmentRequirement[]): readonly string[] {
  return missing.map(
    (r) => `${r.name} (${r.feature}) — χωρίς αυτό: ${r.consequence} [ορίζεται για: ${r.consumer}]`,
  );
}
