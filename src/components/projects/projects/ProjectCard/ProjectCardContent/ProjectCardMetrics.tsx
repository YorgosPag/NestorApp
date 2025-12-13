'use client';

import React from 'react';
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
  return (
    <div className="grid grid-cols-2 gap-4 pt-2">
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">Επιφάνεια</p>
        <p className="text-sm font-semibold">{project.totalArea.toLocaleString('el-GR')} m²</p>
      </div>
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">Αξία</p>
        <Tooltip>
          <TooltipTrigger>
            <p className="text-sm font-semibold text-green-600">
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
