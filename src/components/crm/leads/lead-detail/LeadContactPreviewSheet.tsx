'use client';

import React from 'react';
import { Mail, Phone } from 'lucide-react';
import { Link } from '@/lib/workspace/navigation';
import { ContextualNavigationService } from '@/services/navigation/ContextualNavigationService';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Spinner } from '@/components/ui/spinner';
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/design-system';
import { useContactOpportunities } from './hooks/useContactOpportunities';
import type { LeadPerson } from './lead-person';

interface LeadContactPreviewSheetProps {
  readonly contactId: string;
  readonly currentLeadId?: string;
  readonly person: LeadPerson;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

export function LeadContactPreviewSheet({
  contactId, currentLeadId, person, open, onOpenChange,
}: LeadContactPreviewSheetProps) {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const spacing = useSpacingTokens();
  const { t } = useTranslation('crm');
  const { opportunities, loading } = useContactOpportunities(contactId, open);
  const otherDeals = opportunities.filter((deal) => deal.id && deal.id !== currentLeadId);
  const linkClass = cn('text-link', INTERACTIVE_PATTERNS.LINK_PRIMARY);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex flex-col">
        <SheetHeader>
          <SheetTitle>{person.fullName}</SheetTitle>
          <SheetDescription>{t('contactCard.preview.description')}</SheetDescription>
        </SheetHeader>

        <ul className={spacing.spaceBetween.sm}>
          {person.email && (
            <li className={cn('flex items-center', spacing.gap.sm)}>
              <Mail className={cn(iconSizes.sm, colors.text.muted)} aria-hidden="true" />
              {person.email}
            </li>
          )}
          {person.phone && (
            <li className={cn('flex items-center', spacing.gap.sm)}>
              <Phone className={cn(iconSizes.sm, colors.text.muted)} aria-hidden="true" />
              {person.phone}
            </li>
          )}
        </ul>

        <section aria-label={t('contactCard.preview.otherDeals')}>
          <h4 className={cn('font-medium', spacing.margin.bottom.sm)}>{t('contactCard.preview.otherDeals')}</h4>
          {loading && <Spinner />}
          {!loading && otherDeals.length === 0 && (
            <p className={cn('text-sm', colors.text.muted)}>{t('contactCard.preview.noOtherDeals')}</p>
          )}
          {!loading && otherDeals.length > 0 && (
            <ul className={spacing.spaceBetween.sm}>
              {otherDeals.map((deal) => (
                <li key={deal.id}>
                  <Link href={`/crm/leads/${deal.id}`} className={linkClass}>
                    {deal.title || deal.fullName}
                  </Link>
                  <span className={cn('text-sm', colors.text.muted)}> · {t(`opportunities.stages.${deal.stage}`)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <Link href={ContextualNavigationService.generateRoute('contact', contactId)} className={linkClass}>
          {t('contactCard.preview.openFull')}
        </Link>
      </SheetContent>
    </Sheet>
  );
}
