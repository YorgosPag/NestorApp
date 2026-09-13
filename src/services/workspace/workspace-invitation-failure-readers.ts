/**
 * ADR-853 Φ6 — **ΓΙΑΤΙ ΔΕΝ ΠΡΟΧΩΡΗΣΕ**, ονομασμένα, από το σώμα της απάντησης.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔑 ΕΝΑΣ ΑΝΑΓΝΩΣΤΗΣ ΣΩΜΑΤΟΣ, ΔΙΚΟ ΜΑΣ TYPE-GUARD
 * ─────────────────────────────────────────────────────────────────────────────
 * Το σώμα ενός αποτυχημένου αιτήματος το βγάζει **ένας**: το `apiErrorBodyOf`, που
 * επιστρέφει `Record<string, unknown> | null` **μόνο** για `ApiClientError` — το `.json()`
 * έχει ήδη καταναλωθεί μία φορά και ό,τι δεν κρατήθηκε εκεί χάθηκε οριστικά.
 *
 * **Πρότυπο, και η θέση του αρχείου είναι μέρος του**: `services/contact/` κρατά
 * `first-contact.client.ts` **και** `first-contact-failure-readers.ts` **δίπλα-δίπλα** — ο
 * καλών και ο αναγνώστης των αρνήσεών του. Το ίδιο ζευγάρι εδώ, για τον χώρο εργασίας.
 *
 * ⚠️ **Ο ΔΙΑΚΡΙΤΗΣ ΕΛΕΓΧΕΤΑΙ ΠΡΩΤΟΣ, ΚΑΙ ΕΙΝΑΙ ΤΟ ΜΑΘΗΜΑ ΤΟΥ ADR-844**: πρώτα
 * *«είναι αυτή η άρνηση που νομίζω;»* (`body.error === …`) και **μετά** type-guard στο
 * περιεχόμενο. Ανάποδα, ένα `state: 'accepted'` από **άλλη** διαδρομή θα διαβαζόταν ως
 * δική μας σύγκρουση.
 *
 * ⛔ **ΤΟ ΣΩΜΑ ΔΕΝ ΜΠΑΙΝΕΙ ΠΟΤΕ ΣΕ LOG.** Περνούν διευθύνσεις email παραληπτών — η ίδια
 * πειθαρχία με το `errorBody` του `ApiClientError`.
 *
 * ⛔ **ΚΑΝΕΝΑΣ ΔΕΥΤΕΡΟΣ ΑΝΑΓΝΩΣΤΗΣ.** Αν χρειαστεί τρίτη πόρτα, μπαίνει **εδώ** τρίτη
 * συνάρτηση — δεν γεννιέται δεύτερο αρχείο που ξαναγράφει το `apiErrorBodyOf`.
 *
 * @module services/workspace/workspace-invitation-failure-readers
 * @see docs/centralized-systems/reference/adrs/ADR-853-workspace-invitations.md §8 Φ6
 */

import { apiErrorBodyOf } from '@/lib/api/enterprise-api-client';
import {
  isWorkspaceInvitationRefusal,
  isWorkspaceInvitationState,
  type WorkspaceInvitationRefusal,
  type WorkspaceInvitationState,
} from '@/types/workspace-invitation';

// =============================================================================
// 1. Η ΕΚΔΟΣΗ — `POST /api/workspace-invitations`
// =============================================================================

/**
 * Γιατί **δεν εκδόθηκε** η πρόσκληση.
 *
 * 🔑 **Κάθε λόγος στέλνει τον διαχειριστή σε ΔΙΑΦΟΡΕΤΙΚΗ ενέργεια**, και γι' αυτό δεν
 * ισοπεδώνονται σε ένα «απέτυχε»:
 *
 * | Λόγος | Τι κάνει ο άνθρωπος |
 * |---|---|
 * | `role-above-inviter` | **διαλέγει χαμηλότερο ρόλο** — η πράξη θα πετύχει |
 * | `role-not-invitable` | **τίποτα** — ο ρόλος δεν δίνεται ΠΟΤΕ με πρόσκληση (break-glass) |
 * | `unavailable` | **τίποτα** — λείπει ρύθμιση του διακομιστή· καμία ενέργειά του τη διορθώνει |
 */
export type IssueSetback =
  | { readonly kind: 'role-above-inviter' }
  | { readonly kind: 'role-not-invitable' }
  | { readonly kind: 'unavailable' };

/**
 * Διαβάζει την **ονομασμένη** άρνηση της έκδοσης.
 *
 * @returns `null` όταν η αποτυχία **δεν** είναι καμία από τις δικές μας — η οθόνη τότε λέει
 *          το γενικό μήνυμα. ⚠️ **Ποτέ ωμός κωδικός στην οθόνη**: ένας άγνωστος κωδικός
 *          είναι πληροφορία για εμάς, όχι λέξη για τον άνθρωπο.
 */
export function issueSetbackOf(cause: unknown): IssueSetback | null {
  const body = apiErrorBodyOf(cause);
  if (body === null) return null;

  switch (body.error) {
    case 'ROLE_ABOVE_INVITER':
      return { kind: 'role-above-inviter' };
    case 'ROLE_NOT_INVITABLE':
      return { kind: 'role-not-invitable' };
    case 'INVITE_NOT_ISSUED':
      return { kind: 'unavailable' };
    default:
      return null;
  }
}

// =============================================================================
// 2. Η ΑΝΑΚΛΗΣΗ — `POST /api/workspace-invitations/[invitationId]/revoke`
// =============================================================================

/**
 * Γιατί **δεν ανακλήθηκε**.
 *
 * 🔑 **Το `already-resolved` κουβαλά ΚΑΤΑΣΤΑΣΗ, και γι' αυτό δεν είναι απλό σφάλμα**: ο
 * διακομιστής στέλνει **409 με το `state` μέσα** ακριβώς ώστε η οθόνη να μη χρειαστεί
 * δεύτερη κλήση για να μάθει **τι** πρόλαβε να γίνει — αν ο άνθρωπος δέχτηκε, ή αν
 * συνάδελφος ανακάλεσε πρώτος. Ιδεμποτησία **με πληροφορία**.
 *
 * ⚠️ **Το `not-found` σημαίνει «ανύπαρκτη Ή ξένη», αδιάκριτα** — και είναι απόφαση
 * ασφαλείας του διακομιστή, όχι ασάφεια: αλλιώς η διαδρομή γίνεται **όργανο απαρίθμησης**
 * (ADR-787 Ε-5 §4 #1). Η οθόνη λέει *«δεν βρέθηκε»* και **δεν** υπαινίσσεται ξένο γραφείο.
 */
export type RevokeSetback =
  | {
      readonly kind: 'already-resolved';
      /**
       * ⚠️ **`null` όταν ο διακομιστής έστειλε κατάσταση εκτός του κλειστού συνόλου.** Η
       * οθόνη τότε λέει *«έχει ήδη κλείσει»* χωρίς να ονομάσει **πώς** — ποτέ ωμή τιμή.
       */
      readonly state: WorkspaceInvitationState | null;
    }
  | { readonly kind: 'not-found' }
  | { readonly kind: 'unavailable' };

/**
 * Διαβάζει την **ονομασμένη** άρνηση της ανάκλησης.
 *
 * @returns `null` όταν η αποτυχία δεν είναι καμία από τις δικές μας (δες {@link issueSetbackOf}).
 */
export function revokeSetbackOf(cause: unknown): RevokeSetback | null {
  const body = apiErrorBodyOf(cause);
  if (body === null) return null;

  switch (body.error) {
    case 'ALREADY_RESOLVED':
      // ⚠️ Ο διακομιστής τυπώνει το `state` ως `string` **επίτηδες** (δες
      //    `WorkspaceInvitationDocument`): η εγγύηση είναι **έλεγχος**, ποτέ τύπος.
      return {
        kind: 'already-resolved',
        state: isWorkspaceInvitationState(body.state) ? body.state : null,
      };
    case 'INVITATION_NOT_FOUND':
      return { kind: 'not-found' };
    case 'REVOKE_FAILED':
      return { kind: 'unavailable' };
    default:
      return null;
  }
}

// =============================================================================
// 3. Η ΕΞΑΡΓΥΡΩΣΗ — `POST /api/workspace-invitations/redeem`
// =============================================================================

/**
 * Ο **ονομασμένος** λόγος που ο σύνδεσμος δεν δούλεψε, από την πόρτα της εξαργύρωσης.
 *
 * 🔑 **ΤΡΙΤΗ ΣΥΝΑΡΤΗΣΗ ΕΔΩ, ΟΧΙ ΤΡΙΤΟ ΑΡΧΕΙΟ** — όπως το δηλώνει η κεφαλίδα: ένας
 * αναγνώστης σώματος για όλη την οικογένεια. Δεύτερο αρχείο θα ξαναέγραφε το
 * `apiErrorBodyOf` και θα ήταν το πρώτο βήμα προς δύο λεξιλόγια αρνήσεων.
 *
 * ⚠️ **Ο διακριτής ελέγχεται ΠΡΩΤΟΣ** (`error === 'LINK_REFUSED'`) και **μετά** ο κλειστός
 * έλεγχος του λόγου: ένα `reason` από **άλλη** διαδρομή δεν επιτρέπεται να διαβαστεί ως
 * δικό μας. Άγνωστος λόγος ⇒ `null` ⇒ η οθόνη λέει το γενικό μήνυμα — **ποτέ ωμός κωδικός**
 * σε σελίδα που τη βλέπει άγνωστος άνθρωπος από email.
 */
export function redeemRefusalOf(cause: unknown): WorkspaceInvitationRefusal | null {
  const body = apiErrorBodyOf(cause);
  if (body === null || body.error !== 'LINK_REFUSED') return null;
  return isWorkspaceInvitationRefusal(body.reason) ? body.reason : null;
}
