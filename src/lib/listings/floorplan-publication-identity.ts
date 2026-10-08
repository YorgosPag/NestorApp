/**
 * @fileoverview **ΤΙ ΠΡΑΓΜΑ ΔΗΜΟΣΙΕΥΕΙ ΑΥΤΗ Η ΚΑΤΟΨΗ** — η ταυτότητα, όχι το αρχείο (ADR-909 Α1 · Α3).
 * @related lib/listings/model-publication-identity (ο αδελφός) · services/listings/agency-media-selection
 * @module lib/listings/floorplan-publication-identity
 *
 * ```
 * ταυτότητα = floorplan / measured / {levelId}
 * ```
 *
 * 🔑 **Μία παραγόμενη κάτοψη ανά επίπεδο.** Νέα δημοσίευση του ίδιου επιπέδου **διαδέχεται** την
 * προηγούμενη· άλλο επίπεδο είναι άλλο πράγμα και συνυπάρχει. Η χειροκίνητη κάτοψη **δεν έχει**
 * ταυτότητα ⇒ δεν αντικαθίσταται ποτέ σιωπηλά — την αποσύρει μόνο άνθρωπος.
 *
 * 🔴 **Η ΠΡΟΕΛΕΥΣΗ ΔΙΑΒΑΖΕΤΑΙ ΑΠΟ ΕΔΩ, ΚΑΙ ΕΙΝΑΙ Ο ΛΟΓΟΣ ΠΟΥ ΤΟ ΠΡΟΘΕΜΑ ΤΗΝ ΚΟΥΒΑΛΑ.** Το
 * `publicationIdentity` είναι πεδίο θεματοφυλακής: ο browser **δεν μπορεί** να το γράψει ούτε στη
 * γέννηση ούτε μετά *(ADR-845 §7.17 Α4α, `publicationCustodyKeys()`)*. Άρα «μετρημένη» σημαίνει
 * *«γεννήθηκε από την πόρτα του διακομιστή»* — ποτέ ισχυρισμός του καλούντος.
 *
 * ⛔ **Ποτέ όνομα αρχείου ή ανθρώπου μέσα στην ταυτότητα** *(ADR-769: «δένει με όνομα, και γι' αυτό
 * σπάει»)*. Το `levelId` είναι αναγνωριστικό της βάσης· μετονομασία επιπέδου δεν αλλάζει τίποτα.
 *
 * ⛔ **Καθαρό module** — καμία I/O.
 */

/** Το πρόθεμα είδους — ο αδελφός του `MODEL_IDENTITY_PREFIX`, ώστε τα δύο είδη να μη συγκρουστούν ποτέ. */
const FLOORPLAN_IDENTITY_PREFIX = 'floorplan';

/** Το σκέλος προέλευσης της παραγόμενης κάτοψης — η **μόνη** τιμή που γράφει αυτή η πόρτα. */
const MEASURED_SEGMENT = 'measured';

const IDENTITY_SEPARATOR = '/';

const MEASURED_FLOORPLAN_PREFIX =
  `${FLOORPLAN_IDENTITY_PREFIX}${IDENTITY_SEPARATOR}${MEASURED_SEGMENT}${IDENTITY_SEPARATOR}`;

/**
 * **Το κλειδί της παραγόμενης κάτοψης ενός επιπέδου.**
 *
 * @throws όταν το `levelId` είναι κενό ή περιέχει τον διαχωριστή — ένα τέτοιο κλειδί θα συγχώνευε
 * κατόψεις **διαφορετικών** επιπέδων, σιωπηλά.
 *
 * @example
 * floorplanPublicationIdentityKey('lvl_2a7f'); // 'floorplan/measured/lvl_2a7f'
 */
export function floorplanPublicationIdentityKey(levelId: string): string {
  if (levelId === '' || levelId.includes(IDENTITY_SEPARATOR)) {
    throw new Error('floorplanPublicationIdentityKey: levelId is not a level identifier');
  }
  return `${MEASURED_FLOORPLAN_PREFIX}${levelId}`;
}

/**
 * **Γεννήθηκε αυτή η κάτοψη από το σχέδιο;** — καταφατικά, ποτέ «δεν είναι δηλωμένη».
 *
 * ⚠️ Απόν, κενό ή ξένο κλειδί ⇒ `false` ⇒ η κάτοψη λέγεται «Δηλωμένη», όπως πριν από το ADR-909.
 */
export function isMeasuredFloorplanIdentityKey(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.startsWith(MEASURED_FLOORPLAN_PREFIX) &&
    value.length > MEASURED_FLOORPLAN_PREFIX.length
  );
}
