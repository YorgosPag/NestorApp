'use client';

/**
 * useCrosshairCursor — drive a CSS hardware-cursor crosshair on a target element (ADR-549 Phase 8).
 *
 * Sets `targetEl.style.cursor` to a crosshair SVG (see `crosshair-cursor-image`), so the OS draws
 * the crosshair on its hardware cursor plane → perfect 1:1 tracking with the mouse (like the
 * ViewCube «hand»), with NONE of the compositor-present latency a canvas/DOM crosshair has.
 *
 * The cursor IMAGE is rebuilt only on cursor-settings / aperture change (low-frequency); the OS
 * owns the per-move POSITION. Inline `style.cursor` overrides any `cursor-none` class on the target.
 * Restores the original cursor on unmount / when disabled.
 *
 * @module systems/cursor/useCrosshairCursor
 */

import { useEffect, type RefObject } from 'react';
import { getCursorSettings, subscribeToCursorSettings } from './config';
import { gripStyleStore } from '../../stores/GripStyleStore';
import { isCrosshairSuppressed, subscribeCrosshairSuppression } from './CrosshairSuppressionStore';
import { buildCrosshairCursorValue } from './crosshair-cursor-image';
// ADR-739 §31 — η λειτουργία πίνακα δηλώνει σχήμα δείκτη πάνω στις λωρίδες (Excel). Περνά από
// store και όχι από απευθείας εγγραφή στο element, για τον ΙΔΙΟ λόγο που το NavWheel περνά από
// το `CrosshairSuppressionStore`: εδώ ζει ο ΕΝΑΣ γραφέας του `style.cursor`, και δύο γραφείς
// σβήνουν σιωπηλά ο ένας τον άλλον στο επόμενο re-apply.
import { getTableIndicatorCursor, subscribeTableIndicatorCursor } from './TableIndicatorCursorStore';
import { buildTableArrowCursorValue } from './table-indicator-cursor-image';
import { subscribeDevicePixelRatio } from './device-pixel-ratio';
import type { TableIndicatorCursorRole } from '../../bim/table/table-indicator-geometry';

/**
 * Σταθερή διάσταση (CSS px) του κεντρικού τετραγωνιδίου (pickbox) στο σταυρόνημα — αίτημα Giorgio.
 * Αποσυνδεδεμένο από το osnap `apertureSize` (ανοχή έλξης, ρυθμιζόμενη ≥8): το οπτικό κουτί του
 * κέρσορα είναι πάντα 7×7. Ο toggle `showAperture` εξακολουθεί να το δείχνει/κρύβει.
 */
const CURSOR_PICKBOX_PX = 7;

/**
 * ADR-739 §31 — ρόλος λωρίδας → τιμή CSS `cursor`. Η **μία** μετάφραση.
 *
 * Δύο από τους τρεις ρόλους είναι λέξεις-κλειδιά που ζωγραφίζει ο **ΟΣ** (μηδέν ράστερ, μηδέν
 * κόστος, και ο χρήστης βλέπει το δικό του θέμα δείκτη)· ο τρίτος δεν έχει λέξη-κλειδί σε καμία
 * πλατφόρμα και ζωγραφίζεται. Η επιλογή «native όπου υπάρχει» δεν είναι τεμπελιά: το
 * `col-resize` του χρήστη είναι ό,τι βλέπει σε **κάθε** άλλη εφαρμογή, και ένα ζωγραφισμένο
 * αντίγραφό του θα ήταν αναγνωρίσιμα «σχεδόν σωστό».
 */
function tableIndicatorCursorValue(role: TableIndicatorCursorRole): string {
  switch (role) {
    case 'column-resize':
      return 'col-resize';
    case 'column-select':
      return buildTableArrowCursorValue('down');
    case 'row-select':
      return buildTableArrowCursorValue('right');
  }
}

export interface UseCrosshairCursorOptions {
  /** When false, the hook is inert (leaves the element's cursor untouched). Default true. */
  enabled?: boolean;
  /** Total cursor image side (CSS px, ≤128). */
  size?: number;
  /** Colour override (A/B testing). Default: the cursor-settings colour. */
  color?: string;
  /** Line-width override (A/B testing). Default: the cursor-settings line width. */
  lineWidth?: number;
}

/**
 * Apply the hardware-cursor crosshair to `targetRef`. The crosshair colour / line width / centre
 * gap come from the shared cursor settings; the centre pickbox VISIBILITY from the context-free
 * `gripStyleStore` (`showAperture`) — NOT the GripProvider React context. Reading the store (the SSoT
 * mirror written by the one canonical writer `syncGripStyleStoreFromSettings`) keeps this low-level
 * cursor hook working in EVERY mount: the full editor, the read-only 3D preview (`Bim3DReadOnlyOverlay`,
 * which has no GripProvider), and the test harness. Big-player pattern (Figma / C4D / Revit): a cursor
 * / input system reads a settings store, never a component-tree provider — and a read-only preview
 * must never require the grip-EDITING provider.
 */
export function useCrosshairCursor(
  targetRef: RefObject<HTMLElement | null>,
  // Default 32px: the builder is DPR-aware — it shrinks the CSS size so the DEVICE size stays ≤ the
  // hardware-cursor cap on every dpr, so the image is never silently rejected (a rejected `cursor`
  // declaration drops entirely → the element's class cursor wins ⇒ the crosshair vanishes). We also
  // re-apply on dpr change below so a HiDPI/zoom switch re-rasterises at the right size.
  { enabled = true, size = 32, color, lineWidth }: UseCrosshairCursorOptions = {},
): void {
  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let el: HTMLElement | null = null;
    let unsubSettings: () => void = () => {};
    let unsubSuppress: () => void = () => {};
    let unsubDpr: () => void = () => {};
    let unsubGrip: () => void = () => {};
    let unsubTable: () => void = () => {};

    const apply = (): void => {
      if (!el) return;
      const cross = getCursorSettings().crosshair;
      // ADR-513 — πάνω στα πλήκτρα του «Δαχτυλιδιού Εντολών» (NavWheel) δείξε κανονικό δείκτη
      // ώστε ο χρήστης να μπορεί να κλικάρει τα πλήκτρα (το σταυρόνημα «εξαφανίζεται»).
      if (isCrosshairSuppressed()) {
        el.style.cursor = 'default';
        return;
      }
      // ADR-739 §31 — η λωρίδα δείκτη του πίνακα. Μπαίνει **μετά** το NavWheel και **πριν** τον
      // διακόπτη του σταυρονήματος, και οι δύο θέσεις είναι απόφαση:
      //   • μετά το δαχτυλίδι, γιατί εκείνο ζει **πάνω** από τον καμβά — όταν ο κέρσορας κάθεται
      //     στα πλήκτρα του, ό,τι λέει ο πίνακας από κάτω είναι άσχετο.
      //   • πριν το `cross.enabled`, γιατί ο δείκτης της λωρίδας δεν είναι σχεδιαστικό εργαλείο:
      //     ένας χρήστης με κλειστό σταυρόνημα θα έπαιρνε `cursor: none` πάνω από τα γράμματα,
      //     δηλαδή **καθόλου** δείκτη — η χειρότερη δυνατή απάντηση στο «τι πατιέται εδώ».
      const tableCursor = getTableIndicatorCursor();
      if (tableCursor) {
        el.style.cursor = tableIndicatorCursorValue(tableCursor);
        return;
      }
      if (!cross?.enabled) {
        el.style.cursor = 'none';
        return;
      }
      // Κεντρικό τετραγωνάκι σταθερά 7×7 px· κρύβεται όταν `showAperture` = false.
      // Διαβάζεται fresh από το context-free `gripStyleStore` (SSoT mirror)· ο toggle re-applies
      // μέσω του `gripStyleStore.subscribe(apply)` παρακάτω.
      const pickbox = gripStyleStore.get().showAperture ? CURSOR_PICKBOX_PX : 0;
      // Όταν υπάρχει κουτί, οι 4 βραχίονες του σταυρού ΚΟΛΛΑΝΕ στις παρειές του (gap = μισό κουτί):
      // η άκρη κάθε γραμμής πέφτει ακριβώς πάνω στην πλευρά του τετραγώνου, χωρίς κενό (αίτημα Giorgio).
      // Χωρίς κουτί: ισχύει το κενό του χρήστη (center_gap_px) ή προεπιλογή 6.
      const gap = pickbox > 0
        ? pickbox / 2
        : (cross.use_cursor_gap ? (cross.center_gap_px ?? 6) : 6);
      el.style.cursor = buildCrosshairCursorValue({
        color: color ?? cross.color ?? '#ffffff',
        lineWidth: lineWidth ?? (cross.line_width || 1),
        gap,
        pickbox,
        opacity: cross.opacity ?? 1,
        size,
      });
    };

    // The target element may not exist yet: the host returns null until its viewport becomes visible
    // (e.g. BimViewport3D `if (!effectiveVisible) return null`), and a ref assignment does NOT re-fire
    // this effect. So poll until the element mounts, then attach + subscribe ONCE.
    const attach = (): void => {
      el = targetRef.current;
      if (!el) {
        timer = setTimeout(attach, 120);
        return;
      }
      apply();
      unsubSettings = subscribeToCursorSettings(apply);
      unsubSuppress = subscribeCrosshairSuppression(apply); // ADR-513
      // Re-rasterise on dpr change (HiDPI monitor switch / OS scaling / browser page-zoom): the
      // device size must stay ≤ cap or the browser drops the cursor and the crosshair vanishes.
      unsubDpr = subscribeDevicePixelRatio(apply);
      // Re-apply when the aperture toggle (`showAperture`) changes — the SSoT mirror notifies here
      // whether the write came from the GripProvider (editor) or stayed at the store default (read-only).
      unsubGrip = gripStyleStore.subscribe(apply);
      // ADR-739 §31 — ξανα-εφάρμοσε όταν αλλάζει ο ρόλος λωρίδας **χωρίς** κίνηση ποντικιού: το
      // χέρι στέκεται πάνω στο γράμμα και ο χρήστης κλείνει τον πίνακα με `Esc`. Χωρίς αυτό, το
      // παχύ βέλος θα έμενε στην οθόνη ως το επόμενο τυχαίο `apply()`.
      unsubTable = subscribeTableIndicatorCursor(apply);
    };
    attach();

    return () => {
      if (timer) clearTimeout(timer);
      unsubSettings();
      unsubSuppress();
      unsubDpr();
      unsubGrip();
      unsubTable();
      if (el) el.style.cursor = ''; // restore (class-defined cursor takes over again)
    };
  }, [targetRef, enabled, size, color, lineWidth]);
}
