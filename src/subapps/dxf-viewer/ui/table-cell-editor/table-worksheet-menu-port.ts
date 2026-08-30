'use client';

/**
 * ADR-833 Φάση 4 — **η θύρα του μενού καρτέλας φύλλου προς τον δρομολογητή δεξιού κλικ**.
 *
 * **Τέταρτη** θύρα του ίδιου μοτίβου (ζώνες δείκτη → σύνδεσμος → περιγράμματα → καρτέλα), με
 * την **ίδια** αιτιολόγηση: ο `useCanvasContextMenu` πρέπει να ρωτήσει «πέφτει αυτό το δεξί
 * κλικ σε καρτέλα φύλλου;» **πριν** ανοίξει το μενού οντότητας — γιατί σε επιλεγμένο πίνακα ο
 * πίνακας **είναι** η επιλεγμένη οντότητα. Η ανάγνωση γίνεται **module τη στιγμή του
 * συμβάντος**, ποτέ prop μέσα από τον orchestrator (ADR-040 κανόνας #2).
 *
 * ## 🔴 Γιατί ΠΑΝΩ από τις άλλες τρεις (1.35, πριν το 1.4)
 * Είναι η **μόνη** από τις τέσσερις που ζει **έξω από το πλέγμα**, στη λωρίδα κάτω από τον
 * πίνακα — δηλαδή σε pixel που καμία άλλη δεν ονομάζει. Γεωμετρική διεκδίκηση δεν υπάρχει
 * σήμερα· η θέση δηλώνει **προτεραιότητα** για την ημέρα που κάποιος μεγαλώσει μια ζώνη, και
 * τη δηλώνει προς τη σωστή μεριά: η καρτέλα είναι η **πιο ειδική** ερώτηση («αυτό το φύλλο»
 * αντί για «αυτός ο πίνακας»), με το ίδιο κριτήριο που έβαλε τον σύνδεσμο πάνω από τα
 * περιγράμματα.
 *
 * @module subapps/dxf-viewer/ui/table-cell-editor/table-worksheet-menu-port
 * @see hooks/canvas/useCanvasContextMenu.ts — ο ΕΝΑΣ δρομολογητής (PRIORITY 1.35)
 * @see ui/table-cell-editor/use-table-worksheet-menu.ts — ο κάτοχος
 */

export interface TableWorksheetMenuPort {
  /**
   * Ανοίγει το μενού αν το δεξί κλικ πέφτει σε **καρτέλα** φύλλου.
   *
   * @returns `true` όταν άνοιξε — τότε ο δρομολογητής **σταματά** εδώ· `false` όταν το κλικ
   *          δεν αφορά καρτέλα (και **το ⊕ δεν αφορά**: δεν έχει μενού, όπως ούτε στο Excel),
   *          οπότε συνεχίζει στις επόμενες προτεραιότητες.
   */
  readonly open: (clientX: number, clientY: number) => boolean;
}

let port: TableWorksheetMenuPort | null = null;

/** Ο κάτοχος του μενού δηλώνεται όσο είναι μονταρισμένος· `null` τον αποσύρει. */
export function setTableWorksheetMenuPort(next: TableWorksheetMenuPort | null): void {
  port = next;
}

/** Ανάγνωση τη στιγμή του συμβάντος — ποτέ στιγμιότυπο σε κλείσιμο. */
export function getTableWorksheetMenuPort(): TableWorksheetMenuPort | null {
  return port;
}

/** Test helper — μηδενισμός μεταξύ tests, ίδιο μοτίβο με τις αδελφές θύρες. */
export function __resetTableWorksheetMenuPortForTests(): void {
  port = null;
}
