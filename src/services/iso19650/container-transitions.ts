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

import type { CollectionReference, DocumentReference, Firestore, Transaction } from 'firebase-admin/firestore';

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FILE_COLLECTION } from '@/lib/files/file-custody';
import { custodyScopeFromData } from '@/lib/workspace/custody-scope';
import { FILE_LIFECYCLE_STATES } from '@/config/domain-constants';
import { nowISO } from '@/lib/date-local';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import { safeFireAndForget } from '@/lib/safe-fire-and-forget';
import { decideCapability } from '@/lib/auth/authority';
import { isGranted } from '@/types/capability-authority';
import { recordFileAudit } from '@/services/file-audit-admin.service';
import type { FileAuditAction, FileAuditMetadata } from '@/types/file-audit';
import {
  ACT_SPEC,
  buildAct,
  judgeTransition,
  projectionFor,
  withAct,
  type ActSpec,
  type ContainerRefusalReason,
  type ContainerTransitionOutcome,
  type ContainerTransitionRequest,
} from './container-transition-policy';
import { judgeSuccession } from './container-succession-policy';
import { custodyOnEntry, type ContainerCustodyFields } from './container-custody';
import { regimeRefusal } from './container-regime-policy';

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
// ⚠️ Οι **κατασκευαστές δράστη** εξήχθησαν στο λεξιλόγιο (N.7.1: ο γραφέας έφτασε 494/500 με το
//    ADR-866 2β.3β) — εκεί που ζει ήδη ο τύπος `ContainerActor`. Επανεξάγονται ώστε οι δύο
//    υπάρχουσες διαδρομές να μείνουν **ανέγγιχτες**.
export { containerActorOf, personalContainerActorOf } from './container-transition-vocabulary';

const logger = createModuleLogger('ContainerTransitions');

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
  custody: ContainerCustodyFields,
): ContainerTransitionOutcome {
  const record = buildAct(request, verdict.revision);
  const nextActs = withAct(verdict.acts, request.act, record);
  const projection = projectionFor(nextActs, verdict.revision);

  transaction.update(ref, {
    [spec.field]: record,
    cdeState: projection.cdeState,
    // ADR-862 Φ0 Β11 — ο φράχτης του κανόνα ακολουθεί τη φάση ΑΤΟΜΙΚΑ: ανάμεσα σε δύο
    // update() θα υπήρχε στιγμή «WIP με φράχτη γραφείου» (ή SHARED αόρατο στις λίστες).
    cdeReadReach: projection.cdeReadReach,
    // Η αποθηκευμένη καταλληλότητα είναι **προβολή για ανάγνωση/εξαγωγή**· η αυθεντία
    // μένει το `deriveSuitability`. Γράφεται μόνο όταν το πρότυπο **ορίζει** χρήση —
    // `null` σημαίνει «δεν ορίζεται», όχι «σβήσ' το».
    ...(projection.suitabilityCode === null
      ? {}
      : { suitabilityCode: projection.suitabilityCode }),
    ...(request.act === 'supersede' ? archivalFieldsOf(request, record.at) : {}),
    // ADR-862 Φ0 Β14 — έργο/ομάδα που σφραγίστηκαν στην είσοδο στο CDE (κενό αλλιώς).
    ...custody,
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

/**
 * 🔁 **Η ΜΙΑ γραφή της διαδοχής ΧΩΡΙΣ φάση** — δοχείο εκτός έργου (ADR-862 §5.3.7).
 *
 * 🔑 Γράφει **μόνο** τα ουδέτερα πεδία διαδοχής ({@link archivalFieldsOf}): δεσμός · χρόνος ·
 * αρχειοθέτηση · ποιος. **Κανένα** `cde*`: ο προκάτοχος μένει `pre-cde` ⇒ ο θεματοφύλακας τον
 * διαβάζει «όπως σήμερα», η στοίβα εκδόσεων τον βρίσκει από τον δεσμό, και κανείς κριτής δεν ζητά
 * μέλος έργου που δεν υπάρχει.
 *
 * ⚠️ **Όχι `cdeSupersession`**: πράξη CDE χωρίς `cdeState` = `act-without-declared-state` ⇒ **αόρατο**.
 * Η απόδειξη *(ποιος · πότε · ποιος διάδοχος)* είναι ήδη πλήρης στα ουδέτερα πεδία.
 */
function writeSuccession(
  transaction: Transaction,
  ref: DocumentReference,
  request: ContainerTransitionRequest,
  supersededByFileId: string,
): ContainerTransitionOutcome {
  transaction.update(ref, {
    ...archivalFieldsOf({ ...request, supersededByFileId }, nowISO()),
    updatedAt: nowISO(),
  });
  return { kind: 'succeeded', fileId: request.fileId, act: 'supersede', supersededByFileId };
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
  // 🔑 ADR-866 — ο προσωπικός χώρος **δεν έχει οργανισμό**, άρα ούτε ικανότητες οργανισμού.
  //    Εκεί η εξουσία είναι η **ιδιοκτησία** (βήμα 2) — δες `personalContainerActorOf`.
  const organisational = request.actor.custody.userId === undefined;

  // (4) Ο αδελφός κριτής — καθαρός, σύγχρονος, χωρίς I/O. **Μόνο** για εταιρικό χώρο.
  if (organisational && !isGranted(decideCapability({ subject: request.actor, action: spec.capability }).verdict)) {
    return refusal(request, 'not-capable');
  }

  // 🔑 Β10 — ο συντονιστής (εξουσία απόσυρσης) τακτοποιεί και εκδόσεις **άλλων**. Κρίνεται
  //    από τον **ΕΝΑ** κριτή, εδώ, και φτάνει στην καθαρή κρίση ως γεγονός.
  // 🔴 **Ποτέ στον προσωπικό χώρο**: δεν υπάρχει συντονιστής σε φάκελο ενός ανθρώπου ⇒ ο
  //    διάδοχος πρέπει να είναι **δικός του** (`not-successor-author`), χωρίς εξαίρεση.
  const actsForOthers =
    organisational &&
    request.act === 'supersede' &&
    isGranted(decideCapability({ subject: request.actor, action: ACT_SPEC.withdraw.capability }).verdict);

  try {
    const outcome = await runTransition(request, spec, actsForOthers);
    recordTrace(request, outcome);
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

/**
 * 🗂️ **ΤΟ ΔΙΑΜΕΡΙΣΜΑ ΤΟΥ ΑΙΤΗΜΑΤΟΣ** — από τον **κάτοχο του δράστη**, ποτέ από δεύτερη δήλωση
 * (ADR-866 §2.6.10): ο δράστης πράττει σε **έναν** χώρο, το έγγραφο ζει σε **έναν** χώρο, και ο
 * κριτής (βήμα 2, `isOwnedByCustody`) απαιτεί να είναι **ο ίδιος**. Δεύτερο πεδίο `custody` στο
 * αίτημα θα μπορούσε να διαφωνήσει με τον δράστη — και τότε θα διαβάζαμε στο ένα διαμέρισμα ό,τι
 * κρίναμε για το άλλο.
 *
 * 🔴 **`COLLECTIONS[FILE_COLLECTION[kind]]` ΕΔΩ, ΟΧΙ ΠΕΡΙΤΥΛΙΓΜΑ** (`lib/files/file-custody`): οι
 * πύλες 3.15 (δείκτες) · 3.35 (μισθωτής) · 3.87 (CDE) διαβάζουν **αυτή** τη μορφή και ελέγχουν
 * έναν κλάδο ανά κάτοχο. Συνάρτηση-περιτύλιγμα τις ξανάκανε τυφλές.
 */
function filesOf(db: Firestore, request: ContainerTransitionRequest): CollectionReference {
  const kind = request.actor.custody.userId !== undefined ? 'personal' : 'company';
  return db.collection(COLLECTIONS[FILE_COLLECTION[kind]]);
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
  const ref = filesOf(db, request).doc(request.fileId);

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

    const succession =
      request.act === 'supersede' ? await successionBlock(transaction, raw, request, actsForOthers) : null;
    if (succession !== null && succession.blocked !== null) return succession.blocked;

    // 🔑 Β14 — έργο + ομάδα στην είσοδο στο CDE, **και** το καθεστώς (§5.3.7) από την ΙΔΙΑ
    //    ανάλυση. **Αναγνώσεις**, άρα πριν από κάθε εγγραφή.
    const entry = await custodyOnEntry(transaction, db, raw, verdict.from, request.actor);
    const outsideRegime = regimeRefusal(request.act, entry.regime);
    if (outsideRegime !== null) return refusal(request, outsideRegime);

    // 🔑 Ο διάδοχος γεννιέται ΜΟΝΟ αφού κριθεί, στην ΙΔΙΑ συναλλαγή με την αρχειοθέτηση
    //    του προκατόχου: καμία στιγμή με δύο ενεργές εκδόσεις της ίδιας θέσης. Κληρονομεί
    //    ό,τι σφραγίστηκε μόλις — αλλά ό,τι δηλώνει **ήδη** η εγγραφή του νικά.
    if (succession !== null && succession.birth !== null) {
      transaction.set(succession.birth.ref, { ...entry.fields, ...succession.birth.record });
    }

    if (entry.regime.kind === 'versions-only' && succession !== null) {
      return writeSuccession(transaction, ref, request, succession.successorId);
    }
    return writeTransition(transaction, ref, request, spec, verdict, entry.fields);
  });
}

/**
 * 🔁 **Η απόδειξη διαδοχής — ΜΕΣΑ στη συναλλαγή** (ADR-862 Φ0 Β10).
 *
 * 🔑 Ο διάδοχος διαβάζεται με το **ίδιο** `transaction.get`: αν διαγραφεί ή αλλάξει ανάμεσα
 * στην κρίση και τη γραφή, η συναλλαγή **ξαναεκτελείται** και κρίνει ξανά. Μια ανάγνωση **έξω**
 * από τη συναλλαγή θα έδινε αρχειοθέτηση υπέρ διαδόχου που **ήδη δεν υπάρχει**.
 *
 * 🍼 **Γέννηση στη συναλλαγή** (`successorBirth`): αν ο διάδοχος **δεν** υπάρχει ακόμη ως
 * FileRecord (λείπει ή είναι μόνο το claim του Storage, χωρίς μισθωτή), κρίνεται **η εγγραφή
 * που θα γραφτεί** — και επιστρέφεται για να γραφτεί **μόνο** αν η κρίση περάσει. Αν υπάρχει
 * ήδη πλήρης (επανάληψη), κρίνεται **αυτή**, και δεν ξαναγράφεται τίποτα.
 *
 * @returns `blocked: null` όταν η διαδοχή αποδείχθηκε· αλλιώς η **ονομασμένη** έκβαση.
 */
async function successionBlock(
  transaction: Transaction,
  predecessor: Record<string, unknown>,
  request: ContainerTransitionRequest,
  actsForOthers: boolean,
): Promise<SuccessionJudgement> {
  const successorId = request.supersededByFileId;
  // 🔑 Ο διάδοχος ζητείται στο **ίδιο** διαμέρισμα με τον προκάτοχο: «έκδοση» που αλλάζει
  //    διαμέρισμα δεν είναι έκδοση. Ό,τι ζει αλλού φαίνεται ως `successor-not-found`.
  const successorRef =
    successorId === undefined || successorId === request.fileId
      ? null
      : filesOf(getAdminFirestore(), request).doc(successorId);
  const successorSnap = successorRef === null ? null : await transaction.get(successorRef);
  const stored = successorSnap?.exists ? ((successorSnap.data() ?? {}) as Record<string, unknown>) : null;
  // Claim του Storage (`public-upload.service`) = ύπαρξη **χωρίς κάτοχο** — ΟΧΙ FileRecord.
  // 🔴 ADR-866 §2.6.10 Β5: εδώ ρωτούσε `typeof stored.companyId === 'string'`, που σε προσωπικό
  //    διάδοχο είναι **πάντα false** ⇒ ο γραφέας θα τον θεωρούσε αγέννητο και θα τον **ξανάγραφε
  //    πάνω του**, σβήνοντας πεδία. «Γεννημένο» = **έχει κάτοχο**, με το κοινό σύνορο.
  const born = stored !== null && custodyScopeFromData(stored) !== null;
  const birth = request.successorBirth !== undefined && !born && successorRef !== null
    ? { ref: successorRef, record: request.successorBirth }
    : null;

  const verdict = judgeSuccession({
    predecessor,
    successor: birth !== null ? { ...birth.record } : stored,
    predecessorId: request.fileId,
    successorId,
    actorUid: request.actor.uid,
    actorCustody: request.actor.custody,
    actsForOthers,
  });
  if (verdict.ok) return { blocked: null, birth, successorId: verdict.successorId };
  return {
    blocked: verdict.outcome === 'noop'
      ? { kind: 'noop', fileId: request.fileId, act: request.act, why: verdict.why }
      : refusal(request, verdict.why),
    birth: null,
  };
}

/** Η έκβαση της κρίσης διαδοχής: άρνηση/noop **ή** (προαιρετική) γέννηση προς εγγραφή. */
type SuccessionJudgement =
  | { readonly blocked: ContainerTransitionOutcome; readonly birth: null }
  | {
      readonly blocked: null;
      readonly birth: { readonly ref: DocumentReference; readonly record: Readonly<Record<string, unknown>> } | null;
      /** Ο **αποδεδειγμένος** διάδοχος — ποτέ ο ισχυρισμός του σώματος. */
      readonly successorId: string;
    };

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
function recordTrace(request: ContainerTransitionRequest, outcome: ContainerTransitionOutcome): void {
  const trace = traceOf(request, outcome);
  if (trace === null) return;
  // 🔶 ADR-866 2β.4 — **το `FILE_AUDIT_LOG` δεν έχει προσωπικό διαμέρισμα** (ο `recordFileAudit`
  //    απαιτεί μη κενό `companyId`, και ο αναγνώστης φιλτράρει `where('companyId','==',…)`). Μια
  //    γραμμή με ψεύτικη ή κενή εταιρεία θα ήταν **αόρατη** — δηλαδή ίχνος που κανείς δεν διαβάζει,
  //    με το κόστος να μοιάζει γραμμένο. ⇒ Σιωπή **δηλωμένη**, ίδιο δόγμα με το `logForCustody`
  //    (2β.2) και το `recordPurgeAudit` (2β.3α). Ο φρουρός φεύγει στο 2β.4, μαζί με τους άλλους δύο.
  const { custody } = request.actor;
  if (custody.userId !== undefined) return;
  safeFireAndForget(
    recordFileAudit({
      fileId: outcome.fileId,
      action: trace.action,
      performedBy: request.actor.uid,
      companyId: custody.companyId,
      metadata: trace.metadata,
    }),
    'ContainerTransitions.recordTrace',
    { fileId: outcome.fileId, act: outcome.act },
  );
}

/**
 * **Τι καταγράφεται** για κάθε έκβαση — `null` όταν δεν έγινε τίποτα (noop · άρνηση).
 *
 * 🔑 ADR-862 §5.3.7: διαδοχή **χωρίς** φάση ⇒ `version_supersede`, **ποτέ** `cde_supersede` — το
 * ημερολόγιο δεν επιτρέπεται να ισχυριστεί μετάβαση ISO 19650 που δεν έγινε.
 */
function traceOf(
  request: ContainerTransitionRequest,
  outcome: ContainerTransitionOutcome,
): { readonly action: FileAuditAction; readonly metadata: FileAuditMetadata } | null {
  if (outcome.kind === 'succeeded') {
    return { action: 'version_supersede', metadata: { supersededByFileId: outcome.supersededByFileId } };
  }
  if (outcome.kind !== 'transitioned') return null;
  return {
    action: ACT_SPEC[outcome.act].audit,
    metadata: {
      from: outcome.from,
      to: outcome.to,
      revision: outcome.revision,
      ...(request.suitabilityCode === undefined ? {} : { suitabilityCode: request.suitabilityCode }),
      ...(request.reason === undefined ? {} : { reason: request.reason }),
      ...(request.supersededByFileId === undefined
        ? {}
        : { supersededByFileId: request.supersededByFileId }),
    },
  };
}
