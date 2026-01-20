
'use client';

import React from 'react';
import { User, Mail, Phone, Tag, Calendar } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation('crm');
  const { getStatusColor } = useStatusColor();

  return (
    <div className={`${colors.bg.primary} ${quick.card} shadow p-6`}>
      <h3 className={`text-lg font-semibold mb-4 ${colors.text.foreground}`}>{t('contactCard.contactDetails')}</h3>
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <User className={`${iconSizes.md} ${colors.text.muted}`} />
          <div>
            <p className="font-medium">{lead.fullName}</p>
            <p className={`text-sm ${colors.text.muted}`}>{t('contactCard.fullName')}</p>
          </div>
        </div>
        {lead.email && (
          <div className="flex items-center gap-3">
            <Mail className={`${iconSizes.md} ${colors.text.muted}`} />
            <div>
              <p className="font-medium">{lead.email}</p>
              <p className={`text-sm ${colors.text.muted}`}>{t('contactCard.email')}</p>
            </div>
          </div>
        )}
        {lead.phone && (
          <div className="flex items-center gap-3">
            <Phone className={`${iconSizes.md} ${colors.text.muted}`} />
            <div>
              <p className="font-medium">{lead.phone}</p>
              <p className={`text-sm ${colors.text.muted}`}>{t('contactCard.phone')}</p>
            </div>
          </div>
        )}
        <div className="flex items-center gap-3">
          <Tag className={`${iconSizes.md} ${colors.text.muted}`} />
          <div>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(lead.stage)}`}>
              {lead.stage}
            </span>
            <p className={`text-sm ${colors.text.muted} mt-1`}>{t('contactCard.status')}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Calendar className={`${iconSizes.md} ${colors.text.muted}`} />
          <div>
            <p className="font-medium">{formatDate(lead.createdAt)}</p>
            <p className={`text-sm ${colors.text.muted}`}>{t('contactCard.createdAt')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
