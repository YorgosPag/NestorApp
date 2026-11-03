'use client';

/**
 * Το μενού ενεργειών μιας γραμμής (ADR-928 §5.5 · Φ3α-2): οι μεταβάσεις **από** την τρέχουσα κατάσταση. Η ανενεργή
 * λέει **γιατί** κάτω από την ετικέτα της — με τη λέξη που θα έλεγε ο γραφέας (ίδιοι πίνακες μηνυμάτων). Ο Procore
 * απλώς κρύβει· εδώ ο άνθρωπος μαθαίνει τι λείπει πριν το κλικ (π.χ. «απόκλιση περιμένει έγκριση»).
 * Χωρίς δικαίωμα στο έγγραφο ⇒ καμία μετάβαση (κρύβει, δεν προστατεύει — ο γραφέας ξανακρίνει)· η «Προεπισκόπηση
 * εγγράφου» μένει πάντα, γιατί είναι ανάγνωση (ADR-928 §5.17).
 */

import { FileText, Loader2, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import {
  useSubcontractFailureMessage,
  useSubcontractIssueMessage,
} from '@/components/procurement/subcontracts/subcontract-messages';
import type { SubcontractAgreement } from '@/subapps/procurement/subcontracts/types/agreement';
import type { RowAction, RowActionBlock } from './subcontract-row-actions';

interface SubcontractRowActionsProps {
  readonly agreement: SubcontractAgreement;
  readonly actions: readonly RowAction[];
  readonly pending: boolean;
  readonly onRun: (agreement: SubcontractAgreement, action: RowAction) => void;
  /** Η προεπισκόπηση είναι **ανάγνωση**: τη βλέπει όποιος βλέπει τη λίστα, χωρίς δικαίωμα διαχείρισης. */
  readonly onPreview: (agreement: SubcontractAgreement) => void;
}

function useBlockReason(open: boolean): (block: RowActionBlock) => string {
  const { t } = useTranslation('procurement');
  const failure = useSubcontractFailureMessage(open);
  const issue = useSubcontractIssueMessage(open);
  return (block) => {
    if (block.kind === 'checking') return t('subcontracts.actions.checking');
    return block.kind === 'refusal' ? failure(block.refusal) : issue(block.issue);
  };
}

function ActionItem({ action, reason, onSelect }: { action: RowAction; reason: string | null; onSelect: () => void }) {
  const { t } = useTranslation('procurement');
  return (
    <DropdownMenuItem
      disabled={action.block !== null}
      onSelect={onSelect}
      className={cn('flex-col items-start gap-0.5', action.destructive && 'text-destructive focus:text-destructive')}
    >
      <span>{t(`subcontracts.actions.transition.${action.transition}`)}</span>
      {reason && <span className="text-xs text-muted-foreground">{reason}</span>}
    </DropdownMenuItem>
  );
}

export function SubcontractRowActions({ agreement, actions, pending, onRun, onPreview }: SubcontractRowActionsProps) {
  const { t } = useTranslation('procurement');
  const reasonOf = useBlockReason(actions.some((action) => action.block !== null));
  const forward = actions.filter((action) => !action.destructive);
  const closing = actions.filter((action) => action.destructive);
  const item = (action: RowAction) => (
    <ActionItem
      key={action.transition}
      action={action}
      reason={action.block ? reasonOf(action.block) : null}
      onSelect={() => onRun(agreement, action)}
    />
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" disabled={pending} aria-label={t('subcontracts.actions.menu', { number: agreement.documentNumber })}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <MoreHorizontal className="h-4 w-4" aria-hidden />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>{agreement.documentNumber}</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => onPreview(agreement)}>
          <FileText className="mr-2 h-4 w-4" aria-hidden />
          {t('subcontracts.actions.preview')}
        </DropdownMenuItem>
        {actions.length > 0 && <DropdownMenuSeparator />}
        {forward.map(item)}
        {forward.length > 0 && closing.length > 0 && <DropdownMenuSeparator />}
        {closing.map(item)}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
