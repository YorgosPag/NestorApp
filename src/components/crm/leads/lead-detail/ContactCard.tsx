'use client';

import React from 'react';
import { User, Mail, Phone, Tag, Calendar, PanelRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { LeadPerson } from './lead-person';
import { Link } from '@/lib/workspace/navigation';
import { ContextualNavigationService } from '@/services/navigation/ContextualNavigationService';
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { Opportunity } from '@/types/crm';
import { formatTimestampDate } from './utils/dates';
import { getStageBadgeVariant } from './utils/status';
import { Badge } from '@/components/ui/badge';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { cn } from '@/lib/design-system';

interface ContactCardProps {
  lead: Opportunity;
  person: LeadPerson;
  onPreview?: () => void;
}

export function ContactCard({ lead, person, onPreview }: ContactCardProps) {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const { quick } = useBorderTokens();
  const { t } = useTranslation('crm');
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
            <p className="font-medium">
              {lead.contactId ? (
                <Link
                  href={ContextualNavigationService.generateRoute('contact', lead.contactId)}
                  className={cn('text-link', INTERACTIVE_PATTERNS.LINK_PRIMARY)}
                >
                  {person.fullName}
                </Link>
              ) : (
                person.fullName
              )}
            </p>
            <p className={cn('text-sm', colors.text.muted)}>{t('contactCard.fullName')}</p>
          </div>
          {lead.contactId && onPreview && (
            <Button type="button" variant="ghost" size="sm" className="ml-auto" onClick={onPreview}>
              <PanelRight className={iconSizes.sm} aria-hidden="true" />
              {t('contactCard.preview.open')}
            </Button>
          )}
        </div>
        {person.email && (
          <div className={cn('flex items-center', spacing.gap.md)}>
            <Mail className={cn(iconSizes.md, colors.text.muted)} />
            <div>
              <p className="font-medium">{person.email}</p>
              <p className={cn('text-sm', colors.text.muted)}>{t('contactCard.email')}</p>
            </div>
          </div>
        )}
        {person.phone && (
          <div className={cn('flex items-center', spacing.gap.md)}>
            <Phone className={cn(iconSizes.md, colors.text.muted)} />
            <div>
              <p className="font-medium">{person.phone}</p>
              <p className={cn('text-sm', colors.text.muted)}>{t('contactCard.phone')}</p>
            </div>
          </div>
        )}
        <div className={cn('flex items-center', spacing.gap.md)}>
          <Tag className={cn(iconSizes.md, colors.text.muted)} />
          <div>
            <Badge variant={getStageBadgeVariant(lead.stage)} className="text-sm">
              {t(stageLabelKey)}
            </Badge>
            <p className={cn('text-sm', colors.text.muted, spacing.margin.top.xs)}>{t('contactCard.status')}</p>
          </div>
        </div>
        <div className={cn('flex items-center', spacing.gap.md)}>
          <Calendar className={cn(iconSizes.md, colors.text.muted)} />
          <div>
            <p className="font-medium">{formatTimestampDate(lead.createdAt)}</p>
            <p className={cn('text-sm', colors.text.muted)}>{t('contactCard.createdAt')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
