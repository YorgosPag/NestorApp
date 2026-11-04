'use client';

/**
 * @fileoverview **Οι διάλογοι της μετακίνησης σταδίου, σε ένα σημείο** (ADR-930).
 * @module components/crm/stage-move/StageMoveDialogs
 *
 * Κλείσιμο ⇒ `CloseOpportunityDialog`. Επανάνοιγμα από κλειστό ⇒ επιβεβαίωση (πρακτική Pipedrive: επιτρέπεται, αλλά
 * ο άνθρωπος ξέρει ότι τα στοιχεία κλεισίματος σβήνουν και ότι **μετριέται** ως επανάνοιγμα).
 */

import React from 'react';

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
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { CloseOpportunityDialog } from './CloseOpportunityDialog';
import type { StageDialogs } from './useStageDialogs';

export function StageMoveDialogs({ dialogs }: { readonly dialogs: StageDialogs }) {
  const { t } = useTranslation('crm');
  const { state, answer } = dialogs;
  if (state.kind === 'close') {
    return <CloseOpportunityDialog key={state.opportunity.id} opportunity={state.opportunity} closing={state.closing} onAnswer={answer} />;
  }
  if (state.kind !== 'reopen') return null;
  const name = state.opportunity.fullName || state.opportunity.title;
  return (
    <AlertDialog open onOpenChange={(open) => { if (!open) answer(false); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('pipeline.reopen.title')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('pipeline.reopen.description', { name, stage: t(`opportunities.stages.${state.target}`) })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => answer(false)}>{t('pipeline.reopen.cancel')}</AlertDialogCancel>
          <AlertDialogAction onClick={() => answer(true)}>{t('pipeline.reopen.confirm')}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
