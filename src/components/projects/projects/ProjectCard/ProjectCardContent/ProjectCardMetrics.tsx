/* eslint-disable design-system/prefer-design-system-imports */
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
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface ProjectCardMetricsProps {
  project: Project;
}

export function ProjectCardMetrics({ project }: ProjectCardMetricsProps) {
  // 🟢 ENTERPRISE: Centralized systems
  const typography = useTypography();
  const colors = useSemanticColors();
  const { t } = useTranslation('projects');

  return (
    <div className="grid grid-cols-2 gap-2 pt-2">
      <div className="space-y-1">
        <p className={typography.special.tertiary}>{t('cards.area')}</p>
        <p className={typography.heading.sm}>{project.totalArea.toLocaleString('el-GR')} m²</p>
      </div>
      <div className="space-y-1">
        <p className={typography.special.tertiary}>{t('listCard.value')}</p>
        <Tooltip>
          <TooltipTrigger>
            <p className={`${typography.heading.sm} ${colors.text.price}`}>
              {formatCurrency(project.totalValue)}
            </p>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t('cards.totalProjectValue')}</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
