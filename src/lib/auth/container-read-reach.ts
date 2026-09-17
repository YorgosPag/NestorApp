/**
 * =============================================================================
 * Η ΕΜΒΕΛΕΙΑ ΑΝΑΓΝΩΣΗΣ — ΠΡΟΒΟΛΗ ΤΗΣ ΚΑΤΑΣΤΑΣΗΣ ΓΙΑ ΤΟΝ ΚΑΝΟΝΑ (ADR-862 Φ0 Β11)
 * =============================================================================
 *
 * **Το ερώτημα**: *«Ποιον φράχτη μπορεί να στήσει ο κανόνας Firestore γύρω από
 * αυτό το δοχείο, χωρίς να ξέρει ομάδες;»*
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ ΠΕΔΙΟ — ΜΕΤΡΗΜΕΝΟ 2026-09-17
 * ─────────────────────────────────────────────────────────────────────────────
 * Το Firestore κρίνει τα `list` από τα **φίλτρα του ερωτήματος**, όχι από τα
 * δεδομένα (*«rules are not filters… evaluates the query against its potential
 * result set»*). Ένα `allow read` που διαβάζει `cdeState` θα έριχνε **όλες** τις
 * λίστες αρχείων από την πρώτη στιγμή — και φίλτρο `in`/`not-in` **αποκλείει**
 * έγγραφα χωρίς το πεδίο (35 ζωντανά, 2 με `cdeState`). ⇒ Ο κανόνας χρειάζεται
 * πεδίο **παρόν σε κάθε έγγραφο**, με τιμή που το ερώτημα μπορεί να δηλώσει.
 *
 * 🌐 **Είναι το μοντέλο των μεγάλων**: στο Autodesk Docs η ορατότητα ανήκει στον
 * **φάκελο** WIP/Shared/Published, στο ProjectWise *«security … applied to each
 * state in a workflow»* — ιδιότητα **θέσης/κατάστασης**, όχι λίστα ACL ανά
 * έγγραφο (ADR-787 Α5 «36.000 αποφάσεις»).
 *
 * 🏆 **Πού ξεπερνάμε**: εκεί ο φάκελος και η κατάσταση είναι **δύο ρυθμίσεις** που
 * αποκλίνουν σιωπηλά (σχέδιο «Published» ξεχασμένο σε φάκελο WIP). Εδώ η εμβέλεια
 * **παράγεται** από τη φάση με αυτόν τον πίνακα, τη γράφει **μόνο** ο γραφέας στην
 * **ίδια** εγγραφή με το `cdeState`, και ο θεματοφύλακας την **ξαναπαράγει και
 * συγκρίνει** ⇒ απόκλιση = `unreadable` = κλειστή πόρτα.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔑 Ο ΚΑΝΟΝΑΣ ΕΙΝΑΙ ΕΞΩΤΕΡΙΚΟΣ ΦΡΑΧΤΗΣ, Ο ΚΡΙΤΗΣ ΕΙΝΑΙ Η ΑΠΟΦΑΣΗ
 * ─────────────────────────────────────────────────────────────────────────────
 * Η εμβέλεια **δεν** αντικαθιστά τον `decideContainerAccess` — τον **περικλείει**:
 * ό,τι επιτρέπει ο κριτής σε άνθρωπο με client SDK, ο φράχτης δεν το αρνείται· ό,τι
 * ο κανόνας **δεν μπορεί να εκφράσει** (η ομάδα — δεν μπαίνει σε claim, βλ.
 * `container-subject.ts`) περνά από τη διαδρομή διακομιστή, όπου κρίνει ο κριτής.
 *
 * | φάση | εμβέλεια | γιατί |
 * |---|---|---|
 * | `pre-cde` | `tenant` | «όπως σήμερα» |
 * | `WIP` | `author` | ISO 19650 task team — η ομάδα από τον διακομιστή |
 * | `SHARED` | `tenant` | ομάδες μελέτης· crew/client δεν είναι χρήστες μισθωτή ως τη Φ1 |
 * | `PUBLISHED` | `tenant` | ό,τι παραπάνω |
 * | `SUPERSEDED` | `tenant` | ιστορικό πίσω από τον διακόπτη της όψης (Procore «All Sets») |
 * | `unreadable` | `null` | **ποτέ** δεν γράφεται — η μετανάστευση το αναφέρει |
 *
 * **Καθαρό · σύγχρονο · κανένα `server-only`** — το διαβάζουν builder, γραφέας,
 * θεματοφύλακας, μετανάστευση και πύλη.
 *
 * @module lib/auth/container-read-reach
 * @see lib/auth/container-access — ο κριτής (τον εκθέτει στο `CONTAINER_POLICY_TABLES`)
 * @see lib/files/file-record-read — ο θεματοφύλακας που ξαναπαράγει και συγκρίνει
 * @see ADR-862 Φ0 Β11 · ADR-373
 */

import type { CdeReadReach, CdeState } from '@/config/iso19650-constants';
import type { ContainerPhase } from '@/types/container-access';

/**
 * Η εμβέλεια της **γέννησης** — κάθε νέο FileRecord είναι `pre-cde`.
 *
 * ⚠️ Μία τιμή, **δύο** χρήσεις (γραμμή `pre-cde` του πίνακα + δημιουργοί): αν
 * αλλάξει εδώ, αλλάζουν **όλοι** μαζί — ποτέ literal στους δημιουργούς.
 */
export const BIRTH_READ_REACH = 'tenant' as const satisfies CdeReadReach;

/**
 * **Κατάσταση ISO 19650 → εμβέλεια** — οι τέσσερις γραμμές που γράφει ο γραφέας.
 *
 * 🔑 Χωριστός από τον πίνακα φάσεων **μόνο στον τύπο**: `Record<CdeState, CdeReadReach>`
 * χωρίς `null`, ώστε η προβολή του γραφέα (`projectionFor`) να μη χρειάζεται ποτέ
 * `!`/cast. Πέμπτη κατάσταση ⇒ **δεν χτίζει** (CHECK Κ4 του Β12).
 */
const READ_REACH_BY_STATE: Readonly<Record<CdeState, CdeReadReach>> = {
  WIP: 'author',
  SHARED: 'tenant',
  PUBLISHED: 'tenant',
  SUPERSEDED: 'tenant',
};

/**
 * **Φάση → εμβέλεια** — οι τέσσερις καταστάσεις **συν** η απουσία και η βλάβη.
 * Κλειστό `Record<ContainerPhase, …>`: έβδομη φάση **δεν χτίζει** χωρίς φράχτη.
 */
export const READ_REACH_BY_PHASE: Readonly<Record<ContainerPhase, CdeReadReach | null>> = {
  ...READ_REACH_BY_STATE,
  'pre-cde': BIRTH_READ_REACH,
  unreadable: null,
};

/**
 * **Η ΜΙΑ παραγωγή της εμβέλειας** για φάση όπως τη διάβασε ο θεματοφύλακας.
 * `null` ⇒ βλάβη· ο καλών **δεν** γράφει φράχτη, αναφέρει.
 *
 * @example
 * readReachFor(readContainerState(raw).phase); // 'tenant' | 'author' | null
 */
export function readReachFor(phase: ContainerPhase): CdeReadReach | null {
  return READ_REACH_BY_PHASE[phase];
}

/**
 * Η ίδια παραγωγή για **κατάσταση** που μόλις παρήγαγε ο γραφέας — πάντα ορισμένη.
 *
 * @example
 * readReachForState(projection.cdeState); // 'author' για WIP
 */
export function readReachForState(state: CdeState): CdeReadReach {
  return READ_REACH_BY_STATE[state];
}

