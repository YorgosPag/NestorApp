'use client';

/**
 * =============================================================================
 * ConveyanceTab — «Δικαιολογητικά» μεταβίβασης για τον εργολάβο (ADR-901 Φ1)
 * =============================================================================
 *
 * Ο κατάλογος γεμίζει **μόνος του** από τα αρχεία που ήδη ζουν στο ακίνητο, στα
 * παρακολουθήματα, στο κτίριο, στο έργο και στις επαφές (Σ-1). Ο χρήστης απαντά μόνο ό,τι
 * δεν παράγεται, ελέγχει γραμμές (δεμένες στην έκδοση του αρχείου) και ορίζει ημέρα
 * υπογραφής ώστε να βλέπει τι **δεν** θα ισχύει τότε.
 *
 * Δικαιώματα: `legal:conveyance:view` για να εμφανιστεί η καρτέλα (το ελέγχει ο
 * `SalesSidebar`) · `legal:conveyance:manage` για ενέργειες — ο server τα ξαναελέγχει.
 *
 * @module components/sales/conveyance/ConveyanceTab
 */

import React, { useCallback, useState } from 'react';
import { ClipboardCheck, Loader2 } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Button } from '@/components/ui/button';
import { useCapability } from '@/auth/hooks/useCapability';
import { isGranted } from '@/types/capability-authority';
import { useConveyanceCase, type ConveyanceCommandOutcome } from '@/hooks/useConveyanceCase';
import { useNotifications } from '@/providers/NotificationProvider';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
import { CHECKLIST_SECTIONS, type ConveyanceFactId } from '@/config/conveyance-checklist/types';
import type { ConveyanceCommand } from '@/lib/conveyance/conveyance-commands';
import type { ChecklistRow, ConveyanceCaseView } from '@/types/conveyance-case';
import type { Property } from '@/types/property';
import { ConveyanceCaseHeader } from './ConveyanceCaseHeader';
import { ConveyanceChecklistSection } from './ConveyanceChecklistSection';
import type { RowDialogMode } from './ConveyanceChecklistRow';
import { ConveyanceFactsPanel } from './ConveyanceFactsPanel';
import { ConveyanceProfessionalsAccess } from './ConveyanceProfessionalsAccess';
import { ConveyanceRowDialog } from './ConveyanceRowDialog';

interface ConveyanceTabProps {
  readonly unit: Property;
}

function EmptyState({ canManage, opening, onOpen }: { readonly canManage: boolean; readonly opening: boolean; readonly onOpen: () => void }) {
  const { t } = useTranslation(['conveyance']);
  const colors = useSemanticColors();
  const iconSizes = useIconSizes();
  return (
    <section className="space-y-3 rounded-lg border bg-card p-4 text-center">
      <ClipboardCheck className={cn(iconSizes.lg, 'mx-auto', colors.text.muted)} aria-hidden="true" />
      <h2 className="text-sm font-semibold">{t('tab.title')}</h2>
      <p className={cn('text-xs', colors.text.muted)}>{t('tab.openCaseHint')}</p>
      {canManage && (
        <Button size="sm" onClick={onOpen} disabled={opening}>
          {opening ? t('tab.opening') : t('tab.openCase')}
        </Button>
      )}
    </section>
  );
}

function CaseBody({ view, canManage, onCommand }: { readonly view: ConveyanceCaseView; readonly canManage: boolean; readonly onCommand: (command: ConveyanceCommand) => void }) {
  const [dialog, setDialog] = useState<{ row: ChecklistRow; mode: RowDialogMode } | null>(null);
  const editable = canManage && view.state === 'open';
  const onOpenDialog = useCallback((row: ChecklistRow, mode: RowDialogMode) => setDialog({ row, mode }), []);
  const onClear = useCallback((row: ChecklistRow) => onCommand({ type: 'clear_override', itemId: row.itemId }), [onCommand]);
  const onAnswer = useCallback(
    (factId: ConveyanceFactId, value: boolean | null) => onCommand({ type: 'answer_fact', factId, value }),
    [onCommand],
  );
  return (
    <section className="space-y-3 p-3">
      <ConveyanceCaseHeader view={view} canEdit={canManage} onCommand={onCommand} />
      {/* ADR-901 Φ2 — οι επαγγελματίες μπαίνουν ΜΟΝΟ με συμμετοχή· η ενότητα ζει όσο υπάρχει υπόθεση. */}
      <ConveyanceProfessionalsAccess caseId={view.conveyanceCase.id} canManage={canManage} />
      <ConveyanceFactsPanel record={view.conveyanceCase} rows={view.checklist.rows} derivedFacts={view.derivedFacts} canEdit={editable} onAnswer={onAnswer} />
      {CHECKLIST_SECTIONS.map((section) => (
        <ConveyanceChecklistSection
          key={section}
          section={section}
          rows={view.checklist.rows.filter((row) => row.section === section)}
          canEdit={editable}
          onOpenDialog={onOpenDialog}
          onClear={onClear}
        />
      ))}
      <ConveyanceRowDialog target={dialog} onClose={() => setDialog(null)} onSubmit={onCommand} />
    </section>
  );
}

export function ConveyanceTab({ unit }: ConveyanceTabProps) {
  const { t } = useTranslation(['conveyance']);
  const colors = useSemanticColors();
  const iconSizes = useIconSizes();
  const { error: notifyError } = useNotifications();
  const canManage = isGranted(useCapability('legal:conveyance:manage').verdict);
  const { view, loading, error, opening, openCase, run } = useConveyanceCase(unit.id);

  const report = useCallback((outcome: ConveyanceCommandOutcome) => {
    if (outcome.ok) return;
    if (outcome.reason === 'conflict') notifyError(t('tab.conflict'));
    else if (outcome.reason === 'error') notifyError(outcome.message ?? t('tab.loadError'));
  }, [notifyError, t]);
  const onCommand = useCallback((command: ConveyanceCommand) => { void run(command).then(report); }, [run, report]);

  if (loading && !view) {
    return (
      <section className="flex items-center justify-center p-8" aria-busy="true">
        <Loader2 className={cn(iconSizes.md, 'animate-spin', colors.text.muted)} aria-hidden="true" />
      </section>
    );
  }
  if (error && !view) return <section className={cn('p-4 text-center text-sm', colors.text.error)}>{t('tab.loadError')}</section>;
  if (!view || view.state === 'cancelled') {
    return (
      <section className="space-y-3 p-3">
        {view && <ConveyanceCaseHeader view={view} canEdit={false} onCommand={onCommand} />}
        <EmptyState canManage={canManage} opening={opening} onOpen={() => void openCase()} />
      </section>
    );
  }
  return <CaseBody view={view} canManage={canManage} onCommand={onCommand} />;
}
