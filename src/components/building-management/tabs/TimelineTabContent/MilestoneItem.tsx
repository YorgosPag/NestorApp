'use client';

import React from 'react';
import { CommonBadge } from '@/core/badges';
import { ThemeProgressBar } from '@/core/progress/ThemeProgressBar';
import { CheckCircle, Clock, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { formatDate } from '@/lib/intl-utils';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';
import '@/lib/design-system';

// 🏢 ENTERPRISE: Proper type safety - Zero 'any' tolerance
export interface Milestone {
    id: string | number;
    status: 'completed' | 'in-progress' | 'pending' | 'delayed' | string;
    title: string;
    type: string;
    date: string;
    description?: string;
    progress?: number;
}

// 🏢 ENTERPRISE: LucideIcon type for icon components
type LucideIconType = React.ComponentType<{ className?: string }>;

interface MilestoneItemProps {
    milestone: Milestone;
    getStatusColor: (status: string) => string;
    getStatusText: (status: string) => string;
    getTypeIcon: (type: string) => LucideIconType;
    onEdit?: () => void;
    onDelete?: () => void;
}

export function MilestoneItem({ milestone, getStatusColor: _getStatusColor, getStatusText, getTypeIcon, onEdit, onDelete }: MilestoneItemProps) {
    // 🏢 ENTERPRISE: i18n hook for translations
    const { t } = useTranslation(['building', 'building-address', 'building-filters', 'building-storage', 'building-tabs', 'building-timeline']);
    const iconSizes = useIconSizes();
    const { quick, getStatusBorder } = useBorderTokens();
    const colors = useSemanticColors();
    return (
        <div className="group relative flex items-start gap-2">
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
                        {(onEdit || onDelete) && (
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                {onEdit && (
                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}>
                                        <Pencil className={iconSizes.sm} />
                                    </Button>
                                )}
                                {onDelete && (
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={onDelete}>
                                        <Trash2 className={iconSizes.sm} />
                                    </Button>
                                )}
                            </div>
                        )}
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
                        <span className={cn("text-sm", colors.text.muted)}>
                            {formatDate(milestone.date)}
                        </span>
                    </div>
                </div>

                <p className={cn("mb-2", colors.text.muted)}>
                    {milestone.description}
                </p>

                <ThemeProgressBar
                    progress={milestone.progress ?? 0}
                    label={t('tabs.timeline.milestone.progressLabel')}
                    size="sm"
                    showPercentage
                />

                {milestone.status === 'in-progress' && (
                    <div className={`mt-2 p-2 ${colors.bg.info} ${quick.card} ${getStatusBorder('info')}`}>
                        <div className={`flex items-center gap-2 text-sm ${colors.text.info}`}>
                            <Clock className={iconSizes.sm} />
                            <span className="font-medium">{t('tabs.timeline.milestone.nextSteps')}</span>
                        </div>
                        <ul className={`mt-2 text-sm ${colors.text.info} space-y-1`}>
                            <li>• {milestone.description}</li>
                        </ul>
                    </div>
                )}

                {milestone.status === 'completed' && (
                    <div className={`mt-2 flex items-center gap-2 text-sm ${colors.text.success}`}>
                        <CheckCircle className={iconSizes.sm} />
                        <span>{t('tabs.timeline.milestone.completedAt', { date: formatDate(milestone.date) })}</span>
                    </div>
                )}
            </div>
        </div>
    );
}