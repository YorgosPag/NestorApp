
'use client';

import React, { lazy, Suspense, useCallback, useState } from 'react';
import { TimelineHeader } from './TimelineTabContent/TimelineHeader';
import { OverallProgressCard } from './TimelineTabContent/OverallProgressCard';
import { TimelineMilestones } from './TimelineTabContent/TimelineMilestones';
import { CriticalPathCard } from './TimelineTabContent/CriticalPathCard';
import { CompletionForecastCard } from './TimelineTabContent/CompletionForecastCard';
import { getStatusColor, getStatusText, getTypeIcon, getMilestones } from './TimelineTabContent/utils';
import { TimelineViewToggle } from './TimelineTabContent/TimelineViewToggle';
import type { TimelineView } from './TimelineTabContent/TimelineViewToggle';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { Building } from '../BuildingsPageContent';

// Lazy load GanttView (ADR-034) — only loaded when user switches to Gantt view
const LazyGanttView = lazy(() =>
  import('./TimelineTabContent/gantt/GanttView').then((mod) => ({
    default: mod.GanttView,
  }))
);

interface TimelineTabContentProps {
  building: Building;
}

const TimelineTabContent = ({ building }: TimelineTabContentProps) => {
  // View toggle state (milestones = default, gantt = ADR-034)
  const [activeView, setActiveView] = useState<TimelineView>('milestones');

  // i18n and semantic colors hooks
  const { t } = useTranslation('building');
  const colors = useSemanticColors();

  // Get i18n-enabled milestones
  const milestones = getMilestones(t);

  // Wrapper functions for component compatibility
  const wrappedGetStatusColor = useCallback(
    (status: string) => getStatusColor(status, colors),
    [colors]
  );

  const wrappedGetStatusText = useCallback(
    (status: string) => getStatusText(status, t),
    [t]
  );

  return (
    <section className="space-y-6">
      {/* View Toggle: Milestones | Gantt (ADR-034) */}
      <TimelineViewToggle activeView={activeView} onViewChange={setActiveView} />

      {/* Milestones View (existing) */}
      {activeView === 'milestones' && (
        <>
          <TimelineHeader milestones={milestones} />
          <OverallProgressCard building={building} milestones={milestones} />
          <TimelineMilestones
            milestones={milestones}
            getStatusColor={wrappedGetStatusColor}
            getStatusText={wrappedGetStatusText}
            getTypeIcon={getTypeIcon}
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <CriticalPathCard />
            <CompletionForecastCard milestones={milestones} />
          </div>
        </>
      )}

      {/* Gantt View (ADR-034) — lazy loaded */}
      {activeView === 'gantt' && (
        <Suspense
          fallback={
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          }
        >
          <LazyGanttView building={building} />
        </Suspense>
      )}
    </section>
  );
};

export default TimelineTabContent;
