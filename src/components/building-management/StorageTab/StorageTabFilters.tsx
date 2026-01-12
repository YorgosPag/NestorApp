'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, BarChart3 } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import type { StorageType, StorageStatus } from '@/types/storage';
import { STORAGE_FILTER_LABELS, STORAGE_STATUS_LABELS, STORAGE_TYPE_LABELS } from '@/constants/property-statuses-enterprise';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface StorageTabFiltersProps {
    searchTerm: string;
    onSearchChange: (value: string) => void;
    filterType: StorageType | 'all';
    onFilterTypeChange: (value: StorageType | 'all') => void;
    filterStatus: StorageStatus | 'all';
    onFilterStatusChange: (value: StorageStatus | 'all') => void;
}

export function StorageTabFilters({
    searchTerm,
    onSearchChange,
    filterType,
    onFilterTypeChange,
    filterStatus,
    onFilterStatusChange,
}: StorageTabFiltersProps) {
    // 🏢 ENTERPRISE: i18n hook for translations
    const { t } = useTranslation('building');
    const iconSizes = useIconSizes();
    return (
        <Card>
            <CardContent className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <div className="relative md:col-span-2">
                        <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground ${iconSizes.sm}`} />
                        <Input
                            placeholder={t('tabs.storageTab.searchPlaceholder')}
                            value={searchTerm}
                            onChange={(e) => onSearchChange(e.target.value)}
                            className="pl-10"
                        />
                    </div>

                    <Select value={filterType} onValueChange={(val) => onFilterTypeChange(val as StorageType | 'all')}>
                        <SelectTrigger>
                            <SelectValue placeholder={STORAGE_FILTER_LABELS.ALL_TYPES} />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">{STORAGE_FILTER_LABELS.ALL_TYPES}</SelectItem>
                            <SelectItem value="storage">{STORAGE_TYPE_LABELS.storage}</SelectItem>
                            <SelectItem value="parking">{STORAGE_TYPE_LABELS.parking}</SelectItem>
                        </SelectContent>
                    </Select>

                    <Select value={filterStatus} onValueChange={(val) => onFilterStatusChange(val as StorageStatus | 'all')}>
                        <SelectTrigger>
                            <SelectValue placeholder={STORAGE_FILTER_LABELS.ALL_STATUSES} />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">{STORAGE_FILTER_LABELS.ALL_STATUSES}</SelectItem>
                            <SelectItem value="available">{STORAGE_STATUS_LABELS.available}</SelectItem>
                            <SelectItem value="sold">{STORAGE_STATUS_LABELS.sold}</SelectItem>
                            <SelectItem value="reserved">{STORAGE_STATUS_LABELS.reserved}</SelectItem>
                            <SelectItem value="maintenance">{STORAGE_STATUS_LABELS.maintenance}</SelectItem>
                        </SelectContent>
                    </Select>

                    <Button variant="outline" className="flex items-center gap-2">
                        <BarChart3 className={iconSizes.sm} />
                        {t('tabs.storageTab.exportReport')}
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}