'use client';

/**
 * @fileoverview **SSoT: ένας διάλογος που ΕΙΝΑΙ φόρμα** — τίτλος, `<form id>`, υποσέλιδο.
 * @module components/ui/form/FormDialog
 * @related ADR-598 «(θ)» · `ui/form/FormActions` · `hooks/useFormSubmission`
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Κάθε διάλογος του κύματος 2α έγραφε το ΙΔΙΟ σχήμα: `useId` για το `formId`, `<form id onSubmit>`,
 * `DialogFooter` + `FormActions` πλήρους πλάτους με `submitting`/`error` από την υποβολή. Το
 * CHECK 3.28 το έπιασε ως κλώνο δύο φορές· ο πληθυσμός που μένει να μεταφερθεί είναι ~90
 * αρχεία. Πρότυπο: Ant Design `ModalForm`, Atlassian `ModalDialog` + `Form`.
 *
 * 🔑 ΑΠΟΦΑΣΕΙΣ
 * 1. **Ο διάλογος ΔΕΝ κλείνει όσο τρέχει η υποβολή** (Esc / εκτός / ✕): ο άνθρωπος θα έχανε το
 *    αποτέλεσμα — επιτυχία ή σφάλμα — μιας ενέργειας που ΗΔΗ έφυγε (Atlassian: κλείσιμο
 *    απενεργοποιημένο σε `isLoading`). Γενίκευση του φραγμού που είχε ήδη το `VendorInviteDialog`.
 * 2. **Ένα `formId`, από εδώ**: το κουμπί υποβολής ζει στο υποσέλιδο, έξω από το `<form>`, και
 *    συνδέεται με `form=` (βλ. `FormActions`) — κλικ και Enter περνούν από τον ΙΔΙΟ δρόμο.
 * 3. **Κείμενο, όχι κλειδιά** (όπως `FormActions`): κάθε `t()` μένει στον γονέα, ορατό στη CHECK 3.8.
 */

import { useCallback, useId, type FormEvent, type ReactNode } from 'react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { FormSubmission } from '@/hooks/useFormSubmission';

import { FormActions, type FormActionsProps } from './FormActions';

export interface FormDialogProps
  extends Omit<FormActionsProps, 'formId' | 'submitting' | 'error' | 'onCancel' | 'className'> {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly title: ReactNode;
  readonly description?: ReactNode;
  readonly submission: Pick<FormSubmission, 'submitting' | 'error' | 'handleSubmit'>;
  /** Αντικαθιστά το `submission.handleSubmit` (π.χ. οδηγός: «Επόμενο» στα ενδιάμεσα βήματα). */
  readonly onSubmit?: (event: FormEvent<HTMLFormElement>) => void;
  /** Σφάλμα που ΔΕΝ προέρχεται από την υποβολή (π.χ. έλεγχος βήματος)· υπερισχύει. */
  readonly error?: string | null;
  /** Προεπιλογή: κλείσιμο του διαλόγου. */
  readonly onCancel?: () => void;
  readonly contentClassName?: string;
  readonly titleClassName?: string;
  readonly descriptionClassName?: string;
  readonly formClassName?: string;
  /**
   * Δευτερεύουσα ενέργεια στην ΑΡΧΗ του υποσέλιδου, μακριά από την κύρια (Material: η
   * καταστροφική/τριτεύουσα ενέργεια απέναντι από το «Αποθήκευση») — π.χ. «Διαγραφή».
   */
  readonly secondaryAction?: ReactNode;
  readonly children: ReactNode;
}

/** Απόφαση 1: όσο τρέχει η υποβολή, κάθε αίτημα κλεισίματος αγνοείται. */
function useGuardedOpenChange(onOpenChange: (open: boolean) => void, submitting: boolean) {
  return useCallback((next: boolean) => {
    if (next || !submitting) onOpenChange(next);
  }, [onOpenChange, submitting]);
}

export function FormDialog(props: FormDialogProps) {
  const { open, onOpenChange, title, description, submission, onSubmit, error, onCancel, secondaryAction, children, ...rest } = props;
  const { contentClassName, titleClassName, descriptionClassName, formClassName, ...actions } = rest;
  const formId = `${useId()}-form`;
  const { submitting } = submission;
  const handleOpenChange = useGuardedOpenChange(onOpenChange, submitting);
  const cancel = onCancel ?? (() => handleOpenChange(false));

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className={contentClassName}>
        <DialogHeader>
          <DialogTitle className={titleClassName}>{title}</DialogTitle>
          {description && <DialogDescription className={descriptionClassName}>{description}</DialogDescription>}
        </DialogHeader>
        <form id={formId} onSubmit={onSubmit ?? submission.handleSubmit} className={formClassName}>
          {children}
        </form>
        <DialogFooter className={secondaryAction ? 'flex flex-col gap-2 sm:flex-row sm:justify-between' : undefined}>
          {secondaryAction}
          <FormActions
            {...actions}
            formId={formId}
            onCancel={cancel}
            submitting={submitting}
            error={error ?? submission.error}
            className={secondaryAction ? 'sm:ml-auto' : 'w-full'}
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
