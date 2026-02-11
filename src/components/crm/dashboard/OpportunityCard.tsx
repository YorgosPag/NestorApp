'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Users, Mail, Phone, Calendar, FileText, Edit, Trash2 } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { CommonBadge } from '@/core/badges';
import { COMPLEX_HOVER_EFFECTS, TRANSITION_PRESETS, INTERACTIVE_PATTERNS, GROUP_HOVER_PATTERNS } from '@/components/ui/effects';
import type { Opportunity } from '@/types/crm';
import { formatCurrency, formatDateTime } from '@/lib/intl-utils';
import { normalizeToDate } from '@/lib/date-local';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { getStatusColor } from '@/components/leads/utils/formatters';

const getCreatedAtLabel = (timestamp: Opportunity['createdAt'], unknownLabel: string): string => {
    const date = normalizeToDate(timestamp);
    return date ? formatDateTime(date) : unknownLabel;
};

export function OpportunityCard({ opportunity, onEdit, onDelete }: { opportunity: Opportunity, onEdit: (opportunity: Opportunity) => void, onDelete: (opportunityId: string, opportunityName: string) => void }) {
    // 🏢 ENTERPRISE: i18n hook for translations
    const { t } = useTranslation('crm');
    const iconSizes = useIconSizes();
    const colors = useSemanticColors();
    const router = useRouter();

    const handleCardClick = () => {
        if (opportunity.id) {
            router.push(`/crm/leads/${opportunity.id}`);
        }
    };

    return (
        <div
            role="group"
            className={`bg-card p-4 rounded-lg shadow-sm border border-transparent cursor-pointer relative group ${COMPLEX_HOVER_EFFECTS.FEATURE_CARD}`}
            onClick={handleCardClick}
        >
            <div className="flex items-start justify-between mb-2">
                <h4 className="font-medium text-sm text-foreground flex items-center gap-2">
                    <Users className={iconSizes.sm} />
                    {opportunity.fullName || opportunity.title}
                </h4>
                <CommonBadge
                  status="company"
                  customLabel={opportunity.stage || ''}
                  size="sm"
                  className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(opportunity.stage, colors)}`}
                />
            </div>
            
            <div className="space-y-1.5 text-xs text-muted-foreground">
                {opportunity.email && (
                    <div className="flex items-center gap-2">
                        <Mail className={iconSizes.xs} />
                        <span>{opportunity.email}</span>
                    </div>
                )}
                {opportunity.phone && (
                    <div className="flex items-center gap-2">
                        <Phone className={iconSizes.xs} />
                        <span>{opportunity.phone}</span>
                    </div>
                )}
                <div className="flex items-center gap-2">
                    <Calendar className={iconSizes.xs} />
                    <span>{getCreatedAtLabel(opportunity.createdAt, t('opportunities.unknownDate'))}</span>
                </div>
            </div>

            {opportunity.notes && (
                <div className="mt-2 pt-2 border-t text-xs text-muted-foreground">
                    <p className="flex items-start gap-2">
                        <FileText className={`${iconSizes.xs} mt-0.5 shrink-0`}/>
                        <span className="flex-1">{opportunity.notes}</span>
                    </p>
                </div>
            )}

            {opportunity.estimatedValue !== undefined && (
                <p className={`text-right text-sm font-bold ${colors.text.success} mt-2`} aria-live="polite">
                    {formatCurrency(opportunity.estimatedValue, 'EUR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </p>
            )}

            <div className={`absolute bottom-2 right-2 flex items-center gap-1 ${GROUP_HOVER_PATTERNS.SHOW_ON_GROUP} ${TRANSITION_PRESETS.OPACITY}`}>
                <Tooltip>
                    <TooltipTrigger asChild>
                         <Button 
                            variant="ghost" 
                            size="sm" 
                            className={`${iconSizes.xl} p-0`}
                            onClick={(e) => {
                                e.stopPropagation();
                                onEdit(opportunity);
                            }}
                            aria-label={t('opportunities.actions.edit')}
                        >
                            <Edit className={iconSizes.xs} />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>{t('opportunities.actions.edit')}</p>
                    </TooltipContent>
                </Tooltip>
                
                <AlertDialog>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <AlertDialogTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className={`${iconSizes.xl} p-0 ${INTERACTIVE_PATTERNS.DESTRUCTIVE_HOVER}`}
                                    onClick={(e) => e.stopPropagation()}
                                    aria-label={t('opportunities.actions.delete')}
                                >
                                    <Trash2 className={iconSizes.xs} />
                                </Button>
                            </AlertDialogTrigger>
                        </TooltipTrigger>
                         <TooltipContent>
                            <p>{t('opportunities.actions.delete')}</p>
                        </TooltipContent>
                    </Tooltip>
                    <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                        <AlertDialogHeader>
                        <AlertDialogTitle>{t('opportunities.deleteDialog.title')}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t('opportunities.deleteDialog.message', { name: opportunity.fullName || opportunity.title })}
                            {' '}{t('opportunities.deleteDialog.warning')}
                        </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                        <AlertDialogCancel>{t('opportunities.deleteDialog.cancel')}</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => opportunity.id && onDelete(opportunity.id, opportunity.fullName || opportunity.title)}
                            className={`bg-destructive ${INTERACTIVE_PATTERNS.DESTRUCTIVE_HOVER}`}
                        >
                            {t('opportunities.deleteDialog.confirm')}
                        </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </div>
    );
}

