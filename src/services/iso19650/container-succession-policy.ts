/**
 * =============================================================================
 * Η ΚΡΙΣΗ ΔΙΑΔΟΧΗΣ — «αντικαθιστά ΠΡΑΓΜΑΤΙ το Β το Α;» (ADR-862 Φ0 Β10)
 * =============================================================================
 *
 * **Το ερώτημα**: ο πελάτης λέει *«ανέβασα νέα έκδοση — το Β παίρνει τη θέση του Α»*. Ο
 * διακομιστής **δεν** το πιστεύει· το **αποδεικνύει** από τα δύο έγγραφα, μέσα στην ίδια
 * συναλλαγή που θα γράψει.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🌐 Η ΠΡΑΚΤΙΚΗ (πρωτογενείς πηγές, 2026-09-17)
 * ─────────────────────────────────────────────────────────────────────────────
 *   Oracle Aconex   «updating a document is called superseding» · «all versions are kept»
 *   Procore         νέα αναθεώρηση ⇒ Revision History· δικαίωμα **Upload Drawings**, όχι admin
 *   Autodesk Docs   version-up με δικαίωμα **Create + Upload**
 *   UK BIM Part C   §6.3 «Continuous Archiving» — το superseded **αρχειοθετείται**, ποτέ σβήνεται
 *
 * ⇒ Η αντικατάσταση είναι **συνέπεια ανεβάσματος**, δικαίωμα **όποιου ανεβάζει** — όχι η
 *   απόσυρση του συντονιστή (`withdraw`), που μένει κρίση με αιτιολογία.
 *
 * 🏆 **Πού ξεπερνάμε**: εκείνοι δένουν «ίδιο έγγραφο» με **όνομα/αριθμό** που γράφει
 * άνθρωπος. Εδώ η διαδοχή απαιτεί **απόδειξη** — ίδια δομική ταυτότητα, ίδιος μισθωτής,
 * έτοιμος και νεότερος διάδοχος, γραμμένος από τον αιτούντα — και κάθε «όχι» έχει **όνομα**.
 *
 * ⚠️ **ΚΑΘΑΡΟ, ΧΩΡΙΣ ΔΙΣΚΟ** — ίδιο δόγμα με το `container-transition-policy.ts`.
 *
 * @module services/iso19650/container-succession-policy
 * @see lib/files/succession-identity — **τι** σημαίνει «ίδιο δοχείο»
 * @see services/iso19650/container-transitions — ο **γραφέας** που ρωτά
 */

import { FILE_LIFECYCLE_STATES, FILE_STATUS } from '@/config/domain-constants';
import { isOwnedByCustody, type CustodyScope } from '@/lib/workspace/custody-scope';
import { successionIdentityOf } from '@/lib/files/succession-identity';

/** Γιατί **δεν** δέχτηκε ο κριτής τη διαδοχή. **Κλειστό σύνολο, ονομασμένο.** */
export type SuccessionRefusalReason =
  /** Το σώμα δεν είπε **ποιος** είναι ο διάδοχος. */
  | 'successor-missing'
  /** Το αρχείο που αντικαθίσταται είναι ήδη στον κάδο / αρχειοθετημένο — δεν «ξαναζωντανεύει». */
  | 'predecessor-not-active'
  /**
   * Ο διάδοχος δεν υπάρχει · ανήκει σε άλλον κάτοχο · **ή ζει σε άλλο διαμέρισμα** (ADR-866) —
   * **ένα** όνομα, κανένα μαντείο ύπαρξης.
   */
  | 'successor-not-found'
  /** Ο διάδοχος δεν ολοκληρώθηκε (`pending`/`failed`) ή είναι διαγραμμένος. */
  | 'successor-not-ready'
  /** Τουλάχιστον ένα από τα δύο **δεν έχει θέση** — «δεν ξέρω» ≠ «ίδιο». */
  | 'identity-absent'
  /** Δύο **διαφορετικά** δοχεία — παραλλαγές, όχι εκδόσεις. */
  | 'identity-mismatch'
  /** Ο «διάδοχος» είναι **παλαιότερος** — η έκδοση δεν γυρίζει πίσω με αντικατάσταση. */
  | 'successor-not-newer'
  /** Ο αιτών **δεν** ανέβασε τον διάδοχο και δεν έχει εξουσία συντονιστή. */
  | 'not-successor-author';

export interface SuccessionQuery {
  /** Το έγγραφο που **αντικαθίσταται**, όπως βγήκε από τη βάση. */
  readonly predecessor: Record<string, unknown>;
  /** Ο διάδοχος, όπως βγήκε από τη βάση — `null` αν δεν υπάρχει. */
  readonly successor: Record<string, unknown> | null;
  readonly predecessorId: string;
  readonly successorId: string | undefined;
  readonly actorUid: string;
  /**
   * **Ο χώρος του αιτούντος** — εταιρεία ή ο ίδιος (ADR-866 §2.6.10 Β4). Ο διάδοχος πρέπει να
   * ζει στον **ίδιο**: μια «έκδοση» που αλλάζει διαμέρισμα δεν είναι έκδοση, είναι μεταφορά.
   */
  readonly actorCustody: CustodyScope;
  /**
   * Έχει ο αιτών εξουσία **συντονιστή** (`iso19650:containers:withdraw`); Τότε αντικαθιστά
   * και έκδοση που ανέβασε **άλλος** — ο υπεύθυνος έργου τακτοποιεί το μητρώο.
   * ⚠️ Το κρίνει ο **ΕΝΑΣ** κριτής (`decideCapability`) στον γραφέα — εδώ φτάνει ως γεγονός.
   */
  readonly actsForOthers: boolean;
}

export type SuccessionVerdict =
  | { readonly ok: true; readonly successorId: string }
  | { readonly ok: false; readonly outcome: 'noop'; readonly why: 'self-succession' | 'already-in-state' }
  | { readonly ok: false; readonly outcome: 'refused'; readonly why: SuccessionRefusalReason };

function text(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/**
 * Χρονοσήμανση σε ms — `Timestamp` του Admin SDK · `Date` · ISO. Άγνωστη μορφή ⇒ `null`.
 *
 * ⚠️ Δομικός έλεγχος (`toMillis`), ποτέ `instanceof Timestamp`: το καθαρό αρχείο **δεν**
 * εισάγει `firebase-admin`, και η άγκυρα το ασκεί με ωμό αντικείμενο.
 */
function millisOf(value: unknown): number | null {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  if (typeof value === 'object' && value !== null && 'toMillis' in value) {
    const toMillis = (value as { toMillis: unknown }).toMillis;
    return typeof toMillis === 'function' ? Number(toMillis.call(value)) : null;
  }
  return null;
}

/** Ενεργό = ούτε κάδος, ούτε αρχείο, ούτε σημαία διαγραφής. */
function isActive(raw: Record<string, unknown>): boolean {
  const lifecycle = raw.lifecycleState;
  const activeLifecycle = lifecycle === undefined || lifecycle === FILE_LIFECYCLE_STATES.ACTIVE;
  return activeLifecycle && raw.isDeleted !== true;
}

/** Τα δύο είναι **το ίδιο δοχείο**; — ονομασμένη απάντηση. */
function identityRefusal(
  predecessor: Record<string, unknown>,
  successor: Record<string, unknown>,
): SuccessionRefusalReason | null {
  const before = successionIdentityOf(predecessor);
  const after = successionIdentityOf(successor);
  if (before === null || after === null) return 'identity-absent';
  return before === after ? null : 'identity-mismatch';
}

/** «Νεότερος» μόνο όταν **και οι δύο** χρόνοι διαβάζονται — αλλιώς δεν αποδεικνύεται. */
function isNewer(predecessor: Record<string, unknown>, successor: Record<string, unknown>): boolean {
  const before = millisOf(predecessor.createdAt);
  const after = millisOf(successor.createdAt);
  return before !== null && after !== null && after >= before;
}

/**
 * **Αντικαθιστά ο διάδοχος το αρχείο;** — καθαρή συνάρτηση.
 *
 * ⚠️ Η **σειρά** είναι συμβόλαιο: ό,τι δεν χρειάζεται τον διάδοχο κρίνεται **πρώτο**, και η
 * άρνηση ύπαρξης προηγείται κάθε κρίσης **περιεχομένου** του — αλλιώς ένα `identity-mismatch`
 * πάνω σε ξένο έγγραφο θα μαρτυρούσε ότι υπάρχει.
 */
export function judgeSuccession(query: SuccessionQuery): SuccessionVerdict {
  const deny = (why: SuccessionRefusalReason): SuccessionVerdict => ({ ok: false, outcome: 'refused', why });
  const { predecessor, successor, successorId } = query;

  if (successorId === undefined || successorId.length === 0) return deny('successor-missing');
  if (successorId === query.predecessorId) return { ok: false, outcome: 'noop', why: 'self-succession' };
  // ♻️ ADR-862 §5.3.7 — ιδεμποτησία **χωρίς** πράξη CDE. Στο καθεστώς `versions-only` δεν γράφεται
  //    `cdeSupersession`, άρα το `already-in-state` του `judgeTransition` δεν πιάνει ποτέ· η απόδειξη ότι
  //    «έγινε ήδη» είναι ο **δεσμός** του ίδιου διαδόχου. ⚠️ **Πριν** το `predecessor-not-active`: ο
  //    προκάτοχος είναι πλέον αρχειοθετημένος, και η δεύτερη κλήση θα έβγαινε ψευδώς άρνηση.
  if (text(predecessor.supersededByFileId) === successorId) {
    return { ok: false, outcome: 'noop', why: 'already-in-state' };
  }
  if (!isActive(predecessor)) return deny('predecessor-not-active');

  // 🔑 ADR-866 §2.6.10 Β4 — **ίδιος κάτοχος**, για τα δύο διαμερίσματα, με **μία** σύγκριση:
  //    ανύπαρκτος · ξένου μισθωτή · ξένου ανθρώπου · **άλλου διαμερίσματος** ⇒ το **ίδιο**
  //    όνομα. Κανένα μαντείο ύπαρξης, και καμία «έκδοση» που δραπετεύει από τον χώρο της.
  if (successor === null || !isOwnedByCustody(successor, query.actorCustody)) {
    return deny('successor-not-found');
  }
  if (successor.status !== FILE_STATUS.READY || !isActive(successor)) return deny('successor-not-ready');

  const identity = identityRefusal(predecessor, successor);
  if (identity !== null) return deny(identity);
  if (!isNewer(predecessor, successor)) return deny('successor-not-newer');

  const authored = text(successor.createdBy) === query.actorUid;
  if (!authored && !query.actsForOthers) return deny('not-successor-author');

  return { ok: true, successorId };
}
