/**
 * =============================================================================
 * Ο ΚΡΙΤΗΣ ΤΗΣ ΟΡΑΤΟΤΗΤΑΣ ΤΟΥ ΔΟΧΕΙΟΥ — ο ΕΝΑΣ (ADR-862 Φ0 · ADR-787 Κ-4)
 * =============================================================================
 *
 * **Το ερώτημα**: *«Φτάνει **ΑΥΤΟΣ** ο άνθρωπος σε **ΑΥΤΟ** το δοχείο, στην
 * **κατάσταση** που βρίσκεται;»*
 * **Ο απαντητής**: αυτό το αρχείο. Κανένα άλλο.
 *
 * ⚠️ **ΔΕΝ είναι το ερώτημα του `authority.ts`.** Εκείνο ρωτά *«έχει την
 * **ικανότητα**;»* — εξουσιοδότηση **ανεξάρτητη πόρου**. Η σειρά είναι: **πρώτα
 * μέλος** (ADR-787) · **μετά ικανός** (ADR-801) · **μετά φτάνει σε αυτό το
 * δοχείο** (εδώ). Ο κριτής της ικανότητας καλείται **τελευταίος** (βήμα 8) —
 * δεν αντιγράφεται, δεν παρακάμπτεται.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🏛️ ΤΟ ΜΟΝΤΕΛΟ: ΕΔΩ ΚΛΕΙΝΕΙ Η ΤΡΙΑΔΑ ΤΟΥ AuthZEN — ΚΑΙ ΕΙΝΑΙ ΜΕΤΡΗΜΕΝΟ
 * ─────────────────────────────────────────────────────────────────────────────
 * Το OpenID **AuthZEN 1.0** ορίζει το ερώτημα ως *«Can **who** do **what** on
 * **which resource**?»* και απαιτεί **και τα τρία**: `subject` · `action` ·
 * `resource` είναι **REQUIRED** (§6.1), με το `resource` να είναι
 * `{ type, id, properties }` (§5.2).
 *
 * ⇒ Ο `CapabilityQuery` (`subject × action`) είναι **το μισό ερώτημα**, και το
 * δηλώνει (ADR-801 §7). **Ο `ContainerAccessQuery` είναι ολόκληρο**:
 *
 *   `subject`  → {@link ContainerSubject}  *(ταυτότητα ήδη επαληθευμένη)*
 *   `action`   → `PermissionId`            *(τι θέλει να κάνει)*
 *   `resource` → {@link ContainerFacts}    *(`type: file` · `id: fileId` ·
 *                                           `properties: state`)*
 *
 * 🔑 **ΓΙ' ΑΥΤΟ ΔΕΝ ΠΡΟΣΤΕΘΗΚΕ `resource?` ΣΤΟΝ `CapabilityQuery`** (ADR-862 Φ0,
 * απόφαση Β): ο `decideCapability` **δεν κρίνει** ανά πόρο — ένα πεδίο που
 * κανείς κριτής δεν διαβάζει θα ήταν ο **607ος αδρανής φρουρός** του ADR-749 §5.
 * Η διάσταση `resource` απέκτησε καταναλωτή· ο καταναλωτής είναι **αυτό το
 * αρχείο**, όχι ένα πεδίο.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΚΑΜΙΑ ΑΝΑΓΝΩΣΗ ΕΔΩ ΜΕΣΑ — ΚΑΙ ΕΙΝΑΙ ΤΟ ΠΡΟΤΥΠΟ, ΟΧΙ ΙΔΙΟΤΡΟΠΙΑ
 * ─────────────────────────────────────────────────────────────────────────────
 * **Καθαρός · σύγχρονος · κανένα `server-only`** (πρότυπο `identity-claims.ts`).
 * Τρεις ανεξάρτητες πηγές λένε το ίδιο:
 *
 *   • **AuthZEN §5.1.1** — *«Many authorization systems are **stateless**, and
 *     expect the **client (PEP)** to pass in any properties or attributes that
 *     are expected to be used in the evaluation»*
 *   • **OpenFGA** *contextual tuples* — γεγονότα **περασμένα** στο ερώτημα,
 *     έγκυρα μόνο γι' αυτό, **ποτέ** αποθηκευμένα
 *   • **Cedar** — *«the authorizer is able to consider all of your application's
 *     policies and **entity data**»*, δηλαδή δοσμένα από τον καλούντα
 *
 * ⚠️ Αν γινόταν `async`/`server-only`, ο πελάτης θα **έχανε** τον έναν PEP του
 * (`useCapability` μέσα σε `useMemo`) και θα γεννιόταν η απόκλιση *«το UI
 * δείχνει κουμπί που ο server απορρίπτει»* — η βλάβη που το OWASP ονομάζει
 * *«client-side checks … should **never** be the decisive factor»*.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🏆 ΠΟΥ ΞΕΠΕΡΝΑΜΕ ΤΟΥΣ ΜΕΓΑΛΟΥΣ — Ο ΠΙΝΑΚΑΣ ΕΙΝΑΙ ΚΛΕΙΣΤΟΣ ΣΕ **ΔΥΟ** ΑΞΟΝΕΣ
 * ─────────────────────────────────────────────────────────────────────────────
 * Σε Cedar · OpenFGA · AuthZEN η πολιτική είναι **δεδομένα σε χρόνο εκτέλεσης**:
 * κανόνας που λείπει βγαίνει **σιωπηλή** άρνηση (ή, χειρότερα, σιωπηλή άδεια από
 * άλλη πολιτική), και το μαθαίνεις **εκ των υστέρων** — αυτό που η βιομηχανία
 * ονομάζει *policy drift*.
 *
 * Εδώ ο {@link AUDIENCE_REACH} είναι `Record<CdeAudience, Record<CdeState, …>>`:
 * **πέμπτο ακροατήριο** ή **πέμπτη κατάσταση** χωρίς δηλωμένη εμβέλεια **ΔΕΝ
 * ΜΕΤΑΓΛΩΤΤΙΖΕΤΑΙ**. Ο έλεγχος γίνεται στο `git add`, όχι στην παραγωγή.
 *
 * @module lib/auth/container-access
 * @see types/container-access — το λεξιλόγιο (13 ετυμηγορίες)
 * @see lib/files/file-record-read — ο θεματοφύλακας που παράγει τα γεγονότα
 * @see lib/auth/authority — ο αδελφός («επιτρέπεται;»), βήμα 8
 * @see ADR-862 §5.4.1 — ο πίνακας των τεσσάρων προτύπων, ως δεδομένα
 */

import type { CdeState } from '@/config/iso19650-constants';
import type {
  CdeAudience,
  ContainerAccessDecision,
  ContainerAccessQuery,
  ContainerAccessVerdict,
  ContainerFacts,
  ContainerPhase,
  ContainerState,
  ContainerSubject,
} from '@/types/container-access';
import { isGranted } from '@/types/capability-authority';

import { decideCapability } from './authority';
import { READ_REACH_BY_PHASE } from './container-read-reach';

// =============================================================================
// ΟΙ ΛΟΓΟΙ — ΠΛΗΡΟΤΗΤΑ ΕΠΙΒΑΛΛΟΜΕΝΗ ΑΠΟ ΤΟΝ ΜΕΤΑΓΛΩΤΤΙΣΤΗ
// =============================================================================

/**
 * Κλειδί i18n ανά ετυμηγορία — `null` για όσες **επιτρέπουν**.
 *
 * 🔑 `Record<ContainerAccessVerdict, …>`: μια **δέκατη τέταρτη** ετυμηγορία δεν
 * μεταγλωττίζεται μέχρι να αποκτήσει λόγο. Άρνηση χωρίς λόγο είναι κενή οθόνη
 * που ο άνθρωπος δεν μπορεί να εξηγήσει — το αντίθετο από τα *determining
 * policies* που επιστρέφει το Cedar.
 *
 * ⚠️ Τα κλειδιά **δεν υπάρχουν ακόμη στα locales**, και είναι σκόπιμο (ίδια
 * απόφαση με το `REASON_BY_VERDICT` του `authority.ts`): κανένα UI δεν τα
 * καταναλώνει στη Φ0. Μπαίνουν μαζί με τον πρώτο καταναλωτή — μεταφράσεις που
 * δεν ζητά κανείς είναι νεκρό βάρος (N.11 · CHECK 3.8).
 */
const REASON_BY_VERDICT: Record<ContainerAccessVerdict, string | null> = {
  'visible-own-wip': null,
  'visible-shared-to-design': null,
  'visible-published': null,
  'visible-history': null,
  'visible-legacy-tenant': null,
  'denied-unauthenticated': 'files:container.denyReason.notAuthenticated',
  'denied-not-engaged': 'files:container.denyReason.notEngaged',
  'denied-foreign-wip': 'files:container.denyReason.foreignWip',
  'denied-audience': 'files:container.denyReason.audience',
  'denied-superseded-hidden': 'files:container.denyReason.supersededHidden',
  'denied-unknown-state': 'files:container.denyReason.unknownState',
  'denied-teamless': 'files:container.denyReason.teamless',
  'denied-capability': 'files:container.denyReason.capability',
};

// =============================================================================
// ΠΙΝΑΚΑΣ Α — Η ΕΜΒΕΛΕΙΑ ΤΟΥ ΑΚΡΟΑΤΗΡΙΟΥ (ADR-862 §5.4.1, ΩΣ ΔΕΔΟΜΕΝΑ)
// =============================================================================

/**
 * **Ποιο πρότυπο συμμετοχής φτάνει σε ποια κατάσταση.**
 *
 * 🔑 **ΚΛΕΙΣΤΟΣ ΚΑΙ ΣΤΟΥΣ ΔΥΟ ΑΞΟΝΕΣ**: `Record<CdeAudience, Record<CdeState, …>>`.
 * Νέο ακροατήριο **ή** νέα κατάσταση ⇒ **δεν χτίζει** χωρίς ρητή γραμμή. Αυτό
 * είναι που κάνει το *policy drift* δομικά αδύνατο (βλ. κεφαλίδα).
 *
 * ⛔ **ΔΕΝ είναι αλυσίδα `if` ντυμένη πίνακα**: ο κριτής κάνει **μία** αναζήτηση
 * (βήμα 5) και δεν ξέρει τίποτα για το περιεχόμενο των γραμμών.
 *
 * | | WIP | SHARED | PUBLISHED | SUPERSEDED |
 * |---|---|---|---|---|
 * | `design`   | ✅ *(μόνο δικό του — βήμα 6)* | ✅ | ✅ | ✅ *(με διακόπτη — βήμα 7)* |
 * | `crew`     | ⛔ | ⛔ | ✅ | ⛔ |
 * | `client`   | ⛔ | ⛔ | ✅ | ⛔ |
 * | `supplier` | ⛔ | ⛔ | ⛔ | ⛔ |
 *
 * 🔴 **Η ΓΡΑΜΜΗ `supplier` ΕΙΝΑΙ ΟΛΟΚΛΗΡΗ `false`, ΚΑΙ ΕΙΝΑΙ ΑΠΟΦΑΣΗ.** Το
 * ADR-862 §5.4.1 του δίνει *«**ΜΟΝΟ** το πακέτο (§5.5)»* — μηχανισμός της **Φ3**,
 * που **δεν υπάρχει**. Μέχρι να υπάρξει, ο προμηθευτής παίρνει `denied-audience`
 * **παντού**: fail-closed, ποτέ σιωπηλό «ναι» επειδή κάτι δεν γράφτηκε ακόμη.
 *
 * 🌐 **ΓΙΑΤΙ `crew`/`client` ΔΕΝ ΦΤΑΝΟΥΝ ΣΤΟ `SUPERSEDED`** — και εδώ είμαστε
 * **αυστηρότεροι** από τον κλάδο: το Procore κρατά το αποσυρμένο σχέδιο
 * *«you will still be able to **reference** it, but it will **no longer be
 * visible** in your project's current set»* και **δεν λέει πουθενά** ποιος
 * επιτρέπεται να το δει. Το ADR-862 §5.4.1.γ το κλείνει ρητά: η απόσυρση *«φεύγει
 * **αμέσως** από τα μάτια του συνεργείου»*. Το συνεργείο που χτίζει από
 * αποσυρμένο φύλλο είναι **ατύχημα**, όχι ζήτημα ευκολίας.
 */
const AUDIENCE_REACH: Readonly<Record<CdeAudience, Readonly<Record<CdeState, boolean>>>> = {
  design: { WIP: true, SHARED: true, PUBLISHED: true, SUPERSEDED: true },
  crew: { WIP: false, SHARED: false, PUBLISHED: true, SUPERSEDED: false },
  client: { WIP: false, SHARED: false, PUBLISHED: true, SUPERSEDED: false },
  supplier: { WIP: false, SHARED: false, PUBLISHED: false, SUPERSEDED: false },
};

// =============================================================================
// ΠΙΝΑΚΑΣ Β — ΤΙ ΑΠΑΙΤΕΙ ΚΑΘΕ ΦΑΣΗ, ΚΑΙ ΤΙ ΔΙΝΕΙ
// =============================================================================

/**
 * Η **επιπλέον** προϋπόθεση μιας φάσης, πέρα από την εμβέλεια του ακροατηρίου.
 *
 * ⚠️ Δεν υπάρχει τιμή «ποτέ»: η φάση που δεν ανοίγει με τίποτα (`unreadable`)
 * είναι **άλλο είδος** γραμμής (`kind: 'closed'`), όχι απαίτηση που αποτυγχάνει.
 * Νεκρός κλάδος σε φρουρό είναι φρουρός που κανείς δεν μπορεί να ασκήσει.
 */
type ContainerRequirement = 'none' | 'same-team' | 'history-switch';

/**
 * Η γραμμή του πίνακα Β — **διακριτή ένωση**, ώστε κάθε φάση να δηλώνει **τι
 * είδους** πόρτα είναι.
 *
 * 🔑 Το `state` είναι η **γέφυρα προς τον πίνακα Α**, ως **δεδομένο**: έτσι οι
 * δύο πίνακες δένουν χωρίς κανένα `as` και χωρίς να ξέρει ο ένας τον άλλον.
 */
type PhaseGate =
  /** Φάση του ISO 19650 — κρίνεται από ακροατήριο **και** απαίτηση. */
  | {
      readonly kind: 'cde';
      readonly state: CdeState;
      readonly grant: ContainerAccessVerdict;
      readonly requires: ContainerRequirement;
    }
  /** `pre-cde` = **«όπως σήμερα»**: καμία κρίση CDE, μόνο ο έλεγχος ικανότητας. */
  | { readonly kind: 'legacy'; readonly grant: ContainerAccessVerdict }
  /** `unreadable` = **fail-closed**, πριν από κάθε άλλη ερώτηση. */
  | { readonly kind: 'closed'; readonly deny: ContainerAccessVerdict };

/**
 * **Τι σημαίνει κάθε φάση για την κρίση** — η δεύτερη μισή πολιτική, ως δεδομένα.
 *
 * 🔑 `Record<ContainerPhase, …>` ⇒ **έβδομη φάση δεν χτίζει** χωρίς δηλωμένη
 * πόρτα. Και οι έξι γραμμές είναι εδώ, μαζί με την **απουσία** και τη **βλάβη**
 * — που είναι ονομασμένες καταστάσεις, όχι εξαιρέσεις.
 */
const ACTION_BY_PHASE: Readonly<Record<ContainerPhase, PhaseGate>> = {
  WIP: { kind: 'cde', state: 'WIP', grant: 'visible-own-wip', requires: 'same-team' },
  SHARED: { kind: 'cde', state: 'SHARED', grant: 'visible-shared-to-design', requires: 'none' },
  PUBLISHED: { kind: 'cde', state: 'PUBLISHED', grant: 'visible-published', requires: 'none' },
  SUPERSEDED: {
    kind: 'cde',
    state: 'SUPERSEDED',
    grant: 'visible-history',
    requires: 'history-switch',
  },
  'pre-cde': { kind: 'legacy', grant: 'visible-legacy-tenant' },
  unreadable: { kind: 'closed', deny: 'denied-unknown-state' },
};

// =============================================================================
// ΒΟΗΘΟΙ — καθαροί, ένα ερώτημα ο καθένας
// =============================================================================

/**
 * Η ομάδα **του δοχείου**, όπου η φάση την ονομάζει.
 *
 * ⚠️ `'teamId' in state` και **όχι** cast: οι δύο φάσεις χωρίς ομάδα (`pre-cde` ·
 * `unreadable`) **δεν έχουν** το πεδίο, και ο μεταγλωττιστής το ξέρει.
 */
function containerTeamOf(state: ContainerState): string | null {
  return 'teamId' in state ? state.teamId : null;
}

/**
 * **WIP: μόνο η ομάδα που το φτιάχνει** (ISO 19650 task team — *«not visible to
 * or accessible by anyone else»*).
 *
 * 🔑 **Η ΑΝΩΝΥΜΗ ΟΜΑΔΑ ΔΕΝ ΚΛΗΡΟΝΟΜΕΙΤΑΙ**: αν λείπει η ομάδα **από οποιαδήποτε**
 * πλευρά, η απάντηση είναι `denied-teamless` — **όχι** «ταιριάζουν τα δύο `null`».
 * Χωρίς αυτό, ένα αρχείο χωρίς `cdeTeamId` θα γινόταν ορατό σε **κάθε** άνθρωπο
 * χωρίς ομάδα, δηλαδή η απουσία δεδομένου θα ήταν **άδεια**.
 */
function teamRequirement(
  subject: ContainerSubject,
  facts: ContainerFacts,
): ContainerAccessVerdict | null {
  const owner = containerTeamOf(facts.state);
  if (subject.taskTeamId === null || owner === null) return 'denied-teamless';
  return subject.taskTeamId === owner ? null : 'denied-foreign-wip';
}

/**
 * **SUPERSEDED: ιστορικό πίσω από ρητό διακόπτη**, ποτέ προεπιλογή.
 *
 * 🌐 Είναι η σελίδα *«All Sets and Revisions»* του Procore, εκφρασμένη ως
 * **πρόθεση του αιτούντος** αντί για δεύτερη οθόνη: ο ίδιος κριτής απαντά και
 * στις δύο περιπτώσεις, άρα δεν μπορεί να αποκλίνει από τον εαυτό του.
 */
function historyRequirement(subject: ContainerSubject): ContainerAccessVerdict | null {
  return subject.historyRequested ? null : 'denied-superseded-hidden';
}

/**
 * Οι απαιτήσεις ως **πίνακας**, ποτέ `switch` μέσα στον κριτή.
 *
 * ⚠️ `Record<ContainerRequirement, …>` ⇒ νέα απαίτηση **δεν χτίζει** χωρίς
 * έλεγχο που την ασκεί.
 */
const REQUIREMENT_CHECK: Readonly<
  Record<
    ContainerRequirement,
    (subject: ContainerSubject, facts: ContainerFacts) => ContainerAccessVerdict | null
  >
> = {
  none: () => null,
  'same-team': teamRequirement,
  'history-switch': subject => historyRequirement(subject),
};

// =============================================================================
// Ο ΚΡΙΤΗΣ
// =============================================================================

/**
 * **Φτάνει αυτός ο άνθρωπος σε αυτό το δοχείο;**
 *
 * 🔴 **Η ΣΕΙΡΑ ΕΙΝΑΙ ΣΥΜΒΟΛΑΙΟ, ΟΧΙ ΥΛΟΠΟΙΗΣΗ** (ADR-862 Φ0 Β5):
 *
 *   1. καμία **ταυτότητα**            ⇒ ⛔ deny-by-default (OWASP)
 *   2. **άγνωστη κατάσταση**          ⇒ ⛔ fail-closed, **πριν** από όλα
 *   3. **`pre-cde`**                  ⇒ παρακάμπτει τα (4)-(7) — «όπως σήμερα»
 *   4. **δεν συμμετέχει**             ⇒ ⛔
 *   5. **το ακροατήριο δεν φτάνει**   ⇒ ⛔ πίνακας Α
 *   6. **ξένο WIP**                   ⇒ ⛔ πίνακας Β
 *   7. **SUPERSEDED χωρίς διακόπτη**  ⇒ ⛔ πίνακας Β
 *   8. **`decideCapability`**         ⇒ ✅/⛔ — ο αδελφός κριτής, για **όλους**
 *
 * ⚠️ **ΓΙΑΤΙ ΤΟ (6) ΜΕΤΑ ΤΟ (5)**: το συνεργείο μπροστά σε WIP παίρνει
 * `denied-audience`, **όχι** `denied-foreign-wip` — δεν πρέπει να μάθει **καν ότι
 * υπάρχει ομάδα**. Η σειρά είναι εδώ **διαρροή πληροφορίας**, όχι στυλ.
 *
 * ⚠️ **ΓΙΑΤΙ ΤΟ (8) ΙΣΧΥΕΙ ΚΑΙ ΓΙΑ ΤΟ `pre-cde`**: «όπως σήμερα» σημαίνει
 * *ακριβώς* τον έλεγχο που υπάρχει σήμερα — τον έλεγχο **ικανότητας**. Αν το
 * `pre-cde` επέστρεφε «ορατό» χωρίς αυτόν, η Φ0 θα **χαλάρωνε** την ασφάλεια στα
 * **35 από 35** ζωντανά αρχεία, στο όνομα της συμβατότητας.
 *
 * @param query subject × action × resource — **πλήρες** ερώτημα AuthZEN.
 * @returns Μία από τις **δεκατρείς** ετυμηγορίες, ποτέ `boolean`, ποτέ σιωπή.
 *
 * @example
 * const d = decideContainerAccess({ subject, facts, action: 'projects:projects:view' });
 * if (!isContainerVisible(d.verdict)) hide(d.reason);
 */
export function decideContainerAccess(query: ContainerAccessQuery): ContainerAccessDecision {
  const { subject, facts, action } = query;
  const phase = facts.state.phase;

  const decide = (verdict: ContainerAccessVerdict): ContainerAccessDecision => ({
    verdict,
    fileId: facts.fileId,
    phase,
    reason: REASON_BY_VERDICT[verdict],
  });

  // (1) Καμία ταυτότητα ⇒ ⛔.
  if (!subject) return decide('denied-unauthenticated');

  const gate = ACTION_BY_PHASE[phase];

  // (2) Το έγγραφο δεν λέει τι είναι ⇒ ⛔, πριν από κάθε άλλη ερώτηση.
  if (gate.kind === 'closed') return decide(gate.deny);

  // (3) Το `pre-cde` παρακάμπτει τη σειρά (4)-(7), ποτέ το (8).
  if (gate.kind === 'cde') {
    // (4) Δεν συμμετέχει καθόλου στην υπόθεση.
    if (subject.audience === null) return decide('denied-not-engaged');

    // (5) Το πρότυπο συμμετοχής του δεν φτάνει σε αυτή την κατάσταση.
    if (!AUDIENCE_REACH[subject.audience][gate.state]) return decide('denied-audience');

    // (6)/(7) Η επιπλέον απαίτηση της φάσης — ομάδα ή διακόπτης ιστορικού.
    const unmet = REQUIREMENT_CHECK[gate.requires](subject, facts);
    if (unmet !== null) return decide(unmet);
  }

  // (8) Ο αδελφός κριτής — ο ΕΝΑΣ απαντητής του «επιτρέπεται;» (ADR-801).
  const capability = decideCapability({ subject, action });
  return decide(isGranted(capability.verdict) ? gate.grant : 'denied-capability');
}

// =============================================================================
// ΟΙ ΠΙΝΑΚΕΣ, ΓΙΑ ΤΙΣ ΑΓΚΥΡΕΣ ΚΑΙ ΤΗΝ ΠΥΛΗ ΤΟΥ Β12
// =============================================================================

/**
 * ⚠️ **Εξάγονται ΜΟΝΟ για επαλήθευση** (άγκυρες + CHECK 3.84 Κ4 του Β12:
 * *«κάθε τιμή του `CDE_STATES` έχει γραμμή στο `AUDIENCE_REACH`»*).
 *
 * ⛔ **ΜΗΝ τους διαβάσεις για να πάρεις απόφαση** — η απόφαση έχει **έναν**
 * απαντητή, τον {@link decideContainerAccess}. Πίνακας διαβασμένος αλλού είναι
 * ο δεύτερος κριτής που όλο αυτό υπάρχει για να μην γεννηθεί (ADR-749).
 */
export const CONTAINER_POLICY_TABLES = {
  AUDIENCE_REACH,
  ACTION_BY_PHASE,
  // ADR-862 Φ0 Β11 — ο εξωτερικός φράχτης του κανόνα, δίπλα στην πολιτική που περικλείει.
  READ_REACH_BY_PHASE,
} as const;
