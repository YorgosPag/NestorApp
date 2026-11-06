'use client';

import React from 'react';
import { useRouter } from '@/lib/workspace/navigation';
import { Users, Mail, Phone, Calendar, FileText, Edit, Trash2 } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { CommonBadge } from '@/core/badges';
import { COMPLEX_HOVER_EFFECTS, TRANSITION_PRESETS, INTERACTIVE_PATTERNS, GROUP_HOVER_PATTERNS } from '@/components/ui/effects';
import type { Opportunity } from '@/types/crm';
import type { OpportunityStage } from '@/config/crm/opportunity-stages';
import { stageAgeOf } from '../utils/pipeline-board';
import { CardAction, LockNotice, MoveToMenu, StageAgeBadge } from './OpportunityCardParts';
import type { OpportunityLocks } from '../stage-move/useOpportunityAccess';
import { ENTITY_ROUTES } from '@/lib/routes';
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
import { getStatusColor } from '@/lib/status-helpers';
import '@/lib/design-system';
import { cn } from '@/lib/utils';

const getCreatedAtLabel = (timestamp: Opportunity['createdAt'], unknownLabel: string): string => {
    const date = normalizeToDate(timestamp);
    return date ? formatDateTime(date) : unknownLabel;
};

interface OpportunityCardProps {
    readonly opportunity: Opportunity;
    readonly onEdit: (opportunity: Opportunity) => void;
    readonly onDelete: (opportunityId: string, opportunityName: string) => void;
    /** ADR-930 — η λαβή συρσίματος/πληκτρολογίου του πίνακα (`KanbanBoard`). Απούσα ⇒ η κάρτα δεν σέρνεται. */
    readonly handle?: React.ReactNode;
    /** ADR-930 — «Μετακίνηση σε…»: ο δεύτερος δρόμος προς την ΙΔΙΑ εντολή με το σύρσιμο. */
    readonly onMoveTo?: (stage: OpportunityStage) => void;
    /** Η κάρτα μετακινείται τώρα (αίτημα σε πτήση) — καμία δεύτερη μετακίνηση. */
    readonly moving?: boolean;
    /** ADR-930 «Εξουσία κατόχου» — γιατί δεν επιτρέπεται επεξεργασία/μετακίνηση ή διαγραφή (`null` ⇒ επιτρέπεται). */
    readonly locks?: OpportunityLocks;
}

const UNLOCKED: OpportunityLocks = { edit: null, delete: null };

export function OpportunityCard({ opportunity, onEdit, onDelete, handle, onMoveTo, moving = false, locks = UNLOCKED }: OpportunityCardProps) {
    // 🏢 ENTERPRISE: i18n hook for translations
    const { t } = useTranslation('crm');
    const iconSizes = useIconSizes();
    const colors = useSemanticColors();
    const router = useRouter();

    const handleCardClick = () => {
        if (opportunity.id) {
            router.push(ENTITY_ROUTES.crm.lead(opportunity.id));
        }
    };

    return (
        <div
            role="group"
            aria-busy={moving || undefined}
            className={cn('bg-card p-4 rounded-lg shadow-sm border border-transparent cursor-pointer relative group', COMPLEX_HOVER_EFFECTS.FEATURE_CARD, moving && 'opacity-70')}
            onClick={handleCardClick}
        >
            <div className="flex items-start justify-between mb-2">
                <h4 className="font-medium text-sm text-foreground flex items-center gap-2">
                    {locks.edit ? <LockNotice reason={locks.edit} /> : handle}
                    <Users className={iconSizes.sm} />
                    {opportunity.fullName || opportunity.title}
                </h4>
                <CommonBadge
                  status="company"
                  customLabel={opportunity.stage ? t(`opportunities.stages.${opportunity.stage}`) : ''}
                  size="sm"
                  className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor('lead', opportunity.stage, { colors })}`}
                />
            </div>

            {opportunity.fullName && opportunity.title && (
                <p className="mb-2 text-sm text-foreground">{opportunity.title}</p>
            )}

            <div className={cn("space-y-1.5 text-xs", colors.text.muted)}>
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
                    <span>
                        {t('opportunities.card.createdAt', {
                            date: getCreatedAtLabel(opportunity.createdAt, t('opportunities.unknownDate')),
                        })}
                    </span>
                </div>
            </div>

            <StageAgeBadge age={stageAgeOf(opportunity)} />

            {opportunity.notes && (
                <div className={cn("mt-2 pt-2 border-t text-xs", colors.text.muted)}>
                    <p className="flex items-start gap-2">
                        <FileText className={`${iconSizes.xs} mt-0.5 shrink-0`}/>
                        <span className="flex-1">{opportunity.notes}</span>
                    </p>
                </div>
            )}

            {/* ADR-930 §3.11: ποσό και ενέργειες σε ΜΙΑ γραμμή ροής (Pipedrive/HubSpot) — όχι `absolute` πάνω στο ποσό,
                που στο hover κάλυπτε το «195.000 €». Οι ενέργειες κρατούν τη θέση τους και όταν είναι αόρατες. */}
            <footer className="mt-2 flex items-center justify-between gap-2">
            {opportunity.estimatedValue !== undefined ? (
                <p className={`m-0 text-sm font-bold ${colors.text.success}`} aria-live="polite">
                    {formatCurrency(opportunity.estimatedValue, 'EUR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </p>
            ) : null}

            <div className={`ml-auto flex shrink-0 items-center gap-1 ${GROUP_HOVER_PATTERNS.SHOW_ON_GROUP} ${TRANSITION_PRESETS.OPACITY}`}>
                {onMoveTo && (
                    <MoveToMenu current={opportunity.stage} name={opportunity.fullName || opportunity.title} disabled={moving} onMoveTo={onMoveTo} />
                )}
                <CardAction label={t('opportunities.actions.edit')} icon={<Edit className={iconSizes.xs} />}
                    className={iconSizes.xl} lockedReason={locks.edit} onClick={() => onEdit(opportunity)} />

                {locks.delete ? (
                    <CardAction label={t('opportunities.actions.delete')} icon={<Trash2 className={iconSizes.xs} />}
                        className={iconSizes.xl} lockedReason={locks.delete} />
                ) : (
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
                )}
            </div>
            </footer>
        </div>
    );
}

