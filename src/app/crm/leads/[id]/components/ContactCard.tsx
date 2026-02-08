'use client';

import React from 'react';
import { User, Mail, Phone, Tag, Calendar } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { Opportunity } from '@/types/crm';
import { formatDate } from '../utils/dates';
import { useStatusColor } from '../utils/status';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { cn } from '@/lib/design-system';

interface ContactCardProps {
  lead: Opportunity;
}

export function ContactCard({ lead }: ContactCardProps) {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const { quick, radiusClass } = useBorderTokens();
  const { t } = useTranslation('crm');
  const { getStatusColor } = useStatusColor();
  const spacing = useSpacingTokens();

  const stageLabelKey = lead.stage ? `opportunities.stages.${lead.stage}` : 'opportunities.stages.initial_contact';

  return (
    <div className={cn(colors.bg.primary, quick.card, 'shadow', spacing.padding.lg)}>
      <h3 className={cn('text-lg font-semibold', spacing.margin.bottom.md, colors.text.foreground)}>
        {t('contactCard.contactDetails')}
      </h3>
      <div className={spacing.spaceBetween.md}>
        <div className={cn('flex items-center', spacing.gap.md)}>
          <User className={cn(iconSizes.md, colors.text.muted)} />
          <div>
            <p className="font-medium">{lead.fullName}</p>
            <p className={cn('text-sm', colors.text.muted)}>{t('contactCard.fullName')}</p>
          </div>
        </div>
        {lead.email && (
          <div className={cn('flex items-center', spacing.gap.md)}>
            <Mail className={cn(iconSizes.md, colors.text.muted)} />
            <div>
              <p className="font-medium">{lead.email}</p>
              <p className={cn('text-sm', colors.text.muted)}>{t('contactCard.email')}</p>
            </div>
          </div>
        )}
        {lead.phone && (
          <div className={cn('flex items-center', spacing.gap.md)}>
            <Phone className={cn(iconSizes.md, colors.text.muted)} />
            <div>
              <p className="font-medium">{lead.phone}</p>
              <p className={cn('text-sm', colors.text.muted)}>{t('contactCard.phone')}</p>
            </div>
          </div>
        )}
        <div className={cn('flex items-center', spacing.gap.md)}>
          <Tag className={cn(iconSizes.md, colors.text.muted)} />
          <div>
            <span className={cn(spacing.padding.x.sm, spacing.padding.y.xs, radiusClass.full, 'text-sm font-medium', getStatusColor(lead.stage))}>
              {t(stageLabelKey)}
            </span>
            <p className={cn('text-sm', colors.text.muted, spacing.margin.top.xs)}>{t('contactCard.status')}</p>
          </div>
        </div>
        <div className={cn('flex items-center', spacing.gap.md)}>
          <Calendar className={cn(iconSizes.md, colors.text.muted)} />
          <div>
            <p className="font-medium">{formatDate(lead.createdAt)}</p>
            <p className={cn('text-sm', colors.text.muted)}>{t('contactCard.createdAt')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

