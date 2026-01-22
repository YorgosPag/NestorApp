
'use client';

import React, { useCallback } from 'react';
import { TimelineHeader } from './TimelineTabContent/TimelineHeader';
import { OverallProgressCard } from './TimelineTabContent/OverallProgressCard';
import { TimelineMilestones } from './TimelineTabContent/TimelineMilestones';
import { CriticalPathCard } from './TimelineTabContent/CriticalPathCard';
import { CompletionForecastCard } from './TimelineTabContent/CompletionForecastCard';
import { getStatusColor, getStatusText, getTypeIcon, getMilestones } from './TimelineTabContent/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { Building } from '../BuildingsPageContent';

interface TimelineTabContentProps {
  building: Building;
}

const TimelineTabContent = ({ building }: TimelineTabContentProps) => {
  // 🏢 ENTERPRISE: i18n and semantic colors hooks
  const { t } = useTranslation('building');
  const colors = useSemanticColors();

  // 🏢 ENTERPRISE: Get i18n-enabled milestones
  const milestones = getMilestones(t);

  // 🏢 ENTERPRISE: Wrapper functions for component compatibility
  const wrappedGetStatusColor = useCallback(
    (status: string) => getStatusColor(status, colors),
    [colors]
  );

  const wrappedGetStatusText = useCallback(
    (status: string) => getStatusText(status, t),
    [t]
  );

  return (
    <div className="space-y-6">
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
    </div>
  );
};

export default TimelineTabContent;
