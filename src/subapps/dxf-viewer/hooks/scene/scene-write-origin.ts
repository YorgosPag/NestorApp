/**
 * Scene Write Origin — SSoT provenance for auto-save gating (ADR-040 root-cause #2).
 *
 * ΓΙΑΤΙ: Στα μεγάλα συστήματα (Revit model DB, Figma multiplayer, Yjs/ProseMirror)
 * κάθε mutation κουβαλά origin, και τα side-effects (persistence) είναι gated στο origin.
 * Εδώ ισχύει η θεμελιώδης αρχή: τα per-entity Firestore docs είναι το SSoT των BIM
 * entities· το DXF scene blob (~950KB) είναι παράγωγο cache. Άρα ένα `remote-echo` (που
 * πάντα αντανακλά ΗΔΗ-persisted doc state) ΠΟΤΕ δεν χρειάζεται να ξανα-σώσει το blob —
 * όπως στο Revit η αναγέννηση view/cache ΔΕΝ «βρομίζει» (dirty) το document.
 *
 * ΕΝΑ vocabulary + ΜΙΑ συνάρτηση απόφασης αντικαθιστούν τα scattered `suppressAutoSave`
 * booleans: νέο origin → compile error αν δεν το χειριστεί το `originSchedulesAutoSave`.
 */

/** Γιατί άλλαξε η σκηνή — SSoT provenance για το auto-save gating (ADR-040). */
export type SceneWriteOrigin =
  | 'local-edit'        // user command / drawing / grip-drag / paste / delete → ΠΡΕΠΕΙ autosave
  | 'remote-echo'       // Firestore snapshot reconciliation (ήδη persisted) → ΟΧΙ autosave
  | 'load'              // initial load / restore / bootstrap → ΟΧΙ autosave
  | 'system-reconcile'; // derived idempotent writes (hosting/fitting/connector reconcilers +
                        // type re-resolution, ADR-441/-408) — το source edit ήδη προγραμμάτισε
                        // save → ΟΧΙ autosave

/**
 * Default = `local-edit` → opt-OUT migration (safe): τα υπάρχοντα user-edit call sites
 * (commands/drawing/grips) δουλεύουν αμετάβλητα· ταγκάρουμε ΜΟΝΟ τα μη-τοπικά paths.
 * Ελάχιστη επιφάνεια, μηδέν regression για user edits, backward-compatible optional param.
 */
export const DEFAULT_SCENE_WRITE_ORIGIN: SceneWriteOrigin = 'local-edit';

/**
 * Η ΜΟΝΑΔΙΚΗ απόφαση «σχηματίζει αυτό το write auto-save;». Καμία αλλού (SSoT).
 * Μόνο τα τοπικά edits του χρήστη προγραμματίζουν αποθήκευση του scene blob· τα
 * remote echoes, τα loads και τα derived system reconciles αντανακλούν ΗΔΗ-persisted
 * doc state και δεν πρέπει να ξανα-σώσουν το παράγωγο cache.
 */
export function originSchedulesAutoSave(origin: SceneWriteOrigin): boolean {
  return origin === 'local-edit';
}
