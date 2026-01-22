'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { LayoutGrid, List, ArrowLeft, Home, Search } from 'lucide-react';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import type { FilterState } from '@/types/property-viewer';
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects/hover-effects';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
// 🏢 ENTERPRISE: Centralized action icons (ZERO hardcoded values)
import { NAVIGATION_ACTIONS } from '@/components/navigation/config';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface PublicPropertyViewerHeaderProps {
  viewMode: 'list' | 'grid';
  setViewMode: (mode: 'list' | 'grid') => void;
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  availableCount: number;
}

export function PublicPropertyViewerHeader({
  viewMode,
  setViewMode,
  filters,
  onFiltersChange,
  availableCount
}: PublicPropertyViewerHeaderProps) {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const router = useRouter();
  const { t } = useTranslation('common');
  
  return (
    <div className="shrink-0">
      <div className="border-b bg-card p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            {/* Back Button Group */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push('/properties')}
                className={`h-9 px-3 flex items-center gap-2 ${INTERACTIVE_PATTERNS.PRIMARY_HOVER} transition-colors`}
              >
                <ArrowLeft className={iconSizes.sm} />
                <span className="hidden sm:inline">{t('propertyViewer.header.backToSearch')}</span>
                <span className="sm:hidden">{t('propertyViewer.header.back')}</span>
              </Button>
              
              <div className="h-6 w-px bg-border" />
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/')}
                className={`h-9 px-3 flex items-center gap-2 ${INTERACTIVE_PATTERNS.SUBTLE_HOVER}`}
              >
                <Home className={iconSizes.sm} />
                <span className="hidden sm:inline">{t('propertyViewer.header.home')}</span>
              </Button>
            </div>
            
            <div className="h-6 w-px bg-border" />
            
            {/* Title */}
            <div>
              <h1 className="text-xl font-bold text-foreground">{t('propertyViewer.header.floorPlan')}</h1>
              <p className="text-sm text-muted-foreground">
                {t('propertyViewer.header.availableProperties', { count: availableCount })}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Search Button - για να πάει πίσω στην αναζήτηση */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push('/properties')}
              className="h-8 hidden md:flex items-center gap-2"
            >
              <Search className={iconSizes.sm} />
              {t('propertyViewer.header.newSearch')}
            </Button>
            
            {/* View Mode Toggle */}
            <div className={`flex border rounded-md ${colors.bg.primary}`}>
              <Button
                variant={viewMode === 'list' ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode('list')}
                className="h-8 rounded-r-none border-0"
              >
                <List className={`${iconSizes.sm} mr-1`} />
                {t('viewMode.list')}
              </Button>
              <Button
                variant={viewMode === 'grid' ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode('grid')}
                className="h-8 rounded-l-none border-0"
              >
                <LayoutGrid className={`${iconSizes.sm} mr-1`} />
                {t('viewMode.grid')}
              </Button>
            </div>
          </div>
        </div>
        
        {/* Filters Section */}
        <Collapsible>
          <CollapsibleTrigger asChild>
            <Button variant="outline" className="w-full justify-start p-4 text-sm font-semibold">
              <NAVIGATION_ACTIONS.filter.icon className={cn(iconSizes.sm, NAVIGATION_ACTIONS.filter.color, 'mr-2')}/>
              {t('propertyViewer.header.searchFilters')}
              {(filters.searchTerm || filters.propertyType.length > 0 || filters.status.length > 0) && (
                <span className="ml-2 px-2 py-1 bg-primary text-primary-foreground text-xs rounded-full">
                  {t('propertyViewer.header.activeFilters')}
                </span>
              )}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="p-4 bg-muted/50 rounded-b-lg">
              <p className="text-sm text-muted-foreground">{t('propertyViewer.header.filtersPlaceholder')}</p>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  );
}