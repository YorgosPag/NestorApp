'use client';

/**
 * Στοιχεία Ευκαιρίας στο προφίλ: τι πάμε να κλείσουμε, για πόσα και ποιο είναι το επόμενο βήμα.
 */

import React from 'react';
import { Building2, CalendarClock, Euro, FileText, ListChecks, Percent } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/design-system';
import { formatCurrency } from '@/lib/intl-utils';
import { ENTITY_ROUTES } from '@/lib/routes';
import { Link } from '@/lib/workspace/navigation';
import type { Opportunity } from '@/types/crm';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useOpportunityProperties } from './hooks/useOpportunityProperties';
import { formatTimestampDate } from './utils/dates';

interface DetailRowProps {
  readonly icon: LucideIcon;
  readonly label: string;
  readonly children: React.ReactNode;
}

function DetailRow({ icon: Icon, label, children }: DetailRowProps) {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const spacing = useSpacingTokens();

  return (
    <div className={cn('flex items-center', spacing.gap.md)}>
      <Icon className={cn(iconSizes.md, colors.text.muted)} />
      <div>
        <div className="font-medium">{children}</div>
        <p className={cn('text-sm', colors.text.muted)}>{label}</p>
      </div>
    </div>
  );
}

interface OpportunityDetailsCardProps {
  readonly lead: Opportunity;
}

export function OpportunityDetailsCard({ lead }: OpportunityDetailsCardProps) {
  const colors = useSemanticColors();
  const spacing = useSpacingTokens();
  const { quick } = useBorderTokens();
  const { t } = useTranslation('crm');
  const properties = useOpportunityProperties(lead.interestedIn?.propertyIds);

  return (
    <article className={cn(colors.bg.primary, quick.card, 'shadow', spacing.padding.lg)}>
      <h3 className={cn('text-lg font-semibold', spacing.margin.bottom.md, colors.text.foreground)}>
        {t('opportunities.details.title')}
      </h3>
      <div className={spacing.spaceBetween.md}>
        {lead.title && (
          <DetailRow icon={FileText} label={t('opportunities.details.name')}>
            {lead.title}
          </DetailRow>
        )}
        {lead.estimatedValue !== undefined && (
          <DetailRow icon={Euro} label={t('opportunities.details.estimatedValue')}>
            {formatCurrency(lead.estimatedValue, 'EUR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </DetailRow>
        )}
        {lead.probability !== undefined && (
          <DetailRow icon={Percent} label={t('opportunities.details.probability')}>
            {t('opportunities.details.probabilityValue', { value: lead.probability })}
          </DetailRow>
        )}
        {lead.nextAction && (
          <DetailRow icon={ListChecks} label={t('opportunities.details.nextAction')}>
            {lead.nextAction}
            {lead.nextActionDate && (
              <p className={cn('text-sm font-normal', colors.text.muted)}>{formatTimestampDate(lead.nextActionDate)}</p>
            )}
          </DetailRow>
        )}
        {lead.expectedCloseDate && (
          <DetailRow icon={CalendarClock} label={t('opportunities.details.expectedClose')}>
            {formatTimestampDate(lead.expectedCloseDate)}
          </DetailRow>
        )}
        {properties.map((property) => (
          <DetailRow key={property.id} icon={Building2} label={t('opportunities.details.property')}>
            <Link href={ENTITY_ROUTES.properties.withId(property.id)} className={colors.text.info}>
              {property.name ?? t('opportunities.details.propertyUnnamed')}
            </Link>
          </DetailRow>
        ))}
      </div>
    </article>
  );
}
