/**
 * =============================================================================
 * GET + POST /api/workspaces — «σε ποιους χώρους ανήκω;» · «φτιάξε μου χώρο»
 * =============================================================================
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ ΟΙ ΔΥΟ ΜΕΘΟΔΟΙ ΖΟΥΝ ΣΤΟ ΙΔΙΟ ΑΡΧΕΙΟ (ADR-787 Κ-1, 2026-08-25)
 * ─────────────────────────────────────────────────────────────────────────────
 * Είναι ο **ίδιος πόρος**: «οι χώροι μου». Το `GET` τους απαριθμεί, το `POST`
 * προσθέτει έναν. Χωριστή διεύθυνση (`/api/workspaces/create`) θα ήταν ρήμα σε
 * θέση πόρου — και, χειρότερα, **δεύτερο σημείο** που θα έπρεπε να θυμάται
 * κανείς όταν αλλάξει το συμβόλαιο του χώρου.
 *
 * ⚠️ **ΤΟ `POST` ΔΕΝ ΕΙΝΑΙ ΑΝΑΓΝΩΣΤΗΣ ΚΑΝΑΛΙΟΥ** (CHECK 3.58 · ADR-787 Ε-5), και
 * η διάκριση δεν είναι λεπτολογία: «κανάλι» είναι ο τρόπος με τον οποίο ο
 * πελάτης λέει *«θέλω να ενεργήσω σε **αυτόν** τον χώρο»* — αναξιόπιστη είσοδος
 * που **οφείλει** να περάσει από τον κριτή. Εδώ ο πελάτης **δεν ονομάζει χώρο**:
 * ζητά να **γεννηθεί** ένας, και το `uid` έρχεται από το **υπογεγραμμένο token**.
 * Δεν υπάρχει τιμή να εμπιστευτούμε, άρα δεν υπάρχει τι να κριθεί.
 *
 * ⛔ **ΚΑΜΙΑ ΑΠΑΙΤΗΣΗ ΡΟΛΟΥ, ΚΑΙ ΕΙΝΑΙ ΤΟ ΝΟΗΜΑ ΤΟΥ ΒΗΜΑΤΟΣ.** Ο άνθρωπος που
 *    φτιάχνει το **δικό του** γραφείο δεν έχει — και δεν μπορεί να έχει —
 *    δικαίωμα μέσα σε αυτό: **δεν υπάρχει ακόμη**. Ο φρουρός δεν είναι ο ρόλος
 *    αλλά η **κατοχή**: όποιος έχει ήδη χώρο δεν περνά (`already-has-workspace`,
 *    `workspace-provisioning.ts`). Απαίτηση `company_admin` εδώ θα ήταν κυκλική —
 *    ακριβώς το εμπόδιο που κρατούσε το Κ-1 κλειδωμένο στον `super_admin`.
 *
 * Η **αντίστροφη** ερώτηση του ADR-787 Κ-2. Απαντιέται **μόνο εδώ**, στον
 * διακομιστή.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΔΙΑΔΡΟΜΗ ΚΑΙ ΟΧΙ ΕΡΩΤΗΜΑ ΤΟΥ ΠΕΛΑΤΗ
 * ─────────────────────────────────────────────────────────────────────────────
 * Το `WorkspaceService.listWorkspacesForUser` ρωτούσε **από τον φυλλομετρητή**
 * τη συλλογή `workspaces` — και **αγνοούσε το `userId`** (*«TODO: Implement
 * workspace membership check · For now, return all active workspaces»*).
 * Σήμερα είναι ακίνδυνο επειδή η συλλογή **δεν υπάρχει καν**· την ημέρα που
 * υπάρξει δεύτερος χώρος, γίνεται *«όλοι οι οργανισμοί της πλατφόρμας»*
 * **χωρίς καμία αλλαγή κώδικα** (ADR-787 §2.7 β).
 *
 * ⛔ Η θεραπεία **δεν** είναι «βάλε φίλτρο στο ερώτημα του πελάτη»: ένα
 *    collection-group ερώτημα πάνω στα μέλη, εκτελεσμένο από τον φυλλομετρητή,
 *    σαρώνει **όλα τα γραφεία** — απαρίθμηση που το **ADR-787 Ε-5 §4 #1**
 *    απαγορεύει ρητά. Γι' αυτό δεν υπάρχει κανόνας collection-group στο
 *    `firestore.rules`, και γι' αυτό η απάντηση ζει σε διαδρομή.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔑 Ο ΚΑΤΑΛΟΓΟΣ ΧΤΙΖΕΤΑΙ ΑΠΟ ΤΙΣ ΙΔΙΕΣ ΕΤΥΜΗΓΟΡΙΕΣ ΠΟΥ ΦΡΟΥΡΟΥΝ ΤΗΝ ΠΟΡΤΑ
 * ─────────────────────────────────────────────────────────────────────────────
 * | Πηγή | Ετυμηγορία | Αναγνώσεις |
 * |---|---|---|
 * | ο ιδιωτικός χώρος | `self` | **0** — υπάρχει επειδή υπάρχει ο άνθρωπος (Ε-3 §2) |
 * | ο χώρος του token | `home` | **0** — το υπογεγραμμένο token **είναι** η απόδειξη |
 * | οι υπόλοιποι | `member` | το collection group ερώτημα |
 *
 * ⚠️ **Γι' αυτό ΔΕΝ χρειάστηκε καμία μετανάστευση δεδομένων.** Το σχέδιο
 * προέβλεπε διαδρομή που θα «γέμιζε το βιβλίο» για τους υπάρχοντες χρήστες·
 * περιττή: ο χώρος του token απαντιέται από το `home`, με **μηδέν** αναγνώσεις.
 * Ένας κατάλογος χτισμένος από **άλλη** λογική από την πύλη θα μπορούσε να
 * **διαφωνήσει** μαζί της — εδώ είναι δομικά αδύνατο.
 *
 * Auth: κάθε συνδεδεμένος (ο καθένας βλέπει **μόνο τους δικούς του** χώρους)
 * Rate: withStandardRateLimit
 *
 * @module api/workspaces
 * @see docs/centralized-systems/reference/adrs/ADR-787-multi-organization-platform.md §5.1
 */

import 'server-only';

import { NextResponse, type NextRequest } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext } from '@/lib/auth';
import {
  withStandardRateLimit,
  withSensitiveRateLimit,
} from '@/lib/middleware/with-rate-limit';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { listMemberWorkspaces } from '@/lib/auth/workspace-membership';
import { provisionWorkspace } from '@/lib/workspace/workspace-provisioning';
import { workspacePath } from '@/lib/workspace/workspace-path';
import {
  orgWorkspace,
  personalWorkspace,
  workspaceRefKey,
} from '@/types/workspace-membership';
import type { Workspace } from '@/types/workspace';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import { nowISO } from '@/lib/date-local';

const logger = createModuleLogger('api:workspaces');

/**
 * Το όνομα του ιδιωτικού χώρου **δεν μπαίνει εδώ ως κείμενο**.
 *
 * ⚠️ Ο κανόνας **N.11** απαγορεύει ωμές συμβολοσειρές οθόνης στον κώδικα, και
 * ο κανόνας ισχύει και στον διακομιστή: το κείμενο *«Τα προσωπικά μου»* που
 * σκιαγραφεί το **ADR-787 Ε-3 §1** είναι **ετικέτα οθόνης**, άρα ζει στα
 * locale αρχεία και το επιλέγει η οθόνη από το `type: 'personal'`.
 * Ο διακομιστής στέλνει **κενό** — και αυτό είναι πληροφορία, όχι παράλειψη.
 */
const PERSONAL_DISPLAY_NAME = '';

// =============================================================================
// GET
// =============================================================================

async function handleGet(_request: NextRequest, ctx: AuthContext): Promise<NextResponse> {
  const membership = await listMemberWorkspaces(ctx.uid);

  // ⛔ ΑΓΝΩΣΤΟ ≠ ΚΕΝΟ (N.12 · ADR-787 Ε-5 §4 #3).
  // Μια κενή λίστα εδώ θα έλεγε στον άνθρωπο «δεν έχεις χώρους» ενώ η αλήθεια
  // είναι «δεν μπόρεσα να ρωτήσω». Είναι ακριβώς το ελάττωμα που καταγράφει το
  // §2.7 (`PERMISSION_DENIED` υποβαθμισμένο σε `warn` + κενή λίστα).
  if (membership.outcome === 'unknown') {
    logger.error('[WORKSPACES] Ο κατάλογος δεν απαντήθηκε', {
      uid: ctx.uid,
      reason: membership.reason,
    });
    return NextResponse.json(
      { error: 'Workspace list unavailable', code: 'WORKSPACES_UNAVAILABLE' },
      { status: 503 },
    );
  }

  // Ο χώρος του token μπαίνει **πάντα** (ετυμηγορία `home`, μηδέν αναγνώσεις).
  const orgIds = new Set<string>([ctx.companyId, ...membership.companyIds].filter(Boolean));

  try {
    const workspaces: Workspace[] = [
      buildPersonalWorkspace(ctx.uid),
      ...(await buildOrgWorkspaces(orgIds, ctx.uid)),
    ];
    return NextResponse.json({ success: true, data: { workspaces } });
  } catch (error) {
    logger.error('[WORKSPACES] Η ανάγνωση ονομάτων απέτυχε', {
      uid: ctx.uid,
      error: getErrorMessage(error),
    });
    return NextResponse.json(
      { error: 'Workspace list unavailable', code: 'WORKSPACES_UNAVAILABLE' },
      { status: 503 },
    );
  }
}

// =============================================================================
// ΚΑΤΑΣΚΕΥΗ
// =============================================================================

/**
 * Ο ιδιωτικός χώρος — **παραγόμενος, ποτέ αποθηκευμένος**.
 *
 * ⛔ **ΔΕΝ έχει `companyId`, και δεν επιτρέπεται να αποκτήσει** (ADR-787 Ε-3
 *    §3): θα έδινε σιωπηλά στον διαχειριστή ενός γραφείου πρόσβαση στο ψάξιμο
 *    σπιτιού ενός ανθρώπου — **πράσινο σε κάθε πύλη**. Ο τύπος
 *    `PersonalWorkspaceRef` το κάνει ήδη αδύνατο· εδώ κρατιέται και στην
 *    προβολή.
 */
function buildPersonalWorkspace(uid: string): Workspace {
  return {
    id: workspaceRefKey(personalWorkspace(uid)),
    type: 'personal',
    displayName: PERSONAL_DISPLAY_NAME,
    status: 'active',
    createdAt: nowISO(),
    createdBy: uid,
  };
}

/**
 * Οι χώροι γραφείου, με το όνομά τους από το `companies/{id}`.
 *
 * ⚠️ Ένας χώρος του οποίου το έγγραφο **λείπει** δεν πετιέται σιωπηλά: η
 * συμμετοχή υπάρχει, άρα ο χώρος υπάρχει· λείπει μόνο το **όνομα**. Σιωπηλή
 * απόρριψη εδώ θα ξανάφτιαχνε το *«δεν έχεις χώρους»* από την πίσω πόρτα.
 */
async function buildOrgWorkspaces(orgIds: Set<string>, uid: string): Promise<Workspace[]> {
  if (orgIds.size === 0) return [];

  const db = getAdminFirestore();
  const ids = [...orgIds];
  const snapshots = await Promise.all(
    ids.map((id) => db.collection(COLLECTIONS.COMPANIES).doc(id).get()),
  );

  return ids.map((companyId, index) => {
    const data = snapshots[index].data();
    const name = typeof data?.name === 'string' ? data.name : '';
    if (!snapshots[index].exists) {
      logger.warn('[WORKSPACES] Συμμετοχή σε χώρο χωρίς έγγραφο — κρατιέται χωρίς όνομα', {
        uid,
        companyId,
      });
    }
    return {
      id: workspaceRefKey(orgWorkspace(companyId)),
      type: 'company',
      displayName: name,
      companyId,
      status: 'active',
      createdAt: nowISO(),
      createdBy: uid,
    };
  });
}

// =============================================================================
// POST — «φτιάξε μου χώρο» (ADR-787 Κ-1)
// =============================================================================

/** Το σώμα του αιτήματος, όπως το στέλνει η οθόνη. */
interface CreateWorkspaceBody {
  readonly displayName?: unknown;
  readonly alias?: unknown;
}

/** Η επωνυμία, κανονικοποιημένη — ή `null` αν δεν είναι επωνυμία. */
function readDisplayName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function handlePost(request: NextRequest, ctx: AuthContext): Promise<NextResponse> {
  let body: CreateWorkspaceBody;
  try {
    body = (await request.json()) as CreateWorkspaceBody;
  } catch {
    return rejected('failed', 400);
  }

  const displayName = readDisplayName(body.displayName);
  if (!displayName) return rejected('name-required', 400);

  // ⚠️ Το ψευδώνυμο περνά **ωμό**. Καμία κανονικοποίηση εδώ: ο `judgeAliasShape`
  //    είναι ο κριτής της μορφής, και μια δεύτερη «καθάρισή» της στο σύνορο θα
  //    ήταν κριτήριο που μπορεί να αποκλίνει από εκείνον (ADR-749) — ακριβώς
  //    στα σημεία που έχουν σημασία (κενά, Unicode, κεφαλαία).
  const requestedAlias = typeof body.alias === 'string' ? body.alias : '';

  const result = await provisionWorkspace({
    uid: ctx.uid,
    currentCompanyId: ctx.companyId,
    displayName,
    requestedAlias,
  });

  if (!result.ok) {
    // 409 όταν το εμπόδιο είναι **κατάσταση** (όνομα πιασμένο, χώρος υπάρχει)·
    // 503 όταν **δεν κοιτάξαμε**· 400 όταν το κείμενο δεν είναι ψευδώνυμο.
    return rejected(result.reason, statusFor(result.reason));
  }

  return NextResponse.json({
    success: true,
    data: {
      companyId: result.companyId,
      alias: result.alias,
      // Η **διεύθυνση** χτίζεται από το SSoT, ποτέ με ένωση συμβολοσειρών στην
      // οθόνη — αλλιώς το πρόθεμα αποκτά δεύτερη γραφή (`workspace-path.ts`).
      redirectTo: workspacePath(result.alias),
    },
  });
}

/** Οι τρεις οικογένειες αποτυχίας, με τον κωδικό HTTP που τους ανήκει. */
function statusFor(reason: string): number {
  if (reason === 'registry-unavailable' || reason === 'failed') return 503;
  if (reason === 'already-taken' || reason === 'look-alike-taken') return 409;
  if (reason === 'already-has-workspace') return 409;
  return 400;
}

/**
 * Η απόρριψη — **κωδικός, ποτέ κείμενο** (N.11).
 *
 * Η οθόνη μεταφράζει το `reason` από τα locale αρχεία. Ένα έτοιμο μήνυμα εδώ θα
 * ήταν σκληρή συμβολοσειρά οθόνης σε λάθος στρώμα, και θα αγνοούσε τη γλώσσα
 * του ανθρώπου που τη διαβάζει.
 */
function rejected(reason: string, status: number): NextResponse {
  return NextResponse.json({ success: false, reason }, { status });
}

// =============================================================================
// ΕΞΑΓΩΓΕΣ
// =============================================================================

export const GET = withStandardRateLimit(withAuth(handleGet));

// ⚠️ **Ευαίσθητο** όριο ρυθμού (όχι το τυπικό): η δημιουργία χώρου δεσμεύει
//    **παγκόσμιο** όνομα. Χωρίς σφιχτό όριο, ένας βρόχος θα μπορούσε να πιάσει
//    ψευδώνυμα μαζικά — απαρίθμηση και κατάληψη ταυτόχρονα.
export const POST = withSensitiveRateLimit(withAuth(handlePost));
