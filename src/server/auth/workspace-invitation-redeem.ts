import 'server-only';

/**
 * @fileoverview **Η ΠΡΟΣΚΛΗΣΗ, ΑΠΟ ΤΗΝ ΠΛΕΥΡΑ ΤΟΥ ΑΝΘΡΩΠΟΥ** — αποδοχή · άρνηση · «ανοίχτηκε».
 * @related ADR-853 §7.4 · §7.5 (δύο έλεγχοι) · Α2/Μ1/Μ2 · άγκυρες Τ1-Τ4
 * @module server/auth/workspace-invitation-redeem
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΔΥΟ ΕΛΕΓΧΟΙ ΤΑΥΤΟΤΗΤΑΣ, ΟΧΙ ΕΝΑΣ (§7.5)
 * ─────────────────────────────────────────────────────────────────────────────
 * Η αποδοχή απαιτεί **ΚΑΙ** έγκυρο υπογεγραμμένο token **ΚΑΙ** συνδεδεμένο χρήστη του
 * οποίου το **επαληθευμένο** email ταιριάζει με τον παραλήπτη.
 *
 * Το token μόνο του **δεν αρκεί**: ένα προωθημένο email θα έδινε σε τρίτον τη θέση που
 * προοριζόταν για άλλον. Εκεί ακριβώς σπάει το **Figma**, που δηλώνει ρητά ότι *δεν*
 * δεσμεύει τον σύνδεσμο σε λογαριασμό («πρόσεξε με ποιον λογαριασμό είσαι»).
 *
 * ⚠️ Και το **επαληθευμένο** κάνει τη μισή δουλειά: χωρίς αυτό, οποιοσδήποτε δηλώνει το
 * email του στόχου σε νέο λογαριασμό και το «ταίριασμα» περνά.
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

import type { Transaction } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { decideMembership } from '@/lib/auth/workspace-membership';
import { sameChannelEmail } from '@/lib/contact/channel-email';
import { nowISO as clockNowISO } from '@/lib/date-local';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { sha256HexOfText } from '@/lib/hash/sha256';
import { createModuleLogger } from '@/lib/telemetry';
import { decodeSignedToken, equalsInConstantTime, requireTokenSecret } from '@/lib/tokens/signed-token';
import { grantWorkspaceMembershipInTx } from '@/lib/workspace/grant-membership';
// 🔑 ADR-853 Φ4 — ο ΕΝΑΣ αναγνώστης ονόματος χώρου του διακομιστή (εξήχθη 2026-09-12).
// ⛔ ΜΗΝ διαβάσεις εδώ το `companies/{id}` μόνος σου, και ΜΗΝ καλέσεις τον πελατικό
//    `useCompanyDisplayName`: εκείνος ρωτά **άλλη συλλογή** (`contacts`) με άλλα πεδία.
import { readWorkspaceName } from '@/lib/workspace/workspace-catalog';
import { orgWorkspace } from '@/types/workspace-membership';
import {
  isInvitableRole,
  readStoredInvitationState,
  type WorkspaceInvitation,
  type WorkspaceInvitationDocument,
  type WorkspaceInvitationPreview,
  type WorkspaceInvitationRefusal,
  type WorkspaceInvitationState,
} from '@/types/workspace-invitation';

const logger = createModuleLogger('workspace-invitation-redeem');

/** ⚠️ Ίδιο με του εκδότη — και **ποτέ** κοινό με άλλη πύλη (δες `workspace-invitation.ts`). */
const SECRET_ENV = 'WORKSPACE_INVITE_SECRET';

/** Ο άνθρωπος που πατά τον σύνδεσμο — **ήδη συνδεδεμένος**, από το σύνορο HTTP. */
export interface RedeemingIdentity {
  readonly uid: string;
  readonly email: string;
  /**
   * ⚠️ **Από το Firebase Auth, ΟΧΙ από custom claim.** Το `AuthContext` δεν το εκθέτει· ο
   * ιδιοκτήτης του είναι το Auth (`getUser(uid).emailVerified`), και ένα custom claim με
   * το ίδιο όνομα θα ήταν **δεύτερη αυθεντία** που μπορεί να λέει «ναι» ενώ το Auth λέει
   * «όχι» (ADR-749· γραμμένο ήδη στο `workspace-provisioning.ts`).
   */
  readonly emailVerified: boolean;
  /** Ο χώρος του **claim** του — για να κριθεί αν είναι ήδη μέλος (ποτέ από τον πελάτη). */
  readonly claimCompanyId: string;
  readonly globalRole: string;
}

export type RedeemOutcome =
  | { readonly kind: 'accepted'; readonly invitation: WorkspaceInvitation }
  | { readonly kind: 'declined'; readonly invitation: WorkspaceInvitation }
  | { readonly kind: 'refused'; readonly reason: WorkspaceInvitationRefusal }
  /**
   * 🔴 **ΟΥΤΕ ΑΠΟΔΟΧΗ ΟΥΤΕ ΑΡΝΗΣΗ — «ΔΕΝ ΜΠΟΡΕΣΑ ΝΑ ΡΩΤΗΣΩ».**
   *
   * Ξεχωριστό από κάθε `refused` **επίτηδες**: το `decideMembership` επιστρέφει `unknown`
   * όταν η αναζήτηση **απέτυχε**, και το ADR-787 Ε-5 §4 #3 το δηλώνει ρητά — «δεν είσαι
   * μέλος» εκεί θα ήταν **ψέμα στον χρήστη**, και «είσαι» θα ήταν διαρροή. Ο καλών
   * απαντά **500**, όχι ονομασμένη άρνηση.
   */
  | {
      readonly kind: 'unavailable';
      readonly reason: 'membership-unknown' | 'invitation-corrupt';
    };

/** Η αποθηκευμένη κατάσταση → ο λόγος που βλέπει ο άνθρωπος. */
const REFUSAL_BY_STATE: Readonly<Record<Exclude<WorkspaceInvitationState, 'pending'>, WorkspaceInvitationRefusal>> = {
  accepted: 'already-used',
  declined: 'already-used',
  revoked: 'revoked',
  expired: 'expired',
};

// =============================================================================
// 1. ΑΠΟΔΟΧΗ
// =============================================================================

/**
 * **Αποδοχή** — ατομική: `pending → accepted` **και** γραφή μέλους, αδιαίρετα (Τ3).
 *
 * 🔴 Δύο ταυτόχρονα κλικ δίνουν **ένα** μέλος και **μία** `accepted`: η δεύτερη συναλλαγή
 * ξαναδιαβάζει κατάσταση που δεν είναι πια `pending` και αρνείται με `already-used`.
 *
 * ⛔ **ΔΕΝ αγγίζει claims** (Μ1 · Α2). Το έγγραφο μέλους γράφεται πάντα· το αν ο άνθρωπος
 * παίρνει **και** `companyId` στο claim το αποφασίζει ο καλών, που είναι ο μόνος που ξέρει
 * αν είχε ήδη χώρο. Εδώ μια απόφαση claim θα **μετακινούσε** μέλος από γραφείο σε γραφείο
 * — η συμπεριφορά που το ADR-853 απέρριψε ονομαστικά.
 */
export async function acceptWorkspaceInvitation(input: {
  readonly token: string;
  readonly identity: RedeemingIdentity;
  readonly nowISOValue?: string;
}): Promise<RedeemOutcome> {
  return redeem(input.token, input.identity, 'accepted', input.nowISOValue ?? clockNowISO());
}

/**
 * **Άρνηση** — ίδια κλειδαριά, καμία γραφή μέλους.
 *
 * 🔑 Είναι **ρητή ανθρώπινη πράξη** και καταγράφεται: ο χώρος βλέπει «απορρίφθηκε» αντί
 * για πρόσκληση που σβήνει σιωπηλά στις 7 μέρες, και δεν ξαναστέλνει στα τυφλά.
 */
export async function declineWorkspaceInvitation(input: {
  readonly token: string;
  readonly identity: RedeemingIdentity;
  readonly nowISOValue?: string;
}): Promise<RedeemOutcome> {
  return redeem(input.token, input.identity, 'declined', input.nowISOValue ?? clockNowISO());
}

// =============================================================================
// 2. Η ΜΙΑ ΚΛΕΙΔΑΡΙΑ
// =============================================================================

async function redeem(
  tokenString: string,
  identity: RedeemingIdentity,
  target: 'accepted' | 'declined',
  nowValue: string,
): Promise<RedeemOutcome> {
  let secret: string;
  try {
    secret = requireTokenSecret(SECRET_ENV);
  } catch {
    // ⚠️ Λείπει ΔΙΚΟ ΜΑΣ μυστικό — δεν το λέμε στον άνθρωπο ως «πλαστός σύνδεσμος».
    logger.error('Λείπει το μυστικό των προσκλήσεων — κάθε σύνδεσμος φαίνεται άκυρος');
    return { kind: 'unavailable', reason: 'membership-unknown' };
  }

  // 🔑 Η υπογραφή ελέγχεται **πριν** από κάθε ανάγνωση: πλαστός σύνδεσμος απορρίπτεται
  //    χωρίς **κανένα** αίτημα στη βάση, οπότε κανείς δεν μας κοστίζει στέλνοντας σκουπίδια.
  const verdict = decodeSignedToken(secret, tokenString, 3);
  if (!verdict.ok || verdict.fields.length !== 3) return refuse('link-invalid');

  const [invitationId, nonce, expiresAtMs] = verdict.fields as [string, string, string];
  const expiryMs = Number(expiresAtMs);
  if (!Number.isFinite(expiryMs)) return refuse('link-invalid');

  // ⚠️ **ΠΡΩΤΟΣ** από τους δύο ελέγχους λήξης (Τ2). Ο δεύτερος ζει στο έγγραφο, παρακάτω:
  //    ο χρόνος ζει σε δύο μέρη και **και τα δύο** πρέπει να συμφωνούν.
  if (expiryMs <= Date.parse(nowValue)) return refuse('expired');

  if (!identity.emailVerified) return refuse('email-unverified');

  const nonceHash = await sha256HexOfText(nonce);
  const companyId = await readInvitationCompany(invitationId);
  if (companyId === null) return refuse('invitation-unknown');

  if (target === 'accepted') {
    const blocked = await refuseIfAlreadyMember(identity, companyId);
    if (blocked !== null) return blocked;
  }

  return consume(invitationId, identity, target, nowValue, nonceHash);
}

/** Ο χώρος της πρόσκλησης — **πριν** τη συναλλαγή, ώστε να κριθεί η ιδιότητα μέλους. */
async function readInvitationCompany(invitationId: string): Promise<string | null> {
  const snap = await getAdminFirestore()
    .collection(COLLECTIONS.WORKSPACE_INVITATIONS)
    .doc(invitationId)
    .get();
  if (!snap.exists) return null;
  const companyId = (snap.data() as WorkspaceInvitationDocument).companyId;
  return typeof companyId === 'string' && companyId.length > 0 ? companyId : null;
}

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
): Promise<RedeemOutcome | null> {
  const decision = await decideMembership({
    uid: identity.uid,
    claimCompanyId: identity.claimCompanyId,
    globalRole: identity.globalRole,
    requested: orgWorkspace(companyId),
  });

  if (decision.verdict === 'unknown') return { kind: 'unavailable', reason: 'membership-unknown' };
  return decision.verdict === 'home' || decision.verdict === 'member'
    ? refuse('already-member')
    : null;
}

/**
 * **Η κατανάλωση — ατομική** (§7.4). Έλεγχος και σφράγισμα είναι **αδιαίρετα**.
 */
async function consume(
  invitationId: string,
  identity: RedeemingIdentity,
  target: 'accepted' | 'declined',
  nowValue: string,
  nonceHash: string,
): Promise<RedeemOutcome> {
  const db = getAdminFirestore();
  const ref = db.collection(COLLECTIONS.WORKSPACE_INVITATIONS).doc(invitationId);

  return db.runTransaction<RedeemOutcome>(async (tx: Transaction) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return refuse('invitation-unknown');

    const stored = snap.data() as WorkspaceInvitationDocument;
    const state = readStoredInvitationState(stored.state);
    if (state !== 'pending') return refuse(REFUSAL_BY_STATE[state]);

    // ⚠️ **ΔΕΥΤΕΡΟΣ** έλεγχος λήξης (Τ2): το έγγραφο μπορεί να λέει `pending` ενώ η ώρα
    //    του πέρασε — κανείς δεν «σκουπίζει» τις ληγμένες σε πραγματικό χρόνο.
    if (Date.parse(stored.expiresAt) <= Date.parse(nowValue)) return refuse('expired');

    // 🔴 Το nonce ελέγχεται **μέσα** στη συναλλαγή: η υπογραφή αποδεικνύει ότι **εμείς**
    //    φτιάξαμε το κείμενο, **όχι** ότι δείχνει σε αυτό το έγγραφο.
    if (!equalsInConstantTime(nonceHash, stored.nonceHash)) return refuse('link-invalid');

    // 🔴 Η ΔΕΣΜΕΥΣΗ ΣΤΟΝ ΠΑΡΑΛΗΠΤΗ (§7.5) — εδώ σπάει το προωθημένο email.
    if (!sameChannelEmail(identity.email, stored.inviteeEmail)) return refuse('wrong-recipient');

    // 🔴 **Ο ΡΟΛΟΣ ΞΑΝΑΡΩΤΙΕΤΑΙ ΣΤΗΝ ΕΞΑΡΓΥΡΩΣΗ, ΟΧΙ ΜΟΝΟ ΣΤΗΝ ΕΚΔΟΣΗ.** Το Ρ1/Ρ2
    //    κρίθηκαν όταν στάλθηκε η πρόσκληση· εδώ η τιμή έρχεται **από τη βάση**, και ο
    //    τύπος του εγγράφου τη δηλώνει `string` ακριβώς γι' αυτό. Χωρίς αυτόν τον έλεγχο,
    //    ένα αλλοιωμένο `role` θα γινόταν αυτούσιο ο `globalRole` του ανθρώπου — ανύψωση
    //    προνομίων που **καμία** πύλη δεν βλέπει.
    //
    // ⚠️ **`unavailable`, ΟΧΙ ονομασμένη άρνηση**: δεν φταίει ο άνθρωπος και **καμία**
    //    ενέργειά του δεν το διορθώνει. Μια «άρνηση» θα του ζητούσε να κάνει κάτι που δεν
    //    υπάρχει.
    if (!isInvitableRole(stored.role)) {
      logger.error('Πρόσκληση με ρόλο εκτός λεξιλογίου — δεν εξαργυρώνεται', {
        invitationId,
        companyId: stored.companyId,
      });
      return { kind: 'unavailable', reason: 'invitation-corrupt' };
    }
    const role = stored.role;

    const resolved = { state: target, resolvedAt: nowValue, resolvedByUid: identity.uid } as const;
    tx.update(ref, resolved);

    if (target === 'accepted') {
      // 🔑 **Ο ΕΝΑΣ ΓΡΑΦΕΑΣ** (άγκυρα Μ2) — ο ίδιος που καλεί η έγκριση αιτήματος.
      grantWorkspaceMembershipInTx(tx, {
        uid: identity.uid,
        companyId: stored.companyId,
        globalRole: role,
        grantedByUid: identity.uid,
      });
    }

    const invitation: WorkspaceInvitation = { ...stored, role, ...resolved, state: target };
    return { kind: target === 'accepted' ? 'accepted' : 'declined', invitation };
  });
}

function refuse(reason: WorkspaceInvitationRefusal): RedeemOutcome {
  return { kind: 'refused', reason };
}

// =============================================================================
// 3. «ΑΝΟΙΧΤΗΚΕ» — ένδειξη, όχι απόδειξη
// =============================================================================

/**
 * Σημειώνει ότι ο σύνδεσμος **ανοίχτηκε** (κατάσταση παράδοσης, §5 #5).
 *
 * ⚠️ **ΕΝΔΕΙΞΗ, ΟΧΙ ΑΠΟΔΕΙΞΗ** (§6 #3): οι πελάτες email προ-φορτώνουν συνδέσμους, οπότε
 * αυτό μπορεί να γράφτηκε από **σαρωτή**. Η οθόνη το λέει με λέξεις.
 *
 * ⚠️ **Μη μπλοκάρον και ΠΟΤΕ δεν πετά**: είναι τηλεμετρία παράδοσης — μια αποτυχία εδώ δεν
 * επιτρέπεται να εμποδίσει τον άνθρωπο να δει την πρόσκλησή του.
 * ⚠️ Γράφει **μόνο την πρώτη φορά**, ώστε το «πότε ανοίχτηκε» να μη γίνεται «πότε
 * ξαναφορτώθηκε η σελίδα».
 */
export async function markWorkspaceInvitationOpened(
  invitationId: string,
  nowISOValue: string = clockNowISO(),
): Promise<void> {
  try {
    const db = getAdminFirestore();
    const ref = db.collection(COLLECTIONS.WORKSPACE_INVITATIONS).doc(invitationId);
    await db.runTransaction(async (tx: Transaction) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return;
      const stored = snap.data() as WorkspaceInvitationDocument;
      if (readStoredInvitationState(stored.state) !== 'pending' || stored.openedAt !== null) return;
      tx.update(ref, { openedAt: nowISOValue });
    });
  } catch (error: unknown) {
    logger.warn('Η σήμανση «ανοίχτηκε» απέτυχε (μη μπλοκάρον)', {
      invitationId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

// =============================================================================
// 4. Η ΟΨΗ ΠΡΙΝ ΤΗΝ ΑΠΟΦΑΣΗ — «ποιος με καλεί, και για τι θέση;»
// =============================================================================

/**
 * 🔴 **ΟΥΤΕ ΟΝΟΜΑΣΜΕΝΗ ΑΡΝΗΣΗ ΟΥΤΕ ΟΨΗ** — ίδια διάκριση με το `unavailable` της
 * εξαργύρωσης: το «λείπει το μυστικό μας» δεν λέγεται στον άνθρωπο ως «πλαστός σύνδεσμος».
 */
export type InvitationPreviewOutcome =
  | {
      readonly kind: 'preview';
      readonly preview: WorkspaceInvitationPreview;
      /**
       * ⚠️ **ΔΕΝ ταξιδεύει στο σύρμα** — ζει στην έκβαση επειδή τη χρειάζεται ο καλών για
       * τη σήμανση «ανοίχτηκε». Δες τον τύπο {@link WorkspaceInvitationPreview}: το
       * αναγνωριστικό δεν έχει λόγο να φτάσει σε ανώνυμο φυλλομετρητή.
       */
      readonly invitationId: string;
    }
  | { readonly kind: 'refused'; readonly reason: WorkspaceInvitationRefusal }
  | { readonly kind: 'unavailable' };

function previewRefuse(reason: WorkspaceInvitationRefusal): InvitationPreviewOutcome {
  return { kind: 'refused', reason };
}

/**
 * **Η όψη της πρόσκλησης, ΧΩΡΙΣ ταυτότητα και ΧΩΡΙΣ κατανάλωση** (ADR-853 §5 #4).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΔΕΝ ΕΛΕΓΧΕΙ EMAIL — ΚΑΙ ΓΙΑΤΙ Η ΔΕΣΜΕΥΣΗ ΜΕΝΕΙ ΑΚΕΡΑΙΗ
 * ─────────────────────────────────────────────────────────────────────────────
 * Εδώ **δεν υπάρχει συνδεδεμένος άνθρωπος**: η σελίδα ανοίγει από το email **πριν** από
 * κάθε ταυτότητα, και ο παραλήπτης περνά από `/login` **μετά** (§6 #2). Ένας έλεγχος
 * παραλήπτη θα ήταν δομικά αδύνατος — δεν υπάρχει ποιον να ελέγξει.
 *
 * ⚠️ **Η δέσμευση στο επαληθευμένο email ΔΕΝ χαλαρώνει**: κρίνεται στην **εξαργύρωση**
 * (§7.5, άγκυρες Τ1/Τ1β), που είναι η πράξη που **γράφει**. Αυτή εδώ δεν γράφει τίποτα
 * *(πλην της τηλεμετρίας «ανοίχτηκε»)*, άρα ό,τι μαθαίνει ο κρατών τον σύνδεσμο είναι
 * **όνομα γραφείου, ρόλος, λήξη** — και κανένα προσωπικό δεδομένο.
 *
 * 🔑 **Και γι' αυτό η ανάγνωση ΔΕΝ ΚΑΙΕΙ ΤΗΝ ΠΡΟΣΚΛΗΣΗ** — ίδιο δόγμα με το
 * `open-invite.ts` της πύλης προμηθευτών: το `pending` μένει `pending`, όσες φορές κι αν
 * ανοίξει ο άνθρωπος τη σελίδα. Αλλιώς μια προ-φόρτωση του πελάτη email θα κατανάλωνε
 * πρόσκληση που **κανένας άνθρωπος δεν είδε**.
 *
 * ⚠️ **Η υπογραφή ελέγχεται ΠΡΙΝ από κάθε ανάγνωση βάσης**: πλαστός σύνδεσμος δεν μας
 * κοστίζει ούτε ένα αίτημα Firestore (ίδιο σκεπτικό με το `redeem`, και ρητή απαίτηση του
 * ADR-327 §11 για τις δημόσιες πύλες).
 */
export async function previewWorkspaceInvitation(input: {
  readonly token: string;
  readonly nowISOValue?: string;
}): Promise<InvitationPreviewOutcome> {
  const nowValue = input.nowISOValue ?? clockNowISO();

  let secret: string;
  try {
    secret = requireTokenSecret(SECRET_ENV);
  } catch {
    logger.error('Λείπει το μυστικό των προσκλήσεων — καμία όψη δεν μπορεί να δοθεί');
    return { kind: 'unavailable' };
  }

  const verdict = decodeSignedToken(secret, input.token, 3);
  if (!verdict.ok || verdict.fields.length !== 3) return previewRefuse('link-invalid');

  const [invitationId, nonce, expiresAtMs] = verdict.fields as [string, string, string];
  const expiryMs = Number(expiresAtMs);
  if (!Number.isFinite(expiryMs)) return previewRefuse('link-invalid');
  if (expiryMs <= Date.parse(nowValue)) return previewRefuse('expired');

  const snap = await getAdminFirestore()
    .collection(COLLECTIONS.WORKSPACE_INVITATIONS)
    .doc(invitationId)
    .get();
  if (!snap.exists) return previewRefuse('invitation-unknown');

  const stored = snap.data() as WorkspaceInvitationDocument;

  const state = readStoredInvitationState(stored.state);
  if (state !== 'pending') return previewRefuse(REFUSAL_BY_STATE[state]);

  // ⚠️ **ΔΕΥΤΕΡΟΣ** έλεγχος λήξης, όπως στην εξαργύρωση (Τ2): ο χρόνος ζει σε δύο μέρη.
  if (Date.parse(stored.expiresAt) <= Date.parse(nowValue)) return previewRefuse('expired');

  // 🔴 Η υπογραφή αποδεικνύει ότι **εμείς** φτιάξαμε το κείμενο — **όχι** ότι δείχνει σε
  //    αυτό το έγγραφο. Το nonce είναι εκείνο που το δένει.
  if (!equalsInConstantTime(await sha256HexOfText(nonce), stored.nonceHash)) {
    return previewRefuse('link-invalid');
  }

  // ⚠️ Ίδιος φρουρός με την εξαργύρωση (Μ3) και για τον **ίδιο** λόγο: ο τύπος του
  //    εγγράφου δηλώνει τον ρόλο `string` επίτηδες. Εδώ δεν γράφεται τίποτα — αλλά μια
  //    όψη που δείχνει ρόλο **εκτός λεξιλογίου** υπόσχεται θέση που δεν θα δοθεί ποτέ.
  if (!isInvitableRole(stored.role)) {
    logger.error('Πρόσκληση με ρόλο εκτός λεξιλογίου — δεν εμφανίζεται', { invitationId });
    return { kind: 'unavailable' };
  }

  return {
    kind: 'preview',
    invitationId,
    preview: {
      workspaceName: await readWorkspaceName(stored.companyId),
      role: stored.role,
      expiresAt: stored.expiresAt,
      // 🔑 §6 #4 — «καμία επαλήθευση ΓΕΜΗ/ΑΦΜ σε αυτή τη φάση». Δες τον τύπο για το
      //    γιατί δηλώνεται ρητά αντί να παραλείπεται.
      identityAssurance: 'declared',
    },
  };
}
