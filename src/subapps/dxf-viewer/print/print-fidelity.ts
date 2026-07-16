/**
 * ADR-667 Φ1 — Print fidelity report (SSoT).
 *
 * **Το πρόβλημα που λύνει:** το vector PDF μονοπάτι υποβαθμίζει **σιωπηλά**. Όταν το tile grid
 * μιας γραμμοσκίασης με γέμισμα «Εικόνα» κάνει overflow, το `scene-image-resolver` το
 * αντικαθιστά με το **μέσο χρώμα** — ο χρήστης παίρνει μια μεγάλη τοπογραφική επιφάνεια
 * βαμμένη **συμπαγές γκρι**, και **καμία ειδοποίηση**. Λάθος σχέδιο, μηδέν ένδειξη: το
 * χειρότερο δυνατό αποτέλεσμα για εργαλείο μηχανικού.
 *
 * **Ο ρόλος αυτού του module:** μεταφράζει τους διαγνωστικούς κωδικούς του pre-pass (ASCII,
 * logs-only) σε **μετρήσιμες, εμφανίσιμες** σημειώσεις πιστότητας. Ο `runPrint` τις εκπέμπει
 * και ο χρήστης τις βλέπει ως toast (`print-fidelity-notifications.ts`).
 *
 * ⚠️ **Γιατί ΕΔΩ και όχι μέσα στο `draw`:** το `capture.fidelity` το διαβάζει ο `runPrint`
 * **ΑΦΟΥ** επιστρέψει το `captureSource` (`print-service.ts:167`). Ό,τι υπολογιστεί μέσα στο
 * σύγχρονο `draw` closure **δεν μπορεί ποτέ να αναφερθεί** — η πιστότητα κρίνεται στο async
 * pre-pass ή πουθενά.
 *
 * @module subapps/dxf-viewer/print/print-fidelity
 * @see docs/centralized-systems/reference/adrs/ADR-667-pdf-native-tiling-patterns.md
 * @see print/vector/scene-image-resolver.ts — η πηγή των κωδικών (Φ1)
 */

/**
 * Τι **έχασε** το εξαγόμενο PDF έναντι της οθόνης. Ένας κωδικός ανά **είδος** απώλειας — όχι
 * ανά οντότητα (ο χρήστης θέλει «3 γεμίσματα έγιναν συμπαγή», όχι 3 πανομοιότυπα toasts).
 */
export type PrintFidelityCode =
  /** Γέμισμα «Εικόνα»/«Διαδικαστικά» → συμπαγές χρώμα (decode fail ή υπέρβαση tile grid). */
  | 'hatch-image-solid'
  /** «Γυμνή» εικόνα (δέντρο/ταπετσαρία) παραλείφθηκε εντελώς — δεν έχει χρώμα να υποβαθμιστεί. */
  | 'image-dropped';

/** Μία απώλεια πιστότητας + **πόσες φορές** συνέβη (ένα toast ανά είδος, με πλήθος). */
export interface PrintFidelityNote {
  readonly code: PrintFidelityCode;
  readonly count: number;
}

/**
 * Κωδικοί που εκπέμπει το pre-pass (`scene-image-resolver`) → είδος απώλειας. Ό,τι δεν
 * χαρτογραφείται εδώ αγνοείται σκόπιμα: ένας άγνωστος κωδικός δεν πρέπει να παράγει
 * ακατανόητο toast (αλλά ζει στα logs).
 */
const RESOLVER_CODE_TO_FIDELITY: Readonly<Record<string, PrintFidelityCode>> = {
  'image-fill:decode-failed': 'hatch-image-solid',
  'image-fill:encode-failed': 'hatch-image-solid',
  'image-fill:tile-overflow': 'hatch-image-solid',
  'image-entity:decode-failed': 'image-dropped',
  'image-entity:encode-failed': 'image-dropped',
};

/**
 * Διαγνωστικοί κωδικοί pre-pass → σημειώσεις πιστότητας, **ομαδοποιημένες ανά είδος με
 * πλήθος**. Καθαρή συνάρτηση. Κενή είσοδος (ή μόνο άγνωστοι κωδικοί) → κενό αποτέλεσμα ⇒
 * καμία ειδοποίηση, που είναι το σωστό για ένα πιστό PDF.
 */
export function summarizePrintFidelity(
  warnings: readonly string[],
): readonly PrintFidelityNote[] {
  const counts = new Map<PrintFidelityCode, number>();
  for (const warning of warnings) {
    const code = RESOLVER_CODE_TO_FIDELITY[warning];
    if (code) counts.set(code, (counts.get(code) ?? 0) + 1);
  }
  return [...counts].map(([code, count]) => ({ code, count }));
}

/**
 * Συγχώνευση σημειώσεων από **πολλά φύλλα** (`runPrintSet` → ένα PDF, N σελίδες): ο χρήστης
 * θέλει «5 γεμίσματα έγιναν συμπαγή σε όλο το σετ», όχι ένα toast ανά φύλλο.
 */
export function mergePrintFidelity(
  notes: readonly (readonly PrintFidelityNote[])[],
): readonly PrintFidelityNote[] {
  const counts = new Map<PrintFidelityCode, number>();
  for (const sheet of notes) {
    for (const note of sheet) counts.set(note.code, (counts.get(note.code) ?? 0) + note.count);
  }
  return [...counts].map(([code, count]) => ({ code, count }));
}
