'use client';

import React from 'react';
import { CommonBadge } from '@/core/badges';
import { ThemeProgressBar } from '@/core/progress/ThemeProgressBar';
import { CheckCircle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { formatDate } from '@/lib/intl-utils';

interface MilestoneItemProps {
    milestone: any;
    getStatusColor: (status: string) => string;
    getStatusText: (status: string) => string;
    getTypeIcon: (type: string) => string;
}

export function MilestoneItem({ milestone, getStatusColor, getStatusText, getTypeIcon }: MilestoneItemProps) {
    const iconSizes = useIconSizes();
    const { quick, getStatusBorder } = useBorderTokens();
    return (
        <div className="relative flex items-start gap-4">
            <div className={cn(
                "relative z-10 flex h-12 w-12 items-center justify-center shadow-sm rounded-full",
                quick.card, // Using centralized border system
                milestone.status === 'completed' ? getStatusBorder('success') :
                milestone.status === 'in-progress' ? getStatusBorder('info') :
                milestone.status === 'pending' ? getStatusBorder('muted') :
                milestone.status === 'delayed' ? getStatusBorder('error') :
                getStatusBorder('muted'), // Default fallback
                milestone.status === 'completed' ? 'text-white' : 'text-gray-600'
            )}>
                {React.createElement(getTypeIcon(milestone.type), { className: "text-lg" })}
            </div>

            <div className="flex-1 min-w-0 pb-6">
                <div className="flex items-center justify-between mb-2">
                    <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        {milestone.title}
                    </h4>
                    <div className="flex items-center gap-2">
                        <CommonBadge
                          status="company"
                          customLabel={getStatusText(milestone.status)}
                          variant="outline"
                          size="sm"
                          className={cn(
                            "text-xs",
                            milestone.status === 'completed' ? `bg-green-50 text-green-700 ${quick.table}` :
                            milestone.status === 'in-progress' ? `bg-blue-50 text-blue-700 ${quick.table}` :
                            `bg-gray-50 text-gray-700 ${quick.table}`
                          )}
                        />
                        <span className="text-sm text-muted-foreground">
                            {formatDate(milestone.date)}
                        </span>
                    </div>
                </div>

                <p className="text-muted-foreground mb-3">
                    {milestone.description}
                </p>

                <ThemeProgressBar
                    progress={milestone.progress}
                    label="Πρόοδος milestone"
                    size="sm"
                    showPercentage={true}
                />

                {milestone.status === 'in-progress' && (
                    <div className={`mt-4 p-3 bg-blue-50 dark:bg-blue-950/30 ${quick.card} ${getStatusBorder('info')}`}>
                        <div className="flex items-center gap-2 text-sm text-blue-800 dark:text-blue-200">
                            <Clock className={iconSizes.sm} />
                            <span className="font-medium">Επόμενα βήματα:</span>
                        </div>
                        <ul className="mt-2 text-sm text-blue-700 dark:text-blue-300 space-y-1">
                            <li>• Ολοκλήρωση κεντρικού θερμικού συστήματος</li>
                            <li>• Εγκατάσταση ανελκυστήρων</li>
                            <li>• Τελικός έλεγχος ηλεκτρολογικών</li>
                        </ul>
                    </div>
                )}

                {milestone.status === 'completed' && (
                    <div className="mt-4 flex items-center gap-2 text-sm text-green-600">
                        <CheckCircle className={iconSizes.sm} />
                        <span>Ολοκληρώθηκε στις {formatDate(milestone.date)}</span>
                    </div>
                )}
            </div>
        </div>
    );
}