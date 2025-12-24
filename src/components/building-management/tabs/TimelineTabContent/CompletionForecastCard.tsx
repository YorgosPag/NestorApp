'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CommonBadge } from '@/core/badges';
import { Separator } from '@/components/ui/separator';
import { TrendingUp, Lightbulb } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { formatDate } from '@/lib/intl-utils';

interface CompletionForecastCardProps {
    milestones: any[];
}

export function CompletionForecastCard({ milestones }: CompletionForecastCardProps) {
    const iconSizes = useIconSizes();
    const lastMilestone = milestones[milestones.length - 1];
    const delayDays = 5; // Mock data for delay

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <TrendingUp className={`${iconSizes.md} text-green-500`} />
                    Πρόβλεψη Ολοκλήρωσης
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-muted-foreground">Αρχικό χρονοδιάγραμμα</span>
                            <span className="font-medium">{formatDate(lastMilestone.date)}</span>
                        </div>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-muted-foreground">Τρέχουσα πρόβλεψη</span>
                            <span className="font-medium text-orange-600">
                                {(() => {
                                    const d = new Date(lastMilestone.date);
                                    d.setDate(d.getDate() + delayDays);
                                    return formatDate(d);
                                })()}
                            </span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Καθυστέρηση</span>
                            <CommonBadge
                                status="building"
                                customLabel={`+${delayDays} ημέρες`}
                                variant="outline"
                                className="bg-orange-100 text-orange-700"
                            />
                        </div>
                    </div>

                    <Separator />

                    <div className="text-sm text-muted-foreground">
                        <p className="mb-2 flex items-center gap-2">
                            <Lightbulb className={`${iconSizes.sm} text-yellow-500`} />
                            <strong>Συμβουλή:</strong>
                        </p>
                        <p>Επιτάχυνση ηλ/μηχ εργασιών μπορεί να μειώσει την καθυστέρηση στις 2-3 ημέρες.</p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}