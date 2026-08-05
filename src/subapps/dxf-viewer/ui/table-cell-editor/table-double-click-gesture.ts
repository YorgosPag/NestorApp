'use client';

/**
 * 🔴 ADR-739 §46 — **ΤΟ ΔΙΠΛΟ ΚΛΙΚ ΕΙΝΑΙ ΔΥΟ ΧΕΙΡΟΝΟΜΙΕΣ, ΟΧΙ ΜΙΑ.**
 *
 * ## Το ελάττωμα, όπως το είδε ο ιδιοκτήτης (2026-08-05, με στιγμιότυπο)
 * «Θέλω με διπλό κλικ να μπαίνω σε edit mode, αλλά **να μην μπαίνει ταυτόχρονα** και σε edit
 * mode κελιού.» Μέχρι εδώ το διπλό κλικ έκανε **δύο** πράγματα με μία κίνηση: γεννούσε τον
 * δρομέα (⇒ είσοδος στη λειτουργία πίνακα) **και** άνοιγε αμέσως συνεδρία γραφής στο κελί που
 * έτυχε να είναι από κάτω — με το κείμενό του σε πρόχειρο και κέρσορα μέσα του. Δηλαδή η
 * **είσοδος** δεν υπήρχε ως ξεχωριστό βήμα: ο χρήστης βρισκόταν να γράφει πριν προλάβει να δει
 * πού είναι, και κάθε πλήκτρο έπεφτε μέσα σε κελί αντί να πλοηγεί.
 *
 * ## 🔑 Η διάκριση ΥΠΗΡΧΕ ΗΔΗ — το ποντίκι ήταν η μόνη είσοδος που την παρέβαινε
 * Το `use-table-mode-entry` την έχει τεκμηριωμένη κατά **WAI-ARIA APG «Grid»** από το βήμα 4:
 * `Enter` = «μπες στο πλέγμα» (`nav`), `F2` = «μπες να **διορθώσεις**» (`edit`). Η αιτιολόγηση
 * της εξαίρεσης ήταν «*το διπλό κλικ έχει σημείο*» — και συγχέει **δύο** ερωτήσεις: το σημείο
 * απαντά «**ποιο** κελί», όχι «**τι θέλω να κάνω** εκεί». Το ότι το ποντίκι ξέρει τη θέση δεν
 * σημαίνει ότι δήλωσε πρόθεση γραφής.
 *
 * | διπλό κλικ | ήσουν | αποτέλεσμα |
 * |---|---|---|
 * | **είσοδος** | έξω από τη λειτουργία πίνακα | `nav` στο κελί που έδειξες, **κανένα** πρόχειρο |
 * | **άνοιγμα κελιού** | ήδη μέσα σε **αυτόν** τον πίνακα | `edit`, κέρσορας στο γράμμα |
 *
 * Η δυνατότητα «κέρσορας εκεί που έδειξες» **δεν χάνεται** — μετακινείται στη χειρονομία όπου
 * έχει νόημα, ακριβώς όπως στο **Excel** και στα **Sheets**: εκεί το διπλό κλικ ανοίγει κελί
 * επειδή είσαι **ήδη** μέσα στο φύλλο.
 *
 * ## Γιατί ζει σε δικό του module
 * Ο ίδιος λόγος με τα §31.10 / §26.15 πριν από αυτό: ο `useTableCellDoubleClickEditor` ξαναχτύπησε
 * τις **500 γραμμές** (N.7.1). Εξαγωγή, όχι κόψιμο — η απόφαση δεν χρειάζεται **τίποτα** από το
 * hook: ούτε React state, ούτε ιστορικό, ούτε συνδρομή. Παίρνει τη σκηνή και το συμβάν, γράφει
 * τον δρομέα.
 *
 * @module subapps/dxf-viewer/ui/table-cell-editor/table-double-click-gesture
 * @see ui/table-cell-editor/use-table-mode-entry.ts — οι είσοδοι **χωρίς** σημείο (Enter/F2/TABLEDIT)
 * @see state/table-cell-cursor-store.ts — γιατί το ρητό `caretIndex` αυξάνει το `caretRevision`
 */

import type React from 'react';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import { resolveTableCellEditTarget } from '../../bim/table/table-cell-edit-session';
import { tableCursorAt } from '../../bim/table/table-cell-navigation';
import { getTableCellCursor, setTableCellCursor } from '../../state/table-cell-cursor-store';
import { resolveDxfCanvasBackgroundHex } from '../../config/color-config';
import { caretIndexOfClick, cellEditorFrameLive } from './table-cell-editor-frame-live';
import { resolveSelectedTable, resolveTableById } from './table-entity-lookup';
import type { LevelManagerLike } from '../../hooks/canvas/canvas-click-types';
import type { Point2D, ViewTransform, Viewport } from '../../rendering/types/Types';

export interface TableDoubleClickParams {
  readonly event: React.MouseEvent<HTMLDivElement>;
  readonly container: HTMLDivElement;
  readonly transform: ViewTransform;
  readonly levelManager: LevelManagerLike;
  readonly getSelectedEntityIds: () => readonly string[];
}

/** Το σημείο κόσμου ενός mouse event, με την ίδια margin-aware αντιστροφή του renderer. */
function eventWorldPoint(
  event: React.MouseEvent<HTMLDivElement>,
  container: HTMLDivElement,
  transform: ViewTransform,
): Point2D {
  const containerRect = container.getBoundingClientRect();
  const viewport: Viewport = { width: containerRect.width, height: containerRect.height };
  return CoordinateTransforms.screenToWorld(
    { x: event.clientX - containerRect.left, y: event.clientY - containerRect.top },
    transform,
    viewport,
  );
}

/**
 * Εκτελεί τη χειρονομία: γράφει τον δρομέα ή σιωπά. Καμία επιστροφή — ο καλών δεν έχει καμία
 * απόφαση να πάρει μετά (το `dblclick` δεν το διεκδικεί κανείς άλλος στον καμβά).
 *
 * ## Γιατί ο δρομέας διαβάζεται με **getter**
 * Είναι ο μόνος τρόπος που η απάντηση αφορά τη **στιγμή του συμβάντος** (ADR-040). Και είναι ο
 * λόγος που αυτή η συνάρτηση δεν δέχεται τον δρομέα ως παράμετρο: ο καλών είναι `useCallback`
 * μέσα σε hook, και μια τέτοια παράμετρος θα τον ανάγκαζε να τον δηλώσει εξάρτηση — δηλαδή να
 * ξαναφτιάχνεται σε **κάθε πάτημα πλήκτρου** (το πρόχειρο ζει μέσα στον δρομέα), και ο
 * χειριστής ταξιδεύει ως prop μέχρι τον `CanvasSection`, τον orchestrator που ο ADR-040
 * απαγορεύει να επαναποδίδεται.
 *
 * ## Γιατί ο πίνακας του δρομέα προηγείται της επιλογής
 * Μέσα στη λειτουργία πίνακα ο καμβάς είναι **κλειδωμένος** (§29), άρα η επιλογή οντότητας
 * έπαψε να είναι αξιόπιστη απάντηση στο «σε ποιον πίνακα έπεσε αυτό». Ο δρομέας το ξέρει ούτως
 * ή άλλως, και η ανάγνωση δίνει τη **ζωντανή** οντότητα — όχι στιγμιότυπο.
 */
export function applyTableDoubleClick(params: TableDoubleClickParams): void {
  const { event, container, transform, levelManager, getSelectedEntityIds } = params;

  const cursorNow = getTableCellCursor();
  const entity =
    (cursorNow && resolveTableById(levelManager, cursorNow.entityId))
    ?? resolveSelectedTable(levelManager, getSelectedEntityIds);
  if (!entity) return;

  const target = resolveTableCellEditTarget(entity, eventWorldPoint(event, container, transform));
  if (!target) return;
  // **Νέα** στήλη αγκύρωσης και στους δύο δρόμους: το κλικ ξεκινά νέα σειρά καταχώρισης, άρα
  // το επόμενο Enter επιστρέφει ΕΔΩ.
  const position = tableCursorAt(target.rowId, target.colId);

  // ── Είσοδος ──────────────────────────────────────────────────────────────────────────
  // Κατάσταση `nav`, **κανένα** πρόχειρο. Το κενό πρόχειρο δεν είναι παράλειψη: το
  // `handleCommit` σιωπά σε `nav` ακριβώς για να μη σβήνει κελιά όποιος περνά από πάνω τους
  // (type-to-replace του Excel) — δες `TableCellEditorOverlay`. Το πλαίσιο του κελιού το
  // ζωγραφίζει ο καμβάς (`stampTableCellCursor`), οπότε ο χρήστης βλέπει πού βρίσκεται.
  //
  // ⚠️ Το κριτήριο είναι «μέσα σε **ΑΥΤΟΝ**», όχι «υπάρχει δρομέας κάπου»: με το δεύτερο, ένα
  // διπλό κλικ σε **δεύτερο** πίνακα θα άνοιγε κατευθείαν κελί, παραλείποντας την είσοδο.
  if (cursorNow?.entityId !== entity.id) {
    setTableCellCursor(entity.id, position, 'nav');
    return;
  }

  // ── Άνοιγμα κελιού (είσαι ήδη μέσα) ──────────────────────────────────────────────────
  // Κατάσταση `edit`, όχι `enter`: μπήκες για να **διορθώσεις**, άρα το πρόχειρο ξεκινά από το
  // δεσμευμένο κείμενο του κελιού (η `enter` είναι εκείνη που ξαναγράφει από την αρχή). Ο
  // κέρσορας πάει στο γράμμα που έδειξες (Excel) — το κουτί υπολογίζεται **εδώ** γιατί μόνο
  // τώρα υπάρχει σημείο κλικ.
  //
  // 🔴 §46.5 — το ρητό `caretIndex` **αυξάνει το `caretRevision`** μέσα στο store, και χωρίς
  // αυτό ο δείκτης θα ήταν διακοσμητικός: το `<textarea>` ζει ήδη με ταυτόσημο React `key`,
  // άρα κανένα remount, άρα το `useLayoutEffect` του κέρσορα δεν θα ξανάτρεχε ποτέ.
  const frame = cellEditorFrameLive(target, entity.angleRad, resolveDxfCanvasBackgroundHex());
  setTableCellCursor(entity.id, position, 'edit', target.text, caretIndexOfClick(target, frame));
}
