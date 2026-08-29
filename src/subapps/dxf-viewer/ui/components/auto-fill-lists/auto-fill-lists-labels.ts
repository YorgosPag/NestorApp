/**
 * 🔴 ADR-828 Φ4β — **ΤΑ ΚΛΕΙΔΙΑ i18n ΤΟΥ ΔΙΑΧΕΙΡΙΣΤΗ ΛΙΣΤΩΝ, ΜΙΑ ΦΟΡΑ.**
 *
 * Ο διαχειριστής αποδίδεται από **δύο** πόρτες (καρτέλα ρυθμίσεων και διάλογος του μενού),
 * και τα υποσυστατικά του είναι τρία. Χωρίς αυτό το αρχείο, το ίδιο πρόθεμα θα γραφόταν σε
 * πέντε σημεία — δηλαδή θα υπήρχαν πέντε ευκαιρίες να αποκλίνει μία μετονομασία, και το
 * CHECK 3.8 πιάνει το **κλειδί που λείπει**, όχι το πρόθεμα που ξεχάστηκε σε ένα από τα πέντε.
 *
 * Ίδιο idiom με το `table-format-cells-labels.ts` και τα μητρώα εντολών των δύο μενού: η
 * ταυτότητα γεννά το κλειδί, ποτέ δεύτερος χειρόγραφος πίνακας.
 *
 * @module subapps/dxf-viewer/ui/components/auto-fill-lists/auto-fill-lists-labels
 */

const PREFIX = 'specificSettings.categories.autoFillLists';

export const AUTO_FILL_LISTS_KEYS = {
  title: `${PREFIX}.title`,
  description: `${PREFIX}.description`,
  intro: `${PREFIX}.intro`,
  empty: `${PREFIX}.empty`,
  add: `${PREFIX}.add`,
  edit: `${PREFIX}.edit`,
  delete: `${PREFIX}.delete`,
  save: `${PREFIX}.save`,
  cancel: `${PREFIX}.cancel`,
  nameLabel: `${PREFIX}.nameLabel`,
  namePlaceholder: `${PREFIX}.namePlaceholder`,
  entriesLabel: `${PREFIX}.entriesLabel`,
  entriesPlaceholder: `${PREFIX}.entriesPlaceholder`,
  entryCount: `${PREFIX}.entryCount`,
  limits: `${PREFIX}.limits`,
  builtIn: `${PREFIX}.builtIn`,
  priority: `${PREFIX}.priority`,
  /** Πρόθεμα· η **ταυτότητα της απόρριψης** συμπληρώνει το υπόλοιπο. */
  rejection: `${PREFIX}.rejection`,
} as const;
