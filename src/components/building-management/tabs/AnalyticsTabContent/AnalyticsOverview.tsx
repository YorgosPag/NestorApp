'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { costBreakdown, monthlyProgress } from './utils';

export default function AnalyticsOverview() {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Cost Breakdown */}
            <Card>
                <CardHeader>
                    <CardTitle>Ανάλυση Κόστους</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {costBreakdown.map((item) => (
                            <div key={item.category}>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-medium">{item.category}</span>
                                    <span className="text-sm text-muted-foreground">
                                        {item.amount.toLocaleString('el-GR')}€ ({item.percentage}%)
                                    </span>
                                </div>
                                <div className="w-full bg-muted rounded-full h-3">
                                    <div
                                        className={cn("h-3 rounded-full transition-all duration-500", item.color)}
                                        style={{ width: `${item.percentage}%` }}
                                    ></div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                        <div className="text-sm font-medium text-blue-900 dark:text-blue-200 mb-2">💡 Ανάλυση</div>
                        <p className="text-sm text-blue-700 dark:text-blue-300">
                            Το κόστος υλικών είναι 5% υψηλότερο από τον μέσο όρο της αγοράς.
                            Συνιστάται επαναδιαπραγμάτευση με προμηθευτές.
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* Progress Chart */}
            <Card>
                <CardHeader>
                    <CardTitle>Πρόοδος vs Προγραμματισμός</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {monthlyProgress.map((month) => (
                            <div key={month.month} className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium">{month.month}</span>
                                    <span className="text-xs text-muted-foreground">
                                        Προγρ: {month.planned}% | Πραγμ: {month.actual}%
                                    </span>
                                </div>
                                <div className="relative">
                                    <div className="w-full bg-muted rounded-full h-4">
                                        <div
                                            className="h-4 bg-blue-200 dark:bg-blue-800 rounded-full"
                                            style={{ width: `${month.planned}%` }}
                                        ></div>
                                        <div
                                            className="absolute top-0 h-4 bg-primary rounded-full"
                                            style={{ width: `${month.actual}%` }}
                                        ></div>
                                        <div className="absolute right-2 top-0 text-xs font-medium text-primary-foreground">
                                            {month.actual}%
                                        </div>
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
