'use client';

import React from 'react';
import { Button } from "@/components/ui/button";
import { CommonBadge } from "@/core/badges";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Eye, EyeOff } from "lucide-react";
import { PROPERTY_STATUS_CONFIG } from "@/lib/property-utils";
import { useIconSizes } from '@/hooks/useIconSizes';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface LayerManagerHeaderProps {
  propertyCount: number;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  filterType: string;
  setFilterType: (type: string) => void;
  filterStatus: string;
  setFilterStatus: (status: string) => void;
  uniqueTypes: string[];
  uniqueStatuses: string[];
  onShowAll: () => void;
  onHideAll: () => void;
}

export function LayerManagerHeader({
  propertyCount,
  searchQuery,
  setSearchQuery,
  filterType,
  setFilterType,
  filterStatus,
  setFilterStatus,
  uniqueTypes,
  uniqueStatuses,
  onShowAll,
  onHideAll,
}: LayerManagerHeaderProps) {
  // 🏢 ENTERPRISE: i18n support and icon sizes hook
  const { t } = useTranslation('common');
  const iconSizes = useIconSizes();

  return (
    <div className="p-4 border-b space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{t('layerManager.title')}</h3>
        <CommonBadge
          status="property"
          customLabel={t('layerManager.itemCount', { count: propertyCount })}
          variant="secondary"
          className="text-xs"
        />
      </div>
      <Input
        placeholder={t('layerManager.searchPlaceholder')}
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="h-8 text-xs"
        aria-label={t('layerManager.searchAriaLabel')}
      />
      <div className="grid grid-cols-2 gap-2">
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="h-8 text-xs" aria-label={t('layerManager.typeFilterAriaLabel')}>
            <SelectValue placeholder={t('layerManager.typePlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('filters.allTypes')}</SelectItem>
            {uniqueTypes.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="h-8 text-xs" aria-label={t('layerManager.statusFilterAriaLabel')}>
            <SelectValue placeholder={t('layerManager.statusPlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('filters.allStatuses')}</SelectItem>
            {uniqueStatuses.map(status => (
              <SelectItem key={status} value={status}>{(PROPERTY_STATUS_CONFIG as Record<string, { label: string; color: string }>)[status]?.label || status}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex gap-1">
        <Button variant="outline" size="sm" className="h-7 px-2 text-xs flex-1" onClick={onShowAll}>
          <Eye className={`${iconSizes.xs} mr-1`} /> {t('layerManager.showAll')}
        </Button>
        <Button variant="outline" size="sm" className="h-7 px-2 text-xs flex-1" onClick={onHideAll}>
          <EyeOff className={`${iconSizes.xs} mr-1`} /> {t('layerManager.hideAll')}
        </Button>
      </div>
    </div>
  );
}
