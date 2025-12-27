'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, BarChart3 } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import type { StorageType, StorageStatus } from '@/types/storage';

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
                        <option value="all">Όλοι οι τύποι</option>
                        <option value="storage">Αποθήκες</option>
                        <option value="parking">Θέσεις Στάθμευσης</option>
                    </select>

                    <select
                        value={filterStatus}
                        onChange={(e) => onFilterStatusChange(e.target.value as StorageStatus | 'all')}
                        className={`h-10 px-3 rounded-md border border-input ${colors.bg.primary} text-sm`}
                    >
                        <option value="all">Όλες οι καταστάσεις</option>
                        <option value="available">Διαθέσιμες</option>
                        <option value="sold">Πωλημένες</option>
                        <option value="reserved">Κρατημένες</option>
                        <option value="maintenance">Συντήρηση</option>
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