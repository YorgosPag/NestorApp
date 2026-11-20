/**
 * @fileoverview **Από πού ήρθε ο επισκέπτης του υπολογιστή, και πώς γυρίζει πίσω** (ADR-947 Φ1β) — ο σύνδεσμος
 * «← Πίσω στο ακίνητό σας» όταν ο υπολογιστής ανοίγει από το ακίνητο του ιδιοκτήτη.
 * @related `objective-value-prefill.ts` (η παράμετρος ταξιδεύει μαζί με την προσυμπλήρωση) ·
 *   `lib/owner-property/owner-property-routes.ts` (`offerImproveHref`, ο ΜΟΝΟΣ δρόμος προς τη σελίδα)
 * @module lib/objective-value/objective-value-return
 *
 * 🔴 **Ποτέ ελεύθερη διεύθυνση επιστροφής** (το κλασικό open redirect του `?returnTo=`): η διεύθυνση φέρει μόνο
 * **κλειστή ένωση + ταυτότητα**, και η διαδρομή χτίζεται **εδώ** από τον βοηθό διαδρομών. Ό,τι κι αν γράψει κάποιος στο
 * URL, ο σύνδεσμος οδηγεί μόνο σε σελίδα της εφαρμογής, ή δεν εμφανίζεται.
 *
 * ⚠️ **Μόνο ο ιδιοκτήτης, επίτηδες**: το `/offers/…` δεν έχει πρόθεμα χώρου εργασίας. Η καρτέλα ακινήτου του γραφείου
 * ζει κάτω από `/o/<εταιρεία>/…`, που η δημόσια σελίδα **δεν ξέρει**. Νέο σκέλος μπαίνει εδώ μόνο με ταυτότητα χώρου.
 */

import { ENTERPRISE_ID_PREFIXES } from '@/services/enterprise-id-prefixes';
import { offerImproveHref } from '@/lib/owner-property/owner-property-routes';

/** Η επιστροφή — κλειστή ένωση. */
export type ObjectiveValueReturn = { readonly kind: 'offer'; readonly ownerPropertyId: string };

const OFFER_KIND = 'offer';
const SEPARATOR = ':';
/** `ownp_` + γράμματα/ψηφία/παύλες, με όριο — η διεύθυνση είναι είσοδος από οποιονδήποτε. */
const OWNER_PROPERTY_ID = new RegExp(`^${ENTERPRISE_ID_PREFIXES.OWNER_PROPERTY}_[A-Za-z0-9-]{1,64}$`);

/** Η επιστροφή για ένα ακίνητο της οθόνης «Βελτίωσε» — `null` όταν δεν είναι ακίνητο ιδιοκτήτη (π.χ. του γραφείου). */
export function objectiveValueReturnOf(subjectId: string): ObjectiveValueReturn | null {
  return OWNER_PROPERTY_ID.test(subjectId) ? { kind: OFFER_KIND, ownerPropertyId: subjectId } : null;
}

export function serializeObjectiveValueReturn(target: ObjectiveValueReturn): string {
  return `${target.kind}${SEPARATOR}${target.ownerPropertyId}`;
}

/** Αυστηρή ανάγνωση: ό,τι δεν είναι ακριβώς `offer:ownp_…` ⇒ `null` (κανένας σύνδεσμος). */
export function parseObjectiveValueReturn(raw: string | null): ObjectiveValueReturn | null {
  if (raw === null) return null;
  const [kind, id, extra] = raw.split(SEPARATOR);
  if (extra !== undefined || kind !== OFFER_KIND || id === undefined) return null;
  return objectiveValueReturnOf(id);
}

/** Η διαδρομή — **μόνο** από τον βοηθό διαδρομών. */
export function objectiveValueReturnHref(target: ObjectiveValueReturn) {
  return offerImproveHref(target.ownerPropertyId);
}
