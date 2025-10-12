'use client';

import React from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Home, TrendingUp, DollarSign, Filter } from 'lucide-react';
import { formatCurrency } from '@/lib/project-utils';
import type { UnitSortKey } from '../UnitsList';

interface UnitsListHeaderProps {
    unitCount: number;
    availableCount: number;
    totalValue: number;
    sortBy: UnitSortKey;
    setSortBy: (value: UnitSortKey) => void;
    sortOrder: 'asc' | 'desc';
    setSortOrder: (value: 'asc' | 'desc') => void;
}

export function UnitsListHeader({
    unitCount,
    availableCount,
    totalValue,
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder,
}: UnitsListHeaderProps) {
    return (
        <div className="p-4 border-b bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20">
            <div className="flex items-center gap-3 mb-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 shadow-sm">
                    <Home className="w-5 h-5 text-white" />
                </div>
                <div>
                    <h3 className="text-base font-semibold text-foreground">Λίστα Μονάδων</h3>
                    <p className="text-xs text-muted-foreground">
                        {unitCount} μονάδες συνολικά
                    </p>
                </div>
            </div>

            <div className="flex items-center justify-between text-xs mb-3">
                 <Badge variant="secondary" className="flex items-center gap-1.5">
                    <TrendingUp className="w-3 h-3 text-green-600" />
                    <span className="font-medium">{availableCount}</span>
                    <span className="text-muted-foreground">Διαθέσιμες</span>
                 </Badge>
                 <Badge variant="secondary" className="flex items-center gap-1.5">
                    <DollarSign className="w-3 h-3 text-blue-600" />
                    <span className="font-medium">{formatCurrency(totalValue)}</span>
                    <span className="text-muted-foreground">Συνολική Αξία</span>
                 </Badge>
            </div>

            <div className="flex items-center gap-2">
                <Filter className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Ταξινόμηση:</span>
                <select
                    value={sortBy}
                    onChange={(e) => {
                        const value = e.target.value;
                        // ✅ ENTERPRISE: Type guard instead of 'as any'
                        if (value === 'name' || value === 'price' || value === 'area') {
                            setSortBy(value);
                        }
                    }}
                    className="text-xs px-2 py-1 rounded border bg-background"
                >
                    <option value="name">Όνομα</option>
                    <option value="price">Τιμή</option>
                    <option value="area">Εμβαδόν</option>
                </select>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                    className="text-xs h-7 w-7 p-0"
                >
                    {sortOrder === 'asc' ? '↑' : '↓'}
                </Button>
            </div>
        </div>
    );
}
