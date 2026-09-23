'use client';

import React from 'react';
import { ToggleButton } from '@/components/ui/toggle-button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ListChecks, GanttChartSquare, LayoutDashboard } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import '@/lib/design-system';

// ─── Types ────────────────────────────────────────────────────────────────

export type TimelineView = 'milestones' | 'gantt' | 'dashboard';

interface TimelineViewToggleProps {
  activeView: TimelineView;
  onViewChange: (view: TimelineView) => void;
}

// ─── Component ────────────────────────────────────────────────────────────

export function TimelineViewToggle({ activeView, onViewChange }: TimelineViewToggleProps) {
  const { t } = useTranslation(['building', 'building-address', 'building-filters', 'building-storage', 'building-tabs', 'building-timeline']);
  const iconSizes = useIconSizes();

  return (
    <nav role="tablist" aria-label={t('tabs.timeline.header.title')} className="flex gap-2">
      <Tooltip>
        <TooltipTrigger asChild>
          <ToggleButton
            role="tab"
            pressed={activeView === 'milestones'}
            variant="outline"
            semantics="selected"
            size="sm"
            onClick={() => onViewChange('milestones')}
          >
            <ListChecks className={`${iconSizes.sm} mr-2`} />
            {t('tabs.timeline.views.milestones')}
          </ToggleButton>
        </TooltipTrigger>
        <TooltipContent>{t('tabs.timeline.views.milestones')}</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <ToggleButton
            role="tab"
            pressed={activeView === 'gantt'}
            variant="outline"
            semantics="selected"
            size="sm"
            onClick={() => onViewChange('gantt')}
          >
            <GanttChartSquare className={`${iconSizes.sm} mr-2`} />
            {t('tabs.timeline.views.gantt')}
          </ToggleButton>
        </TooltipTrigger>
        <TooltipContent>{t('tabs.timeline.views.gantt')}</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <ToggleButton
            role="tab"
            pressed={activeView === 'dashboard'}
            variant="outline"
            semantics="selected"
            size="sm"
            onClick={() => onViewChange('dashboard')}
          >
            <LayoutDashboard className={`${iconSizes.sm} mr-2`} />
            {t('tabs.timeline.views.dashboard')}
          </ToggleButton>
        </TooltipTrigger>
        <TooltipContent>{t('tabs.timeline.views.dashboard')}</TooltipContent>
      </Tooltip>
    </nav>
  );
}
