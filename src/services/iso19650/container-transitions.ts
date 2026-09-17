/**
 * =============================================================================
 * ΟΙ ΤΕΣΣΕΡΙΣ ΟΝΟΜΑΣΜΕΝΕΣ ΠΡΑΞΕΙΣ ΤΟΥ ΔΟΧΕΙΟΥ — **ο ΕΝΑΣ γραφέας** (ADR-862 Φ0 Β6)
 * =============================================================================
 *
 * **Το ερώτημα**: *«Ποιος αλλάζει την κατάσταση ενός δοχείου πληροφορίας, και πώς;»*
 * **Ο απαντητής**: αυτό το αρχείο. Κανένα άλλο.
 *
 * ⚠️ Η **πολιτική** (λεξιλόγιο · πίνακας πράξεων · κρίση · παραγωγή) ζει στο
 * `container-transition-policy.ts` — **καθαρή, χωρίς δίσκο**. Εδώ μένει μόνο ό,τι
 * **γράφει**. Δες εκεί γιατί η τομή έχει αυτή την κατεύθυνση.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 Η ΚΑΤΑΣΤΑΣΗ ΕΙΝΑΙ **ΠΡΑΞΗ**, ΟΧΙ ΠΕΔΙΟ (AIP-216 output-only)
 * ─────────────────────────────────────────────────────────────────────────────
 * Πριν τη Φ0 το `cdeState` ήταν **ελεύθερο dropdown** (`file-record-links.ts:239`).
 * Δηλαδή ο φρουρός της ορατότητας άνοιγε με **ένα κλικ**: κάποιος διάλεγε
 * «Εγκεκριμένο» και η ημιτελής μελέτη έφευγε στο συνεργείο. Το Β3 έκλεισε το
 * dropdown, το Β4 πάγωσε τη γραφή στους κανόνες, και **εδώ** γεννιέται ο μόνος
 * δρόμος που απομένει.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔑 ΑΤΟΜΙΚΟΤΗΤΑ: ΠΡΑΞΗ **ΚΑΙ** ΠΡΟΒΟΛΗ ΣΕ **ΜΙΑ** `update()`
 * ─────────────────────────────────────────────────────────────────────────────
 * Η **αλήθεια** είναι οι τέσσερις πράξεις· το `cdeState` είναι **αποθηκευμένη
 * προβολή** τους, που υπάρχει μόνο επειδή ο κανόνας Firestore δεν επιτρέπεται να
 * κάνει `get()` (*«rules are not filters»*). Δύο γραφές θα άφηναν:
 *
 *   πράξη **χωρίς** προβολή ⇒ ο θεματοφύλακας λέει `act-without-declared-state`
 *                             ⇒ `unreadable` ⇒ **αόρατο αρχείο**
 *   προβολή **χωρίς** πράξη ⇒ `shared-without-share-act` ⇒ το ίδιο
 *
 * ⇒ **Μία** `transaction.update()`. Η συναλλαγή δίνει επιπλέον **CAS**: αν κάποιος
 * ανεβάσει νέα αναθεώρηση ανάμεσα στην ανάγνωση και τη γραφή, η πράξη ακυρώνεται
 * αντί να σφραγίσει έκδοση που κανείς δεν είδε.
 *
 * @module services/iso19650/container-transitions
 * @enterprise ADR-862 Φ0 Β6 · ADR-373 · ADR-787 Α5/Κ-4
 * @see services/iso19650/container-transition-policy — η **πολιτική** (καθαρή)
 * @see lib/files/file-record-read — ο θεματοφύλακας που **ξαναπαράγει** την κατάσταση
 * @see lib/auth/container-access  — ο κριτής της **ορατότητας** (άλλο ερώτημα)
 */

import 'server-only';

import type { DocumentReference, Transaction } from 'firebase-admin/firestore';

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FILE_LIFECYCLE_STATES } from '@/config/domain-constants';
import { nowISO } from '@/lib/date-local';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import { safeFireAndForget } from '@/lib/safe-fire-and-forget';
import { decideCapability } from '@/lib/auth/authority';
import { isGranted } from '@/types/capability-authority';
import { recordFileAudit } from '@/services/file-audit-admin.service';
import type { AuthContext } from '@/lib/auth';
import {
  ACT_SPEC,
  buildAct,
  judgeTransition,
  projectionFor,
  withAct,
  type ActSpec,
  type ContainerActor,
  type ContainerRefusalReason,
  type ContainerTransitionOutcome,
  type ContainerTransitionRequest,
} from './container-transition-policy';
import { judgeSuccession } from './container-succession-policy';

// ⚠️ **ΔΥΟ ΓΡΑΜΜΕΣ, ΟΧΙ ΜΙΑ** (ADR-806 §7 #1): το `export … from` **επανεξάγει, δεν
//    εισάγει**, άρα το `import` από πάνω είναι ξεχωριστό και απαραίτητο. Η επανεξαγωγή
//    κρατά **ανέγγιχτους** τους καταναλωτές (διαδρομή · άγκυρα), που εισάγουν από εδώ.
export type {
  ContainerAct,
  ContainerActor,
  ContainerNoopReason,
  ContainerProjection,
  ContainerRefusalReason,
  ContainerTransitionOutcome,
  ContainerTransitionRequest,
} from './container-transition-policy';
export { deriveCdeState, judgeTransition, projectionFor } from './container-transition-policy';

const logger = createModuleLogger('ContainerTransitions');

/**
 * **Ο αιτών, από ήδη επαληθευμένη ταυτότητα** — μία κατασκευή για κάθε διαδρομή που ζητά πράξη.
 *
 * 🔑 ADR-801 Φ3γ — οι **ρητά δοσμένες** ικανότητες του claim ταξιδεύουν μαζί. Χωρίς αυτές, η
 * προ-εξουσιοδότηση του Ε-12 (απελευθέρωση σε ονομασμένο μελετητή) θα ήταν γραμμένη και
 * **ανενεργή**: ο κριτής θα έκρινε μόνο από ρόλο.
 *
 * ⚠️ Εξήχθη όταν τη χρειάστηκε **δεύτερη** διαδρομή (ADR-862 Φ0 Β10: η δημοσίευση μοντέλου
 * αρχειοθετεί τους προκατόχους) — δεύτερο χειρόγραφο αντίγραφο θα ήταν ο N.18.
 */
export function containerActorOf(ctx: AuthContext): ContainerActor {
  return {
    uid: ctx.uid,
    companyId: ctx.companyId,
    globalRole: ctx.globalRole,
    permissions: ctx.permissions,
  };
}

// =============================================================================
// Η ΓΡΑΦΗ
// =============================================================================

/**
 * 🗄️ **Η ΑΡΧΕΙΟΘΕΤΗΣΗ ΤΗΣ ΑΝΤΙΚΑΤΑΣΤΑΣΗΣ** — στην **ίδια** `update()` με την πράξη (ADR-862 Φ0 Β10).
 *
 * 🔴 **ΑΡΧΕΙΟ, ΠΟΤΕ ΚΑΔΟΣ.** Μέχρι το Β10 η αντικατάσταση έστελνε το παλιό **στον κάδο με
 * `purgeAt`**, και το `file-purge.job` το **διέγραφε οριστικά**. Το UK BIM Framework (Part C
 * §6.3, «Continuous Archiving») και το Aconex («all versions are kept») λένε το αντίθετο: το
 * superseded είναι **αρχείο συμβατικής πληροφορίας** — χωρίς αυτό δεν ανασυντίθεται παλιά έκδοση
 * όταν προκύψει διαφορά. ⇒ `archived` (κρύβεται από τις ενεργές λίστες, φαίνεται στα
 * «Αρχειοθετημένα») **χωρίς** `isDeleted`/`purgeAt` ⇒ **δομικά** εκτός οριστικής διαγραφής.
 *
 * ⚠️ `supersededByFileId` **και** στο ρηχό πεδίο: το διαβάζουν ήδη η οθόνη και ο θεματοφύλακας
 * (κληρονομιά)· η πράξη το κουβαλά επίσης, ώστε η απόδειξη να μη χωρίζεται ποτέ από το ίχνος.
 */
function archivalFieldsOf(
  request: ContainerTransitionRequest,
  at: Date | string,
): Record<string, unknown> {
  return {
    supersededByFileId: request.supersededByFileId,
    supersededAt: at,
    lifecycleState: FILE_LIFECYCLE_STATES.ARCHIVED,
    archivedAt: at,
    archivedBy: request.actor.uid,
  };
}

/**
 * **Η ΜΙΑ γραφή** — πράξη **και** προβολή, μαζί.
 *
 * 🔑 Ο γραφέας δεν ξέρει **τίποτα** για την παραγωγή: τη ζητά από το
 * {@link projectionFor} και τη γράφει στο **ίδιο** `update()`. Έτσι η ατομικότητα
 * παύει να είναι θέμα προσοχής και γίνεται **σχήμα**.
 */
function writeTransition(
  transaction: Transaction,
  ref: DocumentReference,
  request: ContainerTransitionRequest,
  spec: ActSpec,
  verdict: Extract<ReturnType<typeof judgeTransition>, { ok: true }>,
): ContainerTransitionOutcome {
  const record = buildAct(request, verdict.revision);
  const nextActs = withAct(verdict.acts, request.act, record);
  const projection = projectionFor(nextActs, verdict.revision);

  transaction.update(ref, {
    [spec.field]: record,
    cdeState: projection.cdeState,
    // Η αποθηκευμένη καταλληλότητα είναι **προβολή για ανάγνωση/εξαγωγή**· η αυθεντία
    // μένει το `deriveSuitability`. Γράφεται μόνο όταν το πρότυπο **ορίζει** χρήση —
    // `null` σημαίνει «δεν ορίζεται», όχι «σβήσ' το».
    ...(projection.suitabilityCode === null
      ? {}
      : { suitabilityCode: projection.suitabilityCode }),
    ...(request.act === 'supersede' ? archivalFieldsOf(request, record.at) : {}),
    updatedAt: nowISO(),
  });

  return {
    kind: 'transitioned',
    fileId: request.fileId,
    act: request.act,
    from: verdict.from,
    to: projection.cdeState,
    revision: verdict.revision,
  };
}

// =============================================================================
// Ο ΓΡΑΦΕΑΣ
// =============================================================================

/**
 * **Η ΜΙΑ πόρτα** — μία πράξη, μία συναλλαγή, μία `update()`.
 *
 * 🔴 **Η ΣΕΙΡΑ ΕΙΝΑΙ ΣΥΜΒΟΛΑΙΟ**:
 *   1. υπάρχει;            ⇒ `not-found`
 *   2. δικός μας μισθωτής; ⇒ `tenant-mismatch`   ┐
 *   3. διαβάζεται;         ⇒ `unreadable`        │
 *   5. ιδιοκτήτης;         ⇒ `not-author`        ├ {@link judgeTransition} (καθαρά)
 *   6. σωστή φάση;         ⇒ `wrong-phase`/`noop`│
 *   7. προϋποθέσεις;       ⇒ `seal-missing` …    ┘
 *   4. **ικανός;**         ⇒ `not-capable`  — ο ΕΝΑΣ κριτής (ADR-801), **πριν** τη βάση
 *   8. **ΜΙΑ** `update()`  — πράξη **και** προβολή
 *
 * ⚠️ Το (4) κρίνεται **πρώτο χρονικά** και **πριν** αγγίξουμε τον δίσκο: είναι καθαρό
 * και σύγχρονο, οπότε μια άρνηση ικανότητας **δεν** κοστίζει ανάγνωση.
 */
export async function transitionContainer(
  request: ContainerTransitionRequest,
): Promise<ContainerTransitionOutcome> {
  const spec = ACT_SPEC[request.act];

  // (4) Ο αδελφός κριτής — καθαρός, σύγχρονος, χωρίς I/O.
  if (!isGranted(decideCapability({ subject: request.actor, action: spec.capability }).verdict)) {
    return refusal(request, 'not-capable');
  }

  // 🔑 Β10 — ο συντονιστής (εξουσία απόσυρσης) τακτοποιεί και εκδόσεις **άλλων**. Κρίνεται
  //    από τον **ΕΝΑ** κριτή, εδώ, και φτάνει στην καθαρή κρίση ως γεγονός.
  const actsForOthers =
    request.act === 'supersede' &&
    isGranted(decideCapability({ subject: request.actor, action: ACT_SPEC.withdraw.capability }).verdict);

  try {
    const outcome = await runTransition(request, spec, actsForOthers);
    if (outcome.kind === 'transitioned') recordTrace(request, outcome);
    return outcome;
  } catch (error: unknown) {
    // ⚠️ Πραγματική **βλάβη** (δίκτυο, σύγκρουση που δεν έκλεισε) — ποτέ άρνηση
    //    πολιτικής. Οι δύο δεν επιτρέπεται να μοιάσουν: η μία λύνεται με δικαιώματα,
    //    η άλλη με επανάληψη.
    logger.error('Η μετάβαση δοχείου απέτυχε', {
      fileId: request.fileId,
      act: request.act,
      error: getErrorMessage(error),
    });
    throw error;
  }
}

/** Η άρνηση, **μία φορά** — ώστε να μην ξαναγράφεται σε κάθε σημείο που κόβει. */
function refusal(
  request: ContainerTransitionRequest,
  why: ContainerRefusalReason,
): ContainerTransitionOutcome {
  return { kind: 'refused', fileId: request.fileId, act: request.act, why };
}

/**
 * Τα βήματα (1)-(8) **μέσα σε μία συναλλαγή**.
 *
 * 🔑 Η συναλλαγή δίνει **CAS**: αν κάποιος ανεβάσει νέα αναθεώρηση ανάμεσα στην
 * ανάγνωση και τη γραφή, το σώμα **ξαναεκτελείται** και η σφραγίδα δεν προλαβαίνει να
 * αποδοθεί σε έκδοση που κανείς δεν είδε.
 */
function runTransition(
  request: ContainerTransitionRequest,
  spec: ActSpec,
  actsForOthers: boolean,
): Promise<ContainerTransitionOutcome> {
  const db = getAdminFirestore();
  const ref = db.collection(COLLECTIONS.FILES).doc(request.fileId);

  return db.runTransaction<ContainerTransitionOutcome>(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) return refusal(request, 'not-found');

    const raw = (snapshot.data() ?? {}) as Record<string, unknown>;
    const verdict = judgeTransition(raw, request, spec);
    if (!verdict.ok) {
      return verdict.outcome === 'noop'
        ? { kind: 'noop', fileId: request.fileId, act: request.act, why: verdict.why }
        : refusal(request, verdict.why);
    }

    if (request.act === 'supersede') {
      const blocked = await successionBlock(transaction, raw, request, actsForOthers);
      if (blocked !== null) return blocked;
    }

    return writeTransition(transaction, ref, request, spec, verdict);
  });
}

/**
 * 🔁 **Η απόδειξη διαδοχής — ΜΕΣΑ στη συναλλαγή** (ADR-862 Φ0 Β10).
 *
 * 🔑 Ο διάδοχος διαβάζεται με το **ίδιο** `transaction.get`: αν διαγραφεί ή αλλάξει ανάμεσα
 * στην κρίση και τη γραφή, η συναλλαγή **ξαναεκτελείται** και κρίνει ξανά. Μια ανάγνωση **έξω**
 * από τη συναλλαγή θα έδινε αρχειοθέτηση υπέρ διαδόχου που **ήδη δεν υπάρχει**.
 *
 * @returns `null` όταν η διαδοχή αποδείχθηκε· αλλιώς η **ονομασμένη** έκβαση.
 */
async function successionBlock(
  transaction: Transaction,
  predecessor: Record<string, unknown>,
  request: ContainerTransitionRequest,
  actsForOthers: boolean,
): Promise<ContainerTransitionOutcome | null> {
  const successorId = request.supersededByFileId;
  const successorSnap =
    successorId === undefined || successorId === request.fileId
      ? null
      : await transaction.get(getAdminFirestore().collection(COLLECTIONS.FILES).doc(successorId));

  const verdict = judgeSuccession({
    predecessor,
    successor: successorSnap?.exists ? ((successorSnap.data() ?? {}) as Record<string, unknown>) : null,
    predecessorId: request.fileId,
    successorId,
    actorUid: request.actor.uid,
    actorCompanyId: request.actor.companyId,
    actsForOthers,
  });
  if (verdict.ok) return null;
  return verdict.outcome === 'noop'
    ? { kind: 'noop', fileId: request.fileId, act: request.act, why: verdict.why }
    : refusal(request, verdict.why);
}

// =============================================================================
// ΤΟ ΗΜΕΡΟΛΟΓΙΟ — ΜΕΤΑ ΤΟ COMMIT, ΜΗ-ΜΠΛΟΚΑΡΟΝ
// =============================================================================

/**
 * ⚠️ **ΟΧΙ μέσα στη συναλλαγή** (ADR-862 §5.7, δόγμα `recordMembershipGrantAudit`): το
 * σώμα ξαναεκτελείται σε σύγκρουση, άρα παρενέργεια μέσα του φεύγει **πολλές φορές**.
 * Και η αποτυχία του **δεν** επιτρέπεται να ακυρώσει σφραγίδα που έγινε.
 *
 * 🔑 **Δεν χάνεται τίποτα νομικά**: το αυθεντικό ίχνος *(ποιος · πότε · ποια
 * αναθεώρηση)* είναι το `cdeSeal` **πάνω στο έγγραφο**, γραμμένο **ατομικά** στο (8)
 * και αμετάβλητο από τους κανόνες (Β4). Αυτό εδώ είναι η **προβολή** του.
 */
function recordTrace(
  request: ContainerTransitionRequest,
  outcome: Extract<ContainerTransitionOutcome, { kind: 'transitioned' }>,
): void {
  safeFireAndForget(
    recordFileAudit({
      fileId: outcome.fileId,
      action: ACT_SPEC[outcome.act].audit,
      performedBy: request.actor.uid,
      companyId: request.actor.companyId,
      metadata: {
        from: outcome.from,
        to: outcome.to,
        revision: outcome.revision,
        ...(request.suitabilityCode === undefined
          ? {}
          : { suitabilityCode: request.suitabilityCode }),
        ...(request.reason === undefined ? {} : { reason: request.reason }),
        ...(request.supersededByFileId === undefined
          ? {}
          : { supersededByFileId: request.supersededByFileId }),
      },
    }),
    'ContainerTransitions.recordTrace',
    { fileId: outcome.fileId, act: outcome.act },
  );
}
