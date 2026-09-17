/**
 * =============================================================================
 * ΤΟ ΣΥΝΟΡΟ ΑΝΑΓΝΩΣΗΣ ΤΟΥ ΔΟΧΕΙΟΥ (ADR-862 Φ0 · CHECK 3.74)
 * =============================================================================
 *
 * **Ο ΕΝΑΣ μετασχηματιστής** `raw → FileRecord`, και **ο ΕΝΑΣ αναγνώστης** της
 * κατάστασης CDE. Ό,τι άλλο γράφει `snap.data() as FileRecord` παρακάμπτει τον
 * φρουρό — γι' αυτό το αρχείο γίνεται γραμμή στον πίνακα `BOUNDARIES`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΕΙΝΑΙ ΒΑΡΥΤΕΡΟ ΑΠΟ ΤΑ ΤΡΙΑ ΠΡΟΗΓΟΥΜΕΝΑ ΣΥΝΟΡΑ
 * ─────────────────────────────────────────────────────────────────────────────
 * Τα σύνορα του ADR-839/842/841 φυλάνε **ΟΘΟΝΗ**: ένα πεδίο που λείπει βγαίνει
 * λευκή σελίδα. Εδώ ένα πεδίο που λείπει δίνει **ΟΡΑΤΟΤΗΤΑ**:
 *
 *   `cdeState === undefined` διαβασμένο ως `'WIP'`       ⇒ κρύβει εγκεκριμένο σχέδιο
 *   `cdeState === undefined` διαβασμένο ως `'PUBLISHED'` ⇒ δείχνει ημιτελή μελέτη
 *                                                          στο **συνεργείο**
 *
 * Το ωμό `as FileRecord` επιτρέπει **και τα δύο**. Γι' αυτό η απουσία εδώ είναι
 * **ονομασμένη κατάσταση** (`pre-cde`), όχι προεπιλογή.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔑 Η ΑΛΗΘΕΙΑ ΕΙΝΑΙ ΟΙ ΠΡΑΞΕΙΣ — ΤΟ `cdeState` ΕΙΝΑΙ ΠΡΟΒΟΛΗ ΤΟΥΣ
 * ─────────────────────────────────────────────────────────────────────────────
 * Ο {@link readContainerState} **ξαναπαράγει** την κατάσταση από τις τέσσερις
 * πράξεις και τη **συγκρίνει** με το αποθηκευμένο πεδίο. Διαφωνία ⇒ `unreadable`
 * ⇒ άρνηση. Δηλαδή η «δεύτερη αλήθεια» του ADR-749 δεν απαγορεύεται με σχόλιο —
 * γίνεται **μη κερδοφόρα με μηχανισμό**: όποιος γράψει `'PUBLISHED'` στο χέρι
 * παίρνει κλειστή πόρτα, όχι ανοιχτή.
 *
 * ⚠️ **Ανεκτικός αναγνώστης, αυστηρός γραφέας** — ίδιο ιδίωμα με το
 * `lib/agency/showcase-read.ts`: ό,τι δεν καταλαβαίνουμε **δεν μαντεύεται**.
 *
 * @module lib/files/file-record-read
 * @see types/container-access — το λεξιλόγιο και ο τύπος της έκβασης
 * @see lib/agency/showcase-read — το πρότυπο του θεματοφύλακα
 * @see ADR-787 Κ-4 · ADR-862 Φ0
 */

import { trimmedStringOrNull as text } from '@/lib/type-guards';
import type { CdeState, SuitabilityCode } from '@/config/iso19650-constants';
import { readReachFor } from '@/lib/auth/container-read-reach';
import { fieldToISO } from '@/lib/date-local';
// ⚠️ ΟΙ ΥΠΑΡΧΟΝΤΕΣ ΦΡΟΥΡΟΙ ΤΥΠΟΥ — ΟΧΙ ΔΕΥΤΕΡΟΙ (N.0 «ACTIVATION > CREATION»).
//    Η πρώτη γραφή αυτού του αρχείου τους απέφυγε επικαλούμενη «αντιστροφή
//    στρωμάτων» (`lib/` → `services/`). **Μετρήθηκε και ήταν λάθος**: το `src/lib/**`
//    εισάγει από `@/services/**` σε **100** σημεία. Χωρίς αυτή την εισαγωγή οι δύο
//    φρουροί έμεναν **χωρίς κανέναν καταναλωτή** — δηλαδή θα είχα γράψει νεκρό
//    κώδικα ΚΑΙ διπλό έλεγχο, στο αρχείο που υπάρχει για να τα αποτρέπει.
import { isCdeReadReach, isCdeState, isSuitabilityCode } from '@/services/iso19650/validators';
import { isFileRecord, type FileRecord } from '@/types/file-record';
import type {
  ContainerActRecord,
  ContainerActs,
  ContainerFacts,
  ContainerState,
  FileRecordRead,
} from '@/types/container-access';

// =============================================================================
// ΑΤΟΜΑ
// =============================================================================


/** Πεπερασμένος αριθμός, αλλιώς `null` — το `NaN` **δεν** είναι αναθεώρηση. */
function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * Μία πράξη κατάστασης, ή `null`.
 *
 * ⚠️ **Και τα τρία υποχρεωτικά μαζί** (`by` · `at` · `revision`): πράξη χωρίς
 * αναθεώρηση δεν μπορεί να απαντήσει *«σε ποια έκδοση;»*, δηλαδή είναι ακριβώς η
 * σφραγίδα που «ισχύει για πάντα» — η μετάλλαξη που η άγκυρα Α17 απαγορεύει.
 */
function readAct(raw: unknown): ContainerActRecord | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const source = raw as Record<string, unknown>;

  const by = text(source.by);
  const revision = finiteNumber(source.revision);
  const at = source.at;
  const hasAt = at instanceof Date || typeof at === 'string';
  if (by === null || revision === null || !hasAt) return null;

  const act: {
    by: string;
    at: Date | string;
    revision: number;
    suitabilityCode?: SuitabilityCode;
    reason?: string;
  } = { by, at: at as Date | string, revision };

  // ⚠️ Ο φρουρός **στενεύει** τον τύπο — κανένα `as`. Ένα cast εδώ θα έλεγε στον
  //    μεταγλωττιστή «εμπιστέψου με» για τιμή που ήρθε **από τη βάση**.
  const suitability = text(source.suitabilityCode);
  if (isSuitabilityCode(suitability)) {
    act.suitabilityCode = suitability;
  }
  const reason = text(source.reason);
  if (reason !== null) act.reason = reason;

  return act;
}

/**
 * Η πράξη **αντικατάστασης** — μια πράξη **με διάδοχο**, ή `null` (ADR-862 Φ0 Β10).
 *
 * ⚠️ Χωρίς `supersededByFileId` **δεν** είναι πράξη αντικατάστασης: «κάτι με αντικατέστησε»
 * χωρίς **τι** είναι ακριβώς το κενό που το πεδίο υπάρχει για να κλείσει.
 */
function readSupersession(raw: unknown): ContainerActRecord | null {
  const act = readAct(raw);
  if (act === null || typeof raw !== 'object' || raw === null) return null;
  const successor = text((raw as Record<string, unknown>).supersededByFileId);
  return successor === null ? null : { ...act, supersededByFileId: successor };
}

/** Οι πέντε πράξεις του δοχείου, όπως διαβάστηκαν. */
export function readContainerActs(raw: Record<string, unknown>): ContainerActs {
  return {
    share: readAct(raw.cdeShare),
    seal: readAct(raw.cdeSeal),
    release: readAct(raw.cdeRelease),
    withdrawal: readAct(raw.cdeWithdrawal),
    supersession: readSupersession(raw.cdeSupersession),
  };
}

// =============================================================================
// Η ΚΑΤΑΣΤΑΣΗ — ΑΝΑΓΝΩΣΗ **ΚΑΙ** ΕΠΑΛΗΘΕΥΣΗ
// =============================================================================

/** Έχει το έγγραφο έστω μία πράξη κατάστασης; */
function hasAnyAct(acts: ContainerActs): boolean {
  return (
    acts.share !== null ||
    acts.seal !== null ||
    acts.release !== null ||
    acts.withdrawal !== null ||
    acts.supersession !== null
  );
}

const unreadableState = (why: string): ContainerState => ({ phase: 'unreadable', why });

/**
 * **Η ΜΙΑ ανάγνωση της κατάστασης — και η επαλήθευση ΚΑΙ ΤΩΝ ΔΥΟ προβολών.**
 *
 * 🔑 ADR-862 Φ0 Β11: η `cdeReadReach` είναι **δεύτερη προβολή** της ίδιας φάσης (ο
 * φράχτης του κανόνα). Ο θεματοφύλακας την **ξαναπαράγει και συγκρίνει**, όπως κάνει
 * με το `cdeState`: διαφωνία ⇒ `unreadable` ⇒ άρνηση. Χωρίς αυτό, χειρόγραφο
 * `cdeReadReach: 'tenant'` σε WIP θα **άνοιγε** τον φράχτη σε όλο το γραφείο ενώ ο
 * κριτής θα έλεγε «μόνο ομάδα» — δύο αλήθειες.
 * ⚠️ **Απούσα** τιμή είναι ανεκτή: τα έγγραφα πριν τη μετανάστευση του Β11 δεν τη
 * φέρουν, και ο κανόνας `get` τη διαβάζει με προεπιλογή `tenant` («όπως σήμερα»).
 *
 * @param raw Το έγγραφο **όπως βγήκε από τη βάση**, ποτέ στενεμένο.
 */
export function readContainerState(raw: Record<string, unknown>): ContainerState {
  const state = deriveContainerState(raw);
  const stored = raw.cdeReadReach;
  if (stored === undefined || state.phase === 'unreadable') return state;
  if (!isCdeReadReach(stored)) return unreadableState('read-reach-outside-vocabulary');
  return stored === readReachFor(state.phase) ? state : unreadableState('read-reach-mismatch');
}

/** Η φάση από `cdeState` + πράξεις — χωρίς την εμβέλεια (βλ. {@link readContainerState}). */
function deriveContainerState(raw: Record<string, unknown>): ContainerState {
  const acts = readContainerActs(raw);
  const teamId = text(raw.cdeTeamId);
  const declared = raw.cdeState;
  const revision = finiteNumber(raw.revision) ?? 0;

  // ── ΑΠΟΥΣΙΑ ────────────────────────────────────────────────────────────────
  if (declared === undefined || declared === null || declared === '') {
    // 🔴 Πράξη χωρίς δηλωμένη κατάσταση = μισοτελειωμένη γραφή. Οι δύο γραφές
    //    (πράξη + προβολή) είναι **ατομικές** στον `container-transitions`, άρα
    //    αυτό δεν παράγεται ποτέ νόμιμα.
    if (hasAnyAct(acts)) {
      return unreadableState('act-without-declared-state');
    }
    return { phase: 'pre-cde' };
  }

  // Ο ίδιος φρουρός που χρησιμοποιούσε ο ταξινομητής πριν τη Φ0 — μία ερώτηση,
  // ένα λεξιλόγιο. Στενεύει `unknown → CdeState` χωρίς cast.
  if (!isCdeState(declared)) {
    return unreadableState('state-outside-vocabulary');
  }
  const phase: CdeState = declared;

  // ── ΟΙ ΤΕΣΣΕΡΙΣ ΦΑΣΕΙΣ ─────────────────────────────────────────────────────
  switch (phase) {
    case 'WIP':
      // Η κατάσταση **γέννησης** — δεν την παράγει πράξη, άρα δεν επαληθεύεται
      // από πράξη. Η ομάδα μπορεί να λείπει· το «ποιος τη βλέπει» το κρίνει ο
      // κριτής, όχι ο αναγνώστης.
      return { phase: 'WIP', teamId };

    case 'SHARED':
      // Η παράδοση **είναι** πράξη (ADR-787 Α5). Χωρίς αυτήν, κάποιος έγραψε την
      // ετικέτα απευθείας.
      if (acts.share === null) return unreadableState('shared-without-share-act');
      return { phase: 'SHARED', teamId };

    case 'PUBLISHED': {
      // 🔒 ΔΥΟ ΣΚΑΛΟΠΑΤΙΑ, ΚΑΙ ΤΑ ΔΥΟ ΣΤΗΝ **ΙΔΙΑ** ΑΝΑΘΕΩΡΗΣΗ (ADR-862 Ε-12).
      if (acts.seal === null) return unreadableState('published-without-seal');
      if (acts.release === null) return unreadableState('published-without-release');
      if (acts.seal.revision !== revision || acts.release.revision !== revision) {
        // «Σφράγισα την P01, δημοσιεύτηκε η P02» — μετάλλαξη (α) της Α17.
        return unreadableState('published-revision-moved');
      }
      return { phase: 'PUBLISHED', teamId, revision };
    }

    case 'SUPERSEDED':
      // ⚠️ ΜΕΤΡΗΜΕΝΗ ΜΕΤΑΝΑΣΤΕΥΣΗ (ζωντανή βάση, 2026-09-16): **2** έγγραφα φέρουν
      //    `cdeState: 'SUPERSEDED'` **χωρίς** πράξη απόσυρσης — τα έγραψε ο
      //    `supersedeFileRecord` **πριν** τη Φ0. Η απόδειξή τους είναι ο **διάδοχος**
      //    (`supersededByFileId`), που ο ίδιος γραφέας βάζει στην ίδια εγγραφή.
      //    ⛔ Χωρίς αυτόν τον κλάδο θα γίνονταν `unreadable`, δηλαδή **αόρατα** —
      //    συμπέρασμα από τον **ΓΡΑΦΕΑ**, όχι μαντεψιά (πρότυπο `showcase-read`).
      // 🔑 ADR-862 Φ0 Β10: τρίτη απόδειξη — η πράξη **αντικατάστασης** του γραφέα.
      if (
        acts.withdrawal === null &&
        acts.supersession === null &&
        text(raw.supersededByFileId) === null
      ) {
        return unreadableState('superseded-without-evidence');
      }
      return { phase: 'SUPERSEDED', teamId };
  }
}

// =============================================================================
// Η ΚΑΤΑΛΛΗΛΟΤΗΤΑ — **ΠΑΡΑΓΕΤΑΙ**, ΔΕΝ ΔΙΑΒΑΖΕΤΑΙ
// =============================================================================

/**
 * Ο κωδικός «permitted use» του BS 1192 / ISO 19650 §6.1.
 *
 * 🔴 **ΔΕΝ διαβάζει το αποθηκευμένο `suitabilityCode`** — το **υπολογίζει**. Αν
 * διαβαζόταν, μια τιμή γραμμένη με το χέρι θα έλεγε «Για Κατασκευή» σε σχέδιο που
 * κανείς δεν σφράγισε· ίδιο ακριβώς σκεπτικό με το `standing` του
 * `showcase-read.ts` (*«ο φρουρός θα ήταν παρακάμψιμος με μία λέξη σε ένα JSON»*).
 *
 * 🌐 Οι «fixed relationships» του προτύπου: *«information containers with S1 or S2
 * metadata are in the Shared state, whereas A4/A5/A6 are in the Published state»*.
 *
 * ⚠️ Επιστρέφει `null` όπου το πρότυπο **δεν** ορίζει χρήση — και το `null` είναι
 * απάντηση, όχι κενό.
 */
export function deriveSuitability(
  state: ContainerState,
  acts: ContainerActs,
): SuitabilityCode | null {
  switch (state.phase) {
    case 'PUBLISHED':
      // Ο **δημιουργός** δηλώνει τη χρήση στη σφραγίδα του· απουσία ⇒ «Για Κατασκευή».
      return acts.seal?.suitabilityCode ?? 'IFC';
    case 'SHARED':
      return 'IFR';
    case 'SUPERSEDED':
      // Ό,τι ίσχυε όταν αποσύρθηκε — το ιστορικό δεν ξαναγράφεται.
      return acts.seal?.suitabilityCode ?? null;
    case 'WIP':
    case 'pre-cde':
    case 'unreadable':
      return null;
  }
}

// =============================================================================
// Ο ΦΡΟΥΡΟΣ ΤΟΥ ΣΥΝΟΡΟΥ
// =============================================================================

/**
 * **`raw` → `FileRecord`**, ή `null`. **Κανονικοποίηση και τίποτα άλλο.**
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ ΕΙΝΑΙ ΧΩΡΙΣΤΟ ΑΠΟ ΤΟΝ {@link readFileRecord} — ΚΑΙ ΓΙΑΤΙ ΑΥΤΟ ΕΙΝΑΙ
 *    Η ΣΩΣΤΗ ΣΧΕΔΙΑΣΗ, ΟΧΙ ΣΥΜΒΙΒΑΣΜΟΣ
 * ─────────────────────────────────────────────────────────────────────────────
 * Η βιομηχανική πρακτική έχει όνομα: **ασυμμετρία προβολής/μετάλλαξης** —
 * *ανεκτικός στην προβολή, αυστηρός στη μετάλλαξη*. Το να διαβάσεις ένα
 * αλλοιωμένο έγγραφο «σαν να μην υπάρχει» και μετά να γράψεις από πάνω του
 * **καταστρέφει σιωπηλά** ό,τι θα μπορούσε να σωθεί· η άρνηση κοστίζει **μία**
 * παραλειπόμενη πράξη και **ένα ορατό σφάλμα**.
 *
 * ⇒ Δύο ερωτήσεις, **ΕΝΑΣ** μετασχηματιστής:
 *
 *   `normalizeFileRecord`  → λίστες & οθόνες  (~90 σημεία) — **καμία** αλλαγή ορατότητας
 *   `readFileRecord`       → μεταλλάξεις                    — `unreadable` ⇒ **άρνηση**
 *
 * 🔴 **ΜΗΝ κάνεις τον {@link readFileRecord} καθολικό.** Αν οι λίστες γίνονταν
 * φρουρημένες αναγνώσεις, έγγραφο με ασυνεπές `cdeState` θα **εξαφανιζόταν** από
 * ~90 σημεία — παραβίαση της κεντρικής αρχής της Φ0: *«σε κάθε ενδιάμεσο σημείο η
 * παραγωγή δουλεύει, επειδή το «απόν» σημαίνει παντού «όπως σήμερα»»*. Η απόκρυψη
 * ανήκει στο **Β11**, πίσω από τον κανόνα, όχι εδώ.
 *
 * ⚠️ **Ταυτόσημο με το προηγούμενο `toFileRecord`** (`services/file-record-queries.ts`),
 * που πλέον **delegate**-άρει εδώ: ο κανόνας `Timestamp→ISO` απέκτησε **ένα** σπίτι.
 *
 * @param raw Ό,τι επέστρεψε το `snapshot.data()`.
 * @param fileId Εφεδρικό κλειδί όταν το έγγραφο δεν κουβαλά `id` **μέσα** του.
 */
export function normalizeFileRecord(raw: unknown, fileId?: string): FileRecord | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const source = raw as Record<string, unknown>;

  const normalized = {
    ...source,
    id: (source.id ?? fileId) as string,
    createdAt: fieldToISO(source, 'createdAt') || source.createdAt,
    updatedAt: fieldToISO(source, 'updatedAt') || source.updatedAt,
  };

  return isFileRecord(normalized) ? normalized : null;
}

/**
 * **`raw` → `FileRecord` + κατάσταση**, ή ονομασμένη αποτυχία.
 *
 * 🔒 **Η φρουρημένη πόρτα** — για κάθε διαδρομή που πρόκειται να **γράψει**. Το
 * ISO 19650 το λέει ρητά: *«any change requires the opening of a new revision that
 * restarts the cycle from the WIP state»* ⇒ η αναθεώρηση **ΕΙΝΑΙ** μετάβαση
 * κατάστασης, άρα ο γραφέας **οφείλει** να ρωτήσει πρώτα.
 *
 * @param raw Ό,τι επέστρεψε το `snapshot.data()`.
 * @param fileId Το κλειδί — για την καταγραφή του `unreadable`.
 */
export function readFileRecord(raw: unknown, fileId: string): FileRecordRead {
  if (typeof raw !== 'object' || raw === null) {
    return { outcome: 'unreadable', fileId, why: 'not-an-object' };
  }
  const source = raw as Record<string, unknown>;

  const normalized = normalizeFileRecord(source, fileId);
  if (normalized === null) {
    return { outcome: 'unreadable', fileId, why: 'shape-guard-rejected' };
  }

  const state = readContainerState(source);
  if (state.phase === 'unreadable') {
    // 🔒 Η κατάσταση που δεν διαβάζεται **δεν** επιστρέφεται ως έγγραφο: ο καλών
    //    θα έπρεπε αλλιώς να θυμηθεί να την ελέγξει, και «ανάθεση σε άνθρωπο που
    //    πρέπει να θυμάται δεν είναι φρουρός».
    return { outcome: 'unreadable', fileId, why: state.why };
  }

  return { outcome: 'record', record: normalized, state };
}

/**
 * Η **γέφυρα** προς τον κριτή — τα γεγονότα που χρειάζεται, τίποτα παραπάνω.
 *
 * ⚠️ Το `companyId` περνά ως `null` όταν λείπει: **το κενό δεν είναι tenant, είναι
 * απουσία tenant** (ADR-742 §4 — η «παγίδα του κενού», μετρημένη σε έξι σημεία).
 */
export function containerFactsOf(record: FileRecord, state: ContainerState): ContainerFacts {
  return {
    fileId: record.id,
    companyId: text(record.companyId),
    createdBy: record.createdBy,
    state,
  };
}
