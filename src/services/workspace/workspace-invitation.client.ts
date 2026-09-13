/**
 * ADR-853 Φ6 — **Ο ΕΝΑΣ ΚΑΛΩΝ ΤΩΝ ΠΟΡΤΩΝ ΤΗΣ ΠΡΟΣΚΛΗΣΗΣ, ΑΠΟ ΤΗΝ ΟΘΟΝΗ.**
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ: ΔΥΟ ΚΟΥΜΠΙΑ ΚΑΛΟΥΝ ΤΗΝ **ΙΔΙΑ** ΠΡΑΞΗ
 * ─────────────────────────────────────────────────────────────────────────────
 * Το «Αποστολή πρόσκλησης» του διαλόγου και το «Επαναποστολή» της γραμμής του πίνακα
 * είναι **το ίδιο `POST`** (§7.1/§7.3: νέο token, νέα λήξη, η προηγούμενη `revoked` στην
 * ίδια συναλλαγή). Δύο χωριστές υλοποιήσεις θα ήταν **δίδυμα** — ακριβώς ο sibling clone
 * που περιγράφει ο N.18 *(«κεντρικοποιείς το Α, γράφεις Β ως δίδυμο»)* και που πιάνει το
 * **CHECK 3.28** token-based, ανεξάρτητα ονόματος. Ο καλών γράφεται **μία φορά**, εδώ.
 *
 * **Πρότυπο**: `services/contact/first-contact.client.ts` — ο καλών δίπλα στον αναγνώστη
 * των αρνήσεών του.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔑 ΔΕΝ ΠΕΤΑ ΠΟΤΕ ΠΡΟΣ ΤΗΝ ΟΘΟΝΗ — ΕΠΙΣΤΡΕΦΕΙ **ΟΝΟΜΑΣΜΕΝΗ ΕΚΒΑΣΗ**
 * ─────────────────────────────────────────────────────────────────────────────
 * Μια εξαίρεση θα υποχρέωνε **κάθε** καλούντα να ξαναγράψει το `try/catch` **και** την
 * ανάγνωση του σώματος — δηλαδή θα γεννούσε τα δίδυμα από την πίσω πόρτα. Εδώ η έκβαση
 * είναι **κλειστή ένωση**: `issued` · `refused` (με ονομασμένο λόγο) · `failed`. Μια
 * τέταρτη περίπτωση **δεν μεταγλωττίζεται** μέχρι κάποιος να πει τι σημαίνει στην οθόνη.
 *
 * ⛔ **ΚΑΜΙΑ ΚΑΤΑΓΡΑΦΗ ΤΟΥ ΣΩΜΑΤΟΣ** — περνούν διευθύνσεις παραληπτών.
 * ⛔ **ΚΑΜΙΑ ΔΕΥΤΕΡΗ ΚΡΙΣΗ «ΕΠΙΤΡΕΠΕΤΑΙ;»** εδώ (CHECK 3.68): το αν φαίνεται το κουμπί το
 *    απαντά το `useInviteCapability`· το αν **γίνεται** η πράξη το απαντά ο διακομιστής.
 *
 * @module services/workspace/workspace-invitation.client
 * @see docs/centralized-systems/reference/adrs/ADR-853-workspace-invitations.md §8 Φ6
 */

import { API_ROUTES } from '@/config/domain-constants';
import { apiClient } from '@/lib/api/enterprise-api-client';
// ⚠️ **TYPE-ONLY πέρα από το σύνορο του διακομιστή** — σβήνεται στη μεταγλώττιση, τίποτα
//    δεν φτάνει στο bundle. Ζωντανό ιδίωμα του έργου (`OperatorInboxClient` ·
//    `AIInboxClient` · `useAIInboxState`, όλα από `@/server/admin/admin-guards`).
//    Η εναλλακτική — αντιγραφή των τριών εκβάσεων — θα ήταν **δεύτερο λεξιλόγιο** (N.0.2).
import type { InvitationNoticeOutcome } from '@/server/auth/workspace-invitation-notice';
import type { InvitableRole } from '@/types/workspace-invitation';

import type { WorkspaceInvitationRefusal } from '@/types/workspace-invitation';

import {
  issueSetbackOf,
  redeemRefusalOf,
  revokeSetbackOf,
  type IssueSetback,
  type RevokeSetback,
} from './workspace-invitation-failure-readers';

// =============================================================================
// 1. ΕΚΔΟΣΗ — **ΚΑΙ** ΕΠΑΝΑΠΟΣΤΟΛΗ
// =============================================================================

/**
 * Το σώμα του **201**, όπως φτάνει.
 *
 * ⚠️ **Γυμνό, χωρίς τον φάκελο `{ success, data }`** — μετρημένο στον `parseResponseBody`:
 * σώμα χωρίς **και τα δύο** κλειδιά επιστρέφεται **αυτούσιο**. Γι' αυτό ο τύπος γράφεται
 * εδώ ολόκληρος και δεν περνά από `ApiResponse<T>`.
 */
export interface IssuedInvitationBody {
  readonly invitationId: string;
  readonly inviteeEmail: string;
  readonly role: string;
  readonly expiresAt: string;
  /** Πόσες προηγούμενες ζωντανές ακυρώθηκαν στην **ίδια** συναλλαγή (§7.3). */
  readonly supersededCount: number;
  /**
   * ⚠️ `accepted` σημαίνει *«ο πάροχος το δέχτηκε προς αποστολή»*, **ΟΧΙ** «παραδόθηκε».
   * Η οθόνη οφείλει να το πει με λέξεις που **δεν υπόσχονται** παράδοση.
   */
  readonly delivery: InvitationNoticeOutcome;
}

export type IssueInvitationResult =
  | { readonly kind: 'issued'; readonly issued: IssuedInvitationBody }
  | { readonly kind: 'refused'; readonly setback: IssueSetback }
  /** Δίκτυο, 500, ή οτιδήποτε **δεν** ονομάσαμε — η οθόνη λέει το γενικό μήνυμα. */
  | { readonly kind: 'failed' };

/**
 * Εκδίδει πρόσκληση. **Η επαναποστολή είναι αυτή η ίδια κλήση**, με το ίδιο email.
 *
 * 🔑 Το email περνά **ωμό**: ο ΕΝΑΣ κανονικοποιητής (`normaliseChannelEmail`) ζει στην
 * υπηρεσία του διακομιστή. Μια «καθάρισή» εδώ θα αποκλίνει ακριβώς στα σημεία που
 * μετράνε — κενά, κεφαλαία, Unicode.
 */
export async function issueWorkspaceInvitationFromScreen(input: {
  readonly email: string;
  readonly role: InvitableRole;
}): Promise<IssueInvitationResult> {
  try {
    const issued = await apiClient.post<IssuedInvitationBody>(
      API_ROUTES.WORKSPACE_INVITATIONS.ISSUE,
      { email: input.email, role: input.role },
    );
    return { kind: 'issued', issued };
  } catch (cause: unknown) {
    const setback = issueSetbackOf(cause);
    return setback === null ? { kind: 'failed' } : { kind: 'refused', setback };
  }
}

// =============================================================================
// 2. ΑΝΑΚΛΗΣΗ
// =============================================================================

export type RevokeInvitationResult =
  | { readonly kind: 'revoked' }
  | { readonly kind: 'refused'; readonly setback: RevokeSetback }
  | { readonly kind: 'failed' };

/**
 * Ανακαλεί πρόσκληση.
 *
 * ⚠️ **Ο χώρος ΔΕΝ στέλνεται** — ο διακομιστής τον διαβάζει από το υπογεγραμμένο token
 * (`ctx.companyId`). Δεν υπάρχει πεδίο να εμπιστευτούμε, άρα κανένα τέταρτο κανάλι χώρου
 * (CHECK 3.58).
 */
export async function revokeWorkspaceInvitationFromScreen(
  invitationId: string,
): Promise<RevokeInvitationResult> {
  try {
    await apiClient.post(API_ROUTES.WORKSPACE_INVITATIONS.REVOKE(invitationId), {});
    return { kind: 'revoked' };
  } catch (cause: unknown) {
    const setback = revokeSetbackOf(cause);
    return setback === null ? { kind: 'failed' } : { kind: 'refused', setback };
  }
}

// =============================================================================
// 3. ΕΞΑΡΓΥΡΩΣΗ — η πράξη του ΠΡΟΣΚΕΚΛΗΜΕΝΟΥ
// =============================================================================

/** Το σώμα του **200** της αποδοχής. */
interface AcceptedBody {
  readonly status: 'accepted';
  readonly companyId: string;
  /**
   * 🔴 **`false` ΣΗΜΑΙΝΕΙ «ΕΙΣΑΙ ΜΕΛΟΣ, ΑΛΛΑ Ο ΧΩΡΟΣ ΔΕΝ ΕΙΝΑΙ Ο ΕΝΕΡΓΟΣ ΣΟΥ»** — δηλωμένο
   * όριο §6 #1. Ο ήδη-μέλος-αλλού **δεν** μετακινείται (ένα γραφείο θα «έκλεβε» μέλος
   * άλλου με μία πρόσκληση, §11). Η οθόνη **οφείλει** να το πει με όνομα, αλλιώς ο
   * άνθρωπος συνδέεται και **δεν βρίσκει** τον χώρο που μόλις δέχτηκε.
   */
  readonly activeWorkspaceChanged: boolean;
}

export type RedeemInvitationResult =
  | { readonly kind: 'accepted'; readonly activeWorkspaceChanged: boolean }
  | { readonly kind: 'declined' }
  | { readonly kind: 'refused'; readonly reason: WorkspaceInvitationRefusal }
  | { readonly kind: 'failed' };

/**
 * Αποδοχή ή ρητή άρνηση της πρόσκλησης.
 *
 * ⚠️ **ΤΟ TOKEN ΤΑΞΙΔΕΥΕΙ ΣΕ ΣΩΜΑ, ΟΧΙ ΣΕ ΔΙΕΥΘΥΝΣΗ** — RFC 6819 §5.1.5 / OAuth 2.0
 * Security BCP: token σε URL διαρρέει σε αρχεία διακομιστή, σε `Referer` προς τρίτους, σε
 * ιστορικό και σε proxies. Η **όψη** το κρατά στη διεύθυνση επειδή **είναι** ο σύνδεσμος
 * του email· η **πράξη** δεν έχει τέτοια ανάγκη.
 *
 * ⛔ **Το `companyId` της απάντησης ΔΕΝ επιστρέφεται στην οθόνη**: δεν έχει τι να το κάνει,
 * και ένα αναγνωριστικό μισθωτή σε επιφάνεια που μόλις ήταν ανώνυμη είναι έκθεση χωρίς
 * αντάλλαγμα. Ό,τι χρειάζεται η οθόνη είναι **αν άλλαξε ο ενεργός χώρος**.
 */
export async function redeemWorkspaceInvitationFromScreen(input: {
  readonly token: string;
  readonly action: 'accept' | 'decline';
}): Promise<RedeemInvitationResult> {
  try {
    const body = await apiClient.post<AcceptedBody | { readonly status: 'declined' }>(
      API_ROUTES.WORKSPACE_INVITATIONS.REDEEM,
      { token: input.token, action: input.action },
    );
    if (body.status === 'declined') return { kind: 'declined' };
    return { kind: 'accepted', activeWorkspaceChanged: body.activeWorkspaceChanged };
  } catch (cause: unknown) {
    const reason = redeemRefusalOf(cause);
    return reason === null ? { kind: 'failed' } : { kind: 'refused', reason };
  }
}
