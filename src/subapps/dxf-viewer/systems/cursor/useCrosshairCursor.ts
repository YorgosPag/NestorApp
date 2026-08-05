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
import {
  buildTableArrowCursorValue,
  buildTableFillCursorValue,
  buildTableMoveCursorValue,
} from './table-indicator-cursor-image';
import { subscribeDevicePixelRatio } from './device-pixel-ratio';
import { getDevicePixelRatio } from './utils';
// 🔬 ADR-739 §31.11 — το όργανο. Σβηστό εξ ορισμού· κόστος όταν είναι σβηστό = μία σύγκριση
// boolean. Ζει εδώ γιατί εδώ είναι ο ΕΝΑΣ γραφέας: κάθε αλλαγή σχήματος δείκτη περνά από αυτό
// το `apply()`, άρα μία μέτρηση εδώ είναι **πλήρης** εξ ορισμού.
import { noteCursorApply, type CursorApplyBranch } from './cursor-apply-audit';
import type { TableIndicatorCursorRole } from '../../bim/table/table-indicator-cursor-role';
// 🔴 ADR-751 — το χεράκι πάνω σε διεύθυνση κελιού. Δύο ανεξάρτητα σκέλη, δύο συνδρομές:
// το `CtrlKeyTracker` είναι ο SSoT του modifier (ADR-363) και μέχρι τώρα δεν είχε κανέναν
// καταναλωτή στη διαδρομή δείκτη — εδώ αποκτά τον πρώτο.
import { getHoveredCellLink, subscribeHoveredCellLink } from '../../state/table-cell-link-hover-store';
import { CtrlKeyTracker } from '../../keyboard/CtrlKeyTracker';

/**
 * Σταθερή διάσταση (CSS px) του κεντρικού τετραγωνιδίου (pickbox) στο σταυρόνημα — αίτημα Giorgio.
 * Αποσυνδεδεμένο από το osnap `apertureSize` (ανοχή έλξης, ρυθμιζόμενη ≥8): το οπτικό κουτί του
 * κέρσορα είναι πάντα 7×7. Ο toggle `showAperture` εξακολουθεί να το δείχνει/κρύβει.
 */
const CURSOR_PICKBOX_PX = 7;

/**
 * ADR-739 §31/§36 — ρόλος λειτουργίας πίνακα → τιμή CSS `cursor`. Η **μία** μετάφραση.
 *
 * Οκτώ από τους **έντεκα** ρόλους είναι λέξεις-κλειδιά που ζωγραφίζει ο **ΟΣ** (μηδέν ράστερ,
 * μηδέν κόστος, και ο χρήστης βλέπει το δικό του θέμα δείκτη)· ζωγραφίζονται μόνο **τρεις**, ο
 * καθένας για δικό του λόγο: τα δύο βέλη επιλογής άξονα επειδή **δεν υπάρχει** λέξη-κλειδί σε
 * καμία πλατφόρμα, και ο σταυρός της λαβής συμπλήρωσης (ADR-754 §14) επειδή η λέξη-κλειδί
 * υπάρχει αλλά είναι **πιασμένη** από το σταυρόνημα CAD. Η επιλογή «native όπου υπάρχει» δεν
 * είναι τεμπελιά: το `col-resize` του χρήστη είναι ό,τι βλέπει σε **κάθε** άλλη εφαρμογή, και
 * ένα ζωγραφισμένο αντίγραφό του θα ήταν αναγνωρίσιμα «σχεδόν σωστό».
 *
 * ## 🔴 §36 — ΤΟ `cell` ΕΙΝΑΙ ΚΥΡΙΟΛΕΚΤΙΚΑ Ο ΣΤΑΥΡΟΣ ΠΟΥ ΖΗΤΗΘΗΚΕ, ΚΑΙ ΕΙΝΑΙ ΔΩΡΕΑΝ
 * Ο ιδιοκτήτης ζήτησε «*μέσα σε κελί ο κέρσορας γίνεται σταυρός, όπως στο Excel*». Η
 * προδιαγραφή CSS ορίζει το `cursor: cell` **ακριβώς** έτσι — «*a thick plus-sign […]
 * indicating that a cell or set of cells may be selected*» — και οι browsers το ζωγραφίζουν
 * ως τον παχύ σταυρό του φύλλου υπολογισμού. Δηλαδή το εικονίδιο **που ζητήθηκε** υπάρχει
 * ήδη στο λειτουργικό.
 *
 * Αυτό δεν είναι απλώς φθηνότερο από ένα PNG — είναι **ανώτερο**, και το ξέρουμε μετρημένα:
 * το `table-indicator-cursor-image` υπάρχει επειδή τα βέλη **δεν** είχαν λέξη-κλειδί, και
 * κουβαλά ολόκληρη την ιστορία των παγίδων του (Chrome που απορρίπτει SVG data-URL·
 * Windows/Chrome που απορρίπτουν **σιωπηλά** πάνω από ~32 device-px· σημείο ενέργειας που
 * ξεφεύγει σε dpr < 1). Ένας native δείκτης δεν μπορεί να απορριφθεί, δεν έχει dpr, δεν έχει
 * αποτύπωμα να αλλάξει και δεν μπορεί να τρεμοπαίξει — τα τρία ακριβώς προβλήματα που
 * γέννησαν το όργανο του §31.11.
 *
 * ⚠️ Η **εισαγωγή** (`Shift`) δεν έχει δικό της σχήμα, και είναι απόφαση: το Excel δείχνει
 * κι εκεί δείκτη μετακίνησης και μεταφέρει το μήνυμα με τη **γραμμή-I** στον καμβά, όχι με
 * τον δείκτη. Ένα τέταρτο εικονίδιο θα έλεγε κάτι που ο χρήστης δεν έχει μάθει πουθενά.
 */
function tableIndicatorCursorValue(role: TableIndicatorCursorRole): string {
  switch (role) {
    case 'column-resize':
      return 'col-resize';
    // Το κάτοπτρο (Giorgio 2026-08-04): `row-resize` είναι λέξη-κλειδί CSS όπως το `col-resize`,
    // άρα ο νέος ρόλος πληρώνει **μηδέν** — καμία εικόνα, κανένα από τα τίμημα του §31.11.
    case 'row-resize':
      return 'row-resize';
    case 'column-select':
      return buildTableArrowCursorValue('down');
    case 'row-select':
      return buildTableArrowCursorValue('right');
    case 'cell-select':
      return 'cell';
    // 🔴 ADR-739 §36.10 — **δικό μας ράστερ, όχι πια η λέξη-κλειδί.** Ο ιδιοκτήτης ζήτησε ίσο
    // μέγεθος με τον σταυρό συμπλήρωσης, και ο δείκτης του ΟΣ δεν έχει μέγεθος να ρυθμιστεί.
    // Η εφεδρεία είναι το **ίδιο** `move`, άρα η χειρότερη περίπτωση είναι η προηγούμενη
    // συμπεριφορά — το φθηνότερο ράστερ της οικογένειας. Δες την κεφαλίδα της συνάρτησης.
    case 'range-move':
      return buildTableMoveCursorValue();
    case 'range-copy':
      return 'copy';
    // 🔴 ADR-739 §36 ΦΑΣΗ 3 — **η άρνηση, ορατή**. Το σχέδιο μεταφοράς απάντησε «όχι»
    // (συγχώνευση στον στόχο, ή η περιοχή δεν προσγειώνεται ακέραιη), και ο δείκτης το λέει
    // **πριν** ο χρήστης αφήσει το κουμπί. Είναι το ένα από τα δύο κανάλια της άρνησης — το
    // άλλο είναι το κόκκινο φάντασμα — και το **μόνο** που λειτουργεί όταν το χέρι βρίσκεται
    // έξω από το πλέγμα, όπου δεν υπάρχει ορθογώνιο να βαφτεί.
    case 'range-refuse':
      return 'not-allowed';
    // 🔴 ADR-739 §40 — **το ⊕ της εισαγωγής**. `pointer` και όχι κάτι πιο «σχεδιαστικό»:
    // είναι το μόνο σημείο σε ολόκληρο τον πίνακα που συμπεριφέρεται ως **κουμπί** — ένα
    // πάτημα, μία πράξη, καμία σύρση. Ο δείκτης λέει ακριβώς αυτό, με τη λέξη-κλειδί που
    // κάθε χρήστης έχει ήδη μάθει από τον ιστό. Ο κανόνας «native όπου υπάρχει» ξανά.
    //
    // ⚠️ Επιστρέφεται **μόνο** στη φάση `armed` (δες `tableIndicatorCursorRoleAtFrame`): στη
    // φάση `nearby` το ⊕ φαίνεται αλλά δεν πατιέται, και ένας δείκτης κουμπιού εκεί θα ήταν
    // ακριβώς το ψέμα που ο §31 απαγορεύει ονομαστικά.
    case 'insert-control':
      return 'pointer';
    // 🔴 ADR-739 §42 — **το ⊖ της διαγραφής**. Ο ίδιος δείκτης με το ⊕ και για τον ίδιο λόγο:
    // είναι κουμπί. Η **διαφορά** των δύο πράξεων δηλώνεται εκεί που ο χρήστης κοιτά όταν
    // στοχεύει — το κόκκινο πλύσιμο πάνω στους άξονες που θα φύγουν — όχι στο σχήμα του
    // δείκτη, που ο ΟΣ δεν επιτρέπει να χρωματιστεί.
    //
    // ⚠️ Ούτε εδώ `not-allowed`: η πράξη **επιτρέπεται**. Το `not-allowed` ανήκει στο
    // `range-refuse`, όπου η απελευθέρωση όντως δεν κάνει τίποτα.
    case 'delete-control':
      return 'pointer';
    // 🔴 ADR-754 §14 — **ο λεπτός μαύρος σταυρός της λαβής συμπλήρωσης** (Excel parity).
    //
    // Ο **τρίτος** ρόλος που πληρώνει ράστερ, και ο πρώτος που το πληρώνει παρότι η λέξη-κλειδί
    // υπάρχει: το `crosshair` της προδιαγραφής είναι εδώ **πιασμένο** από το σταυρόνημα CAD που
    // ο Νέστωρ δείχνει σε ολόκληρο τον καμβά (ADR-549 Φ8), οπότε θα ήταν οπτικά ταυτόσημο με το
    // «κανένας ρόλος» — δηλαδή θα άφηνε τη λαβή τόσο αόρατη όσο ήταν πριν γραφτεί αυτή η γραμμή.
    // Ο κανόνας «native όπου υπάρχει» δεν χαλάρωσε· η προϋπόθεσή του δεν ισχύει σε αυτό το ένα
    // σημείο, και ο λόγος είναι μετρημένος και γραμμένος.
    case 'fill-handle':
      return buildTableFillCursorValue();
    // 🔴 ADR-739 §43 — **το τετραγωνάκι της γωνίας** («επιλογή όλων»). `pointer`, όπως τα δύο
    // χειριστήρια από πάνω και για τον **ίδιο** λόγο: ένα πάτημα, μία πράξη, καμία σύρση.
    //
    // ⚠️ Είναι επίτηδες **διαφορετικό** από τα δύο βέλη επιλογής άξονα (`column-select` /
    // `row-select`), παρότι η πράξη είναι συγγενής («μάρκαρε»). Εκείνα πληρώνουν ράστερ επειδή
    // δηλώνουν **κατεύθυνση** — ποια λωρίδα, από πού ως πού. Η γωνία δεν έχει κατεύθυνση: δεν
    // υπάρχει σύρση «όλων», και ένα βέλος θα υποσχόταν μία.
    case 'select-all':
      return 'pointer';
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
    let unsubCellLink: () => void = () => {};
    let unsubCtrl: () => void = () => {};

    const apply = (): void => {
      const target = el;
      if (!target) return;
      const cross = getCursorSettings().crosshair;
      // Ο ρόλος διαβάζεται **μία** φορά, πριν από κάθε κλάδο: τον χρειάζεται και η απόφαση
      // παρακάτω και η καταγραφή κάθε κλάδου (ένα «NavWheel ενώ ο πίνακας ζητούσε βέλος»
      // είναι διάγνωση, όχι θόρυβος). Καθαρή ανάγνωση store — καμία παρενέργεια.
      const tableCursor = getTableIndicatorCursor();
      /**
       * 🔴 Ο ΕΝΑΣ γραφέας γράφει από **ΕΝΑ** σημείο.
       *
       * Οι τέσσερις κλάδοι έγραφαν ο καθένας μόνος του στο `style.cursor`. Ήταν σωστό, αλλά
       * κάθε μελλοντικό πράγμα που πρέπει να συμβαίνει «σε κάθε εγγραφή» (εδώ: η μέτρηση)
       * θα χρειαζόταν **τέσσερα** αντίγραφα — δηλαδή τρεις ευκαιρίες να ξεχαστεί ένα.
       * Ίδια αρχή με τον ΕΝΑΝ καθαρισμό του §31.4.
       */
      const write = (branch: CursorApplyBranch, value: string): void => {
        noteCursorApply(branch, tableCursor, value, getDevicePixelRatio());
        target.style.cursor = value;
      };
      // ADR-513 — πάνω στα πλήκτρα του «Δαχτυλιδιού Εντολών» (NavWheel) δείξε κανονικό δείκτη
      // ώστε ο χρήστης να μπορεί να κλικάρει τα πλήκτρα (το σταυρόνημα «εξαφανίζεται»).
      if (isCrosshairSuppressed()) {
        write('navwheel', 'default');
        return;
      }
      // 🔴 ADR-751 — το χεράκι πάνω σε διεύθυνση μέσα σε κελί. Απαιτεί **και τα δύο**: σύνδεσμο
      // κάτω από τον δείκτη **και** Ctrl πατημένο — δηλαδή δείχνει ακριβώς όταν το κλικ θα
      // ανοίξει κάτι, ποτέ νωρίτερα. Ένα μόνιμο χεράκι πάνω σε κάθε e-mail θα υποσχόταν κλικ
      // που το σκέτο κλικ **δεν** κάνει (εκείνο επιλέγει τον πίνακα, όπως πάντα).
      //
      // Θέση: **πριν** τη λωρίδα του πίνακα. Οι δύο μπορούν να συνυπάρξουν μέσα σε ανοιχτή
      // συνεδρία (η λωρίδα δίνει το σταυρουδάκι κελιού), και τότε νικά η πιο **ρητή** πρόθεση:
      // ο χρήστης κρατά modifier, δεν περιπλανιέται.
      if (CtrlKeyTracker.getSnapshot() && getHoveredCellLink()) {
        write('cell-link', 'pointer');
        return;
      }
      // ADR-739 §31 — η λωρίδα δείκτη του πίνακα. Μπαίνει **μετά** το NavWheel και **πριν** τον
      // διακόπτη του σταυρονήματος, και οι δύο θέσεις είναι απόφαση:
      //   • μετά το δαχτυλίδι, γιατί εκείνο ζει **πάνω** από τον καμβά — όταν ο κέρσορας κάθεται
      //     στα πλήκτρα του, ό,τι λέει ο πίνακας από κάτω είναι άσχετο.
      //   • πριν το `cross.enabled`, γιατί ο δείκτης της λωρίδας δεν είναι σχεδιαστικό εργαλείο:
      //     ένας χρήστης με κλειστό σταυρόνημα θα έπαιρνε `cursor: none` πάνω από τα γράμματα,
      //     δηλαδή **καθόλου** δείκτη — η χειρότερη δυνατή απάντηση στο «τι πατιέται εδώ».
      if (tableCursor) {
        write('table', tableIndicatorCursorValue(tableCursor));
        return;
      }
      if (!cross?.enabled) {
        write('crosshair-off', 'none');
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
      write('crosshair', buildCrosshairCursorValue({
        color: color ?? cross.color ?? '#ffffff',
        lineWidth: lineWidth ?? (cross.line_width || 1),
        gap,
        pickbox,
        opacity: cross.opacity ?? 1,
        size,
      }));
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
      // 🔴 ADR-751 — **δύο** συνδρομές, γιατί η συνθήκη έχει δύο σκέλη που αλλάζουν χωριστά:
      //   • ο σύνδεσμος κάτω από τον δείκτη (αλλάζει με την κίνηση)·
      //   • το Ctrl (αλλάζει **χωρίς καμία κίνηση** — ο χρήστης στέκεται πάνω στο e-mail και
      //     πατά το πλήκτρο). Χωρίς τη δεύτερη, το χεράκι θα εμφανιζόταν μόνο αν κουνούσε το
      //     ποντίκι μετά το Ctrl, δηλαδή θα έμοιαζε σπασμένο ακριβώς στη σωστή χειρονομία.
      unsubCellLink = subscribeHoveredCellLink(apply);
      unsubCtrl = CtrlKeyTracker.subscribe(apply);
    };
    attach();

    return () => {
      if (timer) clearTimeout(timer);
      unsubSettings();
      unsubSuppress();
      unsubDpr();
      unsubGrip();
      unsubTable();
      unsubCellLink();
      unsubCtrl();
      if (el) el.style.cursor = ''; // restore (class-defined cursor takes over again)
    };
  }, [targetRef, enabled, size, color, lineWidth]);
}
