/**
 * =============================================================================
 * ENTERPRISE: TASK DIALOG FORM FOOTER
 * =============================================================================
 *
 * Το footer «Άκυρο / Αποθήκευση» των CRM task dialogs.
 *
 * SSoT για ένα σχήμα που ήταν byte-identical σε CalendarCreateDialog και
 * TaskEditDialog. Κατέχει τα ίδια του τα i18n keys (`calendarPage.dialog.*`) αντί
 * να τα δέχεται ως props: και οι δύο καταναλωτές χρησιμοποιούσαν ήδη τα ίδια
 * ακριβώς keys, οπότε το πέρασμά τους ως props θα αντικαθιστούσε απλώς έναν
 * κλώνο σήματος με έναν κλώνο προώθησης props.
 *
 * @module components/crm/shared/TaskDialogFormFooter
 * @see ADR-584
 */

'use client';

import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import '@/lib/design-system';

export interface TaskDialogFormFooterProps {
  /** Κλείνει το dialog χωρίς αποθήκευση. */
  onCancel: () => void;
  /** Όσο τρέχει η υποβολή, και τα δύο κουμπιά απενεργοποιούνται. */
  submitting: boolean;
  /** Επιπλέον λόγος να μένει κλειδωμένη η αποθήκευση (π.χ. κενός τίτλος). */
  submitDisabled?: boolean;
}

export function TaskDialogFormFooter({
  onCancel,
  submitting,
  submitDisabled = false,
}: TaskDialogFormFooterProps) {
  const { t } = useTranslation(['crm', 'crm-inbox']);
  const sp = useSpacingTokens();

  return (
    <footer className={`flex justify-end ${sp.gap.sm} ${sp.padding.top.sm}`}>
      <Button
        type="button"
        variant="ghost"
        onClick={onCancel}
        disabled={submitting}
      >
        {t('calendarPage.dialog.actions.cancel')}
      </Button>
      <Button type="submit" disabled={submitting || submitDisabled}>
        {submitting
          ? t('calendarPage.dialog.submitting')
          : t('calendarPage.dialog.actions.save')}
      </Button>
    </footer>
  );
}
