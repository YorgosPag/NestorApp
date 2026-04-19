'use client';

import React, { useCallback } from 'react';
import { TimelineHeader } from './TimelineHeader';
import { OverallProgressCard } from './OverallProgressCard';
import { TimelineMilestones } from './TimelineMilestones';
import { CriticalPathCard } from './CriticalPathCard';
import { CompletionForecastCard } from './CompletionForecastCard';
import { getStatusColor } from '@/lib/status-helpers';
import { getStatusText, getTimelineTypeIcon, getMilestones } from './utils';
import type { Building } from '../../BuildingsPageContent';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';
// 🏢 ENTERPRISE: Semantic colors for status mapping
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import '@/lib/design-system';

interface TimelineTabContentProps {
  building: Building;
}

const TimelineTabContent = ({ building }: TimelineTabContentProps) => {
  // 🏢 ENTERPRISE: i18n hook for translations
  const { t } = useTranslation(['building', 'building-address', 'building-filters', 'building-storage', 'building-tabs', 'building-timeline']);
  // 🏢 ENTERPRISE: Semantic colors hook
  const colors = useSemanticColors();

  // 🏢 ENTERPRISE: Get milestones with i18n support
  const milestones = getMilestones(t);

  // 🏢 ENTERPRISE: Wrapper for getStatusColor with Dependency Injection
  const wrappedGetStatusColor = useCallback(
    (status: string) => getStatusColor('buildingTimeline', status, { colors }),
    [colors]
  );

  // 🏢 ENTERPRISE: i18n-enabled wrapper for getStatusText
  const translatedGetStatusText = useCallback(
    (status: string) => getStatusText(status, t),
    [t]
  );

  return (
    <section className="space-y-2">
      <TimelineHeader milestones={milestones} />
      <OverallProgressCard building={building} milestones={milestones} />
      <TimelineMilestones
        milestones={milestones}
        getStatusColor={wrappedGetStatusColor}
        getStatusText={translatedGetStatusText}
        getTypeIcon={getTimelineTypeIcon}
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <CriticalPathCard buildingId={building.id as string} />
        <CompletionForecastCard milestones={milestones} />
      </div>
    </section>
  );
};

export default TimelineTabContent;
