/* eslint-disable design-system/prefer-design-system-imports */
'use client';

import React from 'react';
import { formatDateShort } from '@/lib/intl-utils';
import { User, Building2, Briefcase, Calendar, ShieldCheck, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/hooks/useSemanticColors';
import { useTypography } from '@/hooks/useTypography';
import { cn } from '@/lib/utils';
import type { ProjectWorker } from '../contracts';

interface WorkerCardProps {
  worker: ProjectWorker;
  onRemove?: (worker: ProjectWorker) => void;
}

export function WorkerCard({ worker, onRemove }: WorkerCardProps) {
  const { t } = useTranslation('projects');
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const typography = useTypography();

  const statusKey = worker.employmentStatus ?? 'active';
  const isActive = statusKey === 'active';

  return (
    <div className={cn(
      'flex items-center justify-between p-2 rounded-lg border',
      'hover:bg-accent/30 transition-colors'
    )}>
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {/* Avatar */}
        <div className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
          isActive ? 'bg-primary/10' : 'bg-muted'
        )}>
          <User className={cn(iconSizes.sm, isActive ? 'text-primary' : colors.text.muted)} />
        </div>

        {/* Name & specialty */}
        <div className="min-w-0 flex-1">
          <p className={cn(typography.label.sm, 'truncate')}>{worker.name}</p>
          {worker.specialty && (
            <p className={cn(typography.special.tertiary, 'truncate')}>
              <Briefcase className={cn(iconSizes.xs, 'inline-block mr-1')} />
              {worker.specialty}
            </p>
          )}
        </div>

        {/* Company */}
        {worker.company && (
          <div className={cn('hidden md:flex items-center gap-1', typography.special.tertiary)}>
            <Building2 className={iconSizes.xs} />
            <span className="truncate max-w-[120px]">{worker.company}</span>
          </div>
        )}

        {/* Hire date */}
        {worker.hireDate && (
          <div className={cn('hidden lg:flex items-center gap-1', typography.special.tertiary)}>
            <Calendar className={iconSizes.xs} />
            <span>{formatDateShort(new Date(worker.hireDate))}</span>
          </div>
        )}

        {/* AMKA */}
        {worker.amka && (
          <div className={cn('hidden xl:flex items-center gap-1', typography.special.tertiary)}>
            <ShieldCheck className={iconSizes.xs} />
            <span>{worker.amka}</span>
          </div>
        )}

        {/* Status badge */}
        <Badge variant={isActive ? 'default' : 'secondary'}>
          {t(`ika.workersTab.employmentStatus.${statusKey}`)}
        </Badge>
      </div>

      {/* Actions */}
      {onRemove && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="ml-2 shrink-0"
              onClick={() => onRemove(worker)}
            >
              <Trash2 className={cn(iconSizes.sm, colors.text.error)} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t('ika.workersTab.removeWorker')}</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
