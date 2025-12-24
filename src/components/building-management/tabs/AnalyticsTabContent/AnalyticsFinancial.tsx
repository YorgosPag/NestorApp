'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Building } from '../../BuildingsPageContent';
import { monthlyProgress } from './utils';
import { cn } from '@/lib/utils';
import { formatCurrency, formatNumber } from '@/lib/intl-utils';
import { useBorderTokens } from '@/hooks/useBorderTokens';

interface AnalyticsFinancialProps {
    building: Building;
}

export default function AnalyticsFinancial({ building }: AnalyticsFinancialProps) {
    const { quick } = useBorderTokens();
    return (
        <div className="space-y-6">
            {/* Financial Summary */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="p-4 text-center">
                        <div className="text-lg font-bold text-green-600">
                            {formatCurrency(building.totalValue || 0)}
                        </div>
                        <div className="text-xs text-muted-foreground">Συνολικός Προϋπολογισμός</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-4 text-center">
                        <div className="text-lg font-bold text-blue-600">
                            {formatCurrency((building.totalValue || 0) * 0.75)}
                        </div>
                        <div className="text-xs text-muted-foreground">Δαπανηθέν Κόστος</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-4 text-center">
                        <div className="text-lg font-bold text-orange-600">
                            {formatCurrency((building.totalValue || 0) * 0.25)}
                        </div>
                        <div className="text-xs text-muted-foreground">Υπόλοιπο Budget</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-4 text-center">
                        <div className="text-lg font-bold text-purple-600">
                            {formatNumber(((building.totalValue || 0) / building.totalArea))}€/m²
                        </div>
                        <div className="text-xs text-muted-foreground">Κόστος ανά m²</div>
                    </CardContent>
                </Card>
            </div>

            {/* Cash Flow */}
            <Card>
                <CardHeader>
                    <CardTitle>Ταμειακές Ροές</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {monthlyProgress.map((month, index) => (
                            <div key={month.month} className={`flex items-center justify-between p-3 ${quick.card}`}>
                                <div className="flex items-center gap-3">
                                    <div className="text-sm font-medium w-12">{month.month}</div>
                                    <div className="text-sm text-muted-foreground">
                                        Μηνιαία δαπάνη: {formatCurrency(month.cost)}
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="text-sm">
                                        Σωρευτικό: {formatCurrency(monthlyProgress.slice(0, index + 1).reduce((sum, m) => sum + m.cost, 0))}
                                    </div>
                                    <div className={cn(`text-sm px-2 py-1 rounded`,
                                        month.cost < 95000 ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
                                    )}>
                                        {month.cost < 95000 ? 'Εντός budget' : 'Προσοχή'}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
