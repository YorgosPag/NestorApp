import 'server-only';

/**
 * **POST /api/workspace-invitations/redeem** — ο ΑΝΘΡΩΠΟΣ απαντά (ADR-853 Φ4 · §7.5 · Α2).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ `withPersonalOrOrgAuth` ΚΑΙ ΟΧΙ `withAuth` — Η ΚΥΚΛΙΚΟΤΗΤΑ
 * ─────────────────────────────────────────────────────────────────────────────
 * Ο προσκεκλημένος **μπορεί να μην έχει εταιρεία**: η πρόσκληση φτάνει σε **email**, ο
 * άνθρωπος περνά από `/login` και γυρίζει (ADR-853 §6 #2). Το `withAuth` απαντά
 * `401 missing_claims` σε **κάθε** ταυτότητα χωρίς `companyId` — δηλαδή θα έκλεινε την πόρτα
 * σε **ακριβώς** τον πληθυσμό για τον οποίο υπάρχει, η ίδια κυκλικότητα που κρατούσε το
 * `POST /api/workspaces` δομικά ανίκανο (ADR-817 §2.2).
 *
 * ⚠️ **ΚΑΙ Ο ΗΔΗ ΜΕΛΟΣ ΑΛΛΟΥ ΧΩΡΟΥ ΠΕΡΝΑ ΑΠΟ ΕΔΩ** (Α2): δεν απορρίπτεται — η άρνηση είναι
 * το **τεκμηριωμένο ελάττωμα** της Autodesk, που αναγκάζει ανθρώπους σε δεύτερο email.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔑 ΜΙΑ ΔΙΑΔΡΟΜΗ ΓΙΑ ΔΥΟ ΠΡΑΞΕΙΣ — ΚΑΙ ΕΙΝΑΙ ΑΠΟΦΑΣΗ, ΟΧΙ ΣΥΝΤΟΜΙΑ
 * ─────────────────────────────────────────────────────────────────────────────
 * Η αποδοχή και η άρνηση μοιράζονται **την ίδια κλειδαριά** στην υπηρεσία (`redeem()`:
 * υπογραφή → λήξη → email → nonce → παραλήπτης → ρόλος → ατομική κατανάλωση). Δύο
 * διαδρομές θα αντέγραφαν τον φρουρό και θα μεγάλωναν το **κλειστό σύνολο** του
 * `withPersonalOrOrgAuth` κατά **δύο** — και ο κανόνας του απαιτεί ξεχωριστή αιτιολόγηση
 * για κάθε καταναλωτή (ADR-817 §5).
 *
 * ⚠️ Η πράξη **ονομάζεται ρητά** στο σώμα (`action`), ποτέ δεν συμπεραίνεται: το AIP-216
 * απαιτεί **ονομασμένες** μεταβάσεις, και μια «έξυπνη» προεπιλογή εδώ θα σήμαινε ότι ένα
 * κακοσχηματισμένο αίτημα **δέχεται** πρόσκληση εκ παραδρομής.
 *
 * ⚠️ **Το όριο είναι πραγματικά 10/min** μετά το ADR-855 Φ1 — πριν ήταν 60 παρά τη δήλωση.
 *
 * @module api/workspace-invitations/redeem
 * @see docs/centralized-systems/reference/adrs/ADR-853-workspace-invitations.md §8 Φ4
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { readJsonBody } from '@/lib/api/json-body';
import { checkClaimFits, composeClaimPayload } from '@/lib/auth/claim-payload';
import {
  withPersonalOrOrgAuth,
  actorWorkspace,
  type ApiActor,
} from '@/lib/auth/personal-scope-middleware';
import { setClaimsWithMirror } from '@/lib/auth/set-claims-with-mirror';
import { getErrorMessage } from '@/lib/error-utils';
import { getAdminAuth } from '@/lib/firebaseAdmin';
import { withHeavyRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';
import {
  acceptWorkspaceInvitation,
  declineWorkspaceInvitation,
  type RedeemOutcome,
} from '@/server/auth/workspace-invitation-redeem';
import type { InvitableRole, WorkspaceInvitationRefusal } from '@/types/workspace-invitation';

const logger = createModuleLogger('WORKSPACE_INVITATION_REDEEM');

const redeemBodySchema = z.object({
  token: z.string().min(8).max(4096),
  /** ⚠️ **Καμία προεπιλογή** — δες την κεφαλίδα. */
  action: z.enum(['accept', 'decline']),
});

type RedeemResponse =
  | { readonly status: 'accepted'; readonly companyId: string; readonly activeWorkspaceChanged: boolean }
  | { readonly status: 'declined' }
  /** Ονομασμένη άρνηση — κάθε μία στέλνει τον άνθρωπο σε **άλλη** ενέργεια (§5 #7). */
  | { readonly error: 'LINK_REFUSED'; readonly reason: WorkspaceInvitationRefusal }
  /** «Δεν μπόρεσα να ρωτήσω» — ποτέ ονομασμένη άρνηση (N.12 · ADR-787 Ε-5 §4 #3). */
  | { readonly error: 'REDEEM_UNAVAILABLE' };

/**
 * **Είναι επαληθευμένο το email αυτού του λογαριασμού;** — από τον **ιδιοκτήτη**.
 *
 * 🔴 **ΤΟ `AuthContext` ΔΕΝ ΤΟ ΕΚΘΕΤΕΙ, ΚΑΙ ΤΟ TOKEN ΔΕΝ ΑΡΚΕΙ.** Το `email_verified` ζει
 * στο ID token, αλλά ένα token ζει **έως μία ώρα**: ο άνθρωπος που μόλις επιβεβαίωσε το
 * γραμματοκιβώτιό του και πάτησε τον σύνδεσμο θα έπαιρνε `false` και ονομασμένη άρνηση
 * `email-unverified` — δηλαδή θα του λέγαμε να κάνει κάτι που **μόλις έκανε**.
 *
 * ⛔ Και **ποτέ** custom claim με αυτό το όνομα: ο ιδιοκτήτης είναι το Firebase Auth, και
 *    ένα claim θα ήταν **δεύτερη αυθεντία** που μπορεί να λέει «ναι» ενώ το Auth λέει «όχι»
 *    (ADR-749· γραμμένο ήδη στο `workspace-provisioning.ts`).
 */
async function readEmailVerified(uid: string): Promise<boolean> {
  return (await getAdminAuth().getUser(uid)).emailVerified;
}

/**
 * **Ο νέος χώρος γίνεται ΕΝΕΡΓΟΣ — μόνο για όποιον δεν είχε κανέναν** (Α2 · Μ1).
 *
 * 🔴 **ΓΙΑΤΙ ΟΧΙ ΠΑΝΤΑ**: αν ο άνθρωπος **είχε** χώρο, γραφή claim θα τον **μετακινούσε** —
 * ένα γραφείο θα «έκλεβε» μέλος άλλου με μία πρόσκληση, συμπεριφορά που το ADR-853 §11
 * απέρριψε **ονομαστικά**. Το έγγραφο μέλους γράφεται πάντα (από τον ΕΝΑ γραφέα, μέσα στη
 * συναλλαγή του redeem)· το claim **όχι**.
 *
 * ⚠️ **Μη μπλοκάρον**: η ιδιότητα μέλους **έχει ήδη δεσμευτεί** ατομικά. Μια αποτυχία εδώ
 * αφήνει άνθρωπο που **είναι** μέλος αλλά δεν έχει τον χώρο ενεργό — θεραπεύσιμο με
 * επανασύνδεση· μια εξαίρεση θα ακύρωνε ένταξη που **έγινε**.
 *
 * @returns `true` αν το claim όντως γράφτηκε.
 */
async function activateWorkspaceIfHomeless(
  actor: ApiActor,
  companyId: string,
  role: InvitableRole,
): Promise<boolean> {
  if (actorWorkspace(actor) !== null) return false;

  // ⚠️ **ΚΑΝΕΝΑΣ ΕΛΕΓΧΟΣ ΡΟΛΟΥ ΕΔΩ, ΕΠΙΤΗΔΕΣ.** Ο ρόλος φτάνει ως `InvitableRole` επειδή
  //    η υπηρεσία τον **ξαναρώτησε μέσα στη συναλλαγή** (`isInvitableRole(stored.role)` ⇒
  //    `invitation-corrupt`, άγκυρα Μ3). Ένας δεύτερος φρουρός εδώ **δεν θα μπορούσε να
  //    πυροδοτήσει ποτέ** — δηλαδή θα ήταν ακριβώς ο αδρανής φρουρός του ADR-749 §5, που
  //    δίνει ψεύτικη αίσθηση κάλυψης. Η εγγύηση είναι ο **έλεγχος εκεί**, όχι ο τύπος εδώ.
  try {
    const previousClaims = (await getAdminAuth().getUser(actor.ctx.uid)).customClaims ?? {};
    const payload = composeClaimPayload({ companyId, globalRole: role, previousClaims });

    // ⚠️ Το όριο των 1.000 bytes της Firebase μετριέται **πριν** τη γραφή (ADR-813): αλλιώς
    //    σκάει `auth/claims-too-large` χωρίς να πει πόσο, τι, ή γιατί.
    const fit = checkClaimFits(payload);
    if (!fit.fits) {
      logger.error('Ο ενεργός χώρος δεν δόθηκε — το claim δεν χωρά', {
        uid: actor.ctx.uid, bytes: fit.bytes, limit: fit.limit, overBy: fit.overBy,
      });
      return false;
    }

    await setClaimsWithMirror(actor.ctx.uid, payload);
    return true;
  } catch (error: unknown) {
    logger.error('Ο ενεργός χώρος δεν δόθηκε (η ιδιότητα μέλους ΕΧΕΙ γραφτεί)', {
      uid: actor.ctx.uid, companyId, error: getErrorMessage(error),
    });
    return false;
  }
}

async function handler(request: NextRequest, actor: ApiActor): Promise<NextResponse<RedeemResponse>> {
  const parsed = await readJsonBody(request, redeemBodySchema);
  if ('rejected' in parsed) return parsed.rejected;

  let emailVerified: boolean;
  try {
    emailVerified = await readEmailVerified(actor.ctx.uid);
  } catch (error: unknown) {
    // ⚠️ **ΟΧΙ `email-unverified`**: δεν ξέρουμε: ο ιδιοκτήτης δεν απάντησε. Ονομασμένη
    //    άρνηση εδώ θα έστελνε τον άνθρωπο να επιβεβαιώσει email που ίσως είναι εντάξει.
    logger.error('Το Firebase Auth δεν απάντησε για το emailVerified', {
      uid: actor.ctx.uid, error: getErrorMessage(error),
    });
    return NextResponse.json({ error: 'REDEEM_UNAVAILABLE' } as const, { status: 503 });
  }

  const identity = {
    uid: actor.ctx.uid,
    email: actor.ctx.email,
    emailVerified,
    // 🔑 **ΤΟ `?? ''` ΕΙΝΑΙ ΣΩΣΤΟ ΕΔΩ — ΚΑΙ ΜΟΙΑΖΕΙ ΜΕ ΤΟ ΑΠΑΓΟΡΕΥΜΕΝΟ, ΓΙ' ΑΥΤΟ ΓΡΑΦΕΤΑΙ.**
    //
    // Το JSDoc του `actorWorkspace` απαγορεύει ρητά το `?? ''` — αλλά για **άλλο ερώτημα**:
    // ο στόχος εκεί είναι ο `ListingActor` (CHECK 3.56), όπου κενή εταιρεία **δεν ταιριάζει
    // με τίποτα — ούτε με κενή** (`hasTenant`), και σε ερώτημα Firestore γίνεται «κενός
    // μισθωτής» (CHECK 3.35).
    //
    // Εδώ ο στόχος είναι το `MembershipQuery.claimCompanyId`, όπου το `''` έχει **ορισμένη
    // σημασία**: *«ο άνθρωπος δεν δηλώνει εταιρεία»*. Είναι η **ίδια** τιμή που δίνει το
    // `resolveWorkspaceFromPath` για τον ιδιωτικό χώρο, και το `o/[workspace]/layout.tsx`
    // το γράφει ρητά: *«τρίτη ερμηνεία εδώ θα ήταν δεύτερη αλήθεια»* (ADR-749). Το
    // `decideMembership` κρίνει **fail-closed** με `''` — ξένο γραφείο απορρίπτεται.
    //
    // ⛔ ΜΗΝ το «διορθώσεις» αφαιρώντας το `?? ''`: ο τύπος-στόχος είναι `string`, και ένα
    //    `null` εδώ θα ήταν ο ίδιος κενός μισθωτής από την **άλλη** πόρτα.
    claimCompanyId: actorWorkspace(actor) ?? '',
    globalRole: actor.ctx.globalRole,
  };

  const outcome = parsed.data.action === 'accept'
    ? await acceptWorkspaceInvitation({ token: parsed.data.token, identity })
    : await declineWorkspaceInvitation({ token: parsed.data.token, identity });

  if (outcome.kind === 'accepted') {
    const activeWorkspaceChanged = await activateWorkspaceIfHomeless(
      actor, outcome.invitation.companyId, outcome.invitation.role,
    );
    return NextResponse.json({
      status: 'accepted',
      companyId: outcome.invitation.companyId,
      // 🔶 **ΤΟ ΔΗΛΩΜΕΝΟ ΟΡΙΟ §6 #1, ΣΤΟ ΣΥΡΜΑ.** `false` σημαίνει «είσαι μέλος, αλλά ο
      //    χώρος **δεν** είναι ο ενεργός σου»: 78 μπλοκ κανόνων κρίνουν με το claim, άρα
      //    οθόνες που διαβάζουν Firestore από τον φυλλομετρητή θα αρνηθούν. Ο άνθρωπος το
      //    μαθαίνει **με όνομα** — δεν του υποσχόμαστε πρόσβαση που δεν έχει.
      activeWorkspaceChanged,
    } as const, { status: 200 });
  }

  return respond(outcome);
}

/** **Έκβαση → HTTP**, κλειστό σύνολο, **χωρίς `default`** (ιδίωμα `guest/confirm`). */
export function respond(outcome: RedeemOutcome): NextResponse<RedeemResponse> {
  switch (outcome.kind) {
    case 'accepted':
      // Χειρίζεται ο `handler` (θέλει το claim πρώτα). Εδώ για την **πληρότητα** του switch:
      // μια μελλοντική έκβαση δεν μεταγλωττίζεται μέχρι να αποκτήσει σημασία στο δίκτυο.
      return NextResponse.json({
        status: 'accepted',
        companyId: outcome.invitation.companyId,
        activeWorkspaceChanged: false,
      } as const);

    case 'declined':
      return NextResponse.json({ status: 'declined' } as const);

    case 'refused':
      // 🔑 **422, ΠΟΤΕ 404/403**: το αίτημα ήταν κατανοητό· ο **κόσμος** δεν το επιτρέπει.
      //    Και ο λόγος **ταξιδεύει**: «έληξε» · «ανακλήθηκε» · «λάθος παραλήπτης» ·
      //    «ανεπιβεβαίωτο email» στέλνουν τον άνθρωπο σε **τέσσερις διαφορετικές** ενέργειες.
      return NextResponse.json(
        { error: 'LINK_REFUSED', reason: outcome.reason } as const,
        { status: 422 },
      );

    case 'unavailable':
      // 🔴 **503**: *«δεν μάθαμε»* ≠ *«δεν επιτρέπεσαι»*. Το `membership-unknown` σημαίνει ότι
      //    ο κριτής δεν απάντησε· το `invitation-corrupt` ότι το έγγραφο φέρει ρόλο εκτός
      //    λεξιλογίου. **Καμία** ενέργεια του ανθρώπου δεν διορθώνει κανένα από τα δύο.
      return NextResponse.json({ error: 'REDEEM_UNAVAILABLE' } as const, { status: 503 });
  }
}

export const POST = withHeavyRateLimit(withPersonalOrOrgAuth<RedeemResponse>(handler));
