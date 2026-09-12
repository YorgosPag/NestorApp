import 'server-only';

/**
 * **POST /api/workspace-invitations** — ο χώρος προσκαλεί (ADR-853 Φ4 · Α1 · Α3).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ `withAuth` ΚΑΙ ΟΧΙ Η ΠΟΡΤΑ ΤΟΥ ΠΟΛΙΤΗ
 * ─────────────────────────────────────────────────────────────────────────────
 * Εδώ ενεργεί **ο χώρος**, όχι ο προσκεκλημένος: ο καλών έχει εξ ορισμού εταιρεία, και ο
 * χώρος της πρόσκλησης είναι **το `ctx.companyId` του**, ποτέ τιμή από το σώμα. Γι' αυτό
 * δεν υπάρχει πεδίο `companyId` στο σχήμα — δεν απαγορεύεται, είναι **ανέκφραστο**
 * (CHECK 3.58: η πρόσκληση **φέρνει** την εταιρεία μέσα στο έγγραφό της, δεν τη διαβάζει
 * από τον πελάτη). Η αδελφή πόρτα της **αποδοχής** είναι άλλο αρχείο με άλλον φρουρό.
 *
 * ⚠️ **Καμία δεύτερη κρίση «επιτρέπεται;»** (CHECK 3.68): το δικαίωμα είναι
 * `users:users:manage` — **το ίδιο** με την έγκριση/απόρριψη αιτήματος ένταξης — και
 * κρίνεται μέσα από το `withAuth`. Το **ταβάνι ρόλου** (Α3: ποτέ πάνω από τον προσκαλούντα,
 * ποτέ `super_admin`) κρίνεται στην **υπηρεσία**, με δύο ανεξάρτητους φρουρούς.
 *
 * 🔑 **ΤΟ ΟΡΙΟ ΡΥΘΜΟΥ ΕΠΙΒΑΛΛΕΤΑΙ ΟΝΤΩΣ ΤΩΡΑ** (ADR-855 Φ1): μέχρι τις 2026-09-12 το
 * `withSensitiveRateLimit` ήταν διακοσμητικό — το `options.category` δεν έφτανε στη μηχανή
 * και κάθε διαδρομή έτρεχε στα **60/min** ό,τι wrapper κι αν φορούσε. Πλέον η δήλωση
 * κερδίζει, άρα αυτή η πόρτα είναι πραγματικά στα **20/min**.
 * ⛔ **ΜΗΝ προσθέσεις γραμμή στο `ENDPOINT_CATEGORY_MAPPINGS` γι' αυτή τη διαδρομή** — το
 *    handoff το ζητούσε, και μετά το ADR-855 είναι **επιβλαβές**: η δήλωση υπερισχύει, οπότε
 *    η γραμμή θα ήταν **νεκρή** και το CHECK 3.78 Κ2 τη μετρά ως παραβίαση.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔑 Η ΕΠΑΝΑΠΟΣΤΟΛΗ ΕΙΝΑΙ **ΑΥΤΗ Η ΠΟΡΤΑ, ΞΑΝΑ** — ΚΑΜΙΑ ΔΕΥΤΕΡΗ ΔΙΑΔΡΟΜΗ
 * ─────────────────────────────────────────────────────────────────────────────
 * Ο πίνακας §8 ονομάζει τρεις πράξεις για τον χώρο *(δημιουργία · **επαναποστολή** ·
 * ανάκληση)*, αλλά η επαναποστολή **δεν έχει δική της διαδρομή, επίτηδες**: το §7.1 απαιτεί
 * να γεννά **νέο token με νέα λήξη** — γι' αυτό το `winv` είναι **μη** ντετερμινιστικό — και
 * το §7.3 κάνει την προηγούμενη `revoked` μέσα στην **ίδια** συναλλαγή.
 *
 * ⇒ Το UI της επαναποστολής κάνει **δεύτερο POST εδώ** με το ίδιο email. Η απάντηση το
 *   επιβεβαιώνει με το `supersededCount: 1`, και ο άνθρωπος που πατά τον **παλιό** σύνδεσμο
 *   (γιατί τον βρήκε πρώτο στα εισερχόμενα) ακούει «ανακλήθηκε», όχι «άκυρος».
 *
 * ⛔ **ΜΗΝ φτιάξεις `POST /api/workspace-invitations/[id]/resend`**: το σκεπτικό ζει
 *    γραμμένο στην ενότητα 3 του `server/auth/workspace-invitation.ts`, όπου εξηγείται
 *    γιατί δεν υπάρχει ούτε συνάρτηση `resendWorkspaceInvitation`.
 *
 * @module api/workspace-invitations
 * @see docs/centralized-systems/reference/adrs/ADR-853-workspace-invitations.md §8 Φ4
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { readJsonBody } from '@/lib/api/json-body';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { getErrorMessage } from '@/lib/error-utils';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';
import { issueWorkspaceInvitation } from '@/server/auth/workspace-invitation';
import {
  notifyWorkspaceInvitation,
  type InvitationNoticeOutcome,
} from '@/server/auth/workspace-invitation-notice';
import { INVITABLE_ROLES } from '@/types/workspace-invitation';

const logger = createModuleLogger('WORKSPACE_INVITATION_ISSUE');

/**
 * Το σώμα. **Τρία πεδία, και κανένα `companyId`** — δες την κεφαλίδα.
 *
 * ⚠️ **`INVITABLE_ROLES`, ΠΟΤΕ χειρόγραφη λίστα**: το κλειστό σύνολο των τριών ζει στο
 * `types/workspace-invitation.ts` και αποκλείει τον `super_admin` **ρητά** (Α3 · άγκυρα Ρ2).
 * Ένα `z.enum(['company_admin', …])` εδώ θα ήταν **δεύτερο** λεξιλόγιο ρόλων, ελεύθερο να
 * αποκλίνει την πρώτη φορά που αλλάξει το σύνολο.
 *
 * 🔑 Το email περνά **ωμό**: η κανονικοποίηση είναι δουλειά του `normaliseChannelEmail` μέσα
 * στην υπηρεσία (ο ΕΝΑΣ κανονικοποιητής). Μια δεύτερη «καθάρισή» εδώ θα μπορούσε να
 * αποκλίνει ακριβώς στα σημεία που έχουν σημασία — κενά, κεφαλαία, Unicode.
 */
const issueBodySchema = z.object({
  email: z.string().min(3).max(254),
  role: z.enum(INVITABLE_ROLES),
});

/** Ό,τι μαθαίνει ο διαχειριστής. ⛔ **Ποτέ το token** — φεύγει μόνο με email (Φ5). */
type IssueResponse =
  | {
      readonly invitationId: string;
      readonly inviteeEmail: string;
      readonly role: string;
      readonly expiresAt: string;
      /** Πόσες προηγούμενες ζωντανές ακυρώθηκαν στην ίδια συναλλαγή (§7.3). */
      readonly supersededCount: number;
      /**
       * 🔑 **ΤΙ ΑΠΕΓΙΝΕ ΤΟ ΜΗΝΥΜΑ — ΟΝΟΜΑΣΤΙΚΑ, ΚΑΙ ΠΟΤΕ «ΣΤΑΛΘΗΚΕ»** (Φ5).
       *
       * Η πρόσκληση **υπάρχει** ό,τι κι αν λέει αυτό το πεδίο — γι' αυτό η απάντηση
       * μένει **201**. Αλλά ο διαχειριστής πρέπει να μάθει **αμέσως** αν το μήνυμα
       * δεν έφυγε: αλλιώς περιμένει άνθρωπο που **δεν έλαβε ποτέ** τίποτα, και το
       * μόνο που βλέπει είναι «σε αναμονή».
       *
       * ⚠️ Η τιμή `accepted` σημαίνει *«ο πάροχος το δέχτηκε προς αποστολή»*, **όχι**
       * «παραδόθηκε» — δες τον λόγο, γραμμένο στο `workspace-invitation-notice.ts`.
       */
      readonly delivery: InvitationNoticeOutcome;
    }
  | { readonly error: 'ROLE_NOT_INVITABLE' | 'ROLE_ABOVE_INVITER' }
  | { readonly error: 'INVITE_NOT_ISSUED' };

/** Η έκβαση της υπηρεσίας **όταν εκδόθηκε** — με το ωμό token μέσα. */
type IssuedOutcome = Extract<Awaited<ReturnType<typeof issueWorkspaceInvitation>>, { kind: 'issued' }>;

/**
 * Ό,τι φτάνει στον {@link respond}.
 *
 * 🔑 **ΓΙΑΤΙ ΕΜΠΛΟΥΤΙΣΜΕΝΗ ΕΝΩΣΗ ΚΑΙ ΟΧΙ ΔΕΥΤΕΡΗ ΠΑΡΑΜΕΤΡΟΣ**: η έκβαση της παράδοσης
 * υπάρχει **μόνο** όταν υπάρχει πρόσκληση. Μια παράμετρος `delivery: … | null` θα
 * επέτρεπε `null` στον κλάδο της επιτυχίας — δηλαδή θα ζητούσε από τον επόμενο ένα
 * `?? 'failed'`, που είναι **ψέμα σε τύπο**. Έτσι ο μεταγλωττιστής κρατά το
 * **κλειστό σύνολο** ακέραιο: τέταρτη έκβαση **δεν μεταγλωττίζεται**.
 */
type IssueResult =
  | { readonly kind: 'issued'; readonly issued: IssuedOutcome; readonly delivery: InvitationNoticeOutcome }
  | Extract<Awaited<ReturnType<typeof issueWorkspaceInvitation>>, { kind: 'refused' }>;

async function handler(request: NextRequest, ctx: AuthContext): Promise<NextResponse<IssueResponse>> {
  const parsed = await readJsonBody(request, issueBodySchema);
  if ('rejected' in parsed) return parsed.rejected;

  let outcome: Awaited<ReturnType<typeof issueWorkspaceInvitation>>;
  try {
    outcome = await issueWorkspaceInvitation({
      companyId: ctx.companyId,
      inviteeEmailRaw: parsed.data.email,
      role: parsed.data.role,
      inviterUid: ctx.uid,
      inviterRole: ctx.globalRole,
    });
  } catch (error: unknown) {
    // 🔴 **503, ΟΧΙ 500 ΚΑΙ ΟΧΙ ΟΝΟΜΑΣΜΕΝΗ ΑΡΝΗΣΗ.** Η συνηθέστερη αιτία εδώ είναι το
    //    **μυστικό που λείπει** (`WORKSPACE_INVITE_SECRET`, δηλωμένο στο
    //    `environment-contract.ts`): δεν φταίει ο διαχειριστής και **καμία** ενέργειά του
    //    δεν το διορθώνει. Μια άρνηση τύπου «ο ρόλος δεν επιτρέπεται» θα τον έστελνε να
    //    αλλάξει ρόλο για πρόβλημα περιβάλλοντος.
    logger.error('Η πρόσκληση δεν εκδόθηκε', {
      companyId: ctx.companyId,
      error: getErrorMessage(error),
    });
    return NextResponse.json({ error: 'INVITE_NOT_ISSUED' } as const, { status: 503 });
  }

  if (outcome.kind === 'refused') return respond(outcome);

  // 🔑 **ΠΕΡΙΜΕΝΟΥΜΕ ΤΟ EMAIL — ΚΑΙ ΕΙΝΑΙ ΑΠΟΦΑΣΗ, ΟΧΙ ΑΒΛΕΨΙΑ** (N.7.2 #6).
  //
  // Το `after()` θα έδινε ταχύτερη απόκριση και **λάθος** πληροφορία: ο διαχειριστής θα
  // έβλεπε «η πρόσκληση δημιουργήθηκε» και θα περίμενε άνθρωπο που **δεν έλαβε ποτέ**
  // τίποτα — η ακριβής βλάβη που η Atlassian χρειάστηκε να λύσει εκ των υστέρων με
  // ξεχωριστό *«admin email audit»*. Εδώ η πληροφορία ταξιδεύει **με την ίδια απάντηση**.
  //
  // ⚠️ **Η αναμονή είναι φραγμένη**: ο `sendReplyViaMailgun` φορά πλέον
  // `AbortSignal.timeout(PROVIDER_TIMEOUT_MS)` — χωρίς αυτό, ένας **σιωπηλός** πάροχος θα
  // κρατούσε το αίτημα του διαχειριστή ανοιχτό μέχρι να το κόψει η πλατφόρμα.
  //
  // ⚠️ **Και δεν πετά ΠΟΤΕ**: το έγγραφο έχει ήδη γραφτεί και η προηγούμενη ζωντανή έχει
  // ανακληθεί στην ίδια συναλλαγή (§7.3). Εξαίρεση εδώ θα έλεγε «απέτυχε» για πράξη που
  // **πέτυχε**, και ο διαχειριστής θα ξαναπατούσε — ακυρώνοντας σιωπηλά το token που
  // μόλις έφυγε.
  const delivery = await notifyWorkspaceInvitation({
    invitation: outcome.invitation,
    token: outcome.token,
    // Η στιγμή της έκδοσης, από το **ίδιο** το έγγραφο: κανένα δεύτερο ρολόι, ώστε οι
    // «ημέρες που απομένουν» του μηνύματος να μετρούν από εκεί που μετρά και η λήξη.
    nowISOValue: outcome.invitation.createdAt,
  });

  return respond({ kind: 'issued', issued: outcome, delivery });
}

/**
 * **Έκβαση → HTTP**, κάθε λόγος ρητά και **χωρίς `default`**.
 *
 * ⚠️ Κλειστό σύνολο: **τέταρτη** έκβαση της υπηρεσίας **δεν μεταγλωττίζεται** μέχρι κάποιος
 * να πει τι σημαίνει για το δίκτυο. Ίδιο ιδίωμα με το `first-contacts/guest/confirm`.
 */
export function respond(result: IssueResult): NextResponse<IssueResponse> {
  switch (result.kind) {
    case 'issued':
      // ⚠️ **201 ΑΚΟΜΗ ΚΑΙ ΟΤΑΝ ΤΟ EMAIL ΔΕΝ ΕΦΥΓΕ, ΚΑΙ ΕΙΝΑΙ ΤΟ ΣΩΣΤΟ**: η οντότητα
      //    **δημιουργήθηκε** και έχει ταυτότητα· η παράδοση είναι **άλλο** γεγονός, και
      //    ταξιδεύει με **δικό της** όνομα στο `delivery`. Ένα 500 εδώ θα έλεγε ψέματα
      //    για τη γραφή, και θα έσπρωχνε τον διαχειριστή να ξαναπατήσει — γεννώντας
      //    δεύτερη πρόσκληση που ακυρώνει την πρώτη (§7.3).
      return NextResponse.json(
        {
          invitationId: result.issued.invitation.id,
          inviteeEmail: result.issued.invitation.inviteeEmail,
          role: result.issued.invitation.role,
          expiresAt: result.issued.invitation.expiresAt,
          supersededCount: result.issued.supersededCount,
          delivery: result.delivery,
        },
        { status: 201 },
      );

    case 'refused':
      // 🔑 **422 και ΟΝΟΜΑΣΜΕΝΟΣ λόγος**: το αίτημα ήταν κατανοητό· το **ταβάνι ρόλου** δεν
      //    το επιτρέπει. Και οι δύο λόγοι στέλνουν τον διαχειριστή σε **διαφορετική**
      //    ενέργεια: «διάλεξε χαμηλότερο ρόλο» έναντι «αυτός ο ρόλος δεν δίνεται ΠΟΤΕ με
      //    πρόσκληση» (ο `super_admin` είναι break-glass, όχι βαθμίδα).
      return NextResponse.json(
        {
          error: result.reason === 'role-above-inviter' ? 'ROLE_ABOVE_INVITER' : 'ROLE_NOT_INVITABLE',
        } as const,
        { status: 422 },
      );
  }
}

export const POST = withSensitiveRateLimit(
  withAuth<IssueResponse>(
    async (request: NextRequest, ctx: AuthContext, _cache: PermissionCache) => handler(request, ctx),
    { permissions: 'users:users:manage' },
  ),
);
