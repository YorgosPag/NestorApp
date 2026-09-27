'use client';

/**
 * **ΑΚΥΡΩΣΗ + ΚΑΤΑΦΑΣΗ** στο κάτω μέρος ενός διαλόγου — η **μία** υλοποίηση, χωρίς namespace.
 *
 * Κατέχει τη ρήτρα «όσο τρέχει η πράξη, **και τα δύο** κουμπιά κλειδώνουν και η κατάφαση λέει ότι τρέχει».
 * Τις **λέξεις** τις φέρνει ο καλών, ήδη μεταφρασμένες: ο διαχειριστής μιλά από το `admin`
 * (`DialogConfirmFooter`), η αποχώρηση του ίδιου από το `common-account` (ADR-892 Φ3) — ίδια συμπεριφορά,
 * ένα σημείο (N.0.2 · CHECK 3.28).
 *
 * ⚠️ Όχι `AlertDialogAction`: εκείνο **κλείνει** τον διάλογο με το πάτημα, και μια πράξη που τρέχει ή μια
 * άρνηση της τελευταίας στιγμής δεν θα είχε πού να φανεί.
 *
 * @module components/ui/dialog-action-footer
 */

import { Button } from '@/components/ui/button';
import { DialogFooter } from '@/components/ui/dialog';

export interface DialogActionFooterProps {
  readonly cancelLabel: string;
  readonly confirmLabel: string;
  /** Η λέξη όσο τρέχει η πράξη («Αποθήκευση…», «Αποχώρηση…»). */
  readonly busyLabel: string;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
  readonly isSubmitting: boolean;
  /** Επιτρέπεται η κατάφαση; **Προεπιλογή: όποτε δεν τρέχει ήδη.** */
  readonly canSubmit?: boolean;
  /** `destructive` όταν η πράξη **αφαιρεί**. */
  readonly confirmVariant?: 'default' | 'destructive';
}

export function DialogActionFooter({
  cancelLabel,
  confirmLabel,
  busyLabel,
  onCancel,
  onConfirm,
  isSubmitting,
  canSubmit,
  confirmVariant = 'default',
}: DialogActionFooterProps) {
  const mayConfirm = canSubmit ?? !isSubmitting;
  return (
    <DialogFooter>
      <Button variant="outline" onClick={onCancel} disabled={isSubmitting}>
        {cancelLabel}
      </Button>
      <Button variant={confirmVariant} onClick={onConfirm} disabled={!mayConfirm}>
        {isSubmitting ? busyLabel : confirmLabel}
      </Button>
    </DialogFooter>
  );
}
