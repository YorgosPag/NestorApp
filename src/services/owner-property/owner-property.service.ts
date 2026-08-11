'use client';

/**
 * @fileoverview **Ο ΠΕΛΑΤΗΣ ΠΡΟΣ ΤΗΝ ΠΥΛΗ** — τρεις πράξεις, μία διατύπωση αστοχίας.
 * @related ADR-777 §7 (Α14) · app/api/owner-properties/** · CLAUDE.md N.6
 * @module services/owner-property/owner-property.service
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΔΕΝ ΓΡΑΦΕΙ ΣΤΟ FIRESTORE — ΚΑΙ ΓΙΑΤΙ Η ΤΑΥΤΟΤΗΤΑ ΓΕΝΝΙΕΤΑΙ ΕΔΩ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο κανόνας του `owner_properties` δίνει στον πελάτη **ανάγνωση των δικών του** και
 * **καμία** εγγραφή: η αγγελία έχει **δημόσιο παράγωγο**, και το `public_listings`
 * γράφεται μόνο από τον διακομιστή. Άρα κάθε πράξη εδώ είναι κλήση HTTP.
 *
 * 🔑 **Η ταυτότητα όμως γεννιέται ΕΔΩ**, με την **ίδια** γεννήτρια που θα καλούσε ο
 * διακομιστής ({@link enterpriseIdService}) — γιατί τη χρειάζεται το **ανέβασμα**:
 * τα αρχεία ζουν στο `owner_properties/{uid}/{ownerPropertyId}/…`, δηλαδή η διαδρομή
 * αποθήκευσης προϋποθέτει την ταυτότητα **πριν** υπάρξει το έγγραφο. Χωρίς αυτό, η
 * ροή θα ήταν *«υπόβαλε → πάρε id → ανέβασε → ξανα-υπόβαλε»*.
 *
 * ⚠️ **Ο διακομιστής δεν την εμπιστεύεται**: επαληθεύει πρόθεμα + uuid από το μητρώο
 * και γράφει με `create()`, που **πετά** αν υπάρχει.
 */

import { apiClient } from '@/lib/api/enterprise-api-client';
import { createModuleLogger } from '@/lib/telemetry';
import { enterpriseIdService } from '@/services/enterprise-id.service';
import type {
  OwnerProperty,
  OwnerPropertyDraft,
  OwnerPropertyInvariant,
  OwnerPropertyLifecycle,
} from '@/types/owner-property';
import type { PublishOutcome } from '@/services/listings/publish-public-listing';

const logger = createModuleLogger('owner-property.service');

/** Η ρίζα των διαδρομών — γραμμένη **μία** φορά. */
const API_BASE = '/api/owner-properties';

// =============================================================================
// 1. ΤΟ ΑΠΟΤΕΛΕΣΜΑ
// =============================================================================

/**
 * Τι έγινε, όπως το βλέπει η **οθόνη**.
 *
 * 🔑 **Ξεχωριστό από το αποτέλεσμα της πύλης, και δεν είναι διπλότυπο**: εκεί υπάρχει
 * `absent` (ο διακομιστής ξέρει ότι το έγγραφο δεν είναι του αιτούντος)· εδώ
 * υπάρχει `failed` με μήνυμα δικτύου. Είναι **δύο διαφορετικά σύνολα γεγονότων** —
 * μια ένωση που τα κάλυπτε και τα δύο θα ανάγκαζε κάθε οθόνη να χειριστεί καταστάσεις
 * που **δεν μπορούν να φτάσουν** σε αυτήν (ADR-749 §5).
 *
 * ⚠️ Το `publish` ταξιδεύει με το `saved` **επίτηδες**: ο ιδιοκτήτης οφείλει να
 * μάθει αν η αγγελία του έφτασε στον χάρτη — η **Α22** δεσμεύτηκε ότι *«δεν
 * δημοσιεύεται, **αλλά το λέμε καθαρά**»*.
 */
export type OwnerListingResult =
  | { readonly kind: 'saved'; readonly property: OwnerProperty; readonly publish: PublishOutcome }
  | { readonly kind: 'invalid'; readonly violations: readonly OwnerPropertyInvariant[] }
  | { readonly kind: 'failed'; readonly message: string };

interface WriteResponse {
  readonly property: OwnerProperty;
  readonly publish: PublishOutcome;
}

/**
 * Το σώμα σφάλματος του διακομιστή, όσο μας αφορά.
 *
 * ⚠️ **Ο `apiClient` πετά σε μη-2xx**, οπότε οι παραβιάσεις φτάνουν ως **εξαίρεση**.
 * Χωρίς αυτή τη μετάφραση, ένα 422 με ονομασμένους κωδικούς θα κατέληγε «κάτι πήγε
 * στραβά» — δηλαδή θα πετούσαμε ακριβώς την πληροφορία που το §8.16 δεσμεύτηκε να
 * δώσει στον άνθρωπο.
 */
function violationsOf(cause: unknown): readonly OwnerPropertyInvariant[] | null {
  const body = (cause as { data?: { violations?: unknown } } | null)?.data;
  const violations = body?.violations;
  return Array.isArray(violations) ? (violations as OwnerPropertyInvariant[]) : null;
}

/** Η **μία** μετάφραση αστοχίας — ώστε να μη γραφτεί σε καθεμία από τις τρεις πράξεις. */
function failureOf(what: string, ownerPropertyId: string, cause: unknown): OwnerListingResult {
  const violations = violationsOf(cause);
  if (violations !== null) return { kind: 'invalid', violations };

  const message = cause instanceof Error ? cause.message : String(cause);
  logger.error(what, { data: { ownerPropertyId }, error: message });
  return { kind: 'failed', message };
}

// =============================================================================
// 2. ΟΙ ΤΡΕΙΣ ΠΡΑΞΕΙΣ
// =============================================================================

/**
 * **Η ταυτότητα μιας νέας αγγελίας.**
 *
 * ⚠️ Καλείται **μία φορά**, όταν ανοίγει η φόρμα — και **όχι** σε κάθε απόδοση: η
 * διαδρομή των αρχείων χτίζεται πάνω της, οπότε μια ταυτότητα που αλλάζει θα σκόρπιζε
 * τα ανεβασμένα αρχεία σε φακέλους που κανείς δεν θα ξαναβρεί.
 */
export function newOwnerPropertyId(): string {
  return enterpriseIdService.generateOwnerPropertyId();
}

/** **Νέα αγγελία** — γράφεται και δημοσιεύεται στην ίδια πράξη διακομιστή. */
export async function createOwnerListing(
  ownerPropertyId: string,
  draft: OwnerPropertyDraft,
): Promise<OwnerListingResult> {
  try {
    const payload = await apiClient.post<WriteResponse>(API_BASE, {
      id: ownerPropertyId,
      ...draft,
    });
    return { kind: 'saved', ...payload };
  } catch (cause) {
    return failureOf('Η αγγελία δεν δημιουργήθηκε', ownerPropertyId, cause);
  }
}

/** **Αλλαγή περιεχομένου** σε υπάρχουσα αγγελία. */
export async function updateOwnerListing(
  ownerPropertyId: string,
  draft: OwnerPropertyDraft,
): Promise<OwnerListingResult> {
  try {
    const payload = await apiClient.patch<WriteResponse>(
      `${API_BASE}/${encodeURIComponent(ownerPropertyId)}`,
      draft,
    );
    return { kind: 'saved', ...payload };
  } catch (cause) {
    return failureOf('Η αγγελία δεν ενημερώθηκε', ownerPropertyId, cause);
  }
}

/**
 * **Απόσυρση / επαναφορά.**
 *
 * 🔑 Μία διαδρομή για τις δύο κατευθύνσεις, γιατί είναι η **ίδια πράξη**: αλλαγή
 * κύκλου ζωής + επανασύνθεση της δημόσιας προβολής. Η εξαφάνιση από τον χάρτη
 * **συμβαίνει** — δεν είναι σημαία που κάποια οθόνη οφείλει να θυμηθεί να διαβάσει.
 */
export async function setOwnerListingLifecycle(
  ownerPropertyId: string,
  lifecycle: OwnerPropertyLifecycle,
): Promise<OwnerListingResult> {
  try {
    const payload = await apiClient.patch<WriteResponse>(
      `${API_BASE}/${encodeURIComponent(ownerPropertyId)}`,
      { lifecycle },
    );
    return { kind: 'saved', ...payload };
  } catch (cause) {
    return failureOf('Η κατάσταση της αγγελίας δεν άλλαξε', ownerPropertyId, cause);
  }
}
