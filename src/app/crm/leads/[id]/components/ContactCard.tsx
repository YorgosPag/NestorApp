
'use client';

import React from 'react';
import { User, Mail, Phone, Tag, Calendar } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import type { Opportunity } from '@/types/crm';
import { formatDate } from '../utils/dates';
import { useStatusColor } from '../utils/status';

interface ContactCardProps {
  lead: Opportunity;
}

export function ContactCard({ lead }: ContactCardProps) {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const { quick } = useBorderTokens();
  const { getStatusColor } = useStatusColor();

  return (
    <div className={`${colors.bg.primary} ${quick.card} shadow p-6`}>
      <h3 className={`text-lg font-semibold mb-4 ${colors.text.foreground}`}>Στοιχεία Επαφής</h3>
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <User className={`${iconSizes.md} ${colors.text.muted}`} />
          <div>
            <p className="font-medium">{lead.fullName}</p>
            <p className={`text-sm ${colors.text.muted}`}>Πλήρες όνομα</p>
          </div>
        </div>
        {lead.email && (
          <div className="flex items-center gap-3">
            <Mail className={`${iconSizes.md} ${colors.text.muted}`} />
            <div>
              <p className="font-medium">{lead.email}</p>
              <p className={`text-sm ${colors.text.muted}`}>Email</p>
            </div>
          </div>
        )}
        {lead.phone && (
          <div className="flex items-center gap-3">
            <Phone className={`${iconSizes.md} ${colors.text.muted}`} />
            <div>
              <p className="font-medium">{lead.phone}</p>
              <p className={`text-sm ${colors.text.muted}`}>Τηλέφωνο</p>
            </div>
          </div>
        )}
        <div className="flex items-center gap-3">
          <Tag className={`${iconSizes.md} ${colors.text.muted}`} />
          <div>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(lead.stage)}`}>
              {lead.stage}
            </span>
            <p className={`text-sm ${colors.text.muted} mt-1`}>Κατάσταση</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Calendar className={`${iconSizes.md} ${colors.text.muted}`} />
          <div>
            <p className="font-medium">{formatDate(lead.createdAt)}</p>
            <p className={`text-sm ${colors.text.muted}`}>Ημερομηνία δημιουργίας</p>
          </div>
        </div>
      </div>
    </div>
  );
}
