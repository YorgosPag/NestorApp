'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { kpis, getEfficiencyColor } from './utils';

export default function KPICards() {
    return (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <Card>
                <CardContent className="p-4">
                    <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">{kpis.costEfficiency}%</div>
                        <div className="text-xs text-muted-foreground">Κοστολογική Αποδοτικότητα</div>
                        <div className={cn("text-xs px-2 py-1 rounded mt-1", getEfficiencyColor(kpis.costEfficiency))}>
                            {kpis.costEfficiency >= 90 ? 'Άριστα' : kpis.costEfficiency >= 75 ? 'Καλά' : 'Χρήζει βελτίωσης'}
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardContent className="p-4">
                    <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">{kpis.timeEfficiency}%</div>
                        <div className="text-xs text-muted-foreground">Χρονική Αποδοτικότητα</div>
                        <div className={cn("text-xs px-2 py-1 rounded mt-1", getEfficiencyColor(kpis.timeEfficiency))}>
                            {kpis.timeEfficiency >= 90 ? 'Άριστα' : kpis.timeEfficiency >= 75 ? 'Καλά' : 'Χρήζει βελτίωσης'}
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardContent className="p-4">
                    <div className="text-center">
                        <div className="text-2xl font-bold text-purple-600">{kpis.qualityScore}%</div>
                        <div className="text-xs text-muted-foreground">Δείκτης Ποιότητας</div>
                        <div className={cn("text-xs px-2 py-1 rounded mt-1", getEfficiencyColor(kpis.qualityScore))}>
                            Εξαιρετικό
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardContent className="p-4">
                    <div className="text-center">
                        <div className="text-2xl font-bold text-orange-600">{kpis.roi}%</div>
                        <div className="text-xs text-muted-foreground">ROI</div>
                        <div className="text-xs px-2 py-1 rounded mt-1 text-green-800 dark:text-green-300">
                            Πάνω από στόχο
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardContent className="p-4">
                    <div className="text-center">
                        <div className="text-2xl font-bold text-red-600">{kpis.profitMargin}%</div>
                        <div className="text-xs text-muted-foreground">Περιθώριο Κέρδους</div>
                        <div className="text-xs px-2 py-1 rounded mt-1 text-green-800 dark:text-green-300">
                            Εντός στόχων
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardContent className="p-4">
                    <div className="text-center">
                        <div className="text-2xl font-bold text-gray-600">{kpis.riskLevel}</div>
                        <div className="text-xs text-muted-foreground">Επίπεδο Κινδύνου</div>
                        <div className="text-xs px-2 py-1 rounded mt-1 text-green-800 dark:text-green-300">
                            Υπό έλεγχο
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
