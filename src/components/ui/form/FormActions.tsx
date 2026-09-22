'use client';

/**
 * @fileoverview **SSoT: το τέλος μιας φόρμας — σφάλμα, Άκυρο, Υποβολή.**
 * @module components/ui/form/FormActions
 * @related ADR-598 §3 procurement · ADR-584 (CHECK 3.28) · `hooks/useFormSubmission`
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΤΡΕΙΣ ΑΠΟΦΑΣΕΙΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * 1. **Το κουμπί υποβολής ανήκει στη φόρμα μέσω `form={formId}`** (εγγενές HTML), ΟΧΙ
 *    μέσω `onClick`. Έτσι ζει σε `DialogFooter` ή κάτω από κάρτα, έξω από το `<form>`,
 *    και κλικ + Enter περνούν από **ΕΝΑΝ** δρόμο: το `onSubmit` της φόρμας. Το παλιό
 *    `onClick={handleSubmit}` έξω από φόρμα άφηνε τη φόρμα **χωρίς** κουμπί υποβολής ⇒
 *    κατά την προδιαγραφή HTML το Enter δεν υπέβαλλε τίποτα.
 * 2. **Κείμενο, όχι κλειδιά** — όπως το `hinted-field`: κάθε `t()` μένει στον γονέα με
 *    κυριολεκτικό κλειδί, ορατό στη CHECK 3.8 και επιλύσιμο από τον τεμαχιστή (ADR-744).
 * 3. **Άκυρο = `outline`**: τα design systems διαφωνούν (PatternFly link · Material text ·
 *    shadcn/Primer secondary)· αποφασίζει η συνέπεια του δικού μας — μετρημένο στα
 *    `DialogFooter` του έργου: outline 118 · ghost 42 · άλλα 10.
 *
 * Διάταξη = του `DialogFooter`: σε στενή οθόνη η κύρια ενέργεια **πάνω** (`flex-col-reverse`).
 */

import type { LucideIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { cn } from '@/lib/utils';

export interface FormActionsProps {
  /** Το `id` του `<form>` που υποβάλλει το κουμπί. */
  readonly formId: string;
  readonly submitLabel: string;
  /** Κείμενο όσο τρέχει η υποβολή· αλλιώς μένει το `submitLabel`. */
  readonly pendingLabel?: string;
  readonly cancelLabel: string;
  /** Χωρίς αυτό δεν αποδίδεται κουμπί Άκυρο. */
  readonly onCancel?: () => void;
  readonly submitting: boolean;
  readonly submitDisabled?: boolean;
  /** Έτοιμο κείμενο· ανακοινώνεται (`role="alert"`) τη στιγμή που εμφανίζεται. */
  readonly error?: string | null;
  readonly submitIcon?: LucideIcon;
  readonly cancelIcon?: LucideIcon;
  readonly className?: string;
}

const ICON_CLASS = 'mr-1 h-4 w-4';

export function FormActions({
  formId,
  submitLabel,
  pendingLabel,
  cancelLabel,
  onCancel,
  submitting,
  submitDisabled = false,
  error,
  submitIcon: SubmitIcon,
  cancelIcon: CancelIcon,
  className,
}: FormActionsProps) {
  const sp = useSpacingTokens();

  return (
    <footer className={cn('flex flex-col', sp.gap.sm, className)}>
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      <div className={cn('flex flex-col-reverse sm:flex-row sm:justify-end', sp.gap.sm)}>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
            {CancelIcon && <CancelIcon className={ICON_CLASS} aria-hidden />}
            {cancelLabel}
          </Button>
        )}
        <Button type="submit" form={formId} disabled={submitting || submitDisabled}>
          {SubmitIcon && <SubmitIcon className={ICON_CLASS} aria-hidden />}
          {submitting && pendingLabel ? pendingLabel : submitLabel}
        </Button>
      </div>
    </footer>
  );
}
