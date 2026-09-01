'use client';

/**
 * 🔴 ADR-833 Φάση 4 — **ΤΟ ΣΩΜΑ ΕΝΟΣ ΑΓΚΥΡΩΜΕΝΟΥ ΜΕΝΟΥ ΚΑΜΒΑ**: ο κρυφός trigger, το
 * περιεχόμενο υπό όρο, και ο **τίτλος** που ονομάζει τον παγωμένο στόχο.
 *
 * ## Πώς βρέθηκε (CHECK 3.28, μετρημένο 2026-08-30)
 * Το ADR-751 Φ8.β είχε ήδη εξαγάγει τον **κύκλο ζωής** ({@link useAnchoredContextMenu}) όταν το
 * τρίτο μενού τον αντέγραψε. Έμεινε όμως το **JSX** — και το τέταρτο μενού (καρτέλα φύλλου) το
 * αντέγραψε με τη σειρά του: **14 γραμμές / 61 tokens**, πιασμένα από το `jscpd:diff` πριν
 * γραφτεί μία γραμμή περιεχομένου.
 *
 * 🔑 Το επαναλαμβανόμενο δεν ήταν «λίγο JSX». Ήταν **τρεις κανόνες** που, αν αποκλίνουν, δίνουν
 * μενού που συμπεριφέρονται αλλιώς μεταξύ τους:
 *
 *  1. ο trigger είναι **κρυφός** και τοποθετείται στο σημείο του δεξιού κλικ·
 *  2. το περιεχόμενο **δεν αποδίδεται καθόλου** χωρίς στόχο — ποτέ μπαγιάτικα δεδομένα·
 *  3. ο **τίτλος** είναι πάντα απενεργοποιημένο item + διαχωριστικό: ονομάζει τι θα πάθει
 *     ό,τι ακολουθεί, και είναι η τελευταία στιγμή πριν από καταστροφική εντολή.
 *
 * ## Τι ΔΕΝ μπαίνει εδώ
 * Οι **εντολές** και ο **τύπος** του στόχου. Κάθε μενού έχει δικό του `T`, γιατί η γνώση του
 * «τι θα κάνω» δεν είναι κοινή — κοινό είναι μόνο το **κέλυφος**.
 *
 * ⚠️ Και δεν το φοράνε όλα: το μενού **ζωνών** (§29) κουβαλά `TABLE_CELL_SESSION_MARKER` και
 * δεύτερο `DropdownMenu`, το μενού **περιοχής** χρειάζεται `anchor`/`setTarget`/
 * `closeMenuKeepTarget` για τη γραμμή τυπογραφίας. Ένα κέλυφος που θα τα χωρούσε όλα θα ήταν
 * ένα σώμα με τέσσερις συμπεριφορές κρυμμένες σε `if` — η αντίθετη κίνηση από SSoT.
 *
 * @module subapps/dxf-viewer/ui/components/dxf-context-menu/DxfAnchoredMenu
 * @see ui/components/dxf-context-menu/use-anchored-context-menu.ts — ο κύκλος ζωής (ADR-751)
 */

import type React from 'react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DxfMenuContent,
  DxfMenuHiddenTrigger,
  DxfMenuItem,
  DxfMenuLabel,
  DxfMenuSeparator,
} from './DxfContextMenu';
import { useAnchoredContextMenu, type AnchoredMenuHandle } from './use-anchored-context-menu';

export interface DxfAnchoredMenuProps<T> {
  /** Το `ref` του component που μοντάρει το μενού — η επιτακτική του διεπαφή (`open`/`close`). */
  readonly handleRef: React.Ref<AnchoredMenuHandle<T>>;
  /** Πώς ονομάζεται ο στόχος. Κείμενο, ποτέ εντολή: το item είναι πάντα απενεργοποιημένο. */
  readonly title: (target: T) => React.ReactNode;
  /**
   * Οι εντολές, με τον **παγωμένο** στόχο. Καλείται μόνο όσο υπάρχει στόχος.
   *
   * 🔴 ADR-833 Φ4 — το δεύτερο όρισμα είναι για τη **μία** κατηγορία εντολών που ανοίγει
   * επιφάνεια **εισόδου** (πεδίο, διάλογος): τυλίγοντάς την, η εντολή τρέχει όταν το μενού
   * έχει παραδώσει την εστίαση. Δες `useAnchoredContextMenu.runAfterClose` για το ίχνος
   * εστίασης που το επέβαλε. Κάθε άλλη εντολή το αγνοεί — και **οφείλει** να το αγνοεί.
   */
  readonly children: (target: T, runAfterClose: (action: () => void) => void) => React.ReactNode;
}

export function DxfAnchoredMenu<T>({
  handleRef,
  title,
  children,
}: DxfAnchoredMenuProps<T>): React.ReactElement {
  const { triggerRef, isOpen, target, onOpenChange, runAfterClose, onCloseAutoFocus } =
    useAnchoredContextMenu<T>(handleRef);

  return (
    <DropdownMenu open={isOpen} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <DxfMenuHiddenTrigger ref={triggerRef} />
      </DropdownMenuTrigger>

      {target ? (
        <DxfMenuContent onCloseAutoFocus={onCloseAutoFocus}>
          <DxfMenuItem disabled>
            <DxfMenuLabel>{title(target)}</DxfMenuLabel>
          </DxfMenuItem>
          <DxfMenuSeparator />
          {children(target, runAfterClose)}
        </DxfMenuContent>
      ) : null}
    </DropdownMenu>
  );
}
