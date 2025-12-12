'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Users, Mail, Phone, Calendar, FileText, Edit, Trash2 } from 'lucide-react';
import { CommonBadge } from '@/core/badges';
import { COMPLEX_HOVER_EFFECTS, TRANSITION_PRESETS, INTERACTIVE_PATTERNS } from '@/components/ui/effects';
import type { Opportunity, FirestoreishTimestamp } from '@/types/crm';
import { format } from 'date-fns';
import { el } from 'date-fns/locale';
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

// Constants for stage colors, defined outside the component for stable reference.
const STAGE_COLORS: Record<NonNullable<Opportunity['stage']>, string> = {
    'initial_contact': 'bg-blue-100 text-blue-800',
    'qualification': 'bg-yellow-100 text-yellow-800',
    'viewing': 'bg-purple-100 text-purple-800',
    'proposal': 'bg-orange-100 text-orange-800',
    'negotiation': 'bg-teal-100 text-teal-800',
    'contract': 'bg-indigo-100 text-indigo-800',
    'closed_won': 'bg-green-100 text-green-800',
    'closed_lost': 'bg-red-100 text-red-800'
};

const getStatusColor = (status?: Opportunity['stage']) => {
    return STAGE_COLORS[status!] ?? 'bg-gray-100 text-gray-800';
};

// Safe date formatter
const formatDate = (timestamp: FirestoreishTimestamp): string => {
    if (!timestamp) return 'Άγνωστη ημερομηνία';
    
    try {
      const date = timestamp instanceof Date 
        ? timestamp 
        : typeof (timestamp as any).toDate === 'function' 
        ? (timestamp as any).toDate() 
        : new Date(timestamp);
        
      if (isNaN(date.getTime())) return 'Άγνωστη ημερομηνία';

      return format(date, 'dd/MM/yyyy HH:mm', { locale: el });
    } catch (err) {
      return 'Άγνωστη ημερομηνία';
    }
};

export function OpportunityCard({ opportunity, onEdit, onDelete }: { opportunity: Opportunity, onEdit: (opportunity: Opportunity) => void, onDelete: (opportunityId: string, opportunityName: string) => void }) {
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
                    <Users className="w-4 h-4" />
                    {opportunity.fullName || opportunity.title}
                </h4>
                <CommonBadge
                  status="company"
                  customLabel={opportunity.stage || ''}
                  size="sm"
                  className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(opportunity.stage)}`}
                />
            </div>
            
            <div className="space-y-1.5 text-xs text-muted-foreground">
                {opportunity.email && (
                    <div className="flex items-center gap-2">
                        <Mail className="w-3.5 h-3.5" />
                        <span>{opportunity.email}</span>
                    </div>
                )}
                {opportunity.phone && (
                    <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5" />
                        <span>{opportunity.phone}</span>
                    </div>
                )}
                <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{formatDate(opportunity.createdAt)}</span>
                </div>
            </div>

            {opportunity.notes && (
                <div className="mt-2 pt-2 border-t text-xs text-muted-foreground">
                    <p className="flex items-start gap-2">
                        <FileText className="w-3.5 h-3.5 mt-0.5 shrink-0"/>
                        <span className="flex-1">{opportunity.notes}</span>
                    </p>
                </div>
            )}

            {opportunity.estimatedValue !== undefined && (
                <p className="text-right text-sm font-bold text-green-600 mt-2" aria-live="polite">
                    {opportunity.estimatedValue.toLocaleString('el-GR')}€
                </p>
            )}

            <div className={`absolute bottom-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 ${TRANSITION_PRESETS.OPACITY}`}>
                <Tooltip>
                    <TooltipTrigger asChild>
                         <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-7 w-7 p-0"
                            onClick={(e) => {
                                e.stopPropagation();
                                onEdit(opportunity);
                            }}
                            aria-label="Επεξεργασία"
                        >
                            <Edit className="w-3.5 h-3.5" />
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
                                    className={`h-7 w-7 p-0 ${INTERACTIVE_PATTERNS.DESTRUCTIVE_HOVER}`}
                                    onClick={(e) => e.stopPropagation()}
                                    aria-label="Διαγραφή"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
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
                            className="bg-destructive hover:bg-destructive/90"
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
