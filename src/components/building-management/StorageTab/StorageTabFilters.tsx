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
            <CardContent className="p-2">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
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
                            <SelectValue placeholder={t('allTypes', { ns: 'filters' })} />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">{t('allTypes', { ns: 'filters' })}</SelectItem>
                            <SelectItem value="small">{t('pages.storage.typeLabels.small')}</SelectItem>
                            <SelectItem value="large">{t('pages.storage.typeLabels.large')}</SelectItem>
                            <SelectItem value="basement">{t('pages.storage.typeLabels.basement')}</SelectItem>
                            <SelectItem value="ground">{t('pages.storage.typeLabels.ground')}</SelectItem>
                            <SelectItem value="special">{t('pages.storage.typeLabels.special')}</SelectItem>
                        </SelectContent>
                    </Select>

                    <Select value={filterStatus} onValueChange={(val) => onFilterStatusChange(val as StorageStatus | 'all')}>
                        <SelectTrigger>
                            <SelectValue placeholder={t('allStatuses', { ns: 'filters' })} />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">{t('allStatuses', { ns: 'filters' })}</SelectItem>
                            <SelectItem value="available">{t('pages.storage.statusLabels.available')}</SelectItem>
                            <SelectItem value="sold">{t('pages.storage.statusLabels.sold')}</SelectItem>
                            <SelectItem value="reserved">{t('pages.storage.statusLabels.reserved')}</SelectItem>
                            <SelectItem value="maintenance">{t('pages.storage.statusLabels.maintenance')}</SelectItem>
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
