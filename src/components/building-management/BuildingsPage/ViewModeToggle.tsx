
'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  LayoutGrid,
  List,
  FolderOpen,
  CheckSquare,
} from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface ViewModeToggleProps {
  viewMode: 'list' | 'grid' | 'byType' | 'byStatus';
  setViewMode: (mode: 'list' | 'grid' | 'byType' | 'byStatus') => void;
}

export function ViewModeToggle({ viewMode, setViewMode }: ViewModeToggleProps) {
  // 🏢 ENTERPRISE: i18n hook for translations
  const { t } = useTranslation('building');
  const iconSizes = useIconSizes();
  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('list')}
          >
            <List className={iconSizes.sm} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t('viewMode.list')}</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={viewMode === 'grid' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('grid')}
          >
            <LayoutGrid className={iconSizes.sm} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t('viewMode.grid')}</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={viewMode === 'byType' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('byType')}
          >
            <FolderOpen className={`${iconSizes.sm} mr-2`} />
            {t('viewMode.byType')}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t('viewMode.byTypeTooltip')}</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={viewMode === 'byStatus' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('byStatus')}
          >
            <CheckSquare className={`${iconSizes.sm} mr-2`} />
            {t('viewMode.byStatus')}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t('viewMode.byStatusTooltip')}</TooltipContent>
      </Tooltip>
    </>
  );
}
