/**
 * =============================================================================
 * ENTERPRISE: TASK DIALOG SHELL
 * =============================================================================
 *
 * Το αμετάβλητο περίβλημα των CRM task dialogs: Dialog → header με εικονίδιο +
 * τίτλο → form → πεδία → footer.
 *
 * SSoT για το σχήμα που ήταν byte-identical σε CalendarCreateDialog και
 * TaskEditDialog. Μαζί με το {@link TaskDialogFormFooter} (που το αποδίδει το ίδιο
 * το shell) κλείνει τον κύκλο που άφησε ανοιχτό η πρώτη φάση της κεντρικοποίησης:
 * τα δύο dialogs είχαν κοινά atoms αλλά παρέμεναν δίδυμα στο περίβλημα.
 *
 * **Όχι god-shell:** κατέχει μόνο ό,τι ήταν ταυτόσημο και στα δύο. Τα πεδία τα
 * περνά ο καθένας ως `children` — το create έχει επαφή/έργο/υπενθύμιση, το edit
 * έχει κατάσταση/προτεραιότητα, και κανένα δεν επιβάλλεται στο άλλο.
 *
 * Το `title` χρησιμεύει και ως accessible description (`sr-only`), όπως ακριβώς
 * έκαναν και οι δύο καταναλωτές πριν.
 *
 * @module components/crm/shared/TaskDialogShell
 * @see ADR-584
 */

'use client';

import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { TaskDialogFormFooter } from '@/components/crm/shared/TaskDialogFormFooter';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { useLayoutClasses } from '@/hooks/useLayoutClasses';
import '@/lib/design-system';

export interface TaskDialogShellProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Εικονίδιο δίπλα στον τίτλο. */
  icon: LucideIcon;
  /** Ο τίτλος του dialog — μεταφρασμένος από τον καταναλωτή. */
  title: string;
  /** Καλείται μετά το `preventDefault()` της υποβολής. */
  onSubmit: () => void;
  /** Όσο τρέχει η υποβολή, το footer κλειδώνει. */
  submitting: boolean;
  /** Επιπλέον λόγος να μένει κλειδωμένη η αποθήκευση (π.χ. κενός τίτλος). */
  submitDisabled?: boolean;
  /** Τα πεδία της φόρμας. */
  children: ReactNode;
}

export function TaskDialogShell({
  open,
  onOpenChange,
  icon: Icon,
  title,
  onSubmit,
  submitting,
  submitDisabled = false,
  children,
}: TaskDialogShellProps) {
  const iconSizes = useIconSizes();
  const sp = useSpacingTokens();
  const layout = useLayoutClasses();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className={layout.flexCenterGap2}>
            <Icon className={iconSizes.md} />
            {title}
          </DialogTitle>
          <DialogDescription className="sr-only">{title}</DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
          className={sp.spaceBetween.md}
        >
          {children}

          <TaskDialogFormFooter
            onCancel={() => onOpenChange(false)}
            submitting={submitting}
            submitDisabled={submitDisabled}
          />
        </form>
      </DialogContent>
    </Dialog>
  );
}
