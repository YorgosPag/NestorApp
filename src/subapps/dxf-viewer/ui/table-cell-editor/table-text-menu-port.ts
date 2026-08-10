'use client';

/**
 * ADR-739 §67 — **η θύρα της γραμμής εργαλείων κειμένου προς τα δύο πεδία της συνεδρίας**.
 *
 * ## 🔴 Γιατί ΤΕΤΑΡΤΗ θύρα και όχι νέα προτεραιότητα στον `useCanvasContextMenu`
 * Οι τρεις υπάρχουσες θύρες (ζώνες δείκτη, σύνδεσμος, περιοχή) απαντούν όλες στην **ίδια**
 * ερώτηση του δρομολογητή: «πέφτει αυτό το δεξί κλικ πάνω στον καμβά μέσα σε πίνακα;». Ο
 * δρομολογητής ζει σε **capture** πάνω στον `containerRef` του καμβά (`useCanvasContextMenu`).
 *
 * Το `<textarea>` του κελιού και το `<input>` της γραμμής τύπων **δεν είναι μέσα σε εκείνο το
 * δοχείο**: ζουν στο `CanvasSectionOverlays`, που είναι **αδελφός** του `CanvasLayerStack` στο
 * δέντρο του `CanvasSection`. Άρα το `contextmenu` πάνω τους δεν φτάνει ποτέ στον δρομολογητή,
 * κανείς δεν κάνει `preventDefault`, και ο browser δείχνει **το δικό του** μενού — αυτό ακριβώς
 * ανέφερε ο ιδιοκτήτης (στιγμιότυπο 10/08: «Emoji / Αναίρεση / Ορθογραφικός έλεγχος» πάνω από
 * το κελί B2). Το κενό **δεν** κλείνει με νέα προτεραιότητα σε ακροατή που δεν βλέπει το
 * συμβάν· κλείνει με χειριστή πάνω στο ίδιο το πεδίο.
 *
 * ## Γιατί θύρα και όχι prop
 * Ίδια αιτιολόγηση με τις τρεις αδελφές της: τα δύο πεδία ζουν σε components που **δεν** έχουν
 * πρόσβαση στον ιδιοκτήτη του μενού, και ένα prop θα κατέβαινε μέσα από τον `CanvasSection` —
 * τον orchestrator που ο ADR-040 απαγορεύει να αποκτήσει συνδρομές. Ανάγνωση module τη στιγμή
 * του συμβάντος.
 *
 * @module subapps/dxf-viewer/ui/table-cell-editor/table-text-menu-port
 * @see ui/table-cell-editor/use-table-text-toolbar.ts — ο ιδιοκτήτης που τη γεμίζει
 * @see ui/table-cell-editor/use-table-text-context-menu.ts — ο ΕΝΑΣ χειριστής των δύο πεδίων
 * @see ui/table-cell-editor/table-range-menu-port.ts — η αδελφή θύρα του καμβά
 */

import type { TableTextField } from '../components/table-text-menu/table-text-toolbar-types';

export interface TableTextMenuPort {
  /**
   * Ανοίγει τη γραμμή εργαλείων για **αυτό** το πεδίο, στο σημείο του δεξιού κλικ.
   *
   * @returns `true` όταν άνοιξε — τότε ο καλών κάνει `preventDefault` και το native μενού του
   *          browser δεν εμφανίζεται ποτέ· `false` όταν δεν υπάρχει ζωντανή συνεδρία, οπότε ο
   *          καλών **δεν** καταναλώνει το συμβάν. Ένα σιωπηλό `preventDefault` πάνω σε επιφάνεια
   *          που δεν άνοιξε θα ήταν δεξί κλικ που δεν κάνει τίποτα — χειρότερο και από το
   *          native.
   */
  readonly open: (clientX: number, clientY: number, field: TableTextField) => boolean;
}

let port: TableTextMenuPort | null = null;

/** Ο κάτοχος της γραμμής δηλώνεται όσο είναι μονταρισμένος· `null` τον αποσύρει. */
export function setTableTextMenuPort(next: TableTextMenuPort | null): void {
  port = next;
}

/** Ανάγνωση τη στιγμή του συμβάντος — ποτέ στιγμιότυπο σε κλείσιμο. */
export function getTableTextMenuPort(): TableTextMenuPort | null {
  return port;
}

/** Test helper — μηδενισμός μεταξύ tests, ίδιο μοτίβο με τις αδελφές θύρες. */
export function __resetTableTextMenuPortForTests(): void {
  port = null;
}
