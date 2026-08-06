'use client';

/**
 * ADR-750 Φ6γ — **ΤΟ ΑΓΚΥΡΩΜΕΝΟ ΑΝΑΔΥΟΜΕΝΟ**: ένα popup που κανένας πρόγονος δεν μπορεί να
 * ψαλιδίσει, ποτέ.
 *
 * ## 🔴 Το σφάλμα που γέννησε αυτό το αρχείο (ζωντανή μέτρηση, 2026-08-07)
 * Το «Χρώμα:» του διαλόγου «Μορφοποίηση κελιών → Περίγραμμα» ήταν **νεκρό στην οθόνη** επί
 * δύο απόπειρες, με **200/200 + 517/517 tests πράσινα**. Η μέτρηση στον browser έδειξε ότι
 * το κουμπί δεν ήταν ποτέ νεκρό:
 *
 * ```
 *   click ✅ (κανένα defaultPrevented) → aria-expanded=true ✅ → .colorPanel στο DOM ✅
 *   ...και ορθογώνιο 246×217 στο y=989, μέσα σε <section> που τελειώνει στο y=985.
 * ```
 *
 * Δηλαδή **ψαλιδισμένο στο μηδέν**. Ο ψαλιδιστής δεν ήταν του διαλόγου — ήταν καθολικός:
 *
 * ```css
 * / * globals.css:1105 — «Prevent horizontal overflow on mobile», ΕΚΤΟΣ media query * /
 * .container, [class*="container"], header, main, section { overflow-x: hidden; }
 * ```
 *
 * 🔑 **Και ένας μόνο άξονας αρκεί**: όταν το `overflow-x` γίνει `hidden`, η προδιαγραφή CSS
 * ορίζει ότι το `visible` του **άλλου** άξονα υπολογίζεται ως `auto`. Άρα **κάθε `<section>`
 * της εφαρμογής** (1.136 στο `src/`) είναι δοχείο κύλισης που κόβει τους `absolute`
 * απογόνους του. Και ο κανόνας N.4 **επιβάλλει** σημαντικά στοιχεία — δηλαδή η αρχιτεκτονική
 * σπρώχνει ενεργά μέσα στην παγίδα.
 *
 * ## Γιατί η λύση ΔΕΝ είναι «σβήσε το `section` από το globals.css»
 * Θα ήταν αλλαγή σε 1.136 σημεία για να διορθωθεί ένα, χωρίς μέτρηση του τι κρατά όρθιο ο
 * κανόνας. Και **δεν αρκεί**: ακόμη και χωρίς ψαλίδισμα, το popup ξεχείλιζε έξω από την κάρτα
 * και κάτω από το χείλος της οθόνης (μετρημένο). Το πρόβλημα δεν είναι ένας κακός πρόγονος —
 * είναι ότι **υπάρχουν πρόγονοι**.
 *
 * ## Η λύση: βγάλε το popup από το δέντρο, όχι το δέντρο από τη μέση
 * Κανένα από τα Revit / ArchiCAD / Figma / Cinema 4D δεν τοποθετεί αναδυόμενο ως `absolute`
 * παιδί του πάνελ. Όλα το βγάζουν σε **top-level layer** με **anchored positioning** και
 * **collision detection**. Στο web αυτό είναι σήμερα δύο ξεχωριστά πράγματα, και τα
 * χρειαζόμαστε **και τα δύο**:
 *
 * | ερώτημα | ποιος απαντά | γιατί όχι ο άλλος |
 * |---|---|---|
 * | «ποιος με ψαλιδίζει;» | **Popover API** (top layer) | το floating-ui δεν αλλάζει στρώμα ζωγραφικής |
 * | «πού ακριβώς κάθομαι;» | **`@floating-ui/react`** | το CSS Anchor Positioning είναι Chrome-only |
 *
 * ⚠️ Το **CSS Anchor Positioning** (`anchor-name` / `position-area` / `position-try`)
 * μετρήθηκε ζωντανά ως **πλήρως υποστηριζόμενο** στον Chrome του ιδιοκτήτη και θα έλυνε και
 * τα δύο με μηδέν JS. **Απορρίφθηκε**: δεν υπάρχει σε Safari/Firefox, και το
 * `nestorconstruct.gr` είναι παραγωγή. Ένα χειριστήριο που δουλεύει μόνο στη μηχανή του
 * προγραμματιστή δεν είναι λυμένο — είναι λυμένο **εδώ**.
 *
 * ## Γιατί το `popover` μπαίνει επιτακτικά και όχι ως prop του JSX
 * Ο `popover` είναι attribute του HTML, όχι της React μέχρι τη v19. Γραμμένο ως
 * `<div popover="manual">` θα εξαρτιόταν από την έκδοση της React για να φτάσει καν στο DOM —
 * και η αστοχία θα ήταν **σιωπηλή** (πέφτει πίσω στο portal, δουλεύει «σχεδόν», ψαλιδίζεται
 * την πρώτη φορά που κάποιος βάλει `overflow` σε πρόγονο). Γραμμένο με `setAttribute`,
 * ισχύει το ίδιο σε κάθε έκδοση και η ανίχνευση είναι ρητή.
 *
 * ## Τι ΔΕΝ κάνει — και γιατί όχι
 * · **Δεν αγγίζει το `Escape`.** Ο διαχειριστής του είναι το escape bus του subapp (ADR-364)
 *   και αυτό το αρχείο ζει στο `@/components/ui` — μια εξάρτηση προς τα εκεί θα ήταν
 *   αντιστροφή στρώματος. Ο καταναλωτής δηλώνει τον δικό του χειριστή αν χρειάζεται.
 * · **Δεν μετακινεί την εστίαση.** Το popup είναι σε portal, δηλαδή **έξω** από το σημαδεμένο
 *   δέντρο της συνεδρίας κελιού· μια αυτόματη εστίαση εκεί θα διάβαζόταν από τον φύλακα ως
 *   «ο χρήστης έφυγε» και θα σκότωνε τη συνεδρία (ADR-739 §26.15). Ο καταναλωτής που
 *   χρειάζεται τη συνεδρία ζωντανή φορά το `TABLE_CELL_SESSION_MARKER` στο ίδιο το popup —
 *   γι' αυτό τα υπόλοιπα props περνούν αυτούσια.
 *
 * @module components/ui/floating/AnchoredPopover
 * @see docs/centralized-systems/reference/adrs/ADR-750-table-cell-borders.md §21.10
 */

import React, { useCallback, useLayoutEffect, useState } from 'react';
import {
  useFloating,
  autoUpdate,
  offset,
  flip,
  shift,
  size,
  useDismiss,
  useInteractions,
  FloatingPortal,
  type Placement,
} from '@floating-ui/react';
import { cn } from '@/lib/utils';
import styles from './AnchoredPopover.module.css';

/** Το κενό ανάμεσα στην άγκυρα και το popup — ίδιο με το «ξεκομμένο» της mini μπάρας. */
const ANCHOR_GAP_PX = 4;

/** Ελάχιστη απόσταση από κάθε χείλος του παραθύρου, για `flip` / `shift` / `size`. */
const VIEWPORT_PADDING_PX = 8;

/**
 * Κάτω όριο ύψους πριν το `size()` παραδοθεί.
 *
 * Χωρίς αυτό, σε πολύ χαμηλό παράθυρο το `max-height` μπορεί να πέσει σε λίγα pixel και το
 * popup να γίνει μια γραμμή με scrollbar — τεχνικά «ορατό», πρακτικά άχρηστο. Με το όριο,
 * προτιμούμε μια μικρή επικάλυψη της άγκυρας από ένα popup που δεν διαβάζεται.
 */
const MIN_USABLE_HEIGHT_PX = 120;

export interface AnchoredPopoverProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Ανοιχτό; Ο καταναλωτής κατέχει την κατάσταση — εδώ δεν υπάρχει μνήμη. */
  readonly open: boolean;
  /** Κλείσιμο από **light dismiss** (πάτημα εκτός). Ό,τι άλλο το αποφασίζει ο καταναλωτής. */
  readonly onOpenChange: (open: boolean) => void;
  /**
   * Το στοιχείο-άγκυρα. `null` όσο δεν έχει προσαρτηθεί ⇒ τίποτα δεν αποδίδεται.
   *
   * Στοιχείο και όχι `ref`: το floating-ui χρειάζεται να **αντιδράσει** στην προσάρτηση, και
   * ένα `useRef` δεν προκαλεί απόδοση. Ο καταναλωτής γράφει `ref={setAnchor}` με
   * `useState` — ρητό, χωρίς κρυφό συγχρονισμό.
   */
  readonly anchor: HTMLElement | null;
  /** Προτιμώμενη θέση· το `flip()` θα την αλλάξει αν δεν χωρά. */
  readonly placement?: Placement;
  /** Κλείσιμο σε πάτημα εκτός. Η άγκυρα εξαιρείται πάντα (αλλιώς το κλικ θα διπλο-εναλλασσόταν). */
  readonly dismissOnOutsidePress?: boolean;
  readonly children: React.ReactNode;
}

/**
 * Υποστηρίζει αυτός ο browser το Popover API;
 *
 * Ελέγχεται στο **ίδιο το στοιχείο** και όχι στο `HTMLElement.prototype`: είναι η μόνη μορφή
 * που είναι σωστή και σε jsdom, όπου το prototype μπορεί να έχει μπαλωθεί μερικώς.
 */
function supportsTopLayer(element: HTMLElement): boolean {
  return typeof (element as HTMLElement & { showPopover?: unknown }).showPopover === 'function';
}

export function AnchoredPopover({
  open,
  onOpenChange,
  anchor,
  placement = 'bottom-start',
  dismissOnOutsidePress = true,
  className,
  children,
  ...rest
}: AnchoredPopoverProps): React.ReactElement | null {
  const [floatingEl, setFloatingEl] = useState<HTMLDivElement | null>(null);

  const { refs, floatingStyles, context, isPositioned } = useFloating({
    open,
    onOpenChange,
    placement,
    // `fixed` και όχι `absolute`: το popup ζει στο top layer / στο `body`, όπου δεν υπάρχει
    // πρόγονος με θέση για να μετρηθεί σχετικά — και ο trigger ζει σε `position: fixed` πάνελ.
    strategy: 'fixed',
    elements: { reference: anchor },
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(ANCHOR_GAP_PX),
      flip({ padding: VIEWPORT_PADDING_PX }),
      shift({ padding: VIEWPORT_PADDING_PX }),
      size({
        padding: VIEWPORT_PADDING_PX,
        apply({ availableHeight, elements }) {
          // Γεωμετρία από χειρονομία/παράθυρο — η μοναδική νόμιμη εγγραφή στυλ (όπως στο
          // `FloatingPanel`), και η μόνη που δεν εκφράζεται με κλάση.
          elements.floating.style.maxHeight =
            `${Math.max(MIN_USABLE_HEIGHT_PX, availableHeight)}px`;
        },
      }),
    ],
  });

  const setFloating = useCallback(
    (node: HTMLDivElement | null) => {
      refs.setFloating(node);
      setFloatingEl(node);
    },
    [refs],
  );

  /**
   * Η προαγωγή στο **top layer**. Από εδώ και πέρα κανένα `overflow`, κανένα `z-index` και
   * κανένα stacking context προγόνου δεν μπορεί να αγγίξει αυτό το στοιχείο.
   *
   * `useLayoutEffect` ώστε να συμβεί **πριν** το βάψιμο: με `useEffect` το popup θα υπήρχε για
   * ένα καρέ ως κοινό παιδί του portal — δηλαδή θα ψαλιδιζόταν, θα φαινόταν να αναβοσβήνει.
   */
  useLayoutEffect(() => {
    if (floatingEl === null || !supportsTopLayer(floatingEl)) return;
    floatingEl.setAttribute('popover', 'manual');
    floatingEl.showPopover();
    return () => {
      // Το `hidePopover` πετά αν το στοιχείο έχει ήδη αποσυνδεθεί από το document.
      if (floatingEl.isConnected) floatingEl.hidePopover();
    };
  }, [floatingEl]);

  const dismiss = useDismiss(context, {
    enabled: dismissOnOutsidePress,
    // Το `Escape` ανήκει στο escape bus του καταναλωτή (ADR-364) — δες την κεφαλίδα.
    escapeKey: false,
    outsidePress: true,
    // `pointerdown` και όχι `click`: ίδια στιγμή με κάθε άλλο μενού της εφαρμογής, ώστε ένα
    // πάτημα στον καμβά να μη ζωγραφίσει μία φορά με ανοιχτό popup.
    outsidePressEvent: 'pointerdown',
  });
  const { getFloatingProps } = useInteractions([dismiss]);

  if (!open || anchor === null) return null;

  return (
    <FloatingPortal>
      <div
        ref={setFloating}
        className={cn(styles.popover, className)}
        style={floatingStyles}
        data-positioned={isPositioned ? 'true' : 'false'}
        {...getFloatingProps(rest)}
      >
        {children}
      </div>
    </FloatingPortal>
  );
}

export default AnchoredPopover;
