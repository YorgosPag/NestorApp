/**
 * =============================================================================
 * ΤΟ ΛΕΞΙΛΟΓΙΟ ΤΩΝ ΠΡΑΞΕΩΝ ΤΟΥ ΔΟΧΕΙΟΥ — **φύλλο, χωρίς I/O** (ADR-862 Φ0 Β6 · §5.3.7)
 * =============================================================================
 *
 * **Το ερώτημα**: *«Ποιες πράξεις υπάρχουν, ποιος τις ζητά, και ποιες εκβάσεις έχουν;»*
 *
 * ⚠️ **ΓΙΑΤΙ ΞΕΧΩΡΙΣΤΟ ΑΡΧΕΙΟ**: η πολιτική (`container-transition-policy.ts`) είχε φτάσει
 * 487/500 γραμμές (N.7.1) και το καθεστώς δοχείου (§5.3.7) πρόσθετε έκβαση και άρνηση. Η τομή
 * ακολουθεί το μάθημα του `role-catalogue.ts`: *«κάτω τα δεδομένα, πάνω οι ερωτήσεις»* — εδώ
 * **καμία** εισαγωγή τιμής (μόνο `import type`), άρα κανένας κύκλος αρχικοποίησης (CHECK 3.80).
 *
 * 🔑 Οι καταναλωτές **δεν** άλλαξαν: η πολιτική και ο γραφέας **επανεξάγουν** αυτούς τους τύπους.
 *
 * @module services/iso19650/container-transition-vocabulary
 * @see services/iso19650/container-transition-policy — η **κρίση**
 * @see services/iso19650/container-regime-policy — το **καθεστώς** (φάσεις ή μόνο εκδόσεις)
 */

import type { AuthContext } from '@/lib/auth';
import type { CdeState, SuitabilityCode } from '@/config/iso19650-constants';
import type { CapabilitySubject } from '@/types/capability-authority';
import type { ContainerPhase } from '@/types/container-access';
import type { CustodyScope } from '@/lib/workspace/custody-scope';
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
 * Ποιος ζητά την πράξη, **και σε ποιον χώρο**.
 *
 * ⚠️ **Ταυτότητα ήδη επαληθευμένη** — το `AuthContext` του `withAuth` (εταιρεία) ή ο `uid` του
 * `withPersonalOrOrgAuth` (άνθρωπος). Κανένας από τους δύο μας **δεν** διαβάζει κανάλι και
 * **δεν** εμπιστεύεται είσοδο πελάτη.
 */
export interface ContainerActor extends CapabilitySubject {
  readonly uid: string;
  /**
   * 🔑 **Ο χώρος στον οποίο πράττει** — εταιρεία `{ companyId }` ή ο ίδιος `{ userId }`
   * (ADR-866 §2.6.10 Β3).
   *
   * 🔴 **ΟΧΙ το `companyId` του {@link CapabilitySubject}**: εκείνο είναι **πληροφορία** για τον
   * κριτή ικανότητας· αυτό είναι **κριτήριο ιδιοκτησίας**. Και ο πολίτης **δεν έχει και δεν
   * επιτρέπεται να αποκτήσει** οργανισμό (ADR-787 Ε-3 §3), άρα ένα υποχρεωτικό `companyId: string`
   * θα έκανε την προσωπική έκδοση **δομικά αδύνατη** — όχι απλώς απαγορευμένη.
   *
   * ⚠️ **Ένωση, ποτέ `string | null`**: το `null` θα «ταίριαζε» με κενό `companyId` εγγράφου —
   * η παγίδα του κενού (ADR-742 §4), μετρημένη ως ζωντανό σφάλμα. Η σύγκριση γίνεται **μία**
   * φορά, στο `isOwnedByCustody`.
   */
  readonly custody: CustodyScope;
}

/**
 * **Ο αιτών, από ήδη επαληθευμένη ταυτότητα** — μία κατασκευή για κάθε διαδρομή που ζητά πράξη.
 *
 * 🔑 ADR-801 Φ3γ — οι **ρητά δοσμένες** ικανότητες του claim ταξιδεύουν μαζί. Χωρίς αυτές, η
 * προ-εξουσιοδότηση του Ε-12 (απελευθέρωση σε ονομασμένο μελετητή) θα ήταν γραμμένη και
 * **ανενεργή**: ο κριτής θα έκρινε μόνο από ρόλο.
 *
 * ⚠️ Εξήχθη όταν τη χρειάστηκε **δεύτερη** διαδρομή (ADR-862 Φ0 Β10: η δημοσίευση μοντέλου
 * αρχειοθετεί τους προκατόχους) — δεύτερο χειρόγραφο αντίγραφο θα ήταν ο N.18. Ζει **εδώ**
 * (ADR-866 2β.3β) επειδή ο γραφέας έφτασε 494/500 (N.7.1) και ο τύπος του δράστη ζει ήδη εδώ·
 * ο γραφέας την **επανεξάγει**, ώστε κανένας καταναλωτής να μην αλλάξει εισαγωγή.
 */
export function containerActorOf(ctx: AuthContext): ContainerActor {
  return {
    uid: ctx.uid,
    custody: { companyId: ctx.companyId },
    globalRole: ctx.globalRole,
    permissions: ctx.permissions,
  };
}

/**
 * **Ο αιτών στον ΔΙΚΟ ΤΟΥ χώρο** — ADR-866 Ε-Φ0-1, από την πόρτα `withPersonalOrOrgAuth`.
 *
 * 🔴 **ΚΑΝΕΝΑΣ ΡΟΛΟΣ, ΚΑΝΕΝΑ `permissions` — ΚΑΙ ΕΙΝΑΙ ΑΠΟΦΑΣΗ, ΟΧΙ ΠΑΡΑΛΕΙΨΗ.** Στον προσωπικό
 * χώρο η **εξουσία ΕΙΝΑΙ η ιδιοκτησία** (Google Drive: ο κάτοχος διαχειρίζεται τις εκδόσεις του
 * χωρίς κανέναν ρόλο). Ο πολίτης **δεν έχει** οργανισμό ⇒ δεν έχει `iso19650:containers:*`, και
 * claim που θα του το έδινε δεν υπάρχει να δοθεί. Γι' αυτό ο `transitionContainer` **δεν** ρωτά
 * τον κριτή ικανότητας σε αυτόν τον χώρο: τον αντικαθιστά ο κριτής **κατόχου** του βήματος (2),
 * που είναι αυστηρότερος — ταυτότητα εγγράφου↔δράστη, **καμία** παράκαμψη ρόλου.
 *
 * ⚠️ Ίδιο δόγμα με το `createPersonalOwnershipDecision` και το `judgeStorageCustody`: *«bypass
 * εδώ θα έδινε μέσω διακομιστή ό,τι ο κανόνας `files_personal` αρνείται»*.
 */
export function personalContainerActorOf(uid: string): ContainerActor {
  return { uid, custody: { userId: uid } };
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
  /**
   * 🔑 ADR-862 §5.3.7 — πράξη **φάσης** (share · seal · release · withdraw) σε δοχείο που **δεν**
   * λύνεται σε έργο. Χωρίς μέλη δεν υπάρχει κανείς να δει τη φάση ⇒ το αρχείο θα γινόταν αόρατο σε
   * όλους. Procore/ProjectWise: ροή μόνο όπου υπάρχει ομάδα — εκτός, μόνο εκδόσεις.
   */
  | 'no-project'
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
  /**
   * 🔑 ADR-862 §5.3.7 — **διαδοχή χωρίς φάση**: δοχείο εκτός έργου πήρε νέα έκδοση. Ο προκάτοχος
   * αρχειοθετήθηκε και δέθηκε με τον διάδοχο, **χωρίς** `cdeState` — μένει `pre-cde`, ορατός όπως
   * σήμερα στο ιστορικό του. Ξεχωριστό είδος και όχι `transitioned`: δεν υπάρχει `to: CdeState` να
   * ειπωθεί, και ένα ψεύτικο `SUPERSEDED` θα ήταν ακριβώς το σφάλμα που αυτό κλείνει.
   */
  | {
      readonly kind: 'succeeded';
      readonly fileId: string;
      readonly act: 'supersede';
      readonly supersededByFileId: string;
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

/**
 * **Τα είδη έκβασης όπου η νέα έκδοση πήρε τη θέση της παλιάς** — διαδοχή **με** φάση
 * (`transitioned`) **και** χωρίς φάση (`succeeded`, ADR-862 §5.3.7).
 *
 * 🔑 **Ένας ορισμός για κάθε καταναλωτή** (πελάτης · προαγωγή έκδοσης · δημοσίευση μοντέλου): αν ο
 * καθένας έγραφε `kind === 'transitioned'`, η διαδοχή εκτός έργου θα διαβαζόταν **σιωπηλά** ως αποτυχία.
 */
const SUPERSESSION_DONE_KINDS = ['transitioned', 'succeeded'] as const satisfies readonly ContainerTransitionOutcome['kind'][];

/** Το ίδιο ερώτημα πάνω σε **σύρμα** (`kind` αδιάβαστο από JSON) — ο πελάτης δεν έχει τον τύπο. */
export function isSupersessionDoneKind(kind: unknown): boolean {
  return (SUPERSESSION_DONE_KINDS as readonly unknown[]).includes(kind);
}

/**
 * **Πήρε η νέα έκδοση τη θέση της παλιάς;** — πάνω σε έκβαση του γραφέα.
 * Φρουρός τύπου: στον άλλο κλάδο ο καλών κρατά **μόνο** `noop` | `refused` (με `why`).
 */
export function isSupersessionDone(
  outcome: ContainerTransitionOutcome,
): outcome is Extract<ContainerTransitionOutcome, { kind: (typeof SUPERSESSION_DONE_KINDS)[number] }> {
  return isSupersessionDoneKind(outcome.kind);
}
