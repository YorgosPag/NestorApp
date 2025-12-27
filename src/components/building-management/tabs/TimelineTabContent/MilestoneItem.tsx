'use client';

import React from 'react';
import { CommonBadge } from '@/core/badges';
import { ThemeProgressBar } from '@/core/progress/ThemeProgressBar';
import { CheckCircle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { formatDate } from '@/lib/intl-utils';

// 🏢 ENTERPRISE: Proper type safety - Zero 'any' tolerance
interface Milestone {
    status: 'completed' | 'in-progress' | 'pending' | 'delayed';
    title: string;
    type: string;
    date: string;
    description?: string;
    progress?: number;
}

interface MilestoneItemProps {
    milestone: Milestone;
    getStatusColor: (status: string) => string;
    getStatusText: (status: string) => string;
    getTypeIcon: (type: string) => string;
}

export function MilestoneItem({ milestone, getStatusColor, getStatusText, getTypeIcon }: MilestoneItemProps) {
    const iconSizes = useIconSizes();
    const { quick, getStatusBorder } = useBorderTokens();
    const colors = useSemanticColors();
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
                milestone.status === 'completed' ? `${colors.text.inverted}` : `${colors.text.muted}`
            )}>
                {React.createElement(getTypeIcon(milestone.type), { className: "text-lg" })}
            </div>

            <div className="flex-1 min-w-0 pb-6">
                <div className="flex items-center justify-between mb-2">
                    <h4 className={`text-lg font-semibold ${colors.text.foreground}`}>
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
                            milestone.status === 'completed' ? `${colors.bg.success} ${colors.text.success} ${quick.table}` :
                            milestone.status === 'in-progress' ? `${colors.bg.info} ${colors.text.info} ${quick.table}` :
                            `${colors.bg.secondary} ${colors.text.muted} ${quick.table}`
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
                    <div className={`mt-4 p-3 ${colors.bg.info} ${quick.card} ${getStatusBorder('info')}`}>
                        <div className={`flex items-center gap-2 text-sm ${colors.text.info}`}>
                            <Clock className={iconSizes.sm} />
                            <span className="font-medium">Επόμενα βήματα:</span>
                        </div>
                        <ul className={`mt-2 text-sm ${colors.text.info} space-y-1`}>
                            <li>• Ολοκλήρωση κεντρικού θερμικού συστήματος</li>
                            <li>• Εγκατάσταση ανελκυστήρων</li>
                            <li>• Τελικός έλεγχος ηλεκτρολογικών</li>
                        </ul>
                    </div>
                )}

                {milestone.status === 'completed' && (
                    <div className={`mt-4 flex items-center gap-2 text-sm ${colors.text.success}`}>
                        <CheckCircle className={iconSizes.sm} />
                        <span>Ολοκληρώθηκε στις {formatDate(milestone.date)}</span>
                    </div>
                )}
            </div>
        </div>
    );
}