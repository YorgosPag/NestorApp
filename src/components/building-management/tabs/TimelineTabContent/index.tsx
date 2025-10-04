'use client';

import React from 'react';
import { TimelineHeader } from './TimelineHeader';
import { OverallProgressCard } from './OverallProgressCard';
import { TimelineMilestones } from './TimelineMilestones';
import { CriticalPathCard } from './CriticalPathCard';
import { CompletionForecastCard } from './CompletionForecastCard';
import { getStatusColor, getStatusText, getTypeIcon, milestones } from './utils';
import type { Building } from '../../BuildingsPageContent';

interface TimelineTabContentProps {
  building: Building;
}

const TimelineTabContent = ({ building }: TimelineTabContentProps) => {
  return (
    <div className="space-y-6">
      <TimelineHeader milestones={milestones} />
      <OverallProgressCard building={building} milestones={milestones} />
      <TimelineMilestones
        milestones={milestones}
        getStatusColor={getStatusColor}
        getStatusText={getStatusText}
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