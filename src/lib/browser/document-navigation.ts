/**
 * @fileoverview **ΠΛΟΗΓΗΣΗ ΟΛΟΚΛΗΡΟΥ ΤΟΥ ΕΓΓΡΑΦΟΥ** — νέα φόρτωση σελίδας, όχι μετάβαση router.
 * @module lib/browser/document-navigation
 *
 * 🔑 **Πότε ΑΥΤΟ και όχι το σύνορο `@/lib/workspace/navigation`** (CHECK 3.61): όταν ο
 * προορισμός **δεν** είναι διαδρομή του καταλόγου μας (ανακατεύθυνση OAuth, υπογεγραμμένο
 * URL λήψης) **ή** όταν η κατάσταση του React πρέπει να πεταχτεί ολόκληρη (μετά από
 * αποσύνδεση το δέντρο κουβαλά ακόμη τον παλιό χρήστη — ADR-853 §13 ε.δ).
 *
 * ⚠️ **Γιατί συνάρτηση και όχι `window.location.assign` επί τόπου**: ήταν τρία σκόρπια
 * αντίγραφα, και στο jsdom το `window.location` **δεν επαναορίζεται** — η συμπεριφορά ήταν
 * αδοκίμαστη. Ένα σημείο = ένα mock (`jest.mock('@/lib/browser/document-navigation')`).
 */
export function navigateDocument(url: string): void {
  window.location.assign(url);
}
