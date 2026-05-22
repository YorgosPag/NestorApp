'use client';

import React, { useState } from 'react';
import { BaseCard } from '@/components/core/BaseCard/BaseCard';
import { CommonBadge } from '@/core/badges';
import { formatFlexibleDateTime, formatCurrency } from '@/lib/intl-utils';
import { User, Mail, Phone, MessageSquare } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useIconSizes } from '@/hooks/useIconSizes';
// 🏢 ENTERPRISE: Centralized entity icons/colors (ZERO hardcoded values)
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { Opportunity } from '@/types/crm';
import { INTERACTIVE_PATTERNS, HOVER_SHADOWS, TRANSITION_PRESETS } from '@/components/ui/effects';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
import '@/lib/design-system';

interface ContactCardProps {
  lead: Opportunity;
  onEdit?: () => void;
  onCall?: () => void;
  onEmail?: () => void;
  onMessage?: () => void;
  isSelected?: boolean;
  onSelectionChange?: () => void;
}


// 🏢 ENTERPRISE: Stage-based styling
const getLeadStageBadgeClass = (stage: string): string => {
  const stageClasses: Record<string, string> = {
    'initial_contact': 'bg-[hsl(var(--bg-info))]/20 text-primary',
    'qualification': 'bg-accent text-foreground',
    'viewing': 'bg-[hsl(var(--bg-warning))]/40 text-[hsl(var(--text-warning))]',
    'proposal': 'bg-accent text-foreground',
    'negotiation': 'bg-[hsl(var(--bg-warning))]/40 text-[hsl(var(--text-warning))]',
    'contract': 'bg-accent text-foreground',
    'closed_won': 'bg-[hsl(var(--bg-success))]/10 text-green-707',
    'closed_lost': 'bg-destructive/10 text-destructive'
  };
  return stageClasses[stage] || 'bg-muted text-muted-foreground';
};

const formatContactDate = (date: string | Date | { toDate(): Date }) =>
  formatFlexibleDateTime(date, { year: 'numeric', month: '2-digit', day: '2-digit' });

export function ContactCard({ 
  lead, 
  onEdit, 
  onCall, 
  onEmail, 
  onMessage,
  isSelected = false,
  onSelectionChange 
}: ContactCardProps) {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const [isFavorite, setIsFavorite] = useState(false);
  // 🏢 ENTERPRISE: i18n support
  const { t } = useTranslation(['crm', 'crm-inbox']);

  // 🏢 ENTERPRISE: Localized stage label
  const getStageLabel = (stage: string): string => {
    return t(`opportunities.stages.${stage}`, { defaultValue: stage });
  };

  return (
    <BaseCard
      // Βασικές ιδιότητες
      title={lead.fullName || lead.title}
      subtitle={getStageLabel(lead.stage)}
      
      // Header configuration
      headerConfig={{
        backgroundGradient: "from-[hsl(var(--bg-success))]/20 via-[hsl(var(--bg-success))]/10 to-accent",
        logo: <User className={`${iconSizes.xl} text-green-707`} />,
        showImageOverlay: false
      }}
      
      // Selection state
      isSelected={isSelected}
      onSelectionChange={onSelectionChange}
      
      // Favorites
      isFavorite={isFavorite}
      onFavoriteChange={setIsFavorite}
      
      // Status badges - only stage badge (priority not in Opportunity type)
      statusBadges={[
        {
          label: getStageLabel(lead.stage),
          className: getLeadStageBadgeClass(lead.stage)
        }
      ]}
      
      // Content sections
      contentSections={[
        // Contact details
        {
          title: t('contactCard.contactDetails'),
          content: (
            <div className="space-y-3">
              {lead.email && (
                <div className="flex items-center gap-3">
                  <Mail className={`${iconSizes.sm} ${colors.text.muted}`} />
                  <div className="flex-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <a
                          href={`https://mail.google.com/mail/?view=cm&to=${lead.email}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`text-sm font-medium cursor-pointer ${INTERACTIVE_PATTERNS.LINK_PRIMARY}`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {lead.email}
                        </a>
                      </TooltipTrigger>
                      <TooltipContent>{t('contactCard.sendEmailTo', { email: lead.email })}</TooltipContent>
                    </Tooltip>
                    <p className={cn("text-xs", colors.text.muted)}>{t('contactCard.email')}</p>
                  </div>
                </div>
              )}
              {lead.phone && (
                <div className="flex items-center gap-3">
                  <Phone className={`${iconSizes.sm} ${colors.text.muted}`} />
                  <div className="flex-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <a
                          href={`tel:${lead.phone}`}
                          className={`text-sm font-medium cursor-pointer ${INTERACTIVE_PATTERNS.LINK_PRIMARY}`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {lead.phone}
                        </a>
                      </TooltipTrigger>
                      <TooltipContent>{t('contactCard.callTo', { phone: lead.phone })}</TooltipContent>
                    </Tooltip>
                    <p className={cn("text-xs", colors.text.muted)}>{t('contactCard.phone')}</p>
                  </div>
                </div>
              )}
            </div>
          )
        },
        
        // Lead source (if available)
        lead.source && {
          title: t('contactCard.source'),
          content: (
            <div className="text-sm">
              <CommonBadge
                status="contact"
                customLabel={lead.source}
                variant="outline"
              />
            </div>
          )
        },
        
        // Timeline
        {
          title: t('contactCard.timeline'),
          content: (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className={colors.text.muted}>{t('contactCard.createdAt')}</span>
                <span>{formatContactDate(lead.createdAt)}</span>
              </div>
              {lead.lastActivity && (
                <div className="flex justify-between">
                  <span className={colors.text.muted}>{t('contactCard.lastActivity')}</span>
                  <span>{formatContactDate(lead.lastActivity)}</span>
                </div>
              )}
            </div>
          )
        },
        
        // Value/Budget (if available)
        lead.estimatedValue && {
          title: t('contactCard.estimatedValue'),
          content: (
            <div className="text-lg font-semibold text-green-707">
              {typeof lead.estimatedValue === 'number' ? formatCurrency(lead.estimatedValue) : lead.estimatedValue}
            </div>
          )
        },
        
        // Notes (if available)
        lead.notes && {
          title: t('contactCard.notes'),
          content: (
            <div className={cn("text-sm", colors.text.muted)}>
              <p className="line-clamp-3">{lead.notes}</p>
            </div>
          )
        }
      ].filter(Boolean)}
      
      // Actions - with required id property for CardAction type
      actions={[
        ...(onEmail && lead.email ? [{
          id: 'email',
          label: 'Email',
          icon: Mail,
          onClick: onEmail,
          variant: 'default' as const
        }] : []),
        ...(onCall && lead.phone ? [{
          id: 'call',
          label: t('contactCard.actions.call'),
          icon: Phone,
          onClick: onCall,
          variant: 'outline' as const
        }] : []),
        ...(onMessage ? [{
          id: 'message',
          label: t('contactCard.actions.message'),
          icon: MessageSquare,
          onClick: onMessage,
          variant: 'ghost' as const
        }] : []),
        ...(onEdit ? [{
          id: 'edit',
          label: t('contactCard.actions.edit'),
          icon: User,
          onClick: onEdit,
          variant: 'ghost' as const
        }] : [])
      ]}
      
      // Style overrides
      className={`${TRANSITION_PRESETS.SMOOTH_ALL} ${HOVER_SHADOWS.SUBTLE}`}
    />
  );
}