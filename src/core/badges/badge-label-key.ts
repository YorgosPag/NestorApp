/**
 * **ΤΟ ΚΛΕΙΔΙ ΕΤΙΚΕΤΑΣ ΜΕ ΠΡΟΘΕΜΑ NAMESPACE — ΔΙΑΒΑΖΕΤΑΙ ΣΕ ΕΝΑ ΣΗΜΕΙΟ.**
 *
 * Τα λεξιλόγια ετικετών του έργου (`config/vocabulary/labels/*`, `types/project.ts`)
 * γράφουν κλειδιά στη μορφή `<namespace>.<μονοπάτι>` — π.χ. `projects.status.planning`.
 * Στο i18next όμως το namespace **δεν ζει μέσα στο κλειδί**: το `projects.json` έχει
 * `status.planning`, όχι `projects.status.planning`. Κάποιος πρέπει να κόψει το πρόθεμα.
 *
 * 🔴 **ΓΙΑΤΙ ΕΓΙΝΕ SSoT** (ADR-806 §7 #2): αυτή η γνώση ζούσε ως **κλεισμένη συνάρτηση
 * μέσα στο `UnifiedBadge`** — αόρατη σε κάθε άλλον καταναλωτή. Η κάρτα έργου, που χτίζει
 * το δικό της badge αντί να αποδώσει `<ProjectBadge>`, **δεν μπορούσε να τη δει**: γι'
 * αυτό κρατούσε ωμό **ελληνικό κείμενο** αντί για κλειδί (N.11) — η μία μισή εφαρμογή
 * ήξερε τη σύμβαση και η άλλη μισή έγραφε το κείμενο με το χέρι.
 *
 * ⚠️ **ΕΠΙΣΤΡΕΦΕΙ `null`, ΔΕΝ ΜΑΝΤΕΥΕΙ.** Μια συμβολοσειρά χωρίς τελεία **δεν είναι**
 * κλειδί με namespace — είναι έτοιμο κείμενο (ή ένα κλειδί που ζει στο προεπιλεγμένο
 * namespace). Ο καλών αποφασίζει τι κάνει τότε· εδώ δεν επινοείται namespace.
 *
 * ⚠️ **ΜΗΝ γράψεις τρίτη εκδοχή.** Υπάρχει ήδη δεύτερη διαδρομή για συγγενές ερώτημα
 * (`components/generic/i18n/translate-field-value.ts`, CHECK 3.13) που δοκιμάζει
 * **πρώτα** το πλήρες κλειδί και **μετά** κόβει το πρόθεμα, πάνω σε δηλωμένο σύνολο
 * namespaces φορμών. Είναι **άλλο ερώτημα** (ποια namespaces είναι φορτωμένα σε φόρμα
 * υπηρεσίας) και γι' αυτό δεν ενοποιείται εδώ — αλλά αν χρειαστείς τρίτη, **ένωσε τις
 * δύο** αντί να προσθέσεις (ADR-749).
 *
 * @module core/badges/badge-label-key
 */

/** Το ζεύγος που ζητά το i18next: `t(key, { ns })`. */
export interface NamespacedLabelKey {
  readonly ns: string;
  readonly key: string;
}

/**
 * `'projects.status.planning'` → `{ ns: 'projects', key: 'status.planning' }`.
 * `'Σχεδιασμός'` → `null` (καμία τελεία ⇒ δεν είναι κλειδί με namespace).
 */
export function splitNamespacedLabelKey(label: string | undefined | null): NamespacedLabelKey | null {
  if (!label) return null;
  const dot = label.indexOf('.');
  if (dot <= 0 || dot === label.length - 1) return null;
  return { ns: label.slice(0, dot), key: label.slice(dot + 1) };
}
