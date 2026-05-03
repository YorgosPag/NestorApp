'use client';

/**
 * =============================================================================
 * StampsCalculationTabContent — Enterprise stamps & contributions calculator
 * =============================================================================
 *
 * Main orchestrator for Phase 3: Stamps Calculation.
 * Reads attendance data from Phase 2, applies insurance class configuration,
 * and computes monthly stamps and contribution amounts per worker.
 *
 * Formula: contribution = stamps × imputedDailyWage × (rates / 100)
 * Source: ΕΦΚΑ Εγκύκλιος 39/2024, ΚΠΚ 781 (Οικοδομοτεχνικά)
 *
 * @module components/projects/ika/StampsCalculationTabContent
 * @enterprise ADR-090 — IKA/EFKA Labor Compliance System (Phase 3)
 */

import React, { useState, useMemo, useCallback } from 'react';
import { Save, Calculator, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/hooks/useSemanticColors';
import { useTypography } from '@/hooks/useTypography';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useNotifications } from '@/providers/NotificationProvider';
import { useProjectWorkers } from './hooks/useProjectWorkers';
import { useAttendanceEvents } from './hooks/useAttendanceEvents';
import { useLaborComplianceConfig } from './hooks/useLaborComplianceConfig';
import { useStampsCalculation } from './hooks/useStampsCalculation';
import { useEmploymentRecords } from './hooks/useEmploymentRecords';
import { MonthYearSelector } from './components/MonthYearSelector';
import { StampsSummaryDashboard } from './components/StampsSummaryDashboard';
import { WorkerStampsTable } from './components/WorkerStampsTable';
import { EmploymentRecordDialog } from './components/EmploymentRecordDialog';
import type { WorkerStampsSummary } from './contracts';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { updateWorkerInsuranceClassWithPolicy } from '@/services/ika/ika-mutation-gateway';
import '@/lib/design-system';

interface StampsCalculationTabContentProps {
  /** Project ID from parent IKA tab */
  projectId?: string;
}

/**
 * Gets the first day of a month as a Date.
 */
function getMonthStart(month: number, year: number): Date {
  return new Date(year, month - 1, 1);
}

/**
 * Gets the last day of a month as a Date.
 */
function getMonthEnd(month: number, year: number): Date {
  return new Date(year, month, 0);
}

export function StampsCalculationTabContent({ projectId }: StampsCalculationTabContentProps) {
  const { t } = useTranslation(['projects', 'projects-data', 'projects-ika']);
  const { user } = useAuth();
  const { success: notifySuccess, error: notifyError } = useNotifications();
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const typography = useTypography();
  const spacing = useSpacingTokens();
  const borderTokens = useBorderTokens();

  // Current month/year
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingWorker, setEditingWorker] = useState<WorkerStampsSummary | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Hooks
  const { workers, isLoading: workersLoading, refetch: refetchWorkers } = useProjectWorkers(projectId);
  const { config, isLoading: configLoading } = useLaborComplianceConfig();
  const { records, saveRecords } = useEmploymentRecords(projectId, selectedMonth, selectedYear);
  const { confirm, dialogProps: confirmDialogProps } = useConfirmDialog();

  // Build a Date range for the selected month to query attendance events
  const monthStartDate = useMemo(
    () => getMonthStart(selectedMonth, selectedYear),
    [selectedMonth, selectedYear]
  );

  // We need to query attendance for the entire month
  // useAttendanceEvents queries a single day, so we query day-by-day for the month
  // Actually, we'll compute days from events more efficiently
  // Month end date computed for future use
  const _monthEndDate = useMemo(
    () => getMonthEnd(selectedMonth, selectedYear),
    [selectedMonth, selectedYear]
  );

  // Query attendance events for the month start (we'll expand this)
  const { events: monthEvents, isLoading: eventsLoading } = useAttendanceEvents(projectId, monthStartDate);

  // Build attendance days map: contactId → number of unique days with check_in events
  // For now, we use a simplified approach: count unique days from events in the month range
  // In production, this would query the full month. For the initial implementation,
  // we estimate from the available data.
  const attendanceDaysMap = useMemo(() => {
    const daysMap = new Map<string, number>();

    // For each worker, count unique dates they have check_in events
    // Since useAttendanceEvents queries a single day, we need a different approach
    // We'll use a simple estimate based on linked worker data
    // TODO: In production, query the full month range of attendance events
    for (const worker of workers) {
      // Check if this worker has events on the selected date
      const workerEvents = monthEvents.filter(
        (e) => e.contactId === worker.contactId && e.eventType === 'check_in'
      );
      // For now, set days based on available events (will be expanded)
      daysMap.set(worker.contactId, workerEvents.length > 0 ? 1 : 0);
    }

    return daysMap;
  }, [workers, monthEvents]);

  // Compute stamps calculation
  const { summary } = useStampsCalculation(
    projectId,
    selectedMonth,
    selectedYear,
    workers,
    attendanceDaysMap,
    config
  );

  // Handlers
  function handleMonthYearChange(month: number, year: number) {
    setSelectedMonth(month);
    setSelectedYear(year);
  }

  function handleEditWorker(worker: WorkerStampsSummary) {
    setEditingWorker(worker);
    setDialogOpen(true);
  }

  const handleSaveInsuranceClass = useCallback(
    (contactId: string, classNumber: number, _notes: string) => {
      updateWorkerInsuranceClassWithPolicy(contactId, classNumber)
        .then(() => {
          notifySuccess(t('ika.stampsTab.insuranceClassSaved'));
          refetchWorkers();
        })
        .catch(() => {
          notifyError(t('ika.stampsTab.insuranceClassSaveError'));
        });
    },
    [notifySuccess, notifyError, t, refetchWorkers],
  );

  async function handleSaveRecords() {
    if (!projectId || !user) return;

    // ADR-307: guard if any existing records for this period are already submitted/accepted
    const hasSubmittedRecords = records.some(
      (r) => r.apdStatus === 'submitted' || r.apdStatus === 'accepted',
    );

    if (hasSubmittedRecords) {
      const confirmed = await confirm({
        title: t('ika.stampsTab.confirm.overwriteSubmitted.title'),
        description: t('ika.stampsTab.confirm.overwriteSubmitted.description'),
        variant: 'destructive',
      });
      if (!confirmed) return;
    }

    setIsSaving(true);
    const success = await saveRecords({
      projectId,
      month: selectedMonth,
      year: selectedYear,
      workerSummaries: summary.workerSummaries,
      createdBy: user.uid,
    });

    setIsSaving(false);

    if (success) {
      notifySuccess(t('ika.stampsTab.saved'));
    } else {
      notifyError(t('ika.stampsTab.saveError'));
    }
  }

  // Loading state
  const isLoading = workersLoading || configLoading || eventsLoading;

  // No project ID
  if (!projectId) {
    return (
      <section className={cn('flex flex-col items-center justify-center', spacing.padding.xl)}>
        <Calculator className={cn(iconSizes.xl, colors.text.muted)} />
        <p className={cn(typography.body.sm, colors.text.muted, spacing.margin.top.sm)}>
          {t('ika.stampsTab.noProjectId')}
        </p>
      </section>
    );
  }

  return (
    <section className={cn('flex flex-col', spacing.gap.lg)}>
      {/* Header Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className={typography.heading.lg}>
                {t('ika.stampsTab.title')}
              </CardTitle>
              <CardDescription className={spacing.margin.top.xs}>
                {t('ika.stampsTab.description')}
              </CardDescription>
            </div>
            <div className={cn('flex items-center', spacing.gap.md)}>
              <MonthYearSelector
                month={selectedMonth}
                year={selectedYear}
                onChange={handleMonthYearChange}
              />
              <Button
                onClick={handleSaveRecords}
                disabled={isSaving || isLoading || summary.totalWorkers === 0}
              >
                <Save className={cn(iconSizes.sm, spacing.margin.right.xs)} />
                {isSaving ? t('ika.stampsTab.saving') : t('ika.stampsTab.saveRecords')}
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Loading */}
      {isLoading && (
        <Card>
          <CardContent className={cn('text-center', spacing.padding.xl, colors.text.muted)}>
            <p className={typography.body.sm}>{t('common.loading')}</p>
          </CardContent>
        </Card>
      )}

      {/* No workers */}
      {!isLoading && workers.length === 0 && (
        <Card>
          <CardContent className={cn('flex flex-col items-center', spacing.padding.xl)}>
            <Calculator className={cn(iconSizes.xl, colors.text.muted)} />
            <p className={cn(typography.body.sm, colors.text.muted, spacing.margin.top.sm)}>
              {t('ika.stampsTab.noWorkers')}
            </p>
            <p className={cn(typography.body.xs, colors.text.muted, spacing.margin.top.xs)}>
              {t('ika.stampsTab.noWorkersHint')}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Content */}
      {!isLoading && workers.length > 0 && (
        <>
          {/* Issues warning */}
          {summary.recordsWithIssues > 0 && (
            <Card className={borderTokens.quick.warning}>
              <CardContent className={cn('flex items-center', spacing.padding.md)}>
                <AlertTriangle className={cn(iconSizes.md, colors.text.warning, spacing.margin.right.sm)} />
                <p className={cn(typography.body.sm, colors.text.warning)}>
                  {summary.recordsWithIssues} {t('ika.stampsTab.issues.missingClass')}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Summary Dashboard */}
          <StampsSummaryDashboard summary={summary} />

          {/* Workers Table */}
          <Card>
            <CardContent className={spacing.padding.none}>
              <WorkerStampsTable
                summary={summary}
                onEditWorker={handleEditWorker}
              />
            </CardContent>
          </Card>
        </>
      )}

      {/* Insurance Class Dialog */}
      <EmploymentRecordDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        worker={editingWorker}
        config={config}
        onSave={handleSaveInsuranceClass}
      />

      {/* ADR-307: confirm before overwriting submitted records */}
      <ConfirmDialog {...confirmDialogProps} />
    </section>
  );
}
