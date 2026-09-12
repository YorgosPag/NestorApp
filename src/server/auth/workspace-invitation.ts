import 'server-only';

/**
 * @fileoverview **Η ΠΡΟΣΚΛΗΣΗ, ΑΠΟ ΤΗΝ ΠΛΕΥΡΑ ΤΟΥ ΧΩΡΟΥ** — έκδοση · επαναποστολή · ανάκληση.
 * @related ADR-853 §7 (Α1 · Α3 · §7.1-§7.4) · ADR-844 (δόγμα token) · lib/tokens/signed-token
 * @module server/auth/workspace-invitation
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ ΧΩΡΙΣΤΑ ΑΠΟ ΤΗΝ ΕΞΑΡΓΥΡΩΣΗ
 * ─────────────────────────────────────────────────────────────────────────────
 * Εδώ ζει ό,τι κάνει **ο χώρος**: προσκαλεί, ξαναστέλνει, ανακαλεί. Η **αποδοχή** και η
 * **άρνηση** είναι πράξεις **του ανθρώπου** και ζουν στο `workspace-invitation-redeem.ts`.
 * Δεν είναι κόψιμο για το όριο των 500 γραμμών (N.7.1) — είναι **δύο δρώντες με δύο
 * εντελώς διαφορετικά δικαιώματα**: εδώ απαιτείται ικανότητα διαχειριστή, εκεί απαιτείται
 * **υπογεγραμμένο token + επαληθευμένο email**. Ένα αρχείο θα έβαζε τους δύο ελέγχους
 * δίπλα-δίπλα, όπου ο επόμενος μπορεί να καλέσει τον λάθος.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 Η ΙΔΕΜΠΟΤΗΣΙΑ ΕΙΝΑΙ **ΑΤΟΜΙΚΗ**, ΚΑΙ ΕΔΩ ΑΠΟΚΛΙΝΟΥΜΕ ΑΠΟ ΤΟ ΠΡΟΤΥΠΟ ΜΑΣ
 * ─────────────────────────────────────────────────────────────────────────────
 * Το `first-contact-invitation.service.ts` (ADR-844) κάνει το supersede με ερώτημα **έξω**
 * από τη συναλλαγή και μετά `batch` — δηλαδή **ΔΕΝ είναι ατομικό**: δύο ταυτόχρονες
 * αποστολές μπορούν να δουν και οι δύο «καμία προηγούμενη» και να αφήσουν **δύο ζωντανά
 * token**. Εδώ το ερώτημα τρέχει **μέσα** στη συναλλαγή (`tx.get(query)` — ίδιο ιδίωμα με
 * το `first-contact.service.ts:202` και το `pipeline-queue-service.ts:99`, που το γράφει
 * ρητά ως άμυνα σε race condition). Το ADR-853 §7.3 το απαιτεί ονομαστικά.
 */

import type { Transaction } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { compareRoleLevels } from '@/lib/auth';
// 🔑 ADR-742 — ο ΕΝΑΣ κριτής του «ανήκει ΑΥΤΟ το έγγραφο στον μισθωτή μου;».
// ⛔ ΜΗΝ γράψεις εδώ `stored.companyId !== input.companyId`: το κενό δεν είναι tenant,
//    είναι **απουσία** tenant — αφελής `===` κάνει καλούντα με χαλασμένο token
//    (`companyId: ''`) να ταιριάζει με κάθε έγγραφο που έχει κενό companyId.
import { isPayloadOwnedByCompany } from '@/lib/auth/tenant-ownership';
import { normaliseChannelEmail } from '@/lib/contact/channel-email';
import { nowISO as clockNowISO } from '@/lib/date-local';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { sha256HexOfText } from '@/lib/hash/sha256';
import { createModuleLogger } from '@/lib/telemetry';
import { encodeSignedToken, newTokenNonce, requireTokenSecret } from '@/lib/tokens/signed-token';
import { generateWorkspaceInvitationId } from '@/services/enterprise-id.service';
import {
  isInvitableRole,
  readStoredInvitationState,
  type InvitableRole,
  type WorkspaceInvitation,
  type WorkspaceInvitationDocument,
  type WorkspaceInvitationView,
} from '@/types/workspace-invitation';

const logger = createModuleLogger('workspace-invitation');

/**
 * ⚠️ **Δικό του μυστικό, ΠΟΤΕ κοινό με τις άλλες πύλες.** Τα πεδία ενός υπογεγραμμένου
 * συνδέσμου είναι απλό κείμενο και η υπογραφή **δεν ξέρει σε ποια πύλη ανήκει**: με κοινό
 * μυστικό, σύνδεσμος πρώτης επαφής με τα σωστά πεδία θα περνούσε για **πρόσκληση σε
 * γραφείο**. Ξεχωριστά μυστικά κάνουν τη σύγχυση **αδύνατη**.
 */
const SECRET_ENV = 'WORKSPACE_INVITE_SECRET';

/** GitHub 7 · Autodesk 7 · Auth0 default 7 (ADR-853 §5). Το 30 του Slack αφορά κοινόχρηστο σύνδεσμο. */
const LIFETIME_DAYS = 7;

/** Πόσες ζωντανές προσκλήσεις διαβάζονται για supersede — ένα ζευγάρι δεν έχει ποτέ 20. */
const LIVE_SCAN_LIMIT = 20;

// =============================================================================
// 1. ΕΚΔΟΣΗ
// =============================================================================

export interface IssueInvitationInput {
  readonly companyId: string;
  /** Ωμό όπως το πληκτρολόγησε ο διαχειριστής — κανονικοποιείται **εδώ**. */
  readonly inviteeEmailRaw: string;
  readonly role: string;
  readonly inviterUid: string;
  readonly inviterRole: string;
  /** Η **περασμένη** στιγμή· κανένα ρολόι εδώ μέσα, ώστε τα άκρα να είναι δοκιμάσιμα. */
  readonly nowISOValue?: string;
}

export type IssueInvitationOutcome =
  | {
      readonly kind: 'issued';
      readonly invitation: WorkspaceInvitation;
      /** Ωμό **μόνο εδώ και στο email** — στη βάση ζει μόνο το `sha256` του nonce. */
      readonly token: string;
      /** Πόσες προηγούμενες ζωντανές ακυρώθηκαν μέσα στην ίδια συναλλαγή. */
      readonly supersededCount: number;
    }
  | { readonly kind: 'refused'; readonly reason: 'role-not-invitable' | 'role-above-inviter' };

/**
 * **Νέα πρόσκληση** — γράφει το έγγραφο και ακυρώνει κάθε προηγούμενη ζωντανή, **ατομικά**.
 *
 * 🔴 **ΔΥΟ ΑΝΕΞΑΡΤΗΤΟΙ ΦΡΟΥΡΟΙ ΡΟΛΟΥ, ΠΟΤΕ ΕΝΑΣ ΜΕ «Ή»** (Α3 · άγκυρες Ρ1/Ρ2):
 *
 * 1. **Ρ2** — ο ρόλος πρέπει να περνά το {@link isInvitableRole} *(κλειστό σύνολο τριών,
 *    `types/workspace-invitation.ts`)*. Κόβει τον `super_admin` **πάντα**, ακόμη κι όταν
 *    προσκαλεί `super_admin`.
 * 2. **Ρ1** — ταβάνι: ποτέ ρόλος **πάνω** από τον προσκαλούντα (`compareRoleLevels`).
 *
 * ⚠️ Ο (2) **δεν** καθιστά τον (1) περιττό, παρότι σήμερα ο `super_admin` είναι `level: 0`
 * και θα έπεφτε ούτως ή άλλως στο ταβάνι **για όλους**. Τη μέρα που προστεθεί **δεύτερος**
 * bypass ρόλος σε άλλο level, το ταβάνι θα τον επέτρεπε σιωπηλά (μάθημα CHECK 3.41).
 */
export async function issueWorkspaceInvitation(
  input: IssueInvitationInput,
): Promise<IssueInvitationOutcome> {
  if (!isInvitableRole(input.role)) return { kind: 'refused', reason: 'role-not-invitable' };

  // `compareRoleLevels(a, b) < 0` ⇒ ο **a** έχει ΥΨΗΛΟΤΕΡΗ πρόσβαση (μικρότερο level).
  // Άρα «όχι πάνω από εμένα» = ο προσκεκλημένος **δεν** πρέπει να είναι μικρότερος.
  if (compareRoleLevels(input.role, input.inviterRole) < 0) {
    return { kind: 'refused', reason: 'role-above-inviter' };
  }

  const secret = requireTokenSecret(SECRET_ENV);
  const nowValue = input.nowISOValue ?? clockNowISO();
  const inviteeEmail = normaliseChannelEmail(input.inviteeEmailRaw);

  const id = generateWorkspaceInvitationId();
  const nonce = newTokenNonce();
  const expiresAtMs = Date.parse(nowValue) + LIFETIME_DAYS * 24 * 60 * 60 * 1000;

  // ⚠️ **ΧΙΛΙΟΣΤΑ, ΠΟΤΕ ISO** (ADR-853 §7.4): το ISO κουβαλά άνω-κάτω τελείες — τον ίδιο
  //    χαρακτήρα που χωρίζει τα πεδία. Είναι το ελάττωμα που κρατούσε **κάθε** σύνδεσμο
  //    προμηθευτή νεκρό από την πρώτη μέρα, και το `encodeSignedToken` πλέον **αρνείται**
  //    να υπογράψει πεδίο με `:`.
  const token = encodeSignedToken(secret, [id, nonce, String(expiresAtMs)]);

  const invitation: WorkspaceInvitation = {
    id,
    companyId: input.companyId,
    inviteeEmail,
    role: input.role as InvitableRole,
    invitedByUid: input.inviterUid,
    nonceHash: await sha256HexOfText(nonce),
    state: 'pending',
    createdAt: nowValue,
    expiresAt: new Date(expiresAtMs).toISOString(),
    openedAt: null,
    resolvedAt: null,
    resolvedByUid: null,
  };

  const supersededCount = await writeWithSupersede(invitation, input.inviterUid, nowValue);

  logger.info('Εκδόθηκε πρόσκληση χώρου', {
    invitationId: id,
    companyId: input.companyId,
    supersededCount,
  });

  return { kind: 'issued', invitation, token, supersededCount };
}

/**
 * **Γράψε τη νέα και σβήσε τις παλιές — ΜΕΣΑ σε μία συναλλαγή** (§7.3).
 *
 * 🔴 **Η ΣΕΙΡΑ ΕΙΝΑΙ ΥΠΟΧΡΕΩΤΙΚΗ**: το Firestore απαιτεί **όλες** τις αναγνώσεις μιας
 * συναλλαγής **πριν** από κάθε γραφή. Το ερώτημα τρέχει πρώτο, οι γραφές ακολουθούν.
 *
 * ⚠️ **Ερώτημα με ΤΡΕΙΣ ισότητες και καμία διάταξη** — εξυπηρετείται από τη συγχώνευση
 * μονοπεδιακών ευρετηρίων της Firestore, χωρίς δηλωμένο σύνθετο ευρετήριο. *(Τα σύνθετα
 * του `vendor_invites` υπάρχουν επειδή εκείνα τα ερωτήματα έχουν διάταξη/εύρος.)*
 * ⚠️ Και περιλαμβάνει `companyId`, άρα δεν ζητά γραμμένη εξαίρεση tenant-scope (CHECK 3.10).
 */
async function writeWithSupersede(
  invitation: WorkspaceInvitation,
  actorUid: string,
  nowValue: string,
): Promise<number> {
  const db = getAdminFirestore();
  const collection = db.collection(COLLECTIONS.WORKSPACE_INVITATIONS);

  return db.runTransaction(async (tx: Transaction) => {
    const live = await tx.get(
      collection
        .where('companyId', '==', invitation.companyId)
        .where('inviteeEmail', '==', invitation.inviteeEmail)
        .where('state', '==', 'pending')
        .limit(LIVE_SCAN_LIMIT),
    );

    // ⚠️ Η κατάσταση ξαναδιαβάζεται **fail-closed** και δεν εμπιστευόμαστε το `where`:
    //    ένα έγγραφο με χαλασμένο `state` δεν πρέπει να μετρηθεί ως ζωντανό.
    const stale = live.docs.filter(
      (doc) => readStoredInvitationState((doc.data() as WorkspaceInvitationDocument).state) === 'pending',
    );

    for (const doc of stale) {
      tx.update(collection.doc(doc.id), {
        state: 'revoked',
        resolvedAt: nowValue,
        resolvedByUid: actorUid,
      });
    }

    tx.set(collection.doc(invitation.id), invitation);
    return stale.length;
  });
}

// =============================================================================
// 2. ΑΝΑΚΛΗΣΗ
// =============================================================================

export type RevokeInvitationOutcome =
  | { readonly kind: 'revoked' }
  /** Δεν υπάρχει τέτοια πρόσκληση **σε αυτόν τον χώρο** — ποτέ «υπάρχει αλλού». */
  | { readonly kind: 'absent' }
  /** Ήδη κλειστή — **καμία** γραφή (ιδεμποτησία· ποτέ σιωπηλή ανατροπή). */
  | { readonly kind: 'already'; readonly state: string };

/**
 * **Ανάκληση** — μόνο πάνω σε `pending`, μέσα σε συναλλαγή.
 *
 * ⚠️ **Ο χώρος περνιέται ΚΑΙ ελέγχεται**, παρότι το `id` είναι μοναδικό: χωρίς αυτό, ένας
 * διαχειριστής θα μπορούσε να ανακαλέσει πρόσκληση **ξένου** γραφείου γνωρίζοντας μόνο το
 * αναγνωριστικό. Η απάντηση είναι `absent`, ποτέ «υπάρχει αλλά δεν επιτρέπεσαι» — αλλιώς
 * η διαδρομή γίνεται όργανο απαρίθμησης (ADR-787 Ε-5 §4 #1).
 */
export async function revokeWorkspaceInvitation(input: {
  readonly invitationId: string;
  readonly companyId: string;
  readonly revokedByUid: string;
  readonly nowISOValue?: string;
}): Promise<RevokeInvitationOutcome> {
  const db = getAdminFirestore();
  const ref = db.collection(COLLECTIONS.WORKSPACE_INVITATIONS).doc(input.invitationId);
  const nowValue = input.nowISOValue ?? clockNowISO();

  return db.runTransaction(async (tx: Transaction) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return { kind: 'absent' };

    const stored = snap.data() as WorkspaceInvitationDocument;
    // Πολιτική «σιωπηλή» (ADR-742): ξένο = **αδιάκριτο από ανύπαρκτο**, ποτέ «υπάρχει
    // αλλά δεν επιτρέπεσαι» — αλλιώς η διαδρομή γίνεται όργανο απαρίθμησης.
    if (!isPayloadOwnedByCompany(stored, input.companyId)) return { kind: 'absent' };

    const state = readStoredInvitationState(stored.state);
    if (state !== 'pending') return { kind: 'already', state };

    tx.update(ref, { state: 'revoked', resolvedAt: nowValue, resolvedByUid: input.revokedByUid });
    return { kind: 'revoked' };
  });
}

// =============================================================================
// 3. ΕΠΑΝΑΠΟΣΤΟΛΗ
// =============================================================================

// **Επαναποστολή = νέα έκδοση**, και γι' αυτό ΔΕΝ υπάρχει συνάρτηση «resend» εδώ.
//
// 🔑 ΤΟ ΙΔΙΟ ΤΟ ADR ΤΟ ΑΠΑΙΤΕΙ (§7.1): η επαναποστολή οφείλει να γεννά **νέο token με νέα
//    λήξη** — γι' αυτό ακριβώς το `winv` είναι **μη** ντετερμινιστικό. Μια «ανανέωση» του
//    ίδιου εγγράφου θα άφηνε το **παλιό token ζωντανό**: δύο κλειδιά για μία πόρτα.
//
// ⇒ Ο καλών ξαναφωνάζει την `issueWorkspaceInvitation`. Η προηγούμενη γίνεται `revoked`
//   μέσα στην ίδια συναλλαγή, και ο άνθρωπος που πατά τον **παλιό** σύνδεσμο (γιατί τον
//   βρήκε πρώτο στα εισερχόμενα) παίρνει «ανακλήθηκε» — όχι «άκυρος», που θα του έλεγε ότι
//   κάποιος τον εξαπατά ενώ απλώς κοίταξε το προηγούμενο μήνυμα.
//
// ⛔ ΜΗΝ γράψεις `resendWorkspaceInvitation` που ενημερώνει `expiresAt` επί τόπου, και ΜΗΝ
//    βάλεις εδώ εξαγόμενη σταθερά «σημαία» για να κρατήσει αυτό το σχόλιο: εξαγωγή χωρίς
//    καλούντα είναι νεκρός κώδικας (CHECK 3.22) και, χειρότερα, μοιάζει με διακόπτη.

// =============================================================================
// 4. ΑΝΑΓΝΩΣΗ — «ποιες προσκλήσεις περιμένουν σε ΑΥΤΟΝ τον χώρο;»
// =============================================================================

/** Όσες διαβάζει η λίστα διαχειριστή — ίδιο φράγμα με τα αιτήματα ένταξης. */
const INVITATION_LIST_LIMIT = 500;

/**
 * **Η όψη — και η κατάσταση ΠΑΡΑΓΕΤΑΙ, δεν αντιγράφεται.**
 *
 * 🔴 Μια `pending` με **περασμένη** ώρα ταξιδεύει ως `expired`. Κανείς δεν σκουπίζει τις
 * ληγμένες σε πραγματικό χρόνο — γι' αυτό η εξαργύρωση ελέγχει τη λήξη **δύο** φορές
 * (άγκυρα Τ2), και για τον **ίδιο** λόγο η λίστα δεν επιτρέπεται να λέει «σε αναμονή» για
 * σύνδεσμο που **δεν δουλεύει**: ο διαχειριστής θα περίμενε άνθρωπο που δεν μπορεί πια να
 * απαντήσει, και θα δίσταζε να ξαναστείλει.
 *
 * ⚠️ **Δεν γράφει τίποτα.** Η μετάβαση σε `expired` στη βάση θα ήταν γραφή μέσα σε
 * **ανάγνωση** — δηλαδή μια λίστα θα άλλαζε τον κόσμο επειδή κάποιος την κοίταξε.
 *
 * @returns `null` για κακοσχηματισμένο έγγραφο — **σιωπηλή απόρριψη**, ίδιο ιδίωμα με το
 *          `toView` των αιτημάτων ένταξης: μια λίστα δεν πέφτει επειδή ένα έγγραφο χάλασε.
 */
function toInvitationView(
  id: string,
  stored: WorkspaceInvitationDocument,
  nowValue: string,
): WorkspaceInvitationView | null {
  // ⚠️ Ο ρόλος κρίνεται **με έλεγχο**, ποτέ με `as`: ο τύπος του εγγράφου τον δηλώνει
  //    `string` επίτηδες (αλλοιωμένη τιμή δεν γίνεται σιωπηλά `globalRole` — δες τον τύπο).
  if (!isInvitableRole(stored.role)) return null;
  if (typeof stored.inviteeEmail !== 'string' || stored.inviteeEmail.length === 0) return null;

  const stateOnDisk = readStoredInvitationState(stored.state);
  const expired = stateOnDisk === 'pending' && Date.parse(stored.expiresAt) <= Date.parse(nowValue);

  return {
    id,
    companyId: stored.companyId,
    inviteeEmail: stored.inviteeEmail,
    role: stored.role,
    state: expired ? 'expired' : stateOnDisk,
    invitedByUid: stored.invitedByUid,
    createdAt: stored.createdAt,
    expiresAt: stored.expiresAt,
    openedAt: stored.openedAt,
    resolvedAt: stored.resolvedAt,
    resolvedByUid: stored.resolvedByUid,
  };
}

/**
 * **Οι ΖΩΝΤΑΝΕΣ προσκλήσεις αυτού του χώρου** — ποτέ άλλου.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ ΜΟΝΟ ΟΙ `pending`, ΚΑΙ ΟΧΙ ΟΛΟ ΤΟ ΙΣΤΟΡΙΚΟ
 * ─────────────────────────────────────────────────────────────────────────────
 * Η **αποδεκτή** πρόσκληση **ΕΙΝΑΙ μέλος**: εμφανίζεται ήδη στη λίστα χρηστών, από την
 * ίδια απάντηση. Να ταξιδέψει **και** ως πρόσκληση σημαίνει **δύο γραμμές για έναν
 * άνθρωπο** — ακριβώς το κατηγοριακό λάθος που αποφεύγει το §7.1 όταν αρνείται να την
 * αποθηκεύσει ως `workspace_members` με `status: 'invited'`.
 *
 * Η **ανακλημένη** και η **αρνημένη** είναι **ιστορικό**, όχι εκκρεμότητα· ζουν στο ίχνος.
 * Η **ληγμένη** επιστρέφεται (είναι `pending` στον δίσκο) — και **σωστά**: ο διαχειριστής
 * πρέπει να τη δει για να αποφασίσει επαναποστολή.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠️ ΔΥΟ ΙΣΟΤΗΤΕΣ, ΚΑΜΙΑ ΔΙΑΤΑΞΗ — ΚΑΙ ΕΙΝΑΙ ΜΕΤΡΗΜΕΝΟ
 * ─────────────────────────────────────────────────────────────────────────────
 * Εξυπηρετείται από συγχώνευση **μονοπεδιακών** ευρετηρίων, **χωρίς** δηλωμένο σύνθετο
 * (ίδιο σκεπτικό με το `writeWithSupersede` παραπάνω· το `firestore.indexes.json` δεν έχει
 * **καμία** εγγραφή ούτε για τα αιτήματα ένταξης, που ρωτούν ταυτόσημα). Ένα
 * `orderBy('createdAt')` θα απαιτούσε σύνθετο ευρετήριο και **νέα δήλωση** (CHECK 3.15) για
 * να ταξινομήσει δεκάδες έγγραφα — η οθόνη τα ταξινομεί στη μνήμη.
 *
 * ⚠️ Περιλαμβάνει `companyId`, άρα **δεν** ζητά γραμμένη εξαίρεση tenant-scope (CHECK 3.10).
 */
export async function listPendingWorkspaceInvitations(
  companyId: string,
  nowISOValue: string = clockNowISO(),
): Promise<WorkspaceInvitationView[]> {
  const snap = await getAdminFirestore()
    .collection(COLLECTIONS.WORKSPACE_INVITATIONS)
    .where('companyId', '==', companyId)
    .where('state', '==', 'pending')
    .limit(INVITATION_LIST_LIMIT)
    .get();

  return snap.docs.flatMap((doc) => {
    const view = toInvitationView(doc.id, doc.data() as WorkspaceInvitationDocument, nowISOValue);
    return view === null ? [] : [view];
  });
}
