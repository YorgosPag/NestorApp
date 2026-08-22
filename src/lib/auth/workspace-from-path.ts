/**
 * «Ποιον χώρο ζητά αυτή η ΔΙΕΥΘΥΝΣΗ, και επιτρέπεται;» — μία φορά
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΤΙ ΛΥΝΕΙ (ADR-787 §5.3 · Ε-5 §5)
 * ─────────────────────────────────────────────────────────────────────────────
 * Η **Φάση 1** έκλεισε το ένα κανάλι *(κεφαλίδα HTTP)*· η **Φάση 2** το δεύτερο
 * *(έγγραφο βάσης)*. Αυτό είναι το **τρίτο και τελευταίο**: η ίδια η **διεύθυνση**.
 *
 * ⚠️ Το Ε-5 §2 το ονομάζει ρητά: *«η διεύθυνση **δεν είναι απόδειξη** — είναι
 * **ερώτηση**»*. Ό,τι φτάνει από εδώ είναι **είσοδος χρήστη**, εξίσου αναξιόπιστη
 * με κεφαλίδα ή πεδίο βάσης. Ένας άνθρωπος μπορεί να γράψει **οποιοδήποτε**
 * ψευδώνυμο στη μπάρα του φυλλομετρητή.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 Ο ΚΡΙΤΗΣ ΖΕΙ **ΜΕΣΑ** ΣΤΟΝ ΑΝΑΓΝΩΣΤΗ — ΠΟΤΕ ΣΤΟΝ ΚΑΛΟΥΝΤΑ
 * ─────────────────────────────────────────────────────────────────────────────
 * Δεν υπάρχει εξαγόμενη συνάρτηση που να επιστρέφει *ακρίτητο* `companyId` από
 * διεύθυνση. Είναι **δομικά αδύνατο** να ξεχάσει κανείς τον έλεγχο, γιατί δεν
 * υπάρχει τρόπος να πάρει την τιμή χωρίς αυτόν — η ίδια πειθαρχία με το
 * `auth-context.ts` (ADR-787 §5.2 στ).
 *
 * ⛔ **ΜΗΝ** εξάγεις «απλώς το companyId»: θα ήταν κανόνας που ο **επόμενος**
 *    καλών πρέπει να θυμάται, δηλαδή το σχήμα που το CHECK 3.58 υπάρχει για να
 *    απαγορεύει.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠️ Η ΣΥΓΚΑΛΥΨΗ ΕΙΝΑΙ ΜΕΡΟΣ ΤΗΣ ΟΡΘΟΤΗΤΑΣ
 * ─────────────────────────────────────────────────────────────────────────────
 * Το **Ε-5 §4 #1** απαιτεί: σύνδεσμος προς χώρο όπου δεν είσαι μέλος απαντά
 * *«δεν υπάρχει»*, **ποτέ** *«υπάρχει αλλά δεν επιτρέπεσαι»* — αλλιώς η διεύθυνση
 * γίνεται **όργανο απαρίθμησης**: μαθαίνεις ποια γραφεία υπάρχουν δοκιμάζοντας
 * ονόματα. Γι' αυτό το `not-a-member` **δεν** ξεχωρίζει προς τα έξω από το
 * `not-found`· η αιτία μένει **ακέραιη στα ίχνη**.
 *
 * @module lib/auth/workspace-from-path
 */

import 'server-only';

import type { CustomClaims } from './types';
import { decideMembership } from './workspace-membership';
import { isAllowed, orgWorkspace, type MembershipVerdict } from '@/types/workspace-membership';
import { resolveAlias } from '@/lib/workspace/alias-registry';
import { extractWorkspaceSegment } from '@/lib/workspace/workspace-path';
import { PERSONAL_WORKSPACE_ALIAS } from '@/types/workspace-alias';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('workspace-from-path');

// =============================================================================
// ΟΙ ΕΤΥΜΗΓΟΡΙΕΣ — ΤΕΣΣΕΡΙΣ, ΡΗΤΕΣ, FAIL-CLOSED
// =============================================================================

/**
 * ⚠️ **Οι τέσσερις καταστάσεις ΔΕΝ ενώνονται**, και η πιο εύκολη ένωση είναι η
 * πιο επικίνδυνη:
 *
 * | | σημασία | τι κάνει ο καλών |
 * |---|---|---|
 * | `no-workspace` | η διεύθυνση **δεν ονομάζει** χώρο | συνεχίζει με τον χώρο του token |
 * | `resolved` | ονομάζει χώρο **και επιτρέπεται** | ενεργεί εκεί |
 * | `not-found` | ονομάζει χώρο **που δεν δικαιούται ή δεν υπάρχει** | **404** — ποτέ 403 |
 * | `unavailable` | **δεν μπορέσαμε να ρωτήσουμε** | **503** — ποτέ 404 |
 *
 * 🔴 Το `not-found` σκεπάζει **επίτηδες** δύο πραγματικά διαφορετικές
 * καταστάσεις *(δεν υπάρχει / δεν είσαι μέλος)* — αυτό είναι η **συγκάλυψη** του
 * Ε-5 §4 #1. Το `unavailable` **δεν** σκεπάζεται μαζί τους: ένα 404 για γραφείο
 * που **υπάρχει** και είσαι μέλος, επειδή η βάση δεν απάντησε, είναι **ψέμα**
 * (N.12).
 */
export type PathWorkspaceResolution =
  | { readonly outcome: 'no-workspace' }
  | {
      readonly outcome: 'resolved';
      readonly companyId: string;
      readonly alias: string;
      readonly verdict: MembershipVerdict;
      /** `true` όταν η διεύθυνση ζητά τον **ιδιωτικό** χώρο του ίδιου (Ε-5 §5). */
      readonly personal: boolean;
    }
  | { readonly outcome: 'not-found' }
  | { readonly outcome: 'unavailable' };

// =============================================================================
// Η ΑΠΟΦΑΣΗ
// =============================================================================

/**
 * Διαβάζει τον ζητούμενο χώρο από τη διεύθυνση **και τον κρίνει**.
 *
 * ⚠️ **Ο ιδιωτικός χώρος κρίνεται ΠΡΩΤΟΣ και δεν αγγίζει τη βάση.** Το `/o/me`
 * είναι **πάντα** ο χώρος του ίδιου του αιτούντος: υπάρχει επειδή υπάρχει ο
 * άνθρωπος (Ε-3 §2), δεν αποθηκεύεται, και **δεν έχει `companyId`**. Μια
 * αναζήτηση στο ευρετήριο για το `me` θα ήταν ερώτηση χωρίς νόημα — και θα
 * κόστιζε ανάγνωση σε **κάθε** αίτημα του ιδιωτικού χώρου.
 *
 * ⚠️ **Καμία απομνημόνευση με χρόνο λήξης.** Το Zanzibar της Google ονομάζει τη
 * βλάβη *«new enemy problem»*: ένα TTL cache σπάει την **άμεση** ανάκληση του
 * Ε-2 §5 — ο διωγμένος συνεργάτης θα συνέχιζε να βλέπει τον φάκελο μέχρι να
 * λήξει το cache. Η προαιρετική `cache` του `decideMembership` είναι **ανά
 * αίτημα**, όχι ανά χρόνο.
 */
export async function resolveWorkspaceFromPath(
  pathname: string,
  uid: string,
  claims: CustomClaims,
): Promise<PathWorkspaceResolution> {
  const segment = extractWorkspaceSegment(pathname);
  if (segment === null) return { outcome: 'no-workspace' };

  // ⚡ Ο ιδιωτικός χώρος: ΜΗΔΕΝ αναγνώσεις, και ποτέ `companyId`.
  if (segment.toLowerCase() === PERSONAL_WORKSPACE_ALIAS) {
    return {
      outcome: 'resolved',
      companyId: '',
      alias: PERSONAL_WORKSPACE_ALIAS,
      verdict: 'self',
      personal: true,
    };
  }

  const resolution = await resolveAlias(segment);

  if (resolution.outcome === 'unknown') {
    // ⚠️ ΟΧΙ 404. Δεν κοιτάξαμε (N.12 · Ε-5 §4 #3).
    return { outcome: 'unavailable' };
  }
  if (resolution.outcome === 'not-found') {
    return { outcome: 'not-found' };
  }

  const decision = await decideMembership({
    uid,
    claimCompanyId: claims.companyId,
    globalRole: claims.globalRole,
    requested: orgWorkspace(resolution.companyId),
  });

  if (isAllowed(decision.verdict)) {
    return {
      outcome: 'resolved',
      companyId: resolution.companyId,
      alias: segment,
      verdict: decision.verdict,
      personal: false,
    };
  }

  // 🔴 Η ΑΙΤΙΑ ΜΕΝΕΙ ΑΚΕΡΑΙΗ ΣΤΑ ΙΧΝΗ — προς τα έξω φεύγει η αδιάκριτη μορφή.
  logger.warn('[WORKSPACE_PATH] Ζητήθηκε χώρος από τη διεύθυνση — απορρίφθηκε', {
    uid,
    alias: segment,
    requested: resolution.companyId,
    verdict: decision.verdict,
  });

  // ⚠️ `unknown` ⇒ **unavailable**, όχι `not-found`: το «δεν μπόρεσα να ρωτήσω»
  //    δεν επιτρέπεται να φορέσει τη στολή του «δεν υπάρχει».
  return decision.verdict === 'unknown' ? { outcome: 'unavailable' } : { outcome: 'not-found' };
}
