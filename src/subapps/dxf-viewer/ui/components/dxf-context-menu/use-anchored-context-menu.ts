'use client';

/**
 * 🔴 ADR-751 Φ8.β — **ο κύκλος ζωής ενός αγκυρωμένου μενού καμβά**, σε ένα σημείο.
 *
 * ## Πώς βρέθηκε (CHECK 3.28, μετρημένο 2026-08-04)
 * Το `TableCellLinkContextMenu` γεννήθηκε ως τρίτο μενού δεξιού κλικ πίνακα και αντέγραψε —
 * χωρίς να το θέλει — **32 γραμμές / 138 tokens** από το `TableRangeContextMenu`: τις τέσσερις
 * καταστάσεις, την τοποθέτηση του κρυφού trigger, το `useImperativeHandle` και τον ΕΝΑ δρόμο
 * εξόδου.
 *
 * ⚠️ **Το `jscpd:diff` ΜΟΝΟ στα νέα αρχεία ήταν ΠΡΑΣΙΝΟ.** Συγκρίνει μόνο τα αρχεία που του
 * δίνεις· ο δίδυμος ήταν εκτός λίστας. Φάνηκε μόνο όταν μπήκε **και ο αδελφός** στην ίδια
 * κλήση. Είναι το ίδιο σχήμα με το «0 = κανείς δεν κοίταξε» του N.11/N.12: πράσινο επειδή
 * **κανείς δεν ρώτησε τη σωστή ερώτηση**.
 *
 * ## Τι ΔΕΝ μπαίνει εδώ
 * Το περιεχόμενο (εντολές, εικονίδια, ετικέτες) και ο **τύπος** του στόχου. Κάθε μενού έχει
 * δικό του `T`, γιατί η γνώση του «τι θα κάνω» δεν είναι κοινή — κοινός είναι μόνο ο
 * **μηχανισμός** «άνοιξε εδώ, κράτα τον στόχο παγωμένο, κλείσε από έναν δρόμο».
 *
 * @module subapps/dxf-viewer/ui/components/dxf-context-menu/use-anchored-context-menu
 * @see ui/components/dxf-context-menu/use-anchored-hidden-trigger.ts — η τοποθέτηση, από κάτω
 */

import {
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
  type Dispatch,
  type Ref,
  type RefObject,
  type SetStateAction,
} from 'react';
import { useAnchoredHiddenTrigger } from './use-anchored-hidden-trigger';

/** Η επιτακτική διεπαφή που εκθέτει κάθε αγκυρωμένο μενού στον δρομολογητή δεξιού κλικ. */
export interface AnchoredMenuHandle<T> {
  open: (x: number, y: number, target: T) => void;
  close: () => void;
}

export interface AnchoredMenuState<T> {
  readonly triggerRef: RefObject<HTMLSpanElement | null>;
  readonly isOpen: boolean;
  /**
   * Ο στόχος, **παγωμένος στο άνοιγμα**. `null` όσο το μενού είναι κλειστό, ώστε το
   * περιεχόμενο να μην αποδίδεται καθόλου — και να μη δείχνει ποτέ μπαγιάτικα όρια αν ο
   * δείκτης έφυγε ή έγινε undo όσο ήταν ανοιχτό.
   */
  readonly target: T | null;
  /** Ο **ΕΝΑΣ** δρόμος εξόδου: `Escape`, κλικ έξω, επιλογή item. */
  readonly onOpenChange: (next: boolean) => void;
  /**
   * ADR-755 — το σημείο του δεξιού κλικ, για όποιον θέλει να **αγκυρώσει και δεύτερη
   * επιφάνεια** εκεί (mini toolbar πάνω από το μενού, απόφαση Α7 του ADR-739).
   *
   * `null` όσο δεν έχει ανοίξει ποτέ. Το κρατούσε ήδη το hook για τον κρυφό trigger· απλώς
   * δεν το έδειχνε — και ο δεύτερος καταναλωτής του θα το ξαναϋπολόγιζε από δικό του state,
   * δηλαδή δύο πηγές για τη θέση της ίδιας χειρονομίας.
   */
  readonly anchor: { readonly x: number; readonly y: number } | null;
  /**
   * ADR-755 — ανανέωση του παγωμένου στόχου **χωρίς** να ξανανοίξει το μενού.
   *
   * Το χρειάζεται όποιος κρατά τη γραμμή εργαλείων ζωντανή μετά την εντολή: η κατάσταση των
   * κουμπιών («είναι συγχωνευμένο;») οφείλει να ξαναρωτηθεί, αλλιώς το κουμπί δείχνει ότι η
   * πράξη απέτυχε ενώ έχει ήδη εφαρμοστεί στον καμβά.
   */
  readonly setTarget: Dispatch<SetStateAction<T | null>>;
  /**
   * ADR-755 — φεύγει **μόνο** το μενού· ο στόχος (άρα και η γραμμή εργαλείων) μένει ζωντανός.
   *
   * Δεν είναι δεύτερος δρόμος εξόδου: είναι **άλλο γεγονός**. Ο ένας δρόμος
   * ({@link onOpenChange}) σβήνει ολόκληρη την επιφάνεια· αυτό εδώ υποχωρεί το ένα από τα δύο
   * στρώματα. Ο φρουρός `isOpen` δεν είναι διακοσμητικός: το δεύτερο και τρίτο πάτημα στη
   * γραμμή περνούν κι αυτά από εδώ με το μενού **ήδη** κλειστό.
   */
  readonly closeMenuKeepTarget: () => void;
}

/**
 * @param ref Το προωθημένο ref του component — εδώ δένεται το `open`/`close`.
 * @param onClosed Προαιρετικό. Το μενού περιγραμμάτων το χρειάζεται για να **ξαναζωντανέψει
 *        τη συνεδρία κελιού** (αλλιώς ο δρομέας μένει στο store αλλά κουφός στην οθόνη). Το
 *        μενού συνδέσμου **δεν** το περνά, και δεν είναι παράλειψη: ζει σε απλή προβολή, όπου
 *        δεν υπάρχει συνεδρία να επιστρέψει — το Radix γυρίζει μόνο του την εστίαση στον
 *        trigger. Προαιρετικό ακριβώς για να μη χρειαστεί κανένας να περάσει `() => {}`.
 */
export function useAnchoredContextMenu<T>(
  ref: Ref<AnchoredMenuHandle<T>>,
  onClosed?: () => void,
): AnchoredMenuState<T> {
  const triggerRef = useRef<HTMLSpanElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [target, setTarget] = useState<T | null>(null);
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);

  const placeTrigger = useAnchoredHiddenTrigger(triggerRef, anchor);

  useImperativeHandle(
    ref,
    () => ({
      open: (x, y, next) => {
        placeTrigger(x, y);
        setAnchor({ x, y });
        setTarget(next);
        setIsOpen(true);
      },
      close: () => {
        setIsOpen(false);
        setTarget(null);
      },
    }),
    [placeTrigger],
  );

  const onOpenChange = useCallback(
    (next: boolean) => {
      setIsOpen(next);
      if (!next) {
        setTarget(null);
        onClosed?.();
      }
    },
    [onClosed],
  );

  const closeMenuKeepTarget = useCallback(() => {
    if (!isOpen) return;
    setIsOpen(false);
    onClosed?.();
  }, [isOpen, onClosed]);

  return { triggerRef, isOpen, target, onOpenChange, anchor, setTarget, closeMenuKeepTarget };
}
