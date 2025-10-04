
'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Plus, LayoutGrid, List, BarChart3, FolderOpen, CheckSquare, Eye } from 'lucide-react';
import { useTranslation } from '@/i18n';

interface HeaderControlsProps {
  viewMode: 'list' | 'grid' | 'byType' | 'byStatus';
  setViewMode: (mode: 'list' | 'grid' | 'byType' | 'byStatus') => void;
  showDashboard: boolean;
  setShowDashboard: (show: boolean) => void;
}

export function HeaderControls({
  viewMode,
  setViewMode,
  showDashboard,
  setShowDashboard,
}: HeaderControlsProps) {
  const { t } = useTranslation('units');
  return (
    <div className="border-b bg-card p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('management.title')}</h1>
          <p className="text-sm text-muted-foreground">
            {t('management.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={showDashboard ? 'default' : 'outline'}
                size="sm"
                onClick={() => setShowDashboard(!showDashboard)}
              >
                <BarChart3 className="w-4 h-4 mr-2" />
                Dashboard
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('tooltips.dashboard')}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={viewMode === 'list' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('list')}
              >
                <List className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('tooltips.listView')}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={viewMode === 'grid' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('grid')}
              >
                <LayoutGrid className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('tooltips.gridView')}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={viewMode === 'byType' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('byType')}
              >
                <FolderOpen className="w-4 h-4 mr-2" />
                {t('actions.groupByType')}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('tooltips.groupByType')}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={viewMode === 'byStatus' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('byStatus')}
              >
                <CheckSquare className="w-4 h-4 mr-2" />
                {t('actions.groupByStatus')}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('tooltips.groupByStatus')}</TooltipContent>
          </Tooltip>
          <Button className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700">
            <Plus className="w-4 h-4 mr-2" />
            {t('actions.newUnit')}
          </Button>
        </div>
      </div>
    </div>
  );
}
