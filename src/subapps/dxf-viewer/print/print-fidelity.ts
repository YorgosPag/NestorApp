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
  /**
   * ADR-667 Φ3 — γραμμές μοτίβου **πάνω από το budget** ⇒ τυπώθηκε **μόνο το περίγραμμα**. Η οθόνη
   * δείχνει μοτίβο, το χαρτί όχι ⇒ **υπαρκτή απόκλιση**, άρα αναφέρεται. (Το catalog MISS **δεν**
   * αναφέρεται: εκεί δεν δείχνει μοτίβο **ούτε** η οθόνη ⇒ μηδέν απόκλιση.)
   */
  | 'hatch-lines-dropped'
  /**
   * ADR-667 Φ3.1 — μοτίβο **πιο πυκνό από το όριο αναγνωσιμότητας του χαρτιού** (ISO 128-2:
   * ποτέ κάτω από 0,7mm μεταξύ παράλληλων γραμμών) ⇒ τυπώθηκε ως **απόχρωση**, όχι γραμμές.
   *
   * 🚫 **ΞΕΧΩΡΙΣΤΟΣ κωδικός από το `hatch-lines-dropped` — ΟΧΙ διπλοτυπία.** Απαντούν σε **άλλο
   * ερώτημα** και έχουν **άλλη θεραπεία**: το budget λέει «πολύ **βαρύ**» (λύση: απλοποίησε το
   * σχέδιο), αυτό λέει «πολύ **πυκνό**» (λύση: **ανέβασε την κλίμακα του μοτίβου**). Ίδιο
   * μήνυμα για τα δύο θα έστελνε τον χρήστη σε λάθος κατεύθυνση.
   */
  | 'hatch-density-collapsed'
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
  // ADR-667 Φ2 — εκφυλισμένο κελί (μηδενικό tile / degenerate boundary ⇒ κανένα anchor).
  'image-fill:degenerate-cell': 'hatch-image-solid',
  // ADR-667 Φ2 — υπέρβαση `MAX_PDF_PATTERNS_PER_PAGE`. Αντικατέστησε το `image-fill:tile-overflow`
  // της Φ1: το μοντέλο «N πλακάκια ανά γραμμοσκίαση» (και ο cap του) **έπαψε να υπάρχει** — το
  // κόστος ενός μοτίβου είναι πλέον σταθερό ως προς το εμβαδόν, όχι γραμμικό.
  'image-fill:pattern-cap': 'hatch-image-solid',
  'image-entity:decode-failed': 'image-dropped',
  'image-entity:encode-failed': 'image-dropped',
  // ADR-667 Φ3 — `scene-hatch-line-resolver`: υπέρβαση `MAX_TEK_FILL_LINES_PER_HATCH/TOTAL`. Ο
  // guard είναι υποχρεωτικός (χωρίς αυτόν: 164s πάγωμα / OOM 4GB) — αλλά **ποτέ σιωπηλός**.
  'hatch-lines:budget': 'hatch-lines-dropped',
  // ADR-667 Φ3.1 — density-LOD χαρτιού. Η οθόνη δείχνει γραμμές στο zoom του χρήστη, το χαρτί
  // απόχρωση ⇒ **υπαρκτή απόκλιση**, άρα αναφέρεται. (Το Revit κάνει το ίδιο collapse **σιωπηλά**·
  // η Απόφαση 11 λέει «καμία σιωπηλή αλλοίωση» ⇒ κρατάμε τη συμπεριφορά, όχι τη σιωπή.)
  'hatch-lines:density': 'hatch-density-collapsed',
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
