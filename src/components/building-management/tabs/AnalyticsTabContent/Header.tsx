'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart3, DollarSign, TrendingUp, Scale } from 'lucide-react';

interface HeaderProps {
    timeRange: '1M' | '3M' | '6M' | '1Y';
    setTimeRange: (value: '1M' | '3M' | '6M' | '1Y') => void;
    analyticsView: 'overview' | 'financial' | 'progress' | 'comparison';
    setAnalyticsView: (value: 'overview' | 'financial' | 'progress' | 'comparison') => void;
}

export default function Header({ timeRange, setTimeRange, analyticsView, setAnalyticsView }: HeaderProps) {
    return (
        <div>
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold">Advanced Analytics</h3>
                    <p className="text-sm text-muted-foreground">
                        Προχωρημένη ανάλυση δεδομένων και KPIs
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Select value={timeRange} onValueChange={setTimeRange}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Select time range" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="1M">Τελευταίος μήνας</SelectItem>
                            <SelectItem value="3M">Τελευταίοι 3 μήνες</SelectItem>
                            <SelectItem value="6M">Τελευταίοι 6 μήνες</SelectItem>
                            <SelectItem value="1Y">Τελευταίο έτος</SelectItem>
                        </SelectContent>
                    </Select>
                    <Button variant="outline" size="sm">
                        <BarChart3 className="w-4 h-4 mr-2" /> Εξαγωγή Αναφοράς
                    </Button>
                </div>
            </div>

            <div className="flex gap-2 mt-4">
                {[
                    { id: 'overview', label: 'Επισκόπηση', icon: <BarChart3 className="w-4 h-4 mr-2" /> },
                    { id: 'financial', label: 'Οικονομικά', icon: <DollarSign className="w-4 h-4 mr-2" /> },
                    { id: 'progress', label: 'Πρόοδος', icon: <TrendingUp className="w-4 h-4 mr-2" /> },
                    { id: 'comparison', label: 'Σύγκριση', icon: <Scale className="w-4 h-4 mr-2" /> }
                ].map((view) => (
                    <Button
                        key={view.id}
                        variant={analyticsView === view.id ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setAnalyticsView(view.id as any)}
                    >
                        {view.icon} {view.label}
                    </Button>
                ))}
            </div>
        </div>
    );
}
