'use client';

import React from 'react';
import { useTypography } from '@/hooks/useTypography';
import { useSemanticColors } from '@/hooks/useSemanticColors';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Project } from '@/types/project';
import { formatCurrency } from '@/lib/intl-utils';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface ProjectCardMetricsProps {
  project: Project;
}

export function ProjectCardMetrics({ project }: ProjectCardMetricsProps) {
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation('projects');
  // 🟢 ENTERPRISE: Centralized systems
  const typography = useTypography();
  const colors = useSemanticColors();

  return (
    <div className="grid grid-cols-2 gap-4 pt-2">
      <div className="space-y-1">
        <p className={typography.special.tertiary}>{t('metrics.area')}</p>
        <p className={typography.heading.sm}>{project.totalArea.toLocaleString('el-GR')} m²</p>
      </div>
      <div className="space-y-1">
        <p className={typography.special.tertiary}>{t('metrics.value')}</p>
        <Tooltip>
          <TooltipTrigger>
            <p className={`${typography.heading.sm} ${colors.text.price}`}>
              {formatCurrency(project.totalValue)}
            </p>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t('metrics.totalValueTooltip')}</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
