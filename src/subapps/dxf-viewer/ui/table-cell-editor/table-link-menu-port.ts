'use client';

/**
 * ADR-751 Φ8.β — **η θύρα του μενού συνδέσμου προς τον δρομολογητή δεξιού κλικ**.
 *
 * Τρίτη θύρα του ίδιου μοτίβου (ζώνες δείκτη → περιγράμματα → σύνδεσμοι), με την **ίδια**
 * αιτιολόγηση: ο `useCanvasContextMenu` πρέπει να ρωτήσει «πέφτει αυτό το δεξί κλικ πάνω σε
 * σύνδεσμο;» πριν ανοίξει το μενού οντότητας, και η ανάγνωση γίνεται **module τη στιγμή του
 * συμβάντος**, ποτέ prop μέσα από τον orchestrator (ADR-040 κανόνας #2).
 *
 * ## 🔴 Γιατί κάθεται ΠΑΝΩ από τα περιγράμματα (1.44 πριν το 1.45)
 * Είναι η **πιο ειδική** ερώτηση: «αυτά τα συγκεκριμένα γράμματα» αντί για «αυτό το κελί».
 * Στην πράξη οι δύο δεν συναντιούνται ποτέ — το μενού περιγραμμάτων απαιτεί **ζωντανό δρομέα**
 * (`useLiveTable`), ενώ ο σύνδεσμος σβήνεται από το store όσο ο καμβάς είναι κλειδωμένος σε
 * συνεδρία επεξεργασίας. Η σειρά όμως γράφεται ρητά ώστε, αν κάποτε τεμνόμενα, να κερδίζει
 * η ειδικότερη· η αντίστροφη σειρά θα έδινε «μενού περιγραμμάτων» πάνω σε e-mail.
 *
 * @module subapps/dxf-viewer/ui/table-cell-editor/table-link-menu-port
 * @see hooks/canvas/useCanvasContextMenu.ts — ο ΕΝΑΣ δρομολογητής (PRIORITY 1.44)
 * @see ui/table-cell-editor/use-table-link-menu.ts — ο κάτοχος
 */

export interface TableLinkMenuPort {
  /**
   * Ανοίγει το μενού συνδέσμου αν υπάρχει σύνδεσμος κάτω από τον δείκτη.
   *
   * @returns `true` όταν άνοιξε — τότε ο δρομολογητής **σταματά** εδώ· `false` όταν το κλικ
   *          δεν αφορά σύνδεσμο, οπότε συνεχίζει στις επόμενες προτεραιότητες.
   */
  readonly open: (clientX: number, clientY: number) => boolean;
}

let port: TableLinkMenuPort | null = null;

/** Ο κάτοχος του μενού δηλώνεται όσο είναι μονταρισμένος· `null` τον αποσύρει. */
export function setTableLinkMenuPort(next: TableLinkMenuPort | null): void {
  port = next;
}

/** Ανάγνωση τη στιγμή του συμβάντος — ποτέ στιγμιότυπο σε κλείσιμο. */
export function getTableLinkMenuPort(): TableLinkMenuPort | null {
  return port;
}

/** Test helper — μηδενισμός μεταξύ tests, ίδιο μοτίβο με τις αδελφές θύρες. */
export function __resetTableLinkMenuPortForTests(): void {
  port = null;
}
