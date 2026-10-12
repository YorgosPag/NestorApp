'use client';

/**
 * @fileoverview Ο διάλογος εξόδου με αλλαγές που δεν αποθηκεύτηκαν: **Αποθήκευση · Απόρριψη · Συνέχεια επεξεργασίας**.
 * @related ADR-912 §12.12 · `lib/unsaved-edits/leave-guard.ts` (ποιος ρωτά, και πότε) · `UnsavedEditsLeaveHost.tsx`
 * @module components/unsaved-edits/UnsavedEditsLeaveDialog
 *
 * 🔑 Όχι `ConfirmDialog`: εκείνος έχει **δύο** εκβάσεις (ναι / όχι). Εδώ είναι τρεις, και η «Αποθήκευση» κρατά τον
 *   διάλογο ανοιχτό όσο τρέχει — αν αποτύχει, ο άνθρωπος μένει στη φόρμα, όπου η ίδια δείχνει το σφάλμα της.
 * 🔑 Χωρίς δηλωμένο τρόπο αποθήκευσης (`canSave: false`) πέφτει στις δύο επιλογές του παλιού ερωτήματος απόρριψης.
 */

import { useState, type MouseEvent } from 'react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { buttonVariants } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { LeaveDecision, LeavePromptRequest } from '@/lib/unsaved-edits/leave-guard';
import { cn } from '@/lib/utils';

interface UnsavedEditsLeaveDialogProps {
  readonly request: LeavePromptRequest;
  readonly onDecision: (decision: LeaveDecision) => void;
}

export function UnsavedEditsLeaveDialog({ request, onDecision }: UnsavedEditsLeaveDialogProps) {
  // `common-shared`, όχι `common-actions`: το ερώτημα βγαίνει μόνο σε πάτημα, άρα δεν χρεώνεται στο κέλυφος (ADR-744).
  const { t } = useTranslation('common-shared');
  const [saving, setSaving] = useState(false);
  const { canSave } = request;

  const save = async (event: MouseEvent<HTMLButtonElement>) => {
    // Το Radix κλείνει στο κλικ· εδώ ο διάλογος μένει ώσπου να απαντήσει η αποθήκευση.
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    const saved = await request.save();
    onDecision(saved ? 'proceed' : 'stay');
  };

  return (
    <AlertDialog open onOpenChange={(open) => { if (!open && !saving) onDecision('stay'); }}>
      <AlertDialogContent className="max-w-md" data-unsaved-edits-leave="">
        <AlertDialogHeader>
          <AlertDialogTitle>{t(canSave ? 'unsavedChanges.title' : 'discardChanges.title')}</AlertDialogTitle>
          <AlertDialogDescription>{t(canSave ? 'unsavedChanges.body' : 'discardChanges.body')}</AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={saving} data-unsaved-edits-choice="stay">
            {t('discardChanges.keep')}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => onDecision('proceed')}
            disabled={saving}
            data-unsaved-edits-choice="discard"
            className={buttonVariants({ variant: canSave ? 'outline' : 'destructive' })}
          >
            {t('discardChanges.confirm')}
          </AlertDialogAction>
          {canSave && (
            <AlertDialogAction
              onClick={save}
              aria-disabled={saving || undefined}
              aria-busy={saving || undefined}
              data-unsaved-edits-choice="save"
              className={cn(buttonVariants({ variant: 'default' }), 'relative aria-disabled:cursor-not-allowed aria-disabled:opacity-50')}
            >
              <span className={cn(saving && 'invisible')}>{t('unsavedChanges.save')}</span>
              {saving && (
                <span className="absolute inset-0 flex items-center justify-center">
                  <Spinner size="small" color="inherit" />
                </span>
              )}
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
