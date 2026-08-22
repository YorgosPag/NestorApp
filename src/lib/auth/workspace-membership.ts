/**
 * «Επιτρέπεται αυτός ο άνθρωπος να ενεργήσει σε αυτόν τον χώρο;» — η απόφαση, μία φορά
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΤΟ ΚΕΝΟ ΠΟΥ ΚΛΕΙΝΕΙ (ADR-787 §5.1, μετρημένο 2026-08-22)
 * ─────────────────────────────────────────────────────────────────────────────
 * Το ADR-787 §2.8 κατέγραψε ότι ο `SuperAdminCompanyContext` είναι *«ήδη η σωστή
 * αρχιτεκτονική: ο πελάτης ζητά → ο διακομιστής αποφασίζει»*. Το **σχήμα** ήταν
 * σωστό· η **απόφαση** όχι:
 *
 * ```ts
 * // auth-context.ts, πριν από αυτό το αρχείο:
 * if (!isRoleBypass(claims.globalRole)) return claims.companyId;
 * return request.headers.get('x-super-admin-company-id');   // ← καμία ερώτηση μέλους
 * ```
 *
 * Δηλαδή ο διακομιστής **επικύρωνε τον ρόλο** και μετά δεχόταν **οποιαδήποτε**
 * τιμή. Ο έλεγχος *«είναι μέλος;»* **δεν υπήρχε πουθενά** στην πλατφόρμα.
 *
 * ⇒ Αυτό το αρχείο **δεν γενικεύει υπάρχοντα ελεγκτή· δίνει στον υπάρχοντα
 * σκελετό τον ελεγκτή που του λείπει.**
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Η ΣΕΙΡΑ ΕΙΝΑΙ ΣΥΜΒΟΛΑΙΟ — ΚΑΙ ΕΙΝΑΙ ΚΑΙ Η ΑΠΑΝΤΗΣΗ ΣΤΟ ΚΟΣΤΟΣ
 * ─────────────────────────────────────────────────────────────────────────────
 * Το **ανοιχτό #3 του Ε-5** ρωτούσε *«τι κοστίζει ο έλεγχος μέλους σε κάθε
 * αίτημα;»*. Απαντιέται **δωρεάν** από τη σειρά:
 *
 *   1. ιδιωτικός χώρος **δικός σου**            ⇒ `self`             — 0 αναγνώσεις
 *   2. ιδιωτικός χώρος **ΑΛΛΟΥ**                ⇒ `not-a-member`     — 0 αναγνώσεις
 *   3. ο χώρος του **υπογεγραμμένου token**     ⇒ `home`             — 0 αναγνώσεις
 *   4. ρόλος **bypass** (μόνο σε χώρο γραφείου) ⇒ `platform-bypass`  — 0 αναγνώσεις
 *   5. οτιδήποτε άλλο                           ⇒ **μία** ανάγνωση
 *
 * Η **συνήθης** περίπτωση είναι η (3): ο άνθρωπος δουλεύει στον δικό του χώρο,
 * και το **υπογεγραμμένο από τη Firebase token είναι ήδη η απόδειξη** (Ε-5 §2).
 * Πληρώνει **μόνο** το αίτημα που ζητά **ξένο** χώρο.
 *
 * ⛔ **ΜΗΝ ΒΑΛΕΙΣ CACHE ΜΕ ΧΡΟΝΟ ΛΗΞΗΣ** για να «βελτιστοποιήσεις». Το Zanzibar
 *    της Google ονομάζει αυτή τη βλάβη *«new enemy problem»*: ένα TTL cache
 *    εξουσιοδότησης κρατά ζωντανή μια **ανακληθείσα** πρόσβαση για όσο ζει η
 *    εγγραφή του — δηλαδή **σπάει** το *«η ανάκληση είναι ΑΜΕΣΗ»* του
 *    **ADR-787 Ε-2 §5**. Με τη σειρά παραπάνω ο πειρασμός δεν γεννιέται καν.
 *    Η μόνη απομνημόνευση εδώ είναι **ανά αίτημα** (ζει λιγότερο από την
 *    ανάκληση, εξ ορισμού).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΙ ΔΕΝ ΚΑΝΕΙ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ: ΔΕΝ ΑΠΟΦΑΣΙΖΕΙ ΤΙ ΦΕΥΓΕΙ ΣΤΟ ΣΥΡΜΑ
 * ─────────────────────────────────────────────────────────────────────────────
 * Επιστρέφει **πάντα την αλήθεια** — ξεχωριστά το `not-a-member` από το
 * `suspended` από το `unknown`. **Τι από αυτή την αλήθεια βλέπει ο χρήστης** το
 * αποφασίζει το **σύνορο HTTP**, με το υπάρχον `concealCrossTenant`
 * (`tenant-ownership.ts`, ADR-742): σε ξένο χώρο η απάντηση προς τα έξω είναι
 * *«δεν υπάρχει»*, ποτέ *«υπάρχει αλλά δεν επιτρέπεσαι»* — αλλιώς η διεύθυνση
 * γίνεται **όργανο απαρίθμησης** (ADR-787 Ε-5 §4 #1).
 *
 * ⚠️ Είναι **άλλη ερώτηση** από το `tenant-ownership.ts`, και γι' αυτό είναι
 *    άλλο αρχείο: εκείνο ρωτά *«ανήκει αυτό το **ΕΓΓΡΑΦΟ** στον χώρο μου;»*·
 *    εδώ ρωτάμε *«ανήκει αυτός ο **ΑΝΘΡΩΠΟΣ** σε αυτόν τον χώρο;»*. Ένωσή τους
 *    θα ανέφερε αποτυχία **ιδιότητας μέλους** ως αποτυχία **απομόνωσης**.
 *
 * @module lib/auth/workspace-membership
 * @see docs/centralized-systems/reference/adrs/ADR-787-multi-organization-platform.md §5.1
 */

import 'server-only';

import { getAdminFirestore, isFirebaseAdminAvailable } from '@/lib/firebaseAdmin';
import { COLLECTIONS, SUBCOLLECTIONS } from '@/config/firestore-collections';
import { isRoleBypass } from './roles';
import { createModuleLogger } from '@/lib/telemetry';
import {
  workspaceRefKey,
  type MembershipDecision,
  type MembershipVerdict,
  type WorkspaceMembership,
  type WorkspaceMembershipStatus,
  type WorkspaceRef,
} from '@/types/workspace-membership';

const logger = createModuleLogger('workspace-membership');

// =============================================================================
// ΕΙΣΟΔΟΣ
// =============================================================================

/**
 * Ό,τι χρειάζεται η απόφαση — και **τίποτα παραπάνω**.
 *
 * ⚠️ Δέχεται **τα διαπιστευτήρια ξεχωριστά** και όχι ολόκληρο το `AuthContext`,
 * επίτηδες: το `AuthContext` **περιέχει ήδη** το αποτέλεσμα αυτής της απόφασης
 * (`companyId`), οπότε ένας απαντητής που το δεχόταν θα μπορούσε να κρίνει
 * χρησιμοποιώντας **τη δική του παλιά απάντηση** — κύκλωμα που βγαίνει πράσινο
 * χωρίς να ρωτήσει τίποτα.
 */
export interface MembershipQuery {
  /** Ο άνθρωπος, από το υπογεγραμμένο token. */
  readonly uid: string;
  /** Ο χώρος που **δηλώνει το token** — η αυθεντία, όχι επιλογή του πελάτη. */
  readonly claimCompanyId: string;
  /** Ο καθολικός ρόλος, από το υπογεγραμμένο token. */
  readonly globalRole: string;
  /** Ο χώρος που **ζητά** ο πελάτης — αναξιόπιστη είσοδος (Ε-5). */
  readonly requested: WorkspaceRef;
  /**
   * Προαιρετική **ανά-αίτημα** απομνημόνευση.
   * ⛔ Ποτέ καθολικό `Map`: σε serverless θα ζούσε ανάμεσα σε **διαφορετικούς
   *    ανθρώπους** (ίδια πειθαρχία με το `PermissionCache` του `permissions.ts`).
   */
  readonly cache?: Map<string, MembershipDecision>;
}

// =============================================================================
// Η ΑΠΟΦΑΣΗ
// =============================================================================

/**
 * Απαντά **μία** από τις επτά ετυμηγορίες του `MembershipVerdict`.
 *
 * Άγνωστη κατάσταση ⇒ **ρίχνει με όνομα** (fail-closed): μια απόφαση
 * εξουσιοδότησης που «πέφτει έξω» σιωπηλά είναι χειρότερη από άρνηση.
 */
export async function decideMembership(query: MembershipQuery): Promise<MembershipDecision> {
  const { requested, cache } = query;
  const key = workspaceRefKey(requested);

  const memo = cache?.get(key);
  if (memo) return memo;

  const decision = await computeDecision(query);
  cache?.set(key, decision);
  return decision;
}

async function computeDecision(query: MembershipQuery): Promise<MembershipDecision> {
  const { uid, claimCompanyId, globalRole, requested } = query;

  // ── 1+2. Ο ΙΔΙΩΤΙΚΟΣ ΧΩΡΟΣ — και η αυστηρότερη γραμμή όλου του αρχείου ────
  if (requested.kind === 'personal') {
    return {
      verdict: requested.userId === uid ? 'self' : 'not-a-member',
      workspace: requested,
    };
  }

  // ── 3. Ο ΧΩΡΟΣ ΤΟΥ ΙΔΙΟΥ ΤΟΥ TOKEN ───────────────────────────────────────
  // Το token είναι υπογεγραμμένο από τη Firebase και επαληθευμένο ήδη από το
  // `verifyIdToken`/`verifySessionCookie`. Δεύτερη ανάγνωση εδώ δεν θα πρόσθετε
  // καμία βεβαιότητα — θα πρόσθετε μόνο κόστος σε **κάθε** αίτημα.
  if (requested.companyId === claimCompanyId) {
    return { verdict: 'home', workspace: requested };
  }

  // ── 4. Η ΟΝΟΜΑΣΜΕΝΗ ΕΞΑΙΡΕΣΗ ─────────────────────────────────────────────
  // Κρατά ακέραιο τον σημερινό `CompanySwitcher` (ADR-787 §2.8 #3). Γίνεται
  // **ρητή, ονομασμένη κατάσταση** αντί να είναι *ο μηχανισμός*.
  // ⚠️ Φτάνει εδώ **μόνο** για χώρο γραφείου: ο ιδιωτικός χώρος επέστρεψε ήδη
  //    στο βήμα 1, και αυτό είναι το σημείο όπου το Ε-3 §3 γίνεται κώδικας.
  if (isRoleBypass(globalRole)) {
    return { verdict: 'platform-bypass', workspace: requested };
  }

  // ── 5. ΤΟ ΒΙΒΛΙΟ ─────────────────────────────────────────────────────────
  return readMembership(uid, requested.companyId, requested);
}

// =============================================================================
// Η ΑΝΑΓΝΩΣΗ
// =============================================================================

async function readMembership(
  uid: string,
  companyId: string,
  workspace: WorkspaceRef,
): Promise<MembershipDecision> {
  if (!isFirebaseAdminAvailable()) {
    // ⚠️ ΟΧΙ «δεν είσαι μέλος». Δεν κοιτάξαμε (N.12).
    logger.error('[MEMBERSHIP] Firebase Admin μη διαθέσιμο — άγνωστο, όχι κενό', { uid, companyId });
    return { verdict: 'unknown', workspace };
  }

  try {
    const snapshot = await getAdminFirestore()
      .collection(COLLECTIONS.COMPANIES)
      .doc(companyId)
      .collection(SUBCOLLECTIONS.WORKSPACE_MEMBERS)
      .doc(uid)
      .get();

    if (!snapshot.exists) {
      return { verdict: 'not-a-member', workspace };
    }

    const membership = normalizeMembership(uid, snapshot.data());
    return {
      verdict: membership.status === 'active' ? 'member' : 'suspended',
      workspace,
      membership,
    };
  } catch (error) {
    // ⚠️ Η ΠΙΟ ΕΠΙΚΙΝΔΥΝΗ ΓΡΑΜΜΗ ΤΟΥ ΑΡΧΕΙΟΥ, ΑΝ ΓΡΑΦΤΕΙ ΛΑΘΟΣ.
    // Ένα `return { verdict: 'not-a-member' }` εδώ θα ήταν «σωστό» για τον
    // μεταγλωττιστή και **ψέμα** για τον χρήστη: θα του έλεγε «δεν είσαι μέλος»
    // ενώ η αλήθεια είναι «δεν μπόρεσα να ρωτήσω» (ADR-787 Ε-5 §4 #3 · N.12).
    logger.error('[MEMBERSHIP] Η αναζήτηση μέλους απέτυχε — άγνωστο, όχι κενό', {
      uid,
      companyId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { verdict: 'unknown', workspace };
  }
}

/**
 * Ωμό έγγραφο → `WorkspaceMembership`. **Η μία μετάφραση.**
 *
 * ⚠️ Η **κατάσταση δεν παίρνει προεπιλογή `'active'`**: ένα έγγραφο με
 * χαλασμένο ή άγνωστο `status` θα γινόταν σιωπηλά **ενεργό μέλος**. Άγνωστη
 * τιμή ⇒ `'suspended'`, δηλαδή **fail-closed**.
 *
 * 🔴 **Εξάγεται επίτηδες.** Μέχρι 2026-08-22 το ίδιο έγγραφο μεταφραζόταν
 * **δεύτερη φορά** στο `api/admin/role-management/users/route.ts` — με
 * **αντίθετη** προεπιλογή (`?? 'active'`). Δύο μεταφράσεις του ίδιου εγγράφου
 * σημαίνει δύο απαντήσεις στο *«είναι ενεργός;»*, και η μία από τις δύο έλεγε
 * «ναι» ακριβώς όταν δεν ήξερε (**ADR-749**).
 * ⛔ **ΜΗΝ γράψεις τρίτη.** Αν χρειάζεσαι άλλα πεδία, πρόσθεσέ τα **εδώ**.
 */
export function normalizeMembership(
  uid: string,
  raw: Record<string, unknown> | undefined,
): WorkspaceMembership {
  const data = raw ?? {};
  const rawStatus = data.status;
  const status: WorkspaceMembershipStatus =
    rawStatus === 'active' || rawStatus === 'suspended' || rawStatus === 'pending'
      ? rawStatus
      : 'suspended';

  return {
    uid,
    globalRole: typeof data.globalRole === 'string' ? data.globalRole : '',
    status,
    permissionSetIds: Array.isArray(data.permissionSetIds)
      ? (data.permissionSetIds as unknown[]).filter((id): id is string => typeof id === 'string')
      : [],
    joinedAt: data.joinedAt,
    addedBy: typeof data.addedBy === 'string' ? data.addedBy : null,
    updatedAt: data.updatedAt,
  };
}

// =============================================================================
// Η ΑΝΤΙΣΤΡΟΦΗ ΕΡΩΤΗΣΗ
// =============================================================================

/**
 * Το αποτέλεσμα του *«σε ποιους χώρους ανήκει ο Χ;»*.
 *
 * 🔴 **Δεν είναι πίνακας.** Ένας πίνακας δεν μπορεί να πει τη διαφορά ανάμεσα
 * σε *«σε κανέναν»* και *«δεν μπόρεσα να ρωτήσω»* — και αυτή ακριβώς η σύγχυση
 * είναι το ζωντανό ελάττωμα που καταγράφει το **ADR-787 §2.7**: ένα
 * `PERMISSION_DENIED` υποβαθμιζόταν σε `warn` και ο άνθρωπος έβλεπε **«δεν
 * έχεις χώρους»**.
 */
export type WorkspaceMembershipList =
  | { readonly outcome: 'ok'; readonly companyIds: readonly string[] }
  | { readonly outcome: 'unknown'; readonly reason: string };

/**
 * Οι χώροι **γραφείου** στους οποίους ο άνθρωπος είναι **ενεργό** μέλος.
 *
 * ⚠️ **ΔΕΝ περιλαμβάνει τον ιδιωτικό χώρο** — και είναι σκόπιμο: ο ιδιωτικός
 * χώρος **δεν αποθηκεύεται**, υπάρχει επειδή υπάρχει ο άνθρωπος (Ε-3 §2). Τον
 * προσθέτει ο καταναλωτής, χωρίς ανάγνωση.
 *
 * 🔴 **ΤΟ ΟΝΟΜΑ ΤΗΣ ΣΥΛΛΟΓΗΣ ΕΙΝΑΙ Ο ΜΗΧΑΝΙΣΜΟΣ.** Το collection group query
 * σαρώνει **κατά όνομα**. Όσο τα μέλη χώρου λέγονταν `members` — ίδιο όνομα με
 * τα μέλη **έργου** στο `companies/{W}/projects/{P}/members` — αυτή η γραμμή θα
 * επέστρεφε **και τα δύο**, και επειδή το έγγραφο έργου φέρει `companyId`, ένας
 * καλεσμένος σε **ένα έργο** θα γινόταν **μέλος ολόκληρου του γραφείου**.
 * ⛔ **ΜΗΝ επαναφέρεις το όνομα `members` εδώ.** Δεν είναι καλλωπισμός.
 */
export async function listMemberWorkspaces(uid: string): Promise<WorkspaceMembershipList> {
  if (!isFirebaseAdminAvailable()) {
    return { outcome: 'unknown', reason: 'firebase-admin-unavailable' };
  }

  try {
    // tenant-scope-exempt: Η ερώτηση ΕΙΝΑΙ «σε ποιους μισθωτές ανήκει αυτός ο
    // άνθρωπος;» — ένα `where('companyId')` θα την έκανε «ανήκει σε αυτόν που
    // ξέρω ήδη;», δηλαδή θα ακύρωνε ολόκληρη την αρχή Α2 του ADR-787 (ένας
    // άνθρωπος → πολλοί χώροι). Ο άξονας απομόνωσης εδώ είναι το `uid`: το
    // ερώτημα δεν μπορεί να επιστρέψει τη συμμετοχή ΑΛΛΟΥ ανθρώπου, και το
    // `uid` έρχεται από το ΥΠΟΓΕΓΡΑΜΜΕΝΟ token, ποτέ από τον πελάτη.
    // ⚠️ Γι' αυτό ακριβώς η ερώτηση ζει ΜΟΝΟ εδώ, στον διακομιστή: ο πελάτης
    //    δεν έχει κανόνα collection-group και δεν πρέπει να αποκτήσει — μια
    //    σάρωση όλων των γραφείων είναι απαρίθμηση (ADR-787 Ε-5 §4 #1).
    const snapshot = await getAdminFirestore()
      .collectionGroup(SUBCOLLECTIONS.WORKSPACE_MEMBERS)
      .where('uid', '==', uid)
      .where('status', '==', 'active')
      .get();

    const companyIds: string[] = [];
    for (const doc of snapshot.docs) {
      // Η διαδρομή είναι `companies/{companyId}/workspace_members/{uid}` ⇒ ο
      // γονέας του γονέα είναι ο χώρος. Το διαβάζουμε από τη **διαδρομή** και
      // όχι από πεδίο του εγγράφου: ένα πεδίο μπορεί να αποκλίνει από τη θέση
      // του εγγράφου· η διαδρομή **είναι** η θέση.
      const companyId = doc.ref.parent.parent?.id;
      if (companyId) companyIds.push(companyId);
    }

    return { outcome: 'ok', companyIds };
  } catch (error) {
    logger.error('[MEMBERSHIP] Ο κατάλογος χώρων απέτυχε — άγνωστο, όχι κενό', {
      uid,
      error: error instanceof Error ? error.message : String(error),
    });
    return { outcome: 'unknown', reason: 'query-failed' };
  }
}

// =============================================================================
// ΒΟΗΘΗΜΑΤΑ ΣΥΝΟΡΟΥ
// =============================================================================

/**
 * Πόσες αναγνώσεις Firestore κόστισε αυτή η ετυμηγορία.
 *
 * ⚠️ Υπάρχει για να **μπορεί να ελεγχθεί** η υπόσχεση «η συνήθης περίπτωση
 * κοστίζει μηδέν» — μια υπόσχεση απόδοσης που κανείς δεν μετρά είναι σχόλιο
 * (σχήμα CHECK 3.36). Την ασκούν οι άγκυρες.
 */
export function readsFor(verdict: MembershipVerdict): 0 | 1 {
  switch (verdict) {
    case 'self':
    case 'home':
    case 'platform-bypass':
      return 0;
    case 'member':
    case 'not-a-member':
    case 'suspended':
    case 'unknown':
      return 1;
    default: {
      // fail-closed: νέα ετυμηγορία χωρίς γραμμή εδώ **δεν χτίζει**.
      const unreachable: never = verdict;
      // N.11: server invariant, never rendered — English keeps it out of the i18n surface.
      throw new Error(`[MEMBERSHIP] unknown verdict: ${String(unreachable)}`);
    }
  }
}
