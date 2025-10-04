'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';

interface StorageTabStatsProps {
    storageCount: number;
    parkingCount: number;
    available: number;
    totalValue: number;
}

export function StorageTabStats({
    storageCount,
    parkingCount,
    available,
    totalValue,
}: StorageTabStatsProps) {
    return (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-4">
            <Card>
                <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-blue-600">{storageCount}</div>
                    <div className="text-xs text-muted-foreground">Αποθήκες</div>
                </CardContent>
            </Card>
            <Card>
                <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-orange-600">{parkingCount}</div>
                    <div className="text-xs text-muted-foreground">Θέσεις Στάθμευσης</div>
                </CardContent>
            </Card>
            <Card>
                <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-green-600">{available}</div>
                    <div className="text-xs text-muted-foreground">Διαθέσιμα</div>
                </CardContent>
            </Card>
            <Card>
                <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-gray-600">
                        €{(totalValue / 1000).toFixed(0)}K
                    </div>
                    <div className="text-xs text-muted-foreground">Συνολική Αξία</div>
                </CardContent>
            </Card>
        </div>
    );
}