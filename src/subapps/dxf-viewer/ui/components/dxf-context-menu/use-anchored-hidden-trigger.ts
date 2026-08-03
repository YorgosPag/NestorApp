'use client';

/**
 * **Ο κρυφός trigger ενός context menu, καρφωμένος στο σημείο του δεξιού κλικ.**
 *
 * Το Radix τοποθετεί το περιεχόμενο σε σχέση με τον trigger του. Για μενού που ανοίγουν από
 * *σημείο* και όχι από *κουμπί*, ο trigger είναι ένα `<span>` μηδενικού μεγέθους που
 * μετακινείται εκεί που έγινε το κλικ.
 *
 * ## 🔴 ΓΙΑΤΙ ΔΥΟ ΔΙΑΔΡΟΜΕΣ ΓΙΑ ΤΗΝ ΙΔΙΑ ΘΕΣΗ — το σφάλμα που κλείνει (μετρημένο 2026-08-03)
 * Το `open()` έγραφε `style.left/top` **πριν** από το `setState`, δηλαδή πάνω στο `<span>` της
 * **προηγούμενης** απόδοσης. Δούλευε όσο τα δύο σχήματα απόδοσης (με και χωρίς στόχο) ήταν
 * πανομοιότυπα και το React επαναχρησιμοποιούσε το ίδιο DOM node. Μόλις ο ένας κλάδος τυλίχτηκε
 * σε `<>…</>` για να χωρέσει το mini toolbar, τα σχήματα **έπαψαν να ταιριάζουν**: το React
 * ξαναέχτισε το `<span>`, τα inline styles χάθηκαν, ο trigger έπεσε στη **στατική** του θέση και
 * το μενού άνοιξε στη γωνία του καμβά — μετρημένο, `style.left` **κενό**.
 *
 * Η θεραπεία δεν είναι να ξανακάνουμε τα σχήματα ίδια (εύθραυστο συμβόλαιο που κανένα test δεν
 * φυλάει): είναι **δύο** γραψίματα με διαφορετική δουλειά το καθένα —
 *   · μέσα στο `open()`  ⇒ προλαβαίνει τη **μέτρηση** του Radix (τα effects των παιδιών τρέχουν
 *     πριν του γονέα, άρα το Radix μετρά τον trigger πριν φτάσει η σειρά μας)·
 *   · στο effect        ⇒ επιβιώνει της **ανακατασκευής** του node.
 *
 * ## Γιατί κοινό module
 * Το ζητούν **δύο** μενού που ανοίγουν από σημείο — οι ζώνες δείκτη (ADR-739 Φ.Δ) και τα
 * περιγράμματα κελιών (ADR-750 Φ4) — και το CHECK 3.28 μέτρησε την αντιγραφή ως sibling clone
 * μέσα στο ίδιο commit. Δύο αντίγραφα εδώ σημαίνουν ότι το παραπάνω σφάλμα μπορεί να
 * ξαναγεννηθεί στο ένα και όχι στο άλλο, με όλο το σκεπτικό γραμμένο μόνο στο άλλο.
 *
 * @module subapps/dxf-viewer/ui/components/dxf-context-menu/use-anchored-hidden-trigger
 * @see ui/components/dxf-context-menu/DxfContextMenu.tsx — `DxfMenuHiddenTrigger`
 */

import { useCallback, useLayoutEffect, type RefObject } from 'react';

/** Το σημείο του δεξιού κλικ, σε συντεταγμένες παραθύρου· `null` με κλειστό μενού. */
export interface TriggerAnchor {
  readonly x: number;
  readonly y: number;
}

/**
 * @param triggerRef το `<span>` του {@link DxfMenuHiddenTrigger}
 * @param anchor το τρέχον σημείο, από το state του μενού — η **μία** πηγή αλήθειας για τη θέση
 * @returns το άμεσο γράψιμο, για κλήση μέσα στο `open()` **πριν** από το `setState`
 */
export function useAnchoredHiddenTrigger(
  triggerRef: RefObject<HTMLSpanElement | null>,
  anchor: TriggerAnchor | null,
): (x: number, y: number) => void {
  const placeTrigger = useCallback(
    (x: number, y: number) => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      trigger.style.left = `${x}px`;
      trigger.style.top = `${y}px`;
    },
    [triggerRef],
  );

  useLayoutEffect(() => {
    if (anchor) placeTrigger(anchor.x, anchor.y);
  }, [anchor, placeTrigger]);

  return placeTrigger;
}
