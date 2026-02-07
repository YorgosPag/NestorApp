'use client';

import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Filter } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
// 🏢 ENTERPRISE: Centralized spacing tokens
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { cn } from '@/lib/utils';
import type { ParkingFilters } from '@/types/parking';
import { PARKING_TYPE_LABELS, PARKING_STATUS_LABELS } from '@/types/parking';
import { PARKING_FILTER_LABELS } from '@/constants/property-statuses-enterprise';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface ParkingFilterPanelProps {
    filters: ParkingFilters;
    onFiltersChange: (filters: Partial<ParkingFilters>) => void;
}

export function ParkingFilterPanel({ filters, onFiltersChange }: ParkingFilterPanelProps) {
    // 🏢 ENTERPRISE: i18n hook
    const { t } = useTranslation('projects');
    const iconSizes = useIconSizes();
    const { quick } = useBorderTokens();
    // 🏢 ENTERPRISE: Centralized spacing tokens
    const spacing = useSpacingTokens();
    return (
        <div className={cn("grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 bg-card", spacing.gap.md, spacing.padding.md, quick.card)}>
          <div className={cn("lg:col-span-2", spacing.spaceBetween.sm)}>
            <Label htmlFor="search" className="text-xs font-medium flex items-center gap-1">
              <Search className={iconSizes.xs} />
              {t('parking.searchLabel')}
            </Label>
            <Input
              id="search"
              placeholder={t('parking.searchPlaceholder')}
              value={filters.searchTerm}
              onChange={(e) => onFiltersChange({ searchTerm: e.target.value })}
              className="h-9"
            />
          </div>

          <div className={spacing.spaceBetween.sm}>
            <Label htmlFor="type-filter" className="text-xs font-medium flex items-center gap-1">
              <Filter className={iconSizes.xs} />
              {t('parking.typeLabel')}
            </Label>
            <Select value={filters.type} onValueChange={(value) => onFiltersChange({ type: value })}>
              <SelectTrigger id="type-filter" className="h-9">
                <SelectValue placeholder={PARKING_FILTER_LABELS.ALL_TYPES} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{PARKING_FILTER_LABELS.ALL_TYPES}</SelectItem>
                {Object.entries(PARKING_TYPE_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className={spacing.spaceBetween.sm}>
            <Label htmlFor="status-filter" className="text-xs font-medium">{t('parking.statusLabel')}</Label>
            <Select value={filters.status} onValueChange={(value) => onFiltersChange({ status: value })}>
              <SelectTrigger id="status-filter" className="h-9">
                <SelectValue placeholder={PARKING_FILTER_LABELS.ALL_STATUSES} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{PARKING_FILTER_LABELS.ALL_STATUSES}</SelectItem>
                {Object.entries(PARKING_STATUS_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className={spacing.spaceBetween.sm}>
            <Label htmlFor="level-filter" className="text-xs font-medium">{t('parking.levelLabel')}</Label>
            <Select value={filters.level} onValueChange={(value) => onFiltersChange({ level: value })}>
              <SelectTrigger id="level-filter" className="h-9">
                <SelectValue placeholder={PARKING_FILTER_LABELS.ALL_LEVELS} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{PARKING_FILTER_LABELS.ALL_LEVELS}</SelectItem>
                <SelectItem value="basement">{t('parking.levels.basement')}</SelectItem>
                <SelectItem value="ground">{t('parking.levels.ground')}</SelectItem>
                <SelectItem value="first">{t('parking.levels.first')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className={spacing.spaceBetween.sm}>
            <Label htmlFor="owner-filter" className="text-xs font-medium">{t('parking.ownerLabel')}</Label>
            <Input
              id="owner-filter"
              placeholder={t('parking.ownerFilterPlaceholder')}
              value={filters.owner}
              onChange={(e) => onFiltersChange({ owner: e.target.value })}
              className="h-9"
            />
          </div>
        </div>
    );
}
