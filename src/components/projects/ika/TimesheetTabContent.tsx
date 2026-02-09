'use client';

/**
 * =============================================================================
 * TimesheetTabContent — Enterprise Attendance System (Phase 2)
 * =============================================================================
 *
 * Main component for the attendance/timesheet tab in the IKA section.
 * Displays real-time attendance dashboard, date navigation, crew filtering,
 * and worker daily timeline with manual event recording.
 *
 * Enterprise pattern: Procore-style attendance tracking with immutable events.
 *
 * @module components/projects/ika/TimesheetTabContent
 * @enterprise ADR-090 — IKA/EFKA Labor Compliance System (Phase 2)
 */

import React, { useState, useMemo, useCallback } from 'react';
import { ClipboardList, Plus, Loader2, AlertCircle } from 'lucide-react';
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

// IKA hooks
import { useProjectWorkers } from './hooks/useProjectWorkers';
import { useAttendanceEvents } from './hooks/useAttendanceEvents';
import { useAttendanceSummary } from './hooks/useAttendanceSummary';

// IKA components
import { DateNavigator } from './components/DateNavigator';
import { AttendanceDashboard } from './components/AttendanceDashboard';
import { DailyTimeline } from './components/DailyTimeline';
import { CrewGroupFilter } from './components/CrewGroupFilter';
import { AttendanceRecordDialog } from './components/AttendanceRecordDialog';
import { QrCodePanel } from './components/QrCodePanel';
import { GeofenceConfigMap } from './components/GeofenceConfigMap';

import type { AttendanceViewMode } from './contracts';

interface TimesheetTabContentProps {
  /** Project ID from parent IKA tab */
  projectId?: string;
}

export function TimesheetTabContent({ projectId }: TimesheetTabContentProps) {
  const { t } = useTranslation('projects');
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const typography = useTypography();
  const spacing = useSpacingTokens();
  const { quick } = useBorderTokens();

  // Auth for recordedBy
  const { user } = useAuth();
  const currentUserId = user?.uid ?? 'unknown';

  // State
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<AttendanceViewMode>('daily');
  const [selectedCrewId, setSelectedCrewId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [preSelectedWorkerId, setPreSelectedWorkerId] = useState<string | undefined>(undefined);

  // Data hooks
  const { workers, isLoading: workersLoading, error: workersError } = useProjectWorkers(projectId);
  const { events, isLoading: eventsLoading, error: eventsError, addEvent, refetch } = useAttendanceEvents(projectId, selectedDate);

  // Computed summaries
  const { projectSummary, workerSummaries, crewGroups } = useAttendanceSummary(
    events,
    workers,
    selectedDate,
    projectId ?? ''
  );

  // Filter by crew if selected
  const filteredSummaries = useMemo(() => {
    if (!selectedCrewId) return workerSummaries;
    return workerSummaries.filter((s) => {
      const key = s.companyContactId ?? '__independent__';
      return key === selectedCrewId;
    });
  }, [workerSummaries, selectedCrewId]);

  // Open record dialog for specific worker
  const handleRecordEvent = useCallback((contactId: string) => {
    setPreSelectedWorkerId(contactId);
    setIsDialogOpen(true);
  }, []);

  // Open record dialog without pre-selection
  const handleOpenDialog = useCallback(() => {
    setPreSelectedWorkerId(undefined);
    setIsDialogOpen(true);
  }, []);

  const isLoading = workersLoading || eventsLoading;
  const error = workersError || eventsError;

  // No project ID
  if (!projectId) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <p className="text-sm text-muted-foreground">
            {t('ika.timesheetTab.noProjectId')}
          </p>
        </CardContent>
      </Card>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className={cn(iconSizes.lg, 'animate-spin text-muted-foreground')} />
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center gap-3 py-12">
          <AlertCircle className={cn(iconSizes.md, colors.text.error)} />
          <p className="text-sm text-muted-foreground">{error}</p>
        </CardContent>
      </Card>
    );
  }

  // No workers
  if (workers.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <ClipboardList className={cn(iconSizes.xl, 'text-muted-foreground mb-4')} />
          <p className="text-sm font-medium text-muted-foreground">
            {t('ika.timesheetTab.noWorkers')}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {t('ika.timesheetTab.noWorkersHint')}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <section className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <CardTitle className={typography.card.titleCompact}>
                <ClipboardList className={cn(iconSizes.md, spacing.margin.right.sm, 'inline-block')} />
                {t('ika.timesheetTab.title')}
              </CardTitle>
              <CardDescription>
                {t('ika.timesheetTab.description')}
              </CardDescription>
            </div>
            <Button onClick={handleOpenDialog}>
              <Plus className={cn(iconSizes.sm, spacing.margin.right.sm)} />
              {t('ika.timesheetTab.addEvent')}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <DateNavigator
            date={selectedDate}
            viewMode={viewMode}
            onDateChange={setSelectedDate}
            onViewModeChange={setViewMode}
          />
        </CardContent>
      </Card>

      {/* Dashboard summary cards */}
      <AttendanceDashboard summary={projectSummary} />

      {/* Crew filter + Timeline */}
      <Card>
        <CardContent className={spacing.padding.md}>
          <div className={cn('flex items-center justify-between', spacing.margin.bottom.md)}>
            <CrewGroupFilter
              crews={crewGroups}
              selectedCrewId={selectedCrewId}
              onChange={setSelectedCrewId}
            />
          </div>
          <DailyTimeline
            workerSummaries={filteredSummaries}
            onRecordEvent={handleRecordEvent}
          />
        </CardContent>
      </Card>

      {/* QR Code + Geofence — ADR-170 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <QrCodePanel projectId={projectId} />
        <GeofenceConfigMap projectId={projectId} />
      </div>

      {/* Manual record dialog */}
      <AttendanceRecordDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        projectId={projectId}
        workers={workers}
        preSelectedWorkerId={preSelectedWorkerId}
        currentUserId={currentUserId}
        onRecorded={refetch}
        addEvent={addEvent}
      />
    </section>
  );
}
