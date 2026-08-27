/**
 * =============================================================================
 * 🏷️ Ο ΑΠΟΚΩΔΙΚΟΠΟΙΗΤΗΣ ΕΤΙΚΕΤΑΣ ΦΙΛΤΡΟΥ — **ΕΝΑΣ**, ΓΙΑ ΟΛΟΥΣ ΤΟΥΣ ΑΝΑΓΝΩΣΤΕΣ
 * =============================================================================
 *
 * ## Η σύμβαση
 *
 * Οι σταθερές ετικετών των φίλτρων (`PARKING_STATUS_LABELS`,
 * `PARKING_TYPE_LABELS`, `PARKING_FLOOR_LABELS`, τα `shared.ts` …) γράφουν το
 * namespace με **τελεία**, όχι με άνω-κάτω τελεία:
 *
 * ```ts
 * available: 'parking.status.available'   // ⇒ t('status.available', { ns: 'parking' })
 * ```
 *
 * Είναι **σκόπιμη** σύμβαση της οικογένειας `AdvancedFilters` — όχι λάθος. Οι
 * σταθερές είναι **δεδομένα σε αρχεία `.ts` χωρίς React**, οπότε δεν μπορούν να
 * καλέσουν `t()` μόνες τους· κουβαλούν κωδικοποιημένο το namespace και το λύνει
 * ο **αναγνώστης**.
 *
 * ## 🔴 Γιατί έγινε module — ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ (μετρημένο 2026-08-27)
 *
 * Η αποκωδικοποίηση ζούσε **μέσα** στο `AdvancedFilters/FilterField.tsx`, ως
 * τοπική συνάρτηση. Τις **ίδιες** σταθερές όμως τις διαβάζει και **δεύτερος**
 * καταναλωτής — το `CompactToolbar` (μέσω `filter-definitions.ts`) — που
 * **δεν ήξερε** τη σύμβαση και έγραφε:
 *
 * ```ts
 * t(option.label, { ns: 'common' })      // ⇒ common:parking.status.available
 * ```
 *
 * Δηλαδή έψαχνε στο **`common`** ένα κλειδί που ζει στο **`parking`**. Ζωντανά,
 * στην κονσόλα, με το bundle **πλήρως φορτωμένο**:
 *
 * ```
 * [useTranslation] i18n: raw key reached the UI → common:parking.types.electric
 *   bundles: ["common=complete", …]        ← ΦΟΡΤΩΜΕΝΟ, και όμως δεν βρέθηκε
 * ```
 *
 * > **Μία κωδικοποίηση, δύο αναγνώστες, ο ένας κουφός.** Το μενού φίλτρων έδειχνε
 * > ωμά κλειδιά ενώ οι κάρτες δίπλα του έδειχναν «Διαθέσιμη» — γιατί οι κάρτες
 * > γράφουν `parking:status.available` με **άνω-κάτω τελεία** και δεν περνούν
 * > καθόλου από εδώ.
 *
 * ⚠️ **ΜΗΝ «διορθώσεις» τις σταθερές σε άνω-κάτω τελεία.** Είναι **141** σημεία
 * σε τέσσερα αρχεία, και το `FilterField` τα διαβάζει σωστά **σήμερα**. Η
 * απόκλιση ήταν στον **αναγνώστη**, όχι στα δεδομένα — γι' αυτό διορθώνεται
 * **ένα** σημείο και όχι 141.
 *
 * ## ⚠️ Το όριο, γραμμένο ρητά
 *
 * Ο αποκωδικοποιητής **δεν φορτώνει** namespace· μόνο **δρομολογεί**. Αν το
 * `parking` δεν είναι φορτωμένο στη σελίδα, το κλειδί βγαίνει ωμό — ακριβώς όπως
 * και πριν. Στη σελίδα στάθμευσης φορτώνεται από **9** components· τα resources
 * του i18next είναι **καθολικά**, οπότε αρκεί ένας.
 *
 * @module i18n/filter-label
 * @see ADR-823 §14 · ADR-749 (μία μηχανή) · ADR-280 (namespaces)
 */

/**
 * Τα namespaces που επιτρέπεται να προηγούνται με **τελεία** σε ετικέτα φίλτρου.
 *
 * 🔑 **Κλειστό σύνολο, επίτηδες.** Χωρίς αυτό, κάθε ετικέτα με τελεία —
 * π.χ. `'operationalStatus.ready'` — θα ερμηνευόταν ως namespace
 * `operationalStatus` που **δεν υπάρχει**, και το κλειδί θα χανόταν σιωπηλά.
 * Η λίστα λέει «ΑΥΤΑ τα πρώτα τμήματα είναι namespace· κάθε άλλο είναι κλειδί».
 */
export const FILTER_LABEL_NAMESPACES: readonly string[] = [
  'common',
  'navigation',
  'properties',
  'building',
  'filters',
  'parking',
  'storage',
];

/** Ό,τι χρειάζεται ο αποκωδικοποιητής από το i18next — τίποτα παραπάνω. */
export type FilterLabelTranslator = (
  key: string,
  options?: Record<string, unknown>,
) => string;

/**
 * Σπάει μια ετικέτα σε `{ namespace, key }` **χωρίς** να μεταφράσει.
 *
 * Εκτεθειμένο ξεχωριστά ώστε οι άγκυρες να ελέγχουν τη **δρομολόγηση** χωρίς
 * i18next — δηλαδή να αποδεικνύουν ότι *αποφασίζει σωστά*, όχι απλώς ότι
 * *καλείται*.
 *
 * @returns `null` όταν η ετικέτα **δεν** φέρει γνωστό namespace.
 */
export function splitFilterLabel(
  label: string,
): { namespace: string; key: string } | null {
  if (!label.includes('.')) return null;
  const separator = label.indexOf('.');
  const namespace = label.slice(0, separator);
  if (!FILTER_LABEL_NAMESPACES.includes(namespace)) return null;
  const key = label.slice(separator + 1);
  if (key.length === 0) return null;
  return { namespace, key };
}

/**
 * Μεταφράζει ετικέτα φίλτρου, σεβόμενη τη σύμβαση της τελείας.
 *
 * Σειρά απόφασης — **και οι τρεις περιπτώσεις είναι πραγματικές**:
 *  1. **κενό / undefined** → κενή συμβολοσειρά *(ο πίνακας μπορεί να μην έχει ετικέτα)*
 *  2. **`ns.key` με γνωστό ns** → `t(key, { ns })`
 *  3. **τα υπόλοιπα** → `t(label)` αν μοιάζει με κλειδί, αλλιώς **ως έχει**
 *     *(δυναμικές τιμές: ονόματα πόλεων, κωδικοί κτιρίων — δεν μεταφράζονται)*
 */
export function translateFilterLabel(
  t: FilterLabelTranslator,
  label: string | undefined | null,
): string {
  if (!label) return '';

  const parts = splitFilterLabel(label);
  if (parts) return t(parts.key, { ns: parts.namespace });

  // Χωρίς τελεία δεν είναι κλειδί: είναι τιμή. Επιστρέφεται ατόφια.
  if (!label.includes('.')) return label;

  return t(label);
}
