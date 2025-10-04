
'use client';

import React from 'react';
import { TimelineHeader } from './TimelineTabContent/TimelineHeader';
import { OverallProgressCard } from './TimelineTabContent/OverallProgressCard';
import { TimelineMilestones } from './TimelineTabContent/TimelineMilestones';
import { CriticalPathCard } from './TimelineTabContent/CriticalPathCard';
import { CompletionForecastCard } from './TimelineTabContent/CompletionForecastCard';
import { getStatusColor, getStatusText, getTypeIcon, milestones } from './TimelineTabContent/utils';
import type { Building } from '../BuildingsPageContent';

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
