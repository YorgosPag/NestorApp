'use client';

/**
 * ADR-750 Φάση 4 — **η θύρα του μενού περιγραμμάτων προς τον δρομολογητή δεξιού κλικ**.
 *
 * Ίδιο μοτίβο και ίδια αιτιολόγηση με το `table-header-menu-port`: ο `useCanvasContextMenu`
 * πρέπει να ρωτήσει «πέφτει αυτό το δεξί κλικ μέσα σε πίνακα;» **πριν** ανοίξει το μενού
 * οντότητας — και σε λειτουργία πίνακα ο πίνακας **είναι** η επιλεγμένη οντότητα, οπότε το
 * PRIORITY 2 θα άρπαζε κάθε δεξί κλικ πάνω του. Ανάγνωση module τη στιγμή του συμβάντος, ποτέ
 * prop μέσα από τον orchestrator (ADR-040).
 *
 * ## Γιατί **μία** μέθοδος και όχι `getHit` + `open`
 * Η θύρα των ζωνών χωρίζει τις δύο ερωτήσεις επειδή το `hit` (ποια στήλη;) ταξιδεύει μετά ως
 * όρισμα. Εδώ ο στόχος (μια περιοχή κελιών) **δεν** ταξιδεύει: υπολογίζεται και καταναλώνεται
 * στην ίδια αναπνοή. Δύο μέθοδοι θα έκαναν την ίδια δουλειά δύο φορές ανά κλικ — και θα
 * επέτρεπαν στον καλούντα να ρωτήσει «μπορείς;» και μετά να ανοίξει με **άλλα** όρια.
 *
 * @module subapps/dxf-viewer/ui/table-cell-editor/table-range-menu-port
 * @see hooks/canvas/useCanvasContextMenu.ts — ο ΕΝΑΣ δρομολογητής (PRIORITY 1.45)
 */

export interface TableRangeMenuPort {
  /**
   * Ανοίγει το μενού περιγραμμάτων αν το σημείο πέφτει μέσα στο πλέγμα ενός ζωντανού πίνακα.
   *
   * @returns `true` όταν άνοιξε — τότε ο δρομολογητής **σταματά** εδώ· `false` όταν το κλικ δεν
   *          αφορά κελί, οπότε συνεχίζει κανονικά στις επόμενες προτεραιότητες.
   */
  readonly open: (clientX: number, clientY: number) => boolean;
}

let port: TableRangeMenuPort | null = null;

/** Ο κάτοχος του μενού δηλώνεται όσο είναι μονταρισμένος· `null` τον αποσύρει. */
export function setTableRangeMenuPort(next: TableRangeMenuPort | null): void {
  port = next;
}

/** Ανάγνωση τη στιγμή του συμβάντος — ποτέ στιγμιότυπο σε κλείσιμο. */
export function getTableRangeMenuPort(): TableRangeMenuPort | null {
  return port;
}

/** Test helper — μηδενισμός μεταξύ tests, ίδιο μοτίβο με τα stores του subapp. */
export function __resetTableRangeMenuPortForTests(): void {
  port = null;
}
