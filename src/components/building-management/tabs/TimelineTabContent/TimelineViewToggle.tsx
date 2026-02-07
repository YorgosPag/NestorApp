'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ListChecks, GanttChartSquare } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';

// ─── Types ────────────────────────────────────────────────────────────────

export type TimelineView = 'milestones' | 'gantt';

interface TimelineViewToggleProps {
  activeView: TimelineView;
  onViewChange: (view: TimelineView) => void;
}

// ─── Component ────────────────────────────────────────────────────────────

export function TimelineViewToggle({ activeView, onViewChange }: TimelineViewToggleProps) {
  const { t } = useTranslation('building');
  const iconSizes = useIconSizes();

  return (
    <nav role="tablist" aria-label={t('tabs.timeline.header.title')} className="flex gap-2">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            role="tab"
            aria-selected={activeView === 'milestones'}
            variant={activeView === 'milestones' ? 'default' : 'outline'}
            size="sm"
            onClick={() => onViewChange('milestones')}
          >
            <ListChecks className={`${iconSizes.sm} mr-2`} />
            {t('tabs.timeline.views.milestones')}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t('tabs.timeline.views.milestones')}</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            role="tab"
            aria-selected={activeView === 'gantt'}
            variant={activeView === 'gantt' ? 'default' : 'outline'}
            size="sm"
            onClick={() => onViewChange('gantt')}
          >
            <GanttChartSquare className={`${iconSizes.sm} mr-2`} />
            {t('tabs.timeline.views.gantt')}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t('tabs.timeline.views.gantt')}</TooltipContent>
      </Tooltip>
    </nav>
  );
}
