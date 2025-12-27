'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, BarChart3 } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import type { StorageType, StorageStatus } from '@/types/storage';
import { STORAGE_FILTER_LABELS, STORAGE_STATUS_LABELS, STORAGE_TYPE_LABELS } from '@/constants/property-statuses-enterprise';

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
    const iconSizes = useIconSizes();
    const colors = useSemanticColors();
    return (
        <Card>
            <CardContent className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <div className="relative md:col-span-2">
                        <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground ${iconSizes.sm}`} />
                        <Input
                            placeholder="Αναζήτηση κωδικού ή περιγραφής..."
                            value={searchTerm}
                            onChange={(e) => onSearchChange(e.target.value)}
                            className="pl-10"
                        />
                    </div>

                    <select
                        value={filterType}
                        onChange={(e) => onFilterTypeChange(e.target.value as StorageType | 'all')}
                        className={`h-10 px-3 rounded-md border border-input ${colors.bg.primary} text-sm`}
                    >
                        <option value="all">{STORAGE_FILTER_LABELS.ALL_TYPES}</option>
                        <option value="storage">{STORAGE_TYPE_LABELS.storage}</option>
                        <option value="parking">{STORAGE_TYPE_LABELS.parking}</option>
                    </select>

                    <select
                        value={filterStatus}
                        onChange={(e) => onFilterStatusChange(e.target.value as StorageStatus | 'all')}
                        className={`h-10 px-3 rounded-md border border-input ${colors.bg.primary} text-sm`}
                    >
                        <option value="all">{STORAGE_FILTER_LABELS.ALL_STATUSES}</option>
                        <option value="available">{STORAGE_STATUS_LABELS.available}</option>
                        <option value="sold">{STORAGE_STATUS_LABELS.sold}</option>
                        <option value="reserved">{STORAGE_STATUS_LABELS.reserved}</option>
                        <option value="maintenance">{STORAGE_STATUS_LABELS.maintenance}</option>
                    </select>

                    <Button variant="outline" className="flex items-center gap-2">
                        <BarChart3 className={iconSizes.sm} />
                        Εξαγωγή Αναφοράς
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}