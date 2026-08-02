'use client';

/**
 * ADR-739 Φ.Δ βήμα 9 — **η θύρα του μενού ζωνών δείκτη προς τον δρομολογητή δεξιού κλικ**.
 *
 * ## Γιατί θύρα και όχι props
 * Ο `useCanvasContextMenu` πρέπει να ρωτήσει «πέφτει αυτό το δεξί κλικ σε ζώνη δείκτη;»
 * **πριν** ανοίξει το μενού οντότητας. Ο ίδιος καλείται στη γραμμή 283 του `CanvasSection`,
 * ενώ ο κάτοχος της απάντησης (`useCanvasSectionUI`) στη γραμμή 423 — δηλαδή ένα prop θα
 * απαιτούσε είτε **αναδιάταξη hooks** στον πιο ευαίσθητο orchestrator της εφαρμογής
 * (ADR-040), είτε ανάθεση σε ref μέσα στο render. Και τα δύο είναι χειρότερα από το να
 * δηλωθεί ρητά αυτό που ήδη ισχύει: **υπάρχει το πολύ ένας ανοιχτός πίνακας τη φορά**, όπως
 * ακριβώς υπάρχει ένας δρομέας κελιού (`table-cell-cursor-store`).
 *
 * Το ίδιο μοτίβο χρησιμοποιεί ήδη ο δρομολογητής για να παραχωρήσει το δεξί κλικ στο μενού
 * όψεων του 3D (`usePolygonMode3DStore.getState().active`, ADR-539 Φ3f): **ανάγνωση module τη
 * στιγμή του συμβάντος**, όχι prop που ταξιδεύει μέσα από τον orchestrator.
 *
 * ⚠️ Η θύρα κρατά **συναρτήσεις, όχι κατάσταση**. Δεν υπάρχει τίποτα να παλιώσει: το `getHit`
 * διαβάζει δρομέα και σκηνή τη στιγμή που το καλούν.
 *
 * @module subapps/dxf-viewer/ui/table-cell-editor/table-header-menu-port
 * @see hooks/canvas/useCanvasContextMenu.ts — ο ΕΝΑΣ δρομολογητής (PRIORITY 1.4)
 */

import type { TableIndicatorHit } from '../../bim/table/table-indicator-geometry';

export interface TableHeaderMenuPort {
  /** `null` όταν το σημείο δεν είναι ζώνη δείκτη — τότε ο δρομολογητής συνεχίζει κανονικά. */
  readonly getHit: (clientX: number, clientY: number) => TableIndicatorHit | null;
  readonly open: (clientX: number, clientY: number, hit: TableIndicatorHit) => void;
}

let port: TableHeaderMenuPort | null = null;

/** Ο κάτοχος του μενού δηλώνεται όσο είναι μονταρισμένος· `null` τον αποσύρει. */
export function setTableHeaderMenuPort(next: TableHeaderMenuPort | null): void {
  port = next;
}

/** Ανάγνωση τη στιγμή του συμβάντος — ποτέ στιγμιότυπο σε κλείσιμο. */
export function getTableHeaderMenuPort(): TableHeaderMenuPort | null {
  return port;
}

/** Test helper — μηδενισμός μεταξύ tests, ίδιο μοτίβο με τα stores του subapp. */
export function __resetTableHeaderMenuPortForTests(): void {
  port = null;
}
