'use client';

/**
 * 🔴 ADR-739 §67 — **το κέλυφος ενός αγκυρωμένου μενού καμβά**: κρυφός πυροδότης, ένας δρόμος
 * εξόδου, φύλακας «κλικ πάνω στη γραμμή εργαλείων», σημάδι συνεδρίας.
 *
 * ## Γιατί εξήχθη (CHECK 3.28, μετρημένο 2026-08-10)
 * Το JSX ήταν **κατά λέξη** το ίδιο σε δύο μενού — 23 γραμμές / 75 tokens, πιασμένα από το
 * jscpd μέσα στο ίδιο commit. Είναι η **τρίτη** φορά που το σχήμα «αγκυρωμένο μενού πίνακα»
 * γεννά δίδυμο: το ADR-751 Φ8.β εξήγαγε τον κύκλο ζωής ({@link useAnchoredContextMenu}), το §67
 * τον δρόμο εκτέλεσης ({@link useRunMenuCommand}), και τώρα την **υποδοχή**.
 *
 * ## 🔴 Τι ΔΕΝ μπαίνει εδώ
 * Το **περιεχόμενο** (items, τίτλοι) και η **γραμμή εργαλείων** από πάνω. Κάθε μενού έχει δικό
 * του `T` και δικές του εντολές· κοινό είναι μόνο το κουτί που τις φιλοξενεί. Ίδιο ακριβώς
 * κριτήριο με το `use-anchored-context-menu.ts`: **γνώση χωριστά από μηχανική**.
 *
 * ⚠️ Το `TABLE_CELL_SESSION_MARKER` μπαίνει **και στα δύο** (πυροδότη + περιεχόμενο) και δεν
 * είναι πλεονασμός: ο φύλακας εστίασης ρωτά το `relatedTarget` ενός `blur` — που είναι ο
 * **πυροδότης** όταν το Radix επιστρέφει την εστίαση — και το `document.activeElement` μετά από
 * κλικ σε item, που ζει **μέσα** στο περιεχόμενο. Δύο διαφορετικά στοιχεία, μία απάντηση.
 *
 * @module subapps/dxf-viewer/ui/components/dxf-context-menu/AnchoredMenuShell
 * @see ui/components/dxf-context-menu/use-anchored-context-menu.ts — ο κύκλος ζωής
 * @see ui/components/TableRangeContextMenu.tsx — ο καταναλωτής
 */

import React, { type ReactNode, type RefObject } from 'react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DxfMenuContent,
  DxfMenuHiddenTrigger,
} from './DxfContextMenu';
import { useKeepOpenOnSurface } from './use-keep-open-on-surface';
import { TABLE_CELL_SESSION_MARKER } from '../../table-cell-editor/table-cell-session-focus';

export interface AnchoredMenuShellProps {
  readonly isOpen: boolean;
  readonly onOpenChange: (next: boolean) => void;
  readonly triggerRef: RefObject<HTMLSpanElement | null>;
  /**
   * Η **δεύτερη** επιφάνεια (mini toolbar) που ζει σε δικό της portal και μετράει ως «έξω» για
   * το `DismissableLayer`. Χωρίς τον φύλακα, **κάθε** πάτημα κουμπιού θα έκλεινε το μενού στο
   * `pointerdown` — δηλαδή πριν προλάβει να εκδοθεί το `click` της εντολής.
   */
  readonly surfaceRef: RefObject<HTMLElement | null>;
  /**
   * `null` ⇒ το περιεχόμενο **δεν αποδίδεται καθόλου**.
   *
   * Ο φρουρός είναι του καλούντος (κρέμεται από τον δικό του παγωμένο στόχο) και ταξιδεύει ως
   * `children`, ώστε αυτό το module να μη χρειάζεται να μάθει τι είναι «στόχος».
   */
  readonly children: ReactNode | null;
}

export function AnchoredMenuShell({
  isOpen, onOpenChange, triggerRef, surfaceRef, children,
}: AnchoredMenuShellProps): React.ReactElement {
  const keepOpenOnSurface = useKeepOpenOnSurface(surfaceRef);

  return (
    <DropdownMenu open={isOpen} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <DxfMenuHiddenTrigger ref={triggerRef} {...TABLE_CELL_SESSION_MARKER} />
      </DropdownMenuTrigger>

      {children === null ? null : (
        <DxfMenuContent
          {...TABLE_CELL_SESSION_MARKER}
          onPointerDownOutside={keepOpenOnSurface}
          onFocusOutside={keepOpenOnSurface}
        >
          {children}
        </DxfMenuContent>
      )}
    </DropdownMenu>
  );
}
