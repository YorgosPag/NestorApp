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

interface ProjectCardMetricsProps {
  project: Project;
}

export function ProjectCardMetrics({ project }: ProjectCardMetricsProps) {
  // 🟢 ENTERPRISE: Centralized systems
  const typography = useTypography();
  const colors = useSemanticColors();

  return (
    <div className="grid grid-cols-2 gap-2 pt-2">
      <div className="space-y-1">
        <p className={typography.special.tertiary}>Επιφάνεια</p>
        <p className={typography.heading.sm}>{project.totalArea.toLocaleString('el-GR')} m²</p>
      </div>
      <div className="space-y-1">
        <p className={typography.special.tertiary}>Αξία</p>
        <Tooltip>
          <TooltipTrigger>
            <p className={`${typography.heading.sm} ${colors.text.price}`}>
              {formatCurrency(project.totalValue)}
            </p>
          </TooltipTrigger>
          <TooltipContent>
            <p>Συνολική αξία έργου</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
