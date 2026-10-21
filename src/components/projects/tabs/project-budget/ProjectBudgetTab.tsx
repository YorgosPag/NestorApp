'use client';

/**
 * ProjectBudgetTab — the project's budget lines: soft cost + allowances (ADR-917 Φ3γ · Γ2).
 *
 * Edited HERE, on the project page — never on the chart (Γ2). Cells are always editable (no global Edit
 * toggle, like Addresses); every change is optimistic and compare-and-set (`useProjectBudgetLines`), and the
 * effect of each line is read from the SAME ledger the card and the AI read (`useProjectCostLedger`).
 * Land given in exchange is shown in kind, outside every total (Ζ2).
 *
 * @module components/projects/tabs/project-budget/ProjectBudgetTab
 * @see ADR-917 Φ3γ
 */

import { useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatCurrency } from '@/lib/intl-utils';
import { isDraftEntityId } from '@/lib/draft-entity-id';
import { useNotifications } from '@/providers/NotificationProvider';
import { useProjectBudgetLines, type BudgetLineWriteResult } from '@/hooks/useProjectBudgetLines';
import { useProjectCostLedger } from '@/hooks/useProjectCostLedger';
import type { CostLedgerLandExchange } from '@/services/project-cost/cost-ledger-view';
import type { BudgetLineDisplay, BudgetLineValues } from '@/services/project-cost/budget-lines-optimistic';
import { budgetLineFamilyOf, budgetLineLabel } from './budget-line-presentation';
import { BudgetLineAddForm } from './BudgetLineAddForm';
import { BudgetLineConflicts } from './BudgetLineConflicts';
import { BudgetLineGroupTable } from './BudgetLineGroupTable';

type Translate = (key: string, options?: Record<string, unknown>) => string;

interface ProjectBudgetTabProps {
  project?: { id?: string } | null;
}

const FAILURE_MESSAGE: Record<Exclude<BudgetLineWriteResult, 'saved' | 'conflict'>, string> = {
  failed: 'budgetEditor.toast.failed',
  forbidden: 'budgetEditor.toast.forbidden',
  invalid: 'budgetEditor.toast.invalid',
};

/** Writes with their human feedback: failures said by name, archive with «Undo» (Gmail) instead of a modal. */
function useBudgetLineActions(budget: ReturnType<typeof useProjectBudgetLines>, t: Translate) {
  const { setLine: writeLine, archiveLine: writeArchive } = budget;
  const { error, notify } = useNotifications();
  const report = useCallback((result: BudgetLineWriteResult) => {
    if (result !== 'saved' && result !== 'conflict') error(t(FAILURE_MESSAGE[result]));
  }, [error, t]);

  const setLine = useCallback((costCode: string, values: BudgetLineValues) => {
    void writeLine(costCode, values).then(report);
  }, [writeLine, report]);

  const archiveLine = useCallback((line: BudgetLineDisplay) => {
    void writeArchive(line.costCode).then((result) => {
      if (result !== 'saved') { report(result); return; }
      notify(t('budgetEditor.toast.archived', { code: budgetLineLabel(line.costCode, t) }), {
        type: 'info',
        actions: [{ label: t('budgetEditor.toast.undo'), onClick: () => setLine(line.costCode, { amount: line.amount, note: line.note }) }],
      });
    });
  }, [writeArchive, notify, report, setLine, t]);

  return { setLine, archiveLine };
}

function LandExchangeNote({ landExchange, t }: { landExchange: CostLedgerLandExchange; t: Translate }) {
  return (
    <aside className="rounded-md border border-dashed p-3 text-sm">
      <p className="font-semibold">{t('budgetEditor.landExchange.label')}</p>
      <p className="text-muted-foreground">
        {t('budgetEditor.landExchange.value', { value: formatCurrency(landExchange.inKindValue), percentage: landExchange.bartexPercentage })}
      </p>
    </aside>
  );
}

function BudgetLoadState({ loading, onRetry, t }: { loading: boolean; onRetry: () => void; t: Translate }) {
  if (loading) return <p className="text-sm text-muted-foreground">{t('budgetEditor.loading')}</p>;
  return (
    <p role="alert" className="flex items-center gap-2 text-sm">
      {t('budgetEditor.loadError')}
      <Button size="sm" variant="outline" onClick={onRetry}>{t('budgetEditor.retry')}</Button>
    </p>
  );
}

export function ProjectBudgetTab({ project }: ProjectBudgetTabProps) {
  // `procurement` carries the cost-code labels (`costCodeLabelKey`) — asked for, never assumed loaded
  const { t } = useTranslation(['payments', 'procurement']);
  const projectId = project?.id && !isDraftEntityId(project.id) ? project.id : null;
  const budget = useProjectBudgetLines(projectId);
  const { ledger } = useProjectCostLedger(projectId);
  const { setLine, archiveLine } = useBudgetLineActions(budget, t);
  const byFamily = useMemo(() => ({
    allowance: budget.lines.filter(line => budgetLineFamilyOf(line.costCode) === 'allowance'),
    soft: budget.lines.filter(line => budgetLineFamilyOf(line.costCode) === 'soft'),
  }), [budget.lines]);
  const shared = { ledger, readOnly: budget.readOnly, onSet: setLine, onArchive: archiveLine, t };

  return (
    <section className="space-y-4 p-4" aria-labelledby="project-budget-title">
      <header className="space-y-1">
        <h2 id="project-budget-title" className="text-lg font-semibold">{t('budgetEditor.title')}</h2>
        <p className="text-sm text-muted-foreground">{t('budgetEditor.intro')}</p>
        {budget.readOnly ? <p className="text-sm">{t('budgetEditor.readOnly')}</p> : null}
      </header>
      {budget.loading || budget.loadError ? <BudgetLoadState loading={budget.loading} onRetry={() => void budget.reload()} t={t} /> : null}
      <BudgetLineConflicts conflicts={budget.conflicts} onResolve={budget.resolveConflict} t={t} />
      {!budget.loading && budget.lines.length === 0 ? <p className="text-sm text-muted-foreground">{t('budgetEditor.empty')}</p> : null}
      <BudgetLineGroupTable family="allowance" lines={byFamily.allowance} {...shared} />
      <BudgetLineGroupTable family="soft" lines={byFamily.soft} {...shared} />
      {ledger?.landExchange ? <LandExchangeNote landExchange={ledger.landExchange} t={t} /> : null}
      {budget.readOnly || !projectId ? null : <BudgetLineAddForm usedCodes={budget.usedCodes} onAdd={setLine} t={t} />}
    </section>
  );
}
