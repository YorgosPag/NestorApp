'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Users, Mail, Phone, Calendar, FileText, Edit, Trash2 } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { CommonBadge } from '@/core/badges';
import { COMPLEX_HOVER_EFFECTS, TRANSITION_PRESETS, INTERACTIVE_PATTERNS, GROUP_HOVER_PATTERNS } from '@/components/ui/effects';
import type { Opportunity, FirestoreishTimestamp } from '@/types/crm';
import { format } from 'date-fns';
import { el } from 'date-fns/locale';
import { formatDateTime } from '@/lib/intl-utils';
import { brandClasses } from '@/styles/design-tokens';
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

// 🏢 ENTERPRISE: Centralized stage colors function
const getStageColors = (colors: ReturnType<typeof useSemanticColors>): Record<NonNullable<Opportunity['stage']>, string> => ({
    'initial_contact': brandClasses.primary.badge,
    'qualification': `${colors.bg.warningSubtle} ${colors.text.warning}`,
    'viewing': `${colors.bg.accentSubtle} ${colors.text.accent}`,
    'proposal': `${colors.bg.warningSubtle} ${colors.text.warning}`,
    'negotiation': `${colors.bg.infoSubtle} ${colors.text.info}`,
    'contract': `${colors.bg.accentSubtle} ${colors.text.accent}`,
    'closed_won': `${colors.bg.successSubtle} ${colors.text.success}`,
    'closed_lost': `${colors.bg.errorSubtle} ${colors.text.error}`
});

const getStatusColor = (status?: Opportunity['stage'], colors?: ReturnType<typeof useSemanticColors>) => {
    if (!colors) return 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300'; // Enterprise fallback
    const stageColors = getStageColors(colors);
    return stageColors[status!] ?? `${colors.bg.muted} ${colors.text.muted}`;
};

// ✅ ENTERPRISE MIGRATION: Using centralized formatDateTime for consistent date formatting
const formatDate = (timestamp: FirestoreishTimestamp): string => {
    if (!timestamp) return 'Άγνωστη ημερομηνία';

    try {
      const date = timestamp instanceof Date
        ? timestamp
        : typeof (timestamp as any).toDate === 'function'
        ? (timestamp as any).toDate()
        : new Date(timestamp);

      if (isNaN(date.getTime())) return 'Άγνωστη ημερομηνία';

      return formatDateTime(date); // ✅ Using centralized function
    } catch (err) {
      return 'Άγνωστη ημερομηνία';
    }
};

export function OpportunityCard({ opportunity, onEdit, onDelete }: { opportunity: Opportunity, onEdit: (opportunity: Opportunity) => void, onDelete: (opportunityId: string, opportunityName: string) => void }) {
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
                    <span>{formatDate(opportunity.createdAt)}</span>
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
                    {opportunity.estimatedValue.toLocaleString('el-GR')}€
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
                            aria-label="Επεξεργασία"
                        >
                            <Edit className={iconSizes.xs} />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Επεξεργασία</p>
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
                                    aria-label="Διαγραφή"
                                >
                                    <Trash2 className={iconSizes.xs} />
                                </Button>
                            </AlertDialogTrigger>
                        </TooltipTrigger>
                         <TooltipContent>
                            <p>Διαγραφή</p>
                        </TooltipContent>
                    </Tooltip>
                    <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                        <AlertDialogHeader>
                        <AlertDialogTitle>Επιβεβαίωση Διαγραφής</AlertDialogTitle>
                        <AlertDialogDescription>
                            Είστε σίγουροι ότι θέλετε να διαγράψετε την ευκαιρία "{opportunity.fullName || opportunity.title}"&#59;
                            Αυτή η ενέργεια δεν μπορεί να αναιρεθεί.
                        </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                        <AlertDialogCancel>Ακύρωση</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => opportunity.id && onDelete(opportunity.id, opportunity.fullName || opportunity.title)}
                            className={`bg-destructive ${INTERACTIVE_PATTERNS.DESTRUCTIVE_HOVER}`}
                        >
                            Διαγραφή
                        </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </div>
    );
}
