'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export default function AnalyticsComparison() {
    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Σύγκριση με Παρόμοια Έργα</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {[
                            { metric: 'Κόστος/m²', current: '700€', average: '750€', status: 'better' },
                            { metric: 'Χρόνος ολοκλήρωσης', current: '36 μήνες', average: '32 μήνες', status: 'worse' },
                            { metric: 'Ποιότητα εργασιών', current: '9.5/10', average: '8.2/10', status: 'better' },
                            { metric: 'Αποδοτικότητα', current: '88%', average: '82%', status: 'better' }
                        ].map((item) => (
                            <div key={item.metric} className="flex items-center justify-between p-4 border rounded-lg">
                                <div className="flex-1">
                                    <div className="font-medium">{item.metric}</div>
                                    <div className="text-sm text-muted-foreground">
                                        Τρέχον: {item.current} | Μέσος όρος: {item.average}
                                    </div>
                                </div>
                                <div className={cn(`px-3 py-1 rounded text-sm`,
                                    item.status === 'better'
                                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                                        : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
                                )}>
                                    {item.status === 'better' ? '↗️ Καλύτερα' : '↘️ Χειρότερα'}
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
