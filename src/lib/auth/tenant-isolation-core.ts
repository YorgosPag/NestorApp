/**
 * 🔒 Ο ΠΥΡΗΝΑΣ του tenant isolation — ο ΕΝΑΣ φύλακας «ανήκει αυτό το έγγραφο στον καλούντα;» (ADR-742).
 *
 * Βγήκε από το `tenant-isolation.ts` (ADR-931) ώστε οι δηλώσεις ανά οντότητα να ζουν σε αρχεία
 * κάτω από 500 γραμμές χωρίς κυκλική εξάρτηση: `tenant-isolation.ts` και `tenant-isolation-spaces.ts`
 * εισάγουν **από εδώ**· κανένα δεν εισάγει το άλλο ανάποδα.
 *
 * ⚠️ **ΜΗΝ ξαναγράψεις τη σύγκριση `companyId`** — νέα οντότητα = νέα **δήλωση** πάνω σε αυτόν.
 *
 * @module lib/auth/tenant-isolation-core
 * @see lib/auth/tenant-isolation — το ιστορικό σκεπτικό (404 αντί 403, ADR-742 §7septies)
 */

// Direct imports to avoid circular dependency with @/lib/auth barrel
import type { AuthContext } from './types';
import type { AuditTargetType } from './audit-types';
import { logAuditEvent } from './audit';
import { isRoleBypass } from './roles';
import { isPayloadOwnedByCompany } from './tenant-ownership';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { isAddressableDocId } from '@/lib/firestore/doc-id';
import { TenantIsolationError } from './tenant-isolation-error';

// =============================================================================
// Ο ΠΥΡΗΝΑΣ — μία υλοποίηση, έξι δηλώσεις (ADR-742)
// =============================================================================

/** Το ελάχιστο που εγγυάται ένα έγγραφο με tenant. Το `?` είναι σκόπιμο: το Firestore δεν υπόσχεται πεδία. */
export interface TenantScopedDoc {
  companyId?: string;
}

/** Ο λόγος άρνησης στο audit trail. Ένα string, ένας ορισμός — τα greps των logs βασίζονται σε αυτόν. */
const TENANT_MISMATCH_REASON = 'Tenant isolation violation - companyId mismatch';

/**
 * 🔒 Ο ένας φύλακας: φέρε το έγγραφο, κρίνε την ιδιοκτησία, κατάγραψε την άρνηση.
 *
 * **Η σειρά των βημάτων είναι το συμβόλαιο ασφαλείας**, όχι λεπτομέρεια:
 *
 * 1. **Ανύπαρκτο ⇒ 404** πριν καν κοιταχτεί ο tenant. Ένα «δεν υπάρχει» δεν
 *    πρέπει να κοστίζει διαφορετικό χρόνο ή να δίνει διαφορετικό μήνυμα από
 *    το «δεν είναι δικό σου», αλλιώς η ίδια η απάντηση γίνεται μαντείο.
 * 2. **Bypass ρόλος ⇒ πέρασε.** Ο υπεργραφέας έχει σκοπίμως cross-tenant
 *    ορατότητα (ADR-232) — η ιδιοκτησία δεν ελέγχεται καν.
 * 3. **Ξένο ⇒ audit + 403.** Η καταγραφή γίνεται **πριν** τη ρίψη: η απόπειρα
 *    είναι σήμα ασφαλείας και πρέπει να επιβιώνει ακόμη κι αν ο καλών
 *    καταπιεί το σφάλμα.
 *
 * ⚠️ Η ίδια η σύγκριση **δεν γράφεται εδώ** — τη δανείζεται από το
 * `tenant-ownership.isPayloadOwnedByCompany`, ώστε ο κανόνας «έγγραφο χωρίς
 * `companyId` δεν ανήκει σε κανέναν» να ισχύει με **ένα** ορισμό σε ολόκληρο
 * το repo.
 *
 * @param spec.notFoundMessage Χρησιμεύει **και** ως μήνυμα σφάλματος **και** ως
 *   `reason` στο audit — ήταν ήδη ταυτόσημα και στις έξι συναρτήσεις.
 */
export async function requireDocInTenant<T extends TenantScopedDoc>(spec: {
  ctx: AuthContext;
  id: string;
  path: string;
  collection: string;
  targetType: AuditTargetType;
  notFoundMessage: string;
}): Promise<T> {
  const { ctx, id, path, collection, targetType, notFoundMessage } = spec;

  if (!getAdminFirestore()) {
    throw new Error('Firebase Admin not initialized');
  }

  /**
   * Το **ένα** «δεν βρέθηκε» αυτού του φύλακα — ADR-742 §7septies.
   *
   * Το καλούν **και οι δύο** κλάδοι άρνησης, με **μηδέν** ορίσματα: δεν υπάρχει
   * τιμή που θα μπορούσε να διαφέρει ανάμεσά τους, άρα δεν υπάρχει τρόπος να
   * αποκλίνουν χωρίς να αλλάξει **αυτή** η γραμμή. Επειδή το `code` είναι
   * `'NOT_FOUND'` και στις δύο περιπτώσεις, η ταυτότητα διαδίδεται **αυτόματα**
   * στους 41 καταναλωτές που ήδη γράφουν
   * `error.code === 'NOT_FOUND' ? notFoundMessage : 'Access denied'` — κανένας
   * δεν χρειάστηκε να αλλάξει.
   */
  const notFound = () => new TenantIsolationError(notFoundMessage, 404, 'NOT_FOUND');

  // Ταυτότητα που **δεν μπορεί** να υπάρξει (π.χ. η ψευδο-ταυτότητα `__new__`) είναι
  // απουσία: το Firestore θα πετούσε `INVALID_ARGUMENT` ⇒ 500 αντί για το ίδιο 404.
  const doc = isAddressableDocId(id)
    ? await getAdminFirestore().collection(collection).doc(id).get()
    : null;

  if (!doc?.exists) {
    await logAuditEvent(ctx, 'access_denied', id, targetType, {
      metadata: { path, reason: notFoundMessage },
    });
    throw notFound();
  }

  const data = doc.data() as T | undefined;

  // 🏢 ENTERPRISE: Super Admin bypasses tenant isolation (cross-tenant access)
  // 🏢 ADR-232: Super admin entities may have companyId: null — allow access
  if (!isRoleBypass(ctx.globalRole) && !isPayloadOwnedByCompany(data, ctx.companyId)) {
    // Το **ίχνος ελέγχου** κρατά την αλήθεια: εκεί ο λόγος είναι η παραβίαση
    // απομόνωσης, όχι η απουσία. Η μεταμφίεση αφορά **μόνο** το σύρμα (§3.4).
    await logAuditEvent(ctx, 'access_denied', id, targetType, {
      metadata: { path, reason: TENANT_MISMATCH_REASON },
    });
    throw notFound();
  }

  return data!;
}
