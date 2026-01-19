'use client';

import React, { useState } from 'react';
import { BaseCard } from '@/components/core/BaseCard/BaseCard';
import { ContactBadge, CommonBadge } from '@/core/badges';
import { formatDate } from '@/lib/intl-utils';
import { User, Mail, Phone, Tag, Calendar, MessageSquare } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
// 🏢 ENTERPRISE: Centralized entity icons/colors (ZERO hardcoded values)
import { NAVIGATION_ENTITIES } from '@/components/navigation/config/navigation-entities';
import { cn } from '@/lib/utils';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { Opportunity } from '@/types/crm';
import { INTERACTIVE_PATTERNS, HOVER_SHADOWS, TRANSITION_PRESETS } from '@/components/ui/effects';

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
const getStatusBadgeClass = (stage: string): string => {
  const stageClasses: Record<string, string> = {
    'initial_contact': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    'qualification': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    'viewing': 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
    'proposal': 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
    'negotiation': 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    'contract': 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200',
    'closed_won': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    'closed_lost': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
  };
  return stageClasses[stage] || 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
};

const formatContactDate = (date: string | Date | { toDate(): Date }) => {
  if (typeof date === 'object' && 'toDate' in date) {
    return formatDate(date.toDate());
  }
  return formatDate(new Date(date));
};

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
  const [isFavorite, setIsFavorite] = useState(false);
  // 🏢 ENTERPRISE: i18n support
  const { t } = useTranslation('crm');

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
        backgroundGradient: "from-green-100 via-emerald-50 to-teal-100 dark:from-green-950 dark:via-emerald-950 dark:to-teal-900",
        logo: <User className={`${iconSizes.xl} text-green-600 dark:text-green-400`} />,
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
          className: getStatusBadgeClass(lead.stage)
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
                  <Mail className={`${iconSizes.sm} text-muted-foreground`} />
                  <div className="flex-1">
                    <a
                      href={`https://mail.google.com/mail/?view=cm&to=${lead.email}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`text-sm font-medium cursor-pointer ${INTERACTIVE_PATTERNS.LINK_PRIMARY}`}
                      onClick={(e) => e.stopPropagation()}
                      title={t('contactCard.sendEmailTo', { email: lead.email })}
                    >
                      {lead.email}
                    </a>
                    <p className="text-xs text-muted-foreground">Email</p>
                  </div>
                </div>
              )}
              {lead.phone && (
                <div className="flex items-center gap-3">
                  <Phone className={`${iconSizes.sm} text-muted-foreground`} />
                  <div className="flex-1">
                    <a
                      href={`tel:${lead.phone}`}
                      className={`text-sm font-medium cursor-pointer ${INTERACTIVE_PATTERNS.LINK_PRIMARY}`}
                      onClick={(e) => e.stopPropagation()}
                      title={t('contactCard.callTo', { phone: lead.phone })}
                    >
                      {lead.phone}
                    </a>
                    <p className="text-xs text-muted-foreground">{t('contactCard.phone')}</p>
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
                <span className="text-muted-foreground">{t('contactCard.createdAt')}</span>
                <span>{formatContactDate(lead.createdAt)}</span>
              </div>
              {lead.lastActivity && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('contactCard.lastActivity')}</span>
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
            <div className="text-lg font-semibold text-green-600 dark:text-green-400">
              €{typeof lead.estimatedValue === 'number' ? lead.estimatedValue.toLocaleString() : lead.estimatedValue}
            </div>
          )
        },
        
        // Notes (if available)
        lead.notes && {
          title: t('contactCard.notes'),
          content: (
            <div className="text-sm text-muted-foreground">
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