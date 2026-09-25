import 'server-only';

/**
 * @fileoverview **Η ΟΨΗ ΤΗΣ ΠΡΟΣΚΛΗΣΗΣ ΠΡΙΝ ΤΗΝ ΑΠΟΦΑΣΗ** — «ποιος με καλεί, και για τι θέση;»
 * @related ADR-853 §5 #4 · server/auth/workspace-invitation-redeem.ts (η πράξη)
 * @module server/auth/workspace-invitation-preview
 *
 * ⚠️ Εξήχθη από το `workspace-invitation-redeem.ts` (2026-09-21, N.7.1: >500 γραμμές). Οι
 * έλεγχοι του εγγράφου είναι οι **ΙΔΙΟΙ** με την εξαργύρωση — `refusalOfStoredInvitation`.
 */

import { sameChannelEmail } from '@/lib/contact/channel-email';
import { nowISO as clockNowISO } from '@/lib/date-local';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { createModuleLogger } from '@/lib/telemetry';
import { readWorkspaceName } from '@/lib/workspace/workspace-catalog';
import { readInvitationByToken } from '@/server/invitations/invitation-redeem';
import {
  isInvitableRole,
  type WorkspaceInvitationDocument,
  type WorkspaceInvitationPreview,
  type WorkspaceInvitationRefusal,
} from '@/types/workspace-invitation';

import { WORKSPACE_INVITATION_LOCATOR } from './workspace-invitation-redeem';

const logger = createModuleLogger('workspace-invitation-preview');

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
      /**
       * 🔑 **Απευθύνεται στον συνδεδεμένο;** (ADR-853 §13 ε.δ) — `null` όταν δεν υπάρχει
       * συνδεδεμένος. Η οθόνη το λέει **πριν** το κλικ (Google/Slack «signed in as…»),
       * αντί να το μάθει ο άνθρωπος από άρνηση **μετά**.
       *
       * ⚠️ **Boolean, ΟΧΙ η διεύθυνση του παραλήπτη**: η όψη δίνεται σε όποιον κρατά τον
       * σύνδεσμο, και το email του παραλήπτη δεν ταξιδεύει ποτέ (δες τον τύπο της όψης).
       * ⚠️ **Υπόδειξη, ΟΧΙ απόφαση**: η δέσμευση κρίνεται ξανά στην εξαργύρωση (§7.5).
       */
      readonly addressedToViewer: boolean | null;
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
  /** Το email του συνδεδεμένου, αν υπάρχει — **μόνο** για την υπόδειξη `addressedToViewer`. */
  readonly viewerEmail?: string | null;
  readonly nowISOValue?: string;
}): Promise<InvitationPreviewOutcome> {
  // 🔑 Ο **ΙΔΙΟΣ** δρόμος με την εξαργύρωση (υπογραφή → λήξη → έγγραφο → κατάσταση · λήξη Τ2 · nonce),
  //    χωρίς παραλήπτη: εδώ δεν υπάρχει ακόμη ταυτότητα — δες την κεφαλίδα.
  const db = getAdminFirestore();
  const found = await readInvitationByToken<WorkspaceInvitationDocument>(db, WORKSPACE_INVITATION_LOCATOR, {
    token: input.token,
    nowValue: input.nowISOValue ?? clockNowISO(),
    recipientEmail: null,
  });
  if (found.kind === 'secret-missing') {
    logger.error('Λείπει το μυστικό των προσκλήσεων — καμία όψη δεν μπορεί να δοθεί');
    return { kind: 'unavailable' };
  }
  if (found.kind === 'refused') return previewRefuse(found.reason);
  const { stored, invitationId } = found;

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
    addressedToViewer: input.viewerEmail ? sameChannelEmail(input.viewerEmail, stored.inviteeEmail) : null,
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
