'use client';

import React, { useCallback } from 'react';
import { TimelineHeader } from './TimelineHeader';
import { OverallProgressCard } from './OverallProgressCard';
import { TimelineMilestones } from './TimelineMilestones';
import { CriticalPathCard } from './CriticalPathCard';
import { CompletionForecastCard } from './CompletionForecastCard';
import { getStatusColor, getStatusText, getTypeIcon, getMilestones } from './utils';
import type { Building } from '../../BuildingsPageContent';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface TimelineTabContentProps {
  building: Building;
}

const TimelineTabContent = ({ building }: TimelineTabContentProps) => {
  // 🏢 ENTERPRISE: i18n hook for translations
  const { t } = useTranslation('building');

  // 🏢 ENTERPRISE: Get milestones with i18n support
  const milestones = getMilestones(t);

  // 🏢 ENTERPRISE: i18n-enabled wrapper for getStatusText
  const translatedGetStatusText = useCallback(
    (status: string) => getStatusText(status, t),
    [t]
  );

  return (
    <section className="space-y-6">
      <TimelineHeader milestones={milestones} />
      <OverallProgressCard building={building} milestones={milestones} />
      <TimelineMilestones
        milestones={milestones}
        getStatusColor={getStatusColor}
        getStatusText={translatedGetStatusText}
        getTypeIcon={getTypeIcon}
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <CriticalPathCard />
        <CompletionForecastCard milestones={milestones} />
      </div>
    </section>
  );
};

export default TimelineTabContent;