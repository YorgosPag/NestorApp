/**
 * =============================================================================
 * Η ΠΟΛΙΤΙΚΗ ΤΩΝ ΤΕΣΣΑΡΩΝ ΠΡΑΞΕΩΝ — **καθαρή, χωρίς δίσκο** (ADR-862 Φ0 Β6)
 * =============================================================================
 *
 * **Το ερώτημα**: *«Επιτρέπεται αυτή η πράξη πάνω σε αυτό το έγγραφο, και τι παράγει;»*
 * **Ο απαντητής**: αυτό το αρχείο. Ο γραφέας (`container-transitions.ts`) μόνο **γράφει**.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ ΞΕΧΩΡΙΣΤΟ ΑΡΧΕΙΟ, ΚΑΙ ΓΙΑΤΙ ΜΕ **ΑΥΤΗ** ΤΗΝ ΚΑΤΕΥΘΥΝΣΗ
 * ─────────────────────────────────────────────────────────────────────────────
 * Ο γραφέας είχε φτάσει **550/500** γραμμές (N.7.1) και η `transitionContainer` **71/40**.
 * Η τομή **δεν** είναι αυθαίρετη: ακολουθεί το γραμμένο μάθημα του `role-catalogue.ts`
 * — *«κάτω τα **δεδομένα** (καμία εξάρτηση), πάνω οι **ερωτήσεις**»*, γιατί η αντίστροφη
 * τομή γέννησε ζωντανό `ReferenceError` σε **8 σουίτες**.
 *
 * ⚠️ **ΚΑΝΕΝΑ `server-only` ΕΔΩ, ΚΑΙ ΕΙΝΑΙ ΑΠΟΦΑΣΗ** — ίδιο ιδίωμα με τον κριτή
 * ορατότητας του Β5 (`lib/auth/container-access.ts`): η **κρίση** δοκιμάζεται με ωμό
 * αντικείμενο, **χωρίς πλαστό δίσκο και χωρίς συναλλαγή**. Ένας φρουρός που μπορεί να
 * ασκηθεί μόνο μέσα από `runTransaction` δοκιμάζεται πάντα μαζί με τη μηχανή
 * αποθήκευσης — και τότε ένα πράσινο δεν λέει **ποιο από τα δύο** δούλεψε.
 *
 * ⛔ **ΜΗΝ εισαγάγεις εδώ `firebaseAdmin`, `COLLECTIONS` ή οτιδήποτε γράφει.** Η στιγμή
 * που αυτό το αρχείο αποκτά I/O είναι η στιγμή που η πολιτική παύει να είναι
 * δοκιμάσιμη μόνη της.
 *
 * @module services/iso19650/container-transition-policy
 * @see services/iso19650/container-transitions — ο **γραφέας** (Admin SDK)
 * @see lib/files/file-record-read — ο θεματοφύλακας που **ξαναπαράγει** την κατάσταση
 */

import { nowISO } from '@/lib/date-local';
import {
  readContainerActs,
  readContainerState,
  deriveSuitability,
} from '@/lib/files/file-record-read';
import { isPayloadOwnedByCompany } from '@/lib/auth/tenant-ownership';
import { readReachForState } from '@/lib/auth/container-read-reach';
import type { CdeReadReach, CdeState, SuitabilityCode } from '@/config/iso19650-constants';
import type { PermissionId } from '@/lib/auth/types';
import type { CapabilitySubject } from '@/types/capability-authority';
import type { FileAuditAction } from '@/types/file-audit';
import type {
  ContainerActRecord,
  ContainerActs,
  ContainerPhase,
  ContainerState,
} from '@/types/container-access';
import type { SuccessionRefusalReason } from './container-succession-policy';

// =============================================================================
// ΤΟ ΛΕΞΙΛΟΓΙΟ
// =============================================================================

/**
 * Οι πέντε πράξεις. **Κλειστό σύνολο** — έκτη δεν μεταγλωττίζεται χωρίς γραμμή.
 *
 * 🔑 `supersede` (ADR-862 Φ0 Β10): **νέα έκδοση** πήρε τη θέση — συνέπεια ανεβάσματος, όχι
 * κρίση συντονιστή. Δες `container-succession-policy.ts` για την απόδειξη που απαιτεί.
 */
export type ContainerAct = 'share' | 'seal' | 'release' | 'withdraw' | 'supersede';

/**
 * Ποιος ζητά την πράξη.
 *
 * ⚠️ **Ταυτότητα ήδη επαληθευμένη** — το `AuthContext` του `withAuth`. Κανένας από τους
 * δύο μας **δεν** διαβάζει κανάλι και **δεν** εμπιστεύεται είσοδο πελάτη.
 */
export interface ContainerActor extends CapabilitySubject {
  readonly uid: string;
  readonly companyId: string;
}

export interface ContainerTransitionRequest {
  readonly fileId: string;
  readonly act: ContainerAct;
  readonly actor: ContainerActor;
  /** **Μόνο στη σφραγίδα** — το «permitted use» που δηλώνει ο μελετητής. */
  readonly suitabilityCode?: SuitabilityCode;
  /** **Μόνο στην απόσυρση** — γιατί αποσύρθηκε. */
  readonly reason?: string;
  /** **Μόνο στην αντικατάσταση** — ποιο αρχείο παίρνει τη θέση. Κρίνεται, δεν πιστεύεται. */
  readonly supersededByFileId?: string;
  /**
   * **Μόνο στην αντικατάσταση** — ο διάδοχος **γεννιέται μέσα στην ίδια συναλλαγή** (ADR-862 Φ0,
   * «Ορισμός ως τρέχουσας»). Κρίνεται από τον `judgeSuccession` **όπως θα γραφτεί**, και γράφεται
   * μόνο αν η κρίση περάσει ⇒ δύο «τρέχουσες» εκδόσεις είναι **δομικά αδύνατες**, ούτε για μια στιγμή.
   * Απόν ⇒ ο διάδοχος πρέπει να υπάρχει ήδη (η ροή ανεβάσματος του Β10).
   */
  readonly successorBirth?: Readonly<Record<string, unknown>>;
}

/**
 * Γιατί **δεν** έγινε η πράξη. **Κλειστό σύνολο, ονομασμένο.**
 *
 * ⚠️ **ΠΟΤΕ ρίψη για «δεν επιτρέπεται»**: μια άρνηση πολιτικής είναι **τιμή**, όχι
 * σφάλμα. Εξαίρεση θα ανάγκαζε τον καλούντα να τη διακρίνει από πραγματική βλάβη με
 * `instanceof` — και ο επόμενος θα την έπιανε σε `catch` που γυρίζει **500** αντί για
 * «δεν επιτρέπεται». Ίδιο δόγμα με τις ετυμηγορίες των δύο κριτών.
 */
export type ContainerRefusalReason =
  /** Το έγγραφο δεν υπάρχει — ή ο αιτών δεν δικαιούται να μάθει ότι υπάρχει. */
  | 'not-found'
  /** Ξένος μισθωτής. Το κενό **δεν είναι** tenant (ADR-742 §4). */
  | 'tenant-mismatch'
  /** Η κατάσταση δεν διαβάζεται ⇒ **fail-closed**, καμία πράξη πάνω σε άγνωστο. */
  | 'unreadable'
  /** Ο `decideCapability` είπε όχι. */
  | 'not-capable'
  /** 🔴 Σφραγίδα από **μη-δημιουργό**. Ισχύει **ακόμη και για τον υπερδιαχειριστή**. */
  | 'not-author'
  /** Η πράξη δεν έχει νόημα σε αυτή τη φάση (π.χ. σφραγίδα αποσυρμένου). */
  | 'wrong-phase'
  /** Απελευθέρωση **χωρίς** σφραγίδα δημιουργού (ADR-862 Α17 μετάλλαξη γ). */
  | 'seal-missing'
  /** Η σφραγίδα δείχνει σε **άλλη** αναθεώρηση (Α17 μετάλλαξη α). */
  | 'revision-moved'
  /** Η αντικατάσταση **δεν αποδείχθηκε** (ADR-862 Φ0 Β10) — δες το όνομα. */
  | SuccessionRefusalReason;

/**
 * Γιατί η πράξη ήταν **περιττή** — ιδεμποτησία (N.7.2 #3), όχι αποτυχία.
 * `self-succession`: το αρχείο δεν διαδέχεται τον εαυτό του.
 */
export type ContainerNoopReason = 'already-in-state' | 'self-succession';

/**
 * Η έκβαση — **ονομασμένη ένωση**, ποτέ `boolean`, ποτέ σιωπή.
 *
 * 🔑 Το `fileId` επιστρέφεται **ρητά**, ώστε ένα «έγινε» να μην μπορεί ποτέ να
 * αποδοθεί σε **άλλο** αρχείο από αυτό που ζητήθηκε (πρότυπο `ContainerAccessDecision`).
 */
export type ContainerTransitionOutcome =
  | {
      readonly kind: 'transitioned';
      readonly fileId: string;
      readonly act: ContainerAct;
      readonly from: ContainerPhase;
      readonly to: CdeState;
      readonly revision: number;
    }
  | {
      readonly kind: 'noop';
      readonly fileId: string;
      readonly act: ContainerAct;
      readonly why: ContainerNoopReason;
    }
  | {
      readonly kind: 'refused';
      readonly fileId: string;
      readonly act: ContainerAct;
      readonly why: ContainerRefusalReason;
    };

// =============================================================================
// Ο ΠΙΝΑΚΑΣ ΤΩΝ ΠΡΑΞΕΩΝ — ΔΕΔΟΜΕΝΑ, ΠΟΤΕ ΑΛΥΣΙΔΑ `if`
// =============================================================================

export interface ActSpec {
  /** Η ικανότητα που ζητά ο `decideCapability` (ADR-801). */
  readonly capability: PermissionId;
  /** Το πεδίο της πράξης πάνω στο έγγραφο. */
  readonly field: 'cdeShare' | 'cdeSeal' | 'cdeRelease' | 'cdeWithdrawal' | 'cdeSupersession';
  /** Η **διακριτή** ενέργεια ημερολογίου — ⚠️ ποτέ το πιασμένο `'share'`. */
  readonly audit: FileAuditAction;
  /** 🔴 Απαιτεί **ιδιοκτησία**; Μόνο η σφραγίδα — και **δεν** είναι ικανότητα. */
  readonly requiresAuthor: boolean;
  /** Από ποιες φάσεις έχει νόημα. Κλειστό σύνολο ⇒ ό,τι λείπει είναι `wrong-phase`. */
  readonly from: readonly ContainerPhase[];
}

/**
 * 🔑 `Record<ContainerAct, …>` ⇒ **πέμπτη πράξη δεν χτίζει** χωρίς πλήρη δήλωση.
 *
 * ⚠️ Το `'pre-cde'` είναι επιτρεπτή **αφετηρία** παντού εκτός απελευθέρωσης: σημαίνει
 * «όπως σήμερα», δηλαδή αρχείο γραμμένο **πριν** τη Φ0. Η πρώτη του πράξη είναι και η
 * είσοδός του στο CDE. ⛔ Η **απελευθέρωση** δεν το δέχεται: χωρίς σφραγίδα δεν
 * υπάρχει τίποτα να απελευθερωθεί.
 */
export const ACT_SPEC: Readonly<Record<ContainerAct, ActSpec>> = {
  share: {
    capability: 'iso19650:containers:share',
    field: 'cdeShare',
    audit: 'cde_share',
    requiresAuthor: false,
    from: ['pre-cde', 'WIP'],
  },
  seal: {
    capability: 'iso19650:containers:seal',
    field: 'cdeSeal',
    audit: 'cde_seal',
    // 🔴 ΤΟ ΜΟΝΑΔΙΚΟ `true` ΤΟΥ ΠΙΝΑΚΑ — δες `authorRequirement` παρακάτω.
    requiresAuthor: true,
    from: ['pre-cde', 'WIP', 'SHARED'],
  },
  release: {
    capability: 'iso19650:containers:release',
    field: 'cdeRelease',
    audit: 'cde_release',
    requiresAuthor: false,
    from: ['WIP', 'SHARED'],
  },
  withdraw: {
    capability: 'iso19650:containers:withdraw',
    field: 'cdeWithdrawal',
    audit: 'cde_withdraw',
    requiresAuthor: false,
    from: ['pre-cde', 'WIP', 'SHARED', 'PUBLISHED'],
  },
  supersede: {
    capability: 'iso19650:containers:supersede',
    field: 'cdeSupersession',
    audit: 'cde_supersede',
    // ⚠️ Η «ιδιοκτησία» εδώ αφορά τον **διάδοχο**, όχι το έγγραφο: την κρίνει ο
    //    `judgeSuccession` (`not-successor-author`), που ξέρει και την εξαίρεση συντονιστή.
    requiresAuthor: false,
    from: ['pre-cde', 'WIP', 'SHARED', 'PUBLISHED'],
  },
};

// =============================================================================
// Η ΠΑΡΑΓΩΓΗ — ΚΑΘΑΡΗ, ΚΑΙ **ΚΑΤΟΠΤΡΟ** ΤΟΥ ΑΝΑΓΝΩΣΤΗ
// =============================================================================

/**
 * **Η κατάσταση που παράγουν αυτές οι πράξεις.**
 *
 * 🔴 **ΟΦΕΙΛΕΙ ΝΑ ΣΥΜΦΩΝΕΙ ΜΕ ΤΟΝ `readContainerState`.** Ο θεματοφύλακας
 * **ξαναπαράγει** την κατάσταση και τη **συγκρίνει** με το αποθηκευμένο πεδίο·
 * διαφωνία ⇒ `unreadable` ⇒ άρνηση. Δηλαδή ένα σφάλμα εδώ **δεν** δίνει λάθος
 * ορατότητα — δίνει **κλειστή πόρτα**, και η άγκυρα το πιάνει ξαναδιαβάζοντας με τον
 * **πραγματικό** αναγνώστη.
 *
 * ⚠️ Η σειρά είναι συμβόλαιο: η **απόσυρση νικά τα πάντα** (*«deny πάνω από allow»*,
 * ADR-862 §3.5) — αποσυρμένο σχέδιο δεν ξαναγίνεται «για κατασκευή» επειδή υπάρχει
 * παλιά σφραγίδα.
 */
export function deriveCdeState(acts: ContainerActs, revision: number): CdeState {
  if (acts.withdrawal !== null || acts.supersession !== null) return 'SUPERSEDED';
  if (
    acts.seal !== null &&
    acts.release !== null &&
    acts.seal.revision === revision &&
    acts.release.revision === revision
  ) {
    return 'PUBLISHED';
  }
  if (acts.share !== null) return 'SHARED';
  return 'WIP';
}

/**
 * Η κατάσταση ως {@link ContainerState}, για τον υπολογισμό της καταλληλότητας.
 *
 * 🔑 **Η ΔΙΑΚΡΙΤΗ ΕΝΩΣΗ ΔΕΝ ΔΕΧΕΤΑΙ ΕΝΙΑΙΟ ΑΝΤΙΚΕΙΜΕΝΟ**: μόνο το μέλος `PUBLISHED`
 * φέρει `revision`. Ένα `{ phase: cdeState, teamId, revision }` με `phase: CdeState`
 * δεν ταιριάζει μονοσήμαντα σε **κανένα** μέλος. Ο διαχωρισμός εδώ στενεύει σωστά.
 *
 * ⚠️ `teamId: null` επίτηδες: η καταλληλότητα **δεν** εξαρτάται από ομάδα
 * (`deriveSuitability` διαβάζει μόνο `phase` και τη σφραγίδα), και η ομάδα είναι
 * ερώτημα του **Β7**. Ψεύτικη τιμή εδώ θα ήταν δεδομένο που κανείς δεν τίμησε.
 */
function stateOf(phase: CdeState, revision: number): ContainerState {
  return phase === 'PUBLISHED' ? { phase, teamId: null, revision } : { phase, teamId: null };
}

/** Η **αποθηκευμένη προβολή** των πράξεων — τα τρία παραγόμενα πεδία, μαζί. */
export interface ContainerProjection {
  readonly cdeState: CdeState;
  /** `null` = το πρότυπο **δεν ορίζει** χρήση σε αυτή τη φάση — όχι «σβήσ' το». */
  readonly suitabilityCode: SuitabilityCode | null;
  /** ADR-862 Φ0 Β11 — ο φράχτης του κανόνα· **ίδια** `update()` με το `cdeState`. */
  readonly cdeReadReach: CdeReadReach;
}

/**
 * **Ό,τι πρέπει να γραφτεί δίπλα στην πράξη** — σε **μία** κλήση.
 *
 * 🔑 Ο γραφέας δεν ξέρει **τίποτα** για την παραγωγή: ζητά την προβολή και τη γράφει
 * στην ίδια `update()`. Έτσι η ατομικότητα *(πράξη + προβολή)* παύει να είναι θέμα
 * προσοχής του γραφέα και γίνεται **σχήμα του API**.
 */
export function projectionFor(acts: ContainerActs, revision: number): ContainerProjection {
  const cdeState = deriveCdeState(acts, revision);
  return {
    cdeState,
    suitabilityCode: deriveSuitability(stateOf(cdeState, revision), acts),
    cdeReadReach: readReachForState(cdeState),
  };
}

/**
 * Η αναθεώρηση, **με τον κανόνα του αναγνώστη**.
 *
 * 🔴 **ΜΕΤΡΗΜΕΝΗ ΠΑΓΙΔΑ** (κλειστή 2026-09-17): το καταργημένο `file-version.service.ts`
 * διάβαζε `?? 1`, ο θεματοφύλακας `?? 0`. Αν ο γραφέας διάλεγε το **άλλο**, κάθε `PUBLISHED`
 * θα έβγαινε `published-revision-moved` ⇒ **αόρατο αρχείο**. Το δεύτερο μοντέλο εκδόσεων
 * αφαιρέθηκε (ADR-862 Φ0)· ο κανόνας μένει: ισχύει του **αναγνώστη**, γιατί αυτός κρίνει.
 */
function containerRevisionOf(raw: Record<string, unknown>): number {
  const value = raw.revision;
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

// =============================================================================
// ΟΙ ΦΡΟΥΡΟΙ — ΕΝΑ ΕΡΩΤΗΜΑ Ο ΚΑΘΕΝΑΣ
// =============================================================================

/**
 * 🔴 **Η ΙΔΙΟΚΤΗΣΙΑ ΔΕΝ ΕΙΝΑΙ ΙΚΑΝΟΤΗΤΑ — ΚΑΙ ΓΙ' ΑΥΤΟ ΔΕΝ ΠΕΡΝΑ ΑΠΟ ΤΟΝ ΚΡΙΤΗ.**
 *
 * Μόνο ο **σφραγίζων μελετητής** πιστοποιεί ότι το σχέδιο είναι κατασκευάσιμο· κανείς
 * δεν το κάνει για λογαριασμό του. **Ούτε ο `super_admin`** — ο νόμος δεν έχει bypass
 * ρόλο. Αν αυτός ο έλεγχος περνούσε από τον `decideCapability`, ο κλάδος
 * `granted-by-bypass` θα επέτρεπε στον υπερδιαχειριστή να σφραγίσει **ξένη μελέτη**,
 * δηλαδή να υπογράψει αντί για μηχανικό.
 *
 * @see ADR-862 §5.4.1.γ — 50-state survey σφραγίδων· «ο οικοδεσπότης ΔΕΝ κάνει το βήμα 1»
 */
function authorRequirement(actorUid: string, createdBy: unknown): ContainerRefusalReason | null {
  return typeof createdBy === 'string' && createdBy === actorUid ? null : 'not-author';
}

/**
 * Οι προϋποθέσεις **της απελευθέρωσης** — το δεύτερο σκαλοπάτι χρειάζεται το πρώτο.
 *
 * ⚠️ Και τα δύο πρέπει να δείχνουν στην **ίδια** αναθεώρηση: *«σφράγισα την P01,
 * δημοσιεύτηκε η P02»* είναι η μετάλλαξη (α) της άγκυρας Α17. Χωρίς αυτό, ο μηχανικός
 * σφραγίζει **μία φορά** και κάθε επόμενη αποθήκευση φεύγει «εγκεκριμένη» στο εργοτάξιο.
 */
function releaseRequirement(acts: ContainerActs, revision: number): ContainerRefusalReason | null {
  if (acts.seal === null) return 'seal-missing';
  return acts.seal.revision === revision ? null : 'revision-moved';
}

// =============================================================================
// Η ΚΑΤΑΣΚΕΥΗ ΤΗΣ ΠΡΑΞΗΣ
// =============================================================================

/**
 * Το κλειδί της πράξης μέσα στο {@link ContainerActs} — ρήμα ↔ ουσιαστικό.
 * 🔑 `Record` ⇒ έκτη πράξη **δεν χτίζει** χωρίς γραμμή εδώ (ό,τι ήταν τριαδικό θα σιωπούσε).
 */
const ACT_KEY: Readonly<Record<ContainerAct, keyof ContainerActs>> = {
  share: 'share',
  seal: 'seal',
  release: 'release',
  withdraw: 'withdrawal',
  supersede: 'supersession',
};

function actKey(act: ContainerAct): keyof ContainerActs {
  return ACT_KEY[act];
}

/**
 * Η πράξη, όπως γράφεται. **Conditional spread** — ποτέ `undefined` σε πεδίο (το
 * Firestore το απορρίπτει, και ο `readAct` θα διάβαζε ελλιπή πράξη).
 *
 * 🔴 **ISO, ΠΟΤΕ `serverTimestamp()`**: ο θεματοφύλακας δέχεται `at` **μόνο** ως `Date`
 * ή `string` (`file-record-read.ts:98`). Ένα sentinel επιστρέφει από τη βάση ως
 * `Timestamp` — **ούτε** `Date` **ούτε** `string` ⇒ `readAct` → `null` ⇒ η πράξη
 * **εξαφανίζεται** ⇒ `unreadable` ⇒ **αόρατο αρχείο**. Το ρολόι είναι ούτως ή άλλως
 * του **διακομιστή**: ο μόνος καλών είναι `server-only`.
 */
export function buildAct(
  request: ContainerTransitionRequest,
  revision: number,
): ContainerActRecord {
  return {
    by: request.actor.uid,
    at: nowISO(),
    revision,
    ...(request.act === 'seal' && request.suitabilityCode !== undefined
      ? { suitabilityCode: request.suitabilityCode }
      : {}),
    ...(request.act === 'withdraw' && request.reason !== undefined
      ? { reason: request.reason }
      : {}),
    ...(request.act === 'supersede' && request.supersededByFileId !== undefined
      ? { supersededByFileId: request.supersededByFileId }
      : {}),
  };
}

/**
 * Οι πράξεις **με την καινούργια μέσα** — ρητά και τα τέσσερα πεδία.
 *
 * ⚠️ **ΟΧΙ `{ ...acts, [actKey(act)]: record }`**: το υπολογισμένο κλειδί παράγει τύπο
 * με **index signature**, που δεν στενεύει σε {@link ContainerActs}. Ο μεταγλωττιστής
 * θα το δεχόταν ή θα το απέρριπτε ανάλογα με ρυθμίσεις — και ο N.17 απαγορεύει στον
 * πράκτορα να τρέξει `tsc` για να μάθει ποιο. **Ρητό είναι φθηνότερο από βέβαιο.**
 */
export function withAct(
  acts: ContainerActs,
  act: ContainerAct,
  record: ContainerActRecord,
): ContainerActs {
  return {
    share: act === 'share' ? record : acts.share,
    seal: act === 'seal' ? record : acts.seal,
    release: act === 'release' ? record : acts.release,
    withdrawal: act === 'withdraw' ? record : acts.withdrawal,
    supersession: act === 'supersede' ? record : acts.supersession,
  };
}

// =============================================================================
// Η ΚΡΙΣΗ
// =============================================================================

/**
 * Τι **εμποδίζει** αυτή την πράξη, ή τι χρειάζεται ο γραφέας για να προχωρήσει.
 *
 * 🔑 **Διακριτή ένωση με ΔΥΟ είδη «όχι»**: η άρνηση (`refused`) και το περιττό
 * (`noop`) έχουν **διαφορετική σημασία** για τον καλούντα — το πρώτο θέλει δικαιώματα,
 * το δεύτερο σημαίνει *«έγινε ήδη»*. Ένα κοινό `false` θα τα ισοπέδωνε.
 */
export type TransitionVerdict =
  | {
      readonly ok: true;
      readonly from: ContainerPhase;
      readonly acts: ContainerActs;
      readonly revision: number;
    }
  | { readonly ok: false; readonly outcome: 'refused'; readonly why: ContainerRefusalReason }
  | { readonly ok: false; readonly outcome: 'noop'; readonly why: ContainerNoopReason };

/**
 * **Επιτρέπεται αυτή η πράξη πάνω σε αυτό το έγγραφο;** — καθαρή συνάρτηση.
 *
 * ⚠️ Η **σειρά** είναι συμβόλαιο, τα βήματα (2)-(7) του `transitionContainer`. Το (1)
 * *«υπάρχει;»* και το (4) *«ικανός;»* ζουν στον γραφέα: το πρώτο χρειάζεται δίσκο, το
 * δεύτερο είναι ο **αδελφός κριτής** (ADR-801) και δεν αντιγράφεται εδώ.
 *
 * @param raw Το έγγραφο **όπως βγήκε από τη βάση**, ποτέ στενεμένο.
 */
export function judgeTransition(
  raw: Record<string, unknown>,
  request: ContainerTransitionRequest,
  spec: ActSpec,
): TransitionVerdict {
  const { act, actor } = request;
  const deny = (why: ContainerRefusalReason): TransitionVerdict =>
    ({ ok: false, outcome: 'refused', why });

  // (2) Ξένος μισθωτής — η **ΜΙΑ** σύγκριση (`lib/auth/tenant-ownership`, ADR-742).
  //
  // 🔴 **ΓΙΑΤΙ ΟΧΙ `raw.companyId !== actor.companyId`**: το σχόλιο έλεγε τον σωστό κανόνα
  //    («το κενό δεν είναι tenant») και ο κώδικας από κάτω έκανε το **αντίθετο** — όταν
  //    **και τα δύο** λείπουν, το `!==` δίνει `false`, δηλαδή **περνά**. Ακριβώς το
  //    σφάλμα που το μητρώο καταγράφει ως «a real bug fixed for free» όταν οι τέσσερις
  //    χειρόγραφες μορφές ενοποιήθηκαν. Το κενό είναι **απουσία** μισθωτή, ποτέ ταίριασμα.
  //
  // ⚠️ Ο στενωτής είναι ρητός επειδή το `raw` είναι `Record<string, unknown>`: ό,τι δεν
  //    είναι συμβολοσειρά **είναι** απουσία — ίδιο ιδίωμα με τα `readContainerState`/
  //    `readContainerActs` από κάτω, και **χωρίς** `as` (N.2).
  const docTenant = typeof raw.companyId === 'string' ? raw.companyId : null;
  if (!isPayloadOwnedByCompany({ companyId: docTenant }, actor.companyId)) {
    return deny('tenant-mismatch');
  }

  // (3) Άγνωστη κατάσταση ⇒ fail-closed, **πριν** από κάθε άλλη κρίση.
  const state = readContainerState(raw);
  if (state.phase === 'unreadable') return deny('unreadable');

  // (5) 🔴 Ιδιοκτησία — ποτέ μέσα από τον κριτή ικανότητας.
  if (spec.requiresAuthor) {
    const unmet = authorRequirement(actor.uid, raw.createdBy);
    if (unmet !== null) return deny(unmet);
  }

  // (6) Ιδεμποτησία **πριν** τη φάση: δεύτερη κλήση = ίδιο αποτέλεσμα, καμία γραφή.
  const acts = readContainerActs(raw);
  if (acts[actKey(act)] !== null) return { ok: false, outcome: 'noop', why: 'already-in-state' };
  if (!spec.from.includes(state.phase)) return deny('wrong-phase');

  // (7) Οι προϋποθέσεις της απελευθέρωσης — τα **δύο σκαλοπάτια** του Ε-12.
  const revision = containerRevisionOf(raw);
  if (act === 'release') {
    const unmet = releaseRequirement(acts, revision);
    if (unmet !== null) return deny(unmet);
  }

  return { ok: true, from: state.phase, acts, revision };
}
