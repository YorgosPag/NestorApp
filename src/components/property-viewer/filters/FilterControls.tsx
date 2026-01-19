'use client';

import React from 'react';
import { getAllEnhancedStatuses as getAllStatuses, getStatusLabel, PROPERTY_FILTER_LABELS, DROPDOWN_PLACEHOLDERS } from '@/constants/property-statuses-enterprise';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search } from "lucide-react";
import type { FilterState } from '@/types/property-viewer';
import { useIconSizes } from '@/hooks/useIconSizes';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface FilterControlsProps {
    filters: FilterState;
    onFilterChange: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void;
    onRangeChange: (key: 'priceRange' | 'areaRange', subKey: 'min' | 'max', value: string) => void;
}

export function FilterControls({ filters, onFilterChange, onRangeChange }: FilterControlsProps) {
  const iconSizes = useIconSizes();
  // 🏢 ENTERPRISE: i18n support
  const { t } = useTranslation('properties');

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
        <div className="flex items-center gap-2">
          <Label htmlFor="search" className="text-xs font-medium shrink-0">{t('filterControls.search.label')}</Label>
          <div className="relative w-full">
            <Search className={`absolute left-2.5 top-2.5 ${iconSizes.sm} text-muted-foreground`} />
            <Input
              id="search"
              aria-label={t('filterControls.search.ariaLabel')}
              placeholder={t('filterControls.search.placeholder')}
              className="pl-9 h-9"
              value={filters.searchTerm}
              onChange={(e) => onFilterChange('searchTerm', e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Label className="text-xs font-medium shrink-0">{t('filterControls.priceRange.label')}</Label>
          <Input
            type="number"
            aria-label={t('filterControls.priceRange.minAriaLabel')}
            placeholder={t('filterControls.priceRange.from')}
            className="h-9"
            value={filters.priceRange.min ?? ''}
            onChange={(e) => onRangeChange('priceRange', 'min', e.target.value)}
          />
          <Input
            type="number"
            aria-label={t('filterControls.priceRange.maxAriaLabel')}
            placeholder={t('filterControls.priceRange.to')}
            className="h-9"
            value={filters.priceRange.max ?? ''}
            onChange={(e) => onRangeChange('priceRange', 'max', e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2">
          <Label className="text-xs font-medium shrink-0">{t('filterControls.areaRange.label')}</Label>
          <Input
            type="number"
            aria-label={t('filterControls.areaRange.minAriaLabel')}
            placeholder={t('filterControls.priceRange.from')}
            className="h-9"
            value={filters.areaRange.min ?? ''}
            onChange={(e) => onRangeChange('areaRange', 'min', e.target.value)}
          />
          <Input
            type="number"
            aria-label={t('filterControls.areaRange.maxAriaLabel')}
            placeholder={t('filterControls.priceRange.to')}
            className="h-9"
            value={filters.areaRange.max ?? ''}
            onChange={(e) => onRangeChange('areaRange', 'max', e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2">
          <Label className="text-xs font-medium shrink-0">{t('filterControls.status.label')}</Label>
          <Select
            onValueChange={(value) => onFilterChange('status', value === 'all' ? [] : [value])}
            value={filters.status.length === 1 ? filters.status[0] : 'all'}
          >
            <SelectTrigger className="h-9 w-full" aria-label={t('filterControls.status.ariaLabel')}>
              <SelectValue placeholder={DROPDOWN_PLACEHOLDERS.SELECT_STATUS} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{PROPERTY_FILTER_LABELS.ALL_STATUSES}</SelectItem>
              {getAllStatuses().map(status => (
                <SelectItem key={status} value={status}>
                  {getStatusLabel(status)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
        <div className="flex items-center gap-2">
          <Label className="text-xs font-medium shrink-0">{t('filterControls.project.label')}</Label>
          <Select><SelectTrigger className="h-9 w-full" aria-label={t('filterControls.project.ariaLabel')}><SelectValue placeholder={DROPDOWN_PLACEHOLDERS.SELECT_PROJECT} /></SelectTrigger><SelectContent><SelectItem value="all">{PROPERTY_FILTER_LABELS.ALL_PROJECTS}</SelectItem></SelectContent></Select>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs font-medium shrink-0">{t('filterControls.building.label')}</Label>
          <Select><SelectTrigger className="h-9 w-full" aria-label={t('filterControls.building.ariaLabel')}><SelectValue placeholder={DROPDOWN_PLACEHOLDERS.SELECT_BUILDING} /></SelectTrigger><SelectContent><SelectItem value="all">{PROPERTY_FILTER_LABELS.ALL_BUILDINGS}</SelectItem></SelectContent></Select>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs font-medium shrink-0">{t('filterControls.floor.label')}</Label>
          <Select><SelectTrigger className="h-9 w-full" aria-label={t('filterControls.floor.ariaLabel')}><SelectValue placeholder={DROPDOWN_PLACEHOLDERS.SELECT_FLOOR} /></SelectTrigger><SelectContent><SelectItem value="all">{PROPERTY_FILTER_LABELS.ALL_FLOORS}</SelectItem></SelectContent></Select>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs font-medium shrink-0">{t('filterControls.propertyType.label')}</Label>
          <Select><SelectTrigger className="h-9 w-full" aria-label={t('filterControls.propertyType.ariaLabel')}><SelectValue placeholder={DROPDOWN_PLACEHOLDERS.SELECT_TYPE} /></SelectTrigger><SelectContent><SelectItem value="all">{PROPERTY_FILTER_LABELS.ALL_TYPES}</SelectItem></SelectContent></Select>
        </div>
      </div>
    </>
  );
}
