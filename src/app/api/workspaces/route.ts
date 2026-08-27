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
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ `withPersonalOrOrgAuth` ΚΑΙ ΟΧΙ `withAuth` — Η ΚΥΚΛΙΚΟΤΗΤΑ ΕΝΑ ΕΠΙΠΕΔΟ
 *    ΠΙΟ ΚΑΤΩ (ADR-817 §5, διορθώθηκε 2026-08-27)
 * ─────────────────────────────────────────────────────────────────────────────
 * Η παραπάνω παράγραφος έλεγε *«καμία απαίτηση ρόλου»* — και ήταν **αληθής**. Το
 * `withAuth` όμως δεν απαιτεί **ρόλο**, απαιτεί **μισθωτή**: το
 * `buildRequestContext` απαντά `401 missing_claims` σε **κάθε** ταυτότητα με
 * `scope === 'personal'` (`lib/auth/auth-context.ts`). Δηλαδή **η ίδια κυκλικότητα
 * που η παράγραφος απέκλεισε ρητά, ένα επίπεδο πιο κάτω** — και έκλεινε την πόρτα
 * σε **ακριβώς** τον πληθυσμό για τον οποίο χτίστηκε.
 *
 * 🔴 **ΤΟ ΑΔΙΕΞΟΔΟ ΗΤΑΝ ΚΛΕΙΣΤΟ ΚΑΙ ΑΠΟ ΤΙΣ ΔΥΟ ΜΕΡΙΕΣ** (μετρημένο ζωντανά,
 * `POST /api/workspaces → 401`): **χωρίς** χώρο δεν έφτανες ποτέ στον handler·
 * **με** χώρο έφτανες και έπαιρνες `already-has-workspace`. Καμία τιμή του
 * `companyId` δεν οδηγούσε σε δημιουργία — η οθόνη Κ-1 ήταν **δομικά ανίκανη**.
 *
 * ⚠️ **Η ΑΠΟΔΕΙΞΗ ΟΤΙ Ο ΦΡΟΥΡΟΣ ΕΦΤΑΙΓΕ, ΟΧΙ Ο HANDLER**: το `provisionWorkspace`
 * ξεκινά με `if (input.currentCompanyId) return 'already-has-workspace'` — είναι
 * **γραμμένο** για να τρέχει με κενή κατοχή, κατάσταση που ο φρουρός από πάνω δεν
 * επέτρεπε ποτέ. Φρουρός που κάνει τον έλεγχο του φρουρουμένου αδύνατο.
 *
 * ⛔ **ΜΗΝ το «λύσεις» χαλαρώνοντας το `withAuth`.** Η προεπιλογή του συνόρου
 *    μένει fail-closed για **319** διαδρομές· η προσωπική εμβέλεια αποκτάται
 *    **μόνο** με ρητή κλήση αυτού του περιτυλίγματος, και το κλειστό σύνολο των
 *    καταναλωτών φυλάγεται από το `lib/auth/__tests__/personal-scope-consumers.test.ts`.
 *
 * ⚠️ **ΚΑΙ ΤΟ `GET` ΑΛΛΑΞΕ, ΚΑΙ ΔΕΝ ΕΙΝΑΙ ΣΥΝΟΔΕΥΤΙΚΟ**: ο κατάλογος «οι χώροι
 *    μου» χτίζει `buildPersonalWorkspace(uid)` (`workspace-catalog.ts`) — έγγραφο
 *    που **υπάρχει για κάθε
 *    άνθρωπο**. Ο πολίτης ήταν ο μόνος που δεν μπορούσε να το δει.
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
 * Auth: `withPersonalOrOrgAuth` — κάθε συνδεδεμένος, **με ή χωρίς οργανισμό**
 *       (ο καθένας βλέπει **μόνο τους δικούς του** χώρους)
 * Rate: GET `withStandardRateLimit` · POST `withSensitiveRateLimit`
 *
 * @module api/workspaces
 * @see docs/centralized-systems/reference/adrs/ADR-787-multi-organization-platform.md §5.1
 */

import 'server-only';

import { NextResponse, type NextRequest } from 'next/server';
import {
  withPersonalOrOrgAuth,
  actorWorkspace,
  type ApiActor,
} from '@/lib/auth/personal-scope-middleware';
import {
  withStandardRateLimit,
  withSensitiveRateLimit,
} from '@/lib/middleware/with-rate-limit';
import { listMemberWorkspaces } from '@/lib/auth/workspace-membership';
import { provisionWorkspace } from '@/lib/workspace/workspace-provisioning';
import {
  buildPersonalWorkspace,
  buildOrgWorkspaces,
} from '@/lib/workspace/workspace-catalog';
import { workspacePath } from '@/lib/workspace/workspace-path';
import { resolvePostLoginRoute } from '@/lib/routes/landing';
import type { Workspace } from '@/types/workspace';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';

const logger = createModuleLogger('api:workspaces');

// =============================================================================
// GET
// =============================================================================

async function handleGet(_request: NextRequest, actor: ApiActor): Promise<NextResponse> {
  const uid = actor.ctx.uid;
  const membership = await listMemberWorkspaces(uid);

  // ⛔ ΑΓΝΩΣΤΟ ≠ ΚΕΝΟ (N.12 · ADR-787 Ε-5 §4 #3).
  // Μια κενή λίστα εδώ θα έλεγε στον άνθρωπο «δεν έχεις χώρους» ενώ η αλήθεια
  // είναι «δεν μπόρεσα να ρωτήσω». Είναι ακριβώς το ελάττωμα που καταγράφει το
  // §2.7 (`PERMISSION_DENIED` υποβαθμισμένο σε `warn` + κενή λίστα).
  if (membership.outcome === 'unknown') {
    logger.error('[WORKSPACES] Ο κατάλογος δεν απαντήθηκε', {
      uid,
      reason: membership.reason,
    });
    return NextResponse.json(
      { error: 'Workspace list unavailable', code: 'WORKSPACES_UNAVAILABLE' },
      { status: 503 },
    );
  }

  // Ο χώρος του token μπαίνει **πάντα** (ετυμηγορία `home`, μηδέν αναγνώσεις) —
  // **όταν υπάρχει**. Ο πολίτης δεν έχει, και αυτό είναι **κανονική** κατάσταση:
  // ο κατάλογός του είναι νόμιμα «μόνο ο ιδιωτικός μου χώρος».
  const home = actorWorkspace(actor);
  const orgIds = new Set<string>([...(home ? [home] : []), ...membership.companyIds]);

  try {
    const workspaces: Workspace[] = [
      buildPersonalWorkspace(uid),
      ...(await buildOrgWorkspaces(orgIds, uid)),
    ];
    return NextResponse.json({ success: true, data: { workspaces } });
  } catch (error) {
    logger.error('[WORKSPACES] Η ανάγνωση ονομάτων απέτυχε', {
      uid,
      error: getErrorMessage(error),
    });
    return NextResponse.json(
      { error: 'Workspace list unavailable', code: 'WORKSPACES_UNAVAILABLE' },
      { status: 503 },
    );
  }
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

async function handlePost(request: NextRequest, actor: ApiActor): Promise<NextResponse> {
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
    uid: actor.ctx.uid,
    // ⚠️ `null` σημαίνει **«δεν έχει χώρο»** και είναι η ΑΝΑΜΕΝΟΜΕΝΗ τιμή εδώ.
    //    ⛔ ΜΗΝ γράψεις `?? ''`: κενή συμβολοσειρά είναι «εταιρεία με κενό όνομα»,
    //    που δεν ταιριάζει ούτε με τον εαυτό της (`hasTenant` · CHECK 3.35). Ο
    //    `provisionWorkspace` δηλώνει `string | null` ακριβώς γι' αυτό.
    currentCompanyId: actorWorkspace(actor),
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
      //
      // 🔴 **ΚΑΙ ΤΟ ΔΕΥΤΕΡΟ ΟΡΙΣΜΑ ΔΕΝ ΕΙΝΑΙ ΔΙΑΚΟΣΜΗΤΙΚΟ** (διορθώθηκε 2026-08-27):
      //    σκέτο `workspacePath(alias)` δίνει `/o/<alias>`, και **δεν υπάρχει
      //    `page.tsx` στη ρίζα του `(app)/o/[workspace]/`** — μόνο `layout.tsx` και
      //    υποφάκελοι. Δηλαδή ο άνθρωπος που μόλις έφτιαξε το γραφείο του
      //    προσγειωνόταν στο **κέλυφός του με 404 μέσα**: το sidebar φόρτωνε, το
      //    περιεχόμενο έλεγε «Η σελίδα που αναζητάτε δεν βρέθηκε». **Μετρημένο
      //    ζωντανά** — η ίδια κλάση με το `/unauthorized` του ADR-787 §5.3 ξ
      //    («διεύθυνση χωρίς σελίδα»), δύο μέρες μετά την καταγραφή της.
      //
      // ⛔ **ΜΗΝ γράψεις `'/dashboard'` εδώ.** Το ερώτημα *«πού προσγειώνεται
      //    άνθρωπος ΜΕ οργανισμό;»* έχει **ήδη** αυθεντία, και είναι το
      //    `resolvePostLoginRoute` — το ίδιο που απαντά μετά τη σύνδεση. Ωμή
      //    διαδρομή εδώ θα ήταν **δεύτερος κριτής προσγείωσης** που μπορεί να
      //    αποκλίνει (ADR-749): την ημέρα που η αρχική του γραφείου αλλάξει,
      //    θα άλλαζε η μία και όχι η άλλη.
      //
      // 🔑 Ρωτάμε με το **αποτέλεσμα** (`result.companyId`), όχι με το εισερχόμενο
      //    `actor`: ο δρων μπήκε **χωρίς** οργανισμό — αν τον ρωτούσαμε αυτόν, θα
      //    έπαιρνε την προσγείωση του πολίτη και θα έστελνε τον νέο διαχειριστή
      //    **έξω** από το γραφείο που μόλις γέννησε.
      redirectTo: workspacePath(
        result.alias,
        resolvePostLoginRoute({ companyId: result.companyId }),
      ),
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

export const GET = withStandardRateLimit(withPersonalOrOrgAuth(handleGet));

// ⚠️ **Ευαίσθητο** όριο ρυθμού (όχι το τυπικό): η δημιουργία χώρου δεσμεύει
//    **παγκόσμιο** όνομα. Χωρίς σφιχτό όριο, ένας βρόχος θα μπορούσε να πιάσει
//    ψευδώνυμα μαζικά — απαρίθμηση και κατάληψη ταυτόχρονα.
export const POST = withSensitiveRateLimit(withPersonalOrOrgAuth(handlePost));
