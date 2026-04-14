'use client';

/**
 * @module GanttSnapshotCard
 * @enterprise ADR-266 Phase A — Link card to Gantt view for export
 */

import { GanttChartSquare } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useSemanticColors } from '@/hooks/useSemanticColors';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import type { TimelineView } from '../TimelineViewToggle';

interface GanttSnapshotCardProps {
  onViewChange: (view: TimelineView) => void;
}

export function GanttSnapshotCard({ onViewChange }: GanttSnapshotCardProps) {
  const { t } = useTranslation(['building', 'building-address', 'building-filters', 'building-storage', 'building-tabs', 'building-timeline']);
  const colors = useSemanticColors();

  return (
    <Card>
      <CardContent className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <GanttChartSquare className={cn('h-6 w-6', colors.text.muted)} />
          <div>
            <p className="font-medium">{t('tabs.timeline.dashboard.ganttCard.title')}</p>
            <p className={cn('text-sm', colors.text.muted)}>
              {t('tabs.timeline.dashboard.ganttCard.desc')}
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onViewChange('gantt')}
        >
          {t('tabs.timeline.dashboard.ganttCard.cta')}
        </Button>
      </CardContent>
    </Card>
  );
}
