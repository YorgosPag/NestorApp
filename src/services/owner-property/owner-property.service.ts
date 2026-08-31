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

import { apiClient, apiErrorBodyOf } from '@/lib/api/enterprise-api-client';
import { createModuleLogger } from '@/lib/telemetry';
import { enterpriseIdService } from '@/services/enterprise-id.service';
import type {
  OwnerProperty,
  OwnerPropertyDraft,
  OwnerPropertyLifecycle,
} from '@/types/owner-property';
import {
  isOwnerPropertyInvariant,
  type OwnerPropertyInvariant,
} from '@/types/owner-property-invariants';
import {
  isMandateInvariant,
  type MandateInvariant,
} from '@/types/owner-property-mandate';
import type { PublishOutcome } from '@/services/listings/publish-public-listing';

const logger = createModuleLogger('owner-property.service');

/**
 * Τι έγινε με το μήνυμα προς τον ιδιοκτήτη — **ονομαστικά**, ποτέ `boolean`.
 *
 * ⚠️ Ο τύπος ζει εδώ και **όχι** εισαγόμενος από την υπηρεσία διακομιστή: εκείνη
 * φέρει `import 'server-only'`, και μια εισαγωγή —έστω και **μόνο τύπου**— από
 * κώδικα πελάτη είναι εξάρτηση που κανείς δεν θέλει να μάθει ότι υπήρχε την ημέρα
 * που θα πάψει να διαγράφεται.
 */
export type BrokeredNotifyOutcome =
  | { readonly kind: 'sent'; readonly to: string }
  | { readonly kind: 'no-address' }
  | { readonly kind: 'failed' };

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
  /**
   * 🔴 **ΔΥΟ ΛΕΞΙΛΟΓΙΑ, ΕΝΑ ΠΕΔΙΟ** — ADR-834 §6.5.ε.
   *
   * Το `_shared/respond.ts` στέλνει `violations` για **δύο** αρνήσεις: `INVALID_LISTING`
   * *(παραβιάσεις **αγγελίας**)* και `INVALID_MANDATE` *(παραβιάσεις **εντολής**)*. Ως
   * τις 2026-08-31 αυτή η γραμμή δήλωνε **μόνο** το πρώτο — και ήταν αβλαβές **μόνο
   * επειδή δεν έφτανε τίποτα**. Μόλις το σώμα άρχισε να φτάνει, ένας κωδικός εντολής
   * θα παρουσιαζόταν ως κωδικός αγγελίας: **σωστά δεδομένα, λάθος θεραπεία**.
   */
  | {
      readonly kind: 'invalid';
      readonly violations: readonly (OwnerPropertyInvariant | MandateInvariant)[];
    }
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
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΚΑΙ ΑΚΡΙΒΩΣ ΑΥΤΟ ΣΥΝΕΒΑΙΝΕ — ΤΟ ΣΧΟΛΙΟ ΠΕΡΙΕΓΡΑΦΕ ΤΟ ΚΑΚΟ ΠΟΥ ΔΕΝ ΑΠΕΤΡΕΨΕ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ως τις 2026-08-31 η «μετάφραση» ζητούσε `cause.data.violations` — πεδίο που η
 * `ApiClientError` **δεν είχε ποτέ** ⇒ **πάντα `null`** ⇒ κάθε 422 κατέληγε «κάτι πήγε
 * στραβά», ακριβώς όπως προειδοποιεί η παράγραφος από πάνω. Οι παράγραφοι που
 * περιγράφουν συμπεριφορά είναι **προδιαγραφές**, και οφείλουν να **εκτελούνται**
 * (ADR-834 §7): αυτή δεν εκτελούνταν από **καμία** άγκυρα, γι' αυτό έζησε.
 *
 * ⚠️ **ΔΗΛΩΜΕΝΟ ΟΡΙΟ**: κανένα component **δεν αποδίδει ακόμη** αυτές τις παραβιάσεις
 * *(το `OwnerPropertyFormContent` γράφει «το `invalid` δεν πρέπει να φτάσει εδώ», γιατί
 * ο **ίδιος** κριτής τρέχει και στις δύο πλευρές)*. Άρα η διόρθωση **ανοίγει τον
 * δρόμο** — δεν αλλάζει οθόνη σήμερα. Ο δρόμος χρειάζεται όταν οι δύο κριτές
 * **αποκλίνουν**, που είναι ακριβώς η στιγμή που ο άνθρωπος μένει χωρίς εξήγηση.
 */
function violationsOf(
  cause: unknown,
): readonly (OwnerPropertyInvariant | MandateInvariant)[] | null {
  const body = apiErrorBodyOf(cause);
  if (body === null || !Array.isArray(body.violations)) return null;

  const named = body.violations.filter(
    (value): value is OwnerPropertyInvariant | MandateInvariant =>
      isOwnerPropertyInvariant(value) || isMandateInvariant(value),
  );

  // ⚠️ **Κενή λίστα ⇒ `null`, ΟΧΙ «άκυρο χωρίς λόγους».** Το δεύτερο θα ζωγράφιζε
  //    **λευκό πλαίσιο σφάλματος**: ο άνθρωπος βλέπει ότι κάτι χάλασε και δεν μαθαίνει
  //    τι. Αόρατο στους τύπους — το `Array.isArray([])` είναι `true`.
  return named.length > 0 ? named : null;
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

/**
 * **Νέα αγγελία ΓΙΑ ΠΕΛΑΤΗ** (§8.33) — άλλη πόρτα, γιατί άλλα πρέπει να αποδειχθούν.
 *
 * 🔑 **Δεν είναι παραλλαγή της παραπάνω με ένα πεδίο παραπάνω.** Η διαδρομή του
 * ιδιώτη γράφει `mandate: 'self'` **ως συμβόλαιο**· αν δεχόταν προαιρετική εντολή, ο
 * κάθε συνδεδεμένος χρήστης θα μπορούσε να δηλώσει ότι ενεργεί για λογαριασμό τρίτου.
 *
 * ⚠️ Το `notify` **ταξιδεύει πίσω** και η οθόνη οφείλει να το δείξει: «στάλθηκε στον
 * Χ» και «η επαφή δεν έχει email» είναι δύο πολύ διαφορετικά πράγματα για τον μεσίτη
 * που περιμένει απάντηση.
 */
export async function createBrokeredOwnerListing(
  ownerPropertyId: string,
  draft: OwnerPropertyDraft,
  mandate: {
    readonly clientContactId: string;
    readonly expiresAt: string;
    readonly via: string;
    readonly documentPath: string | null;
  },
): Promise<OwnerListingResult & { readonly notify?: BrokeredNotifyOutcome }> {
  try {
    const payload = await apiClient.post<WriteResponse & { notify?: BrokeredNotifyOutcome }>(
      `${API_BASE}/brokered`,
      { id: ownerPropertyId, ...draft, mandate },
    );
    return { kind: 'saved', ...payload };
  } catch (cause) {
    return failureOf('Η αγγελία πελάτη δεν δημιουργήθηκε', ownerPropertyId, cause);
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
