'use client';

import React, { useState } from 'react';
import { BaseCard } from '@/components/core/BaseCard/BaseCard';
import { ContactBadge, CommonBadge } from '@/core/badges';
import { formatDate } from '@/lib/intl-utils';
import { User, Mail, Phone, Tag, Calendar, MessageSquare, Building } from 'lucide-react';
import type { Opportunity } from '@/types/crm';

interface ContactCardProps {
  lead: Opportunity;
  onEdit?: () => void;
  onCall?: () => void;
  onEmail?: () => void;
  onMessage?: () => void;
  isSelected?: boolean;
  onSelectionChange?: () => void;
}

const getStageLabel = (stage: string) => {
  const stageLabels: Record<string, string> = {
    'new': 'Νέος',
    'qualified': 'Εξειδικευμένος',
    'proposal': 'Πρόταση',
    'negotiation': 'Διαπραγμάτευση',
    'closed-won': 'Κλειστό - Κερδισμένο',
    'closed-lost': 'Κλειστό - Χαμένο'
  };
  return stageLabels[stage] || stage;
};

const formatContactDate = (date: string | Date) => {
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
  const [isFavorite, setIsFavorite] = useState(false);

  return (
    <BaseCard
      // Βασικές ιδιότητες
      title={lead.fullName}
      subtitle={lead.company || 'Ιδιώτης'}
      
      // Header configuration
      headerConfig={{
        backgroundGradient: "from-green-100 via-emerald-50 to-teal-100 dark:from-green-950 dark:via-emerald-950 dark:to-teal-900",
        logo: <User className="w-8 h-8 text-green-600 dark:text-green-400" />,
        showImageOverlay: false
      }}
      
      // Selection state
      isSelected={isSelected}
      onSelectionChange={onSelectionChange}
      
      // Favorites
      isFavorite={isFavorite}
      onFavoriteChange={setIsFavorite}
      
      // Status badges
      statusBadges={[
        {
          label: getStageLabel(lead.stage),
          className: getStatusBadgeClass(lead.stage)
        },
        lead.priority && {
          label: `Προτεραιότητα: ${lead.priority}`,
          className: badgeVariants({ 
            variant: lead.priority === 'high' ? 'error' : 
                     lead.priority === 'medium' ? 'warning' : 'info',
            size: 'sm' 
          })
        }
      ].filter(Boolean)}
      
      // Content sections
      contentSections={[
        // Contact details
        {
          title: 'Στοιχεία Επικοινωνίας',
          content: (
            <div className="space-y-3">
              {lead.email && (
                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{lead.email}</p>
                    <p className="text-xs text-muted-foreground">Email</p>
                  </div>
                </div>
              )}
              {lead.phone && (
                <div className="flex items-center gap-3">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{lead.phone}</p>
                    <p className="text-xs text-muted-foreground">Τηλέφωνο</p>
                  </div>
                </div>
              )}
            </div>
          )
        },
        
        // Company info (if available)
        lead.company && {
          title: 'Εταιρεία',
          content: (
            <div className="flex items-center gap-3">
              <Building className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">{lead.company}</span>
            </div>
          )
        },
        
        // Lead source (if available)
        lead.source && {
          title: 'Πηγή',
          content: (
            <div className="text-sm">
              <span className={badgeVariants({ variant: 'outline', size: 'sm' })}>
                {lead.source}
              </span>
            </div>
          )
        },
        
        // Timeline
        {
          title: 'Χρονολογία',
          content: (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Δημιουργία:</span>
                <span>{formatContactDate(lead.createdAt)}</span>
              </div>
              {lead.lastContactDate && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Τελευταία επαφή:</span>
                  <span>{formatContactDate(lead.lastContactDate)}</span>
                </div>
              )}
            </div>
          )
        },
        
        // Value/Budget (if available)
        lead.estimatedValue && {
          title: 'Εκτιμώμενη Αξία',
          content: (
            <div className="text-lg font-semibold text-green-600 dark:text-green-400">
              €{typeof lead.estimatedValue === 'number' ? lead.estimatedValue.toLocaleString() : lead.estimatedValue}
            </div>
          )
        },
        
        // Notes (if available)
        lead.notes && {
          title: 'Σημειώσεις',
          content: (
            <div className="text-sm text-muted-foreground">
              <p className="line-clamp-3">{lead.notes}</p>
            </div>
          )
        }
      ].filter(Boolean)}
      
      // Actions
      actions={[
        onEmail && lead.email && {
          label: 'Email',
          icon: Mail,
          onClick: onEmail,
          variant: 'default' as const
        },
        onCall && lead.phone && {
          label: 'Κλήση',
          icon: Phone,
          onClick: onCall,
          variant: 'outline' as const
        },
        onMessage && {
          label: 'Μήνυμα',
          icon: MessageSquare,
          onClick: onMessage,
          variant: 'ghost' as const
        },
        onEdit && {
          label: 'Επεξεργασία',
          icon: User,
          onClick: onEdit,
          variant: 'ghost' as const
        }
      ].filter(Boolean)}
      
      // Style overrides
      className="transition-all duration-300 hover:shadow-md"
    />
  );
}