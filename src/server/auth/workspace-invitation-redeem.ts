import 'server-only';

/**
 * @fileoverview **Η ΠΡΟΣΚΛΗΣΗ, ΑΠΟ ΤΗΝ ΠΛΕΥΡΑ ΤΟΥ ΑΝΘΡΩΠΟΥ** — αποδοχή · άρνηση · «ανοίχτηκε».
 * @related ADR-853 §7.4 · §7.5 (δύο έλεγχοι) · §20 (κοινός πυρήνας) · Α2/Μ1/Μ2 · άγκυρες Τ1-Τ4
 * @module server/auth/workspace-invitation-redeem
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔑 ΤΟ ΕΙΔΟΣ «ΧΩΡΟΣ» ΠΑΝΩ ΣΤΟΝ ΚΟΙΝΟ ΠΥΡΗΝΑ (ADR-853 §20)
 * ─────────────────────────────────────────────────────────────────────────────
 * Η μία κλειδαριά (token → έγγραφο → κατάσταση · λήξη · nonce · παραλήπτης → απόδειξη γραμματοκιβωτίου
 * → συναλλαγή που ξαναρωτά τα πάντα) ζει στο `server/invitations/invitation-redeem.ts` και την
 * μοιράζεται με την πρόσκληση φωτογράφου (ADR-884). Εδώ μένει **μόνο** ό,τι είναι χώρου:
 * - **πριν** τη συναλλαγή: «είναι ήδη μέλος;» (`decideMembership`)·
 * - **μέσα** στη συναλλαγή: ο ρόλος ξαναρωτιέται από τη βάση, και γράφεται το μέλος από τον **ΕΝΑ** γραφέα.
 *
 * 🔴 **ΔΥΟ ΕΛΕΓΧΟΙ ΤΑΥΤΟΤΗΤΑΣ, ΟΧΙ ΕΝΑΣ** (§7.5): έγκυρο υπογεγραμμένο token **ΚΑΙ** συνδεδεμένος χρήστης
 * του οποίου το email **στο Auth** ταιριάζει με τον παραλήπτη — εκεί σπάει το **Figma**, που δηλώνει ρητά
 * ότι *δεν* δεσμεύει τον σύνδεσμο σε λογαριασμό. Από 2026-09-21 (§15) η ίδια η πρόσκληση **είναι** η
 * επαλήθευση του email (Auth0/Clerk) — δες `server/invitations/invitation-guards.ts`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ Ο ΕΛΕΓΧΟΣ ΜΕΛΟΥΣ ΤΡΕΧΕΙ **ΠΡΙΝ** ΤΗ ΣΥΝΑΛΛΑΓΗ
 * ─────────────────────────────────────────────────────────────────────────────
 * Ο `decideMembership` (ADR-787 §5.1) διαβάζει με **δικό του** χειριστή Firestore, όχι με
 * το `tx`. Κλήση του **μέσα** στο `runTransaction` θα ήταν ανάγνωση που **μοιάζει**
 * μέρος της συναλλαγής και δεν είναι — και θα έσπαγε τον κανόνα «όλες οι αναγνώσεις πριν
 * από κάθε γραφή». Τρέχει πρώτος, ως **συμβουλευτική** άρνηση· η ατομικότητα που έχει
 * σημασία *(μία αποδοχή ⇒ ένα μέλος)* τη δίνει το `pending →` μέσα στη συναλλαγή.
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import { decideMembership } from '@/lib/auth/workspace-membership';
import { nowISO as clockNowISO } from '@/lib/date-local';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { createModuleLogger } from '@/lib/telemetry';
import { grantWorkspaceMembershipInTx } from '@/lib/workspace/grant-membership';
import { markInvitationOpenedAt } from '@/server/invitations/invitation-lifecycle';
import {
  redeemInvitation,
  type InvitationKind,
  type InvitationLocator,
  type InvitationPrecheck,
  type InvitationRedeemer,
  type InvitationRedeemOutcome,
  type InvitationResolution,
} from '@/server/invitations/invitation-redeem';
import { orgWorkspace } from '@/types/workspace-membership';
import {
  isInvitableRole,
  type WorkspaceInvitation,
  type WorkspaceInvitationDocument,
  type WorkspaceInvitationRefusal,
} from '@/types/workspace-invitation';

import { WORKSPACE_INVITE_SECRET_ENV } from './workspace-invitation';

const logger = createModuleLogger('workspace-invitation-redeem');

/**
 * Ο άνθρωπος που πατά τον σύνδεσμο — **ήδη συνδεδεμένος**, από το σύνορο HTTP. Τα κοινά πεδία
 * (uid · `emailVerified` · 2ος παράγοντας · email **στο Auth**) στο {@link InvitationRedeemer}.
 */
export interface RedeemingIdentity extends InvitationRedeemer {
  /** Ο χώρος του **claim** του — για να κριθεί αν είναι ήδη μέλος (ποτέ από τον πελάτη). */
  readonly claimCompanyId: string;
  /**
   * ⚠️ **`null` είναι ο ΣΥΝΗΘΗΣ προσκεκλημένος, όχι η εξαίρεση** (ADR-853 §14): ο νέος
   * άνθρωπος δεν έχει ακόμη ρόλο — τον αποκτά **εδώ**. Αν ο τύπος απαιτούσε ρόλο, η
   * αποδοχή θα ήταν ανέφικτη για τον πληθυσμό για τον οποίο γράφτηκε (§7.1).
   */
  readonly globalRole: string | null;
}

/**
 * 🔴 Το `unavailable` είναι **«δεν μπόρεσα να ρωτήσω»** — ούτε αποδοχή ούτε άρνηση: `membership-unknown`
 * όταν ο κριτής μέλους δεν απάντησε (ADR-787 Ε-5 §4 #3: «δεν είσαι μέλος» θα ήταν ψέμα, «είσαι» διαρροή)
 * ή λείπει το μυστικό· `invitation-corrupt` για ρόλο εκτός λεξιλογίου· `mailbox-proof-unknown` όταν το
 * Auth δεν απάντησε (§15). Ο καλών απαντά **5xx**, όχι ονομασμένη άρνηση.
 */
export type RedeemOutcome = InvitationRedeemOutcome<
  WorkspaceInvitation,
  WorkspaceInvitationRefusal,
  'membership-unknown'
>;

// =============================================================================
// 1. ΑΠΟΔΟΧΗ · ΑΡΝΗΣΗ
// =============================================================================

/**
 * **Αποδοχή** — ατομική: `pending → accepted` **και** γραφή μέλους, αδιαίρετα (Τ3).
 *
 * ⛔ **ΔΕΝ αγγίζει claims** (Μ1 · Α2). Το έγγραφο μέλους γράφεται πάντα· το αν ο άνθρωπος
 * παίρνει **και** `companyId` στο claim το αποφασίζει ο καλών, που είναι ο μόνος που ξέρει
 * αν είχε ήδη χώρο.
 */
export async function acceptWorkspaceInvitation(input: WorkspaceRedeemInput): Promise<RedeemOutcome> {
  return redeemWorkspaceInvitation(input, 'accepted');
}

/**
 * **Άρνηση** — ίδια κλειδαριά, καμία γραφή μέλους. 🔑 Είναι **ρητή ανθρώπινη πράξη** και καταγράφεται: ο
 * χώρος βλέπει «απορρίφθηκε» αντί για πρόσκληση που σβήνει σιωπηλά στις 7 μέρες.
 */
export async function declineWorkspaceInvitation(input: WorkspaceRedeemInput): Promise<RedeemOutcome> {
  return redeemWorkspaceInvitation(input, 'declined');
}

interface WorkspaceRedeemInput {
  readonly token: string;
  readonly identity: RedeemingIdentity;
  readonly nowISOValue?: string;
}

function redeemWorkspaceInvitation(input: WorkspaceRedeemInput, target: 'accepted' | 'declined'): Promise<RedeemOutcome> {
  return redeemInvitation(getAdminFirestore(), WORKSPACE_INVITATION_KIND, {
    token: input.token,
    identity: input.identity,
    target,
    nowValue: input.nowISOValue ?? clockNowISO(),
  });
}

// =============================================================================
// 2. ΤΟ ΕΙΔΟΣ «ΧΩΡΟΣ» — ό,τι δεν είναι κοινό
// =============================================================================

/**
 * **Πού ζει η πρόσκληση χώρου** — μία κορυφαία συλλογή, το id αρκεί (κανένας locator στο token).
 * Κοινό για εξαργύρωση **και** όψη (`workspace-invitation-preview.ts`).
 */
export const WORKSPACE_INVITATION_LOCATOR: InvitationLocator<WorkspaceInvitationDocument> = {
  secretEnv: WORKSPACE_INVITE_SECRET_ENV,
  locatorCount: 0,
  locate: async (db, invitationId) => ({
    ref: db.collection(COLLECTIONS.WORKSPACE_INVITATIONS).doc(invitationId),
    // Πρόσκληση χωρίς χώρο-εκδότη δεν είναι πρόσκληση — αδιάκριτη από ανύπαρκτη.
    belongs: (stored) => typeof stored.companyId === 'string' && stored.companyId.length > 0,
  }),
};

/**
 * **Είναι ήδη μέλος;** — μέσω του **ΕΝΟΣ** κριτή (ADR-787 §5.1), ποτέ με δεύτερη ανάγνωση.
 *
 * ⚠️ **`'home' | 'member'`, ΚΑΙ ΟΧΙ `isAllowed(verdict)`** — μετρημένη διαφορά: ο
 * `super_admin` παίρνει `platform-bypass`, που **επιτρέπει** χωρίς να υπάρχει έγγραφο
 * μέλους. Με το πλατύ κατηγόρημα, μια **νόμιμη** αποδοχή υπερδιαχειριστή θα απορριπτόταν
 * ως «είσαι ήδη μέλος», και δεν θα γραφόταν ποτέ το έγγραφο που του λείπει.
 */
async function refuseIfAlreadyMember(
  identity: RedeemingIdentity,
  companyId: string,
): Promise<InvitationPrecheck<'already-member', 'membership-unknown'> | null> {
  const decision = await decideMembership({
    uid: identity.uid,
    claimCompanyId: identity.claimCompanyId,
    globalRole: identity.globalRole,
    requested: orgWorkspace(companyId),
  });

  if (decision.verdict === 'unknown') return { kind: 'unavailable', reason: 'membership-unknown' };
  return decision.verdict === 'home' || decision.verdict === 'member'
    ? { kind: 'refused', reason: 'already-member' }
    : null;
}

/**
 * 🔴 **Ο ΡΟΛΟΣ ΞΑΝΑΡΩΤΙΕΤΑΙ ΣΤΗΝ ΕΞΑΡΓΥΡΩΣΗ, ΟΧΙ ΜΟΝΟ ΣΤΗΝ ΕΚΔΟΣΗ.** Το Ρ1/Ρ2 κρίθηκαν όταν στάλθηκε η
 * πρόσκληση· εδώ η τιμή έρχεται **από τη βάση**, και ο τύπος του εγγράφου τη δηλώνει `string` ακριβώς γι'
 * αυτό. Χωρίς αυτόν τον έλεγχο, ένα αλλοιωμένο `role` θα γινόταν αυτούσιο ο `globalRole` του ανθρώπου —
 * ανύψωση προνομίων που **καμία** πύλη δεν βλέπει.
 * ⚠️ `null` ⇒ `invitation-corrupt`, **όχι** ονομασμένη άρνηση: καμία ενέργεια του ανθρώπου δεν το διορθώνει.
 */
function workspaceInvitationRecord(
  stored: WorkspaceInvitationDocument,
  resolution: InvitationResolution,
): WorkspaceInvitation | null {
  if (!isInvitableRole(stored.role)) {
    logger.error('Πρόσκληση με ρόλο εκτός λεξιλογίου — δεν εξαργυρώνεται', {
      invitationId: stored.id,
      companyId: stored.companyId,
    });
    return null;
  }
  return { ...stored, role: stored.role, ...resolution };
}

const WORKSPACE_INVITATION_KIND: InvitationKind<
  WorkspaceInvitationDocument,
  WorkspaceInvitation,
  RedeemingIdentity,
  WorkspaceInvitationRefusal,
  'membership-unknown'
> = {
  ...WORKSPACE_INVITATION_LOCATOR,
  // ⚠️ Λείπει ΔΙΚΟ ΜΑΣ μυστικό — «δεν μπόρεσα», ποτέ «πλαστός σύνδεσμος».
  secretMissing: 'membership-unknown',
  prepareAcceptance: (identity, stored) => refuseIfAlreadyMember(identity, stored.companyId),
  recordOf: workspaceInvitationRecord,
  onAccept: (tx, { record, identity }) => {
    // 🔑 **Ο ΕΝΑΣ ΓΡΑΦΕΑΣ** (άγκυρα Μ2) — ο ίδιος που καλεί η έγκριση αιτήματος.
    grantWorkspaceMembershipInTx(tx, {
      uid: identity.uid,
      companyId: record.companyId,
      globalRole: record.role,
      // 🔴 ADR-853 Ε4 (ADR-867 Β9(β)): «ποιος τον έβαλε» = ο **προσκαλών** (Slack/GitHub «invited by»)·
      //    ο προσκεκλημένος απλώς **δέχτηκε**, και αυτό το λέει ήδη η πρόσκληση (`resolvedByUid`).
      grantedByUid: record.invitedByUid,
      enrollment: 'invitation',
    });
  },
};

// =============================================================================
// 3. «ΑΝΟΙΧΤΗΚΕ» — ένδειξη, όχι απόδειξη
// =============================================================================

/**
 * Σημειώνει ότι ο σύνδεσμος **ανοίχτηκε** (κατάσταση παράδοσης, §5 #5) — μέσω του κοινού πυρήνα:
 * ⚠️ ένδειξη, όχι απόδειξη (σαρωτές email) · μη μπλοκάρον, ποτέ δεν πετά · μόνο την πρώτη φορά.
 */
export async function markWorkspaceInvitationOpened(
  invitationId: string,
  nowISOValue: string = clockNowISO(),
): Promise<void> {
  const db = getAdminFirestore();
  await markInvitationOpenedAt(db, db.collection(COLLECTIONS.WORKSPACE_INVITATIONS).doc(invitationId), nowISOValue);
}
