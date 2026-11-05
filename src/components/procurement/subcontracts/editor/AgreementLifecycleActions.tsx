'use client';

/**
 * Οι μεταβάσεις κύκλου ζωής στη σελίδα ενός συμφωνητικού (ADR-928 §5.5 · Φ3γ απόφαση 7) — **οι ίδιες** με το μενού της
 * λίστας (`useSubcontractRowActions` + `useAgreementTransition`), ως κουμπιά. Καμία νέα λογική.
 *
 * 🔑 Με μη αποθηκευμένες αλλαγές καμία μετάβαση δεν προσφέρεται («αποθήκευσε πρώτα»): η «Έκδοση» θα πάγωνε την
 *    αποθηκευμένη εκδοχή, όχι αυτή που βλέπει ο άνθρωπος στη φόρμα του.
 * 🔑 Η ανενεργή λέει **γιατί** — με τη λέξη του γραφέα (π.χ. «απόκλιση περιμένει έγκριση»).
 */

import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { blockedWhileUnsaved } from '@/components/projects/procurement/subcontracts/subcontract-row-actions';
import { useAgreementTransition } from '@/components/projects/procurement/subcontracts/useAgreementTransition';
import { useRowActionBlockReason, useSubcontractRowActions } from '@/components/projects/procurement/subcontracts/useSubcontractRowActions';
import type { SubcontractAgreement } from '@/subapps/procurement/subcontracts/types/agreement';

interface AgreementLifecycleActionsProps {
  readonly agreement: SubcontractAgreement;
  readonly projectId: string | null;
  readonly unsaved: boolean;
}

export function AgreementLifecycleActions({ agreement, projectId, unsaved }: AgreementLifecycleActionsProps) {
  const { t } = useTranslation('procurement');
  const actionsOf = useSubcontractRowActions(projectId);
  const actions = blockedWhileUnsaved(actionsOf(agreement), unsaved);
  const transition = useAgreementTransition();
  const reasonOf = useRowActionBlockReason(actions.some((action) => action.block !== null));
  const pending = transition.pendingIds.has(agreement.id);
  if (actions.length === 0) return null;

  return (
    <section aria-label={t('subcontracts.editor.lifecycle')} className="flex flex-wrap items-start gap-3">
      {actions.map((action) => (
        <span key={action.transition} className="flex flex-col gap-0.5">
          <Button
            type="button"
            variant={action.destructive ? 'outline' : 'default'}
            className={action.destructive ? 'text-destructive' : undefined}
            disabled={action.block !== null || pending}
            onClick={() => void transition.run(agreement, action)}
          >
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
            {t(`subcontracts.actions.transition.${action.transition}`)}
          </Button>
          {action.block && <span className="max-w-56 text-xs text-muted-foreground">{reasonOf(action.block)}</span>}
        </span>
      ))}
      <ConfirmDialog {...transition.dialogProps} />
    </section>
  );
}
