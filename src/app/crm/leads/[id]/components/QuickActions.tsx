'use client';

import React from 'react';
import { toast } from 'react-hot-toast';
import { Send, PhoneCall, Plus, Edit3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';
import type { Opportunity } from '@/types/crm';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { cn } from '@/lib/design-system';

interface QuickActionsProps {
  lead: Opportunity;
  onEdit: () => void;
  onNewTask: () => void;
  onSendEmail?: () => void; // New callback for email modal
}

export function QuickActions({ lead, onEdit, onNewTask, onSendEmail }: QuickActionsProps) {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const { quick } = useBorderTokens();
  const { t } = useTranslation('crm');
  const spacing = useSpacingTokens();

  const handleCall = () => {
    if (!lead.phone) {
      toast.error(t('leadDetails.errors.noPhone'));
      return;
    }
    window.location.href = `tel:${lead.phone}`;
  };

  const handleSendEmail = () => {
    if (!lead.email) {
      toast.error(t('leadDetails.errors.noEmail'));
      return;
    }

    // Call the parent's email modal handler
    onSendEmail?.();
  };

  return (
    <div className={cn(colors.bg.primary, quick.card, 'shadow', spacing.padding.lg)}>
      <h4 className={cn('font-medium', spacing.margin.bottom.sm, colors.text.foreground)}>
        {t('quickActions.title')}
      </h4>
      <div className={spacing.spaceBetween.sm}>
        <Button
          onClick={handleSendEmail}
          disabled={!lead.email}
          className={cn(
            'w-full flex items-center justify-start',
            spacing.gap.md,
            spacing.padding.x.md,
            spacing.padding.y.sm,
            colors.bg.info,
            colors.text.info,
            INTERACTIVE_PATTERNS.PRIMARY_HOVER
          )}
        >
          <Send className={iconSizes.md} />
          {t('leadCard.sendEmail')}
        </Button>
        <Button
          onClick={handleCall}
          disabled={!lead.phone}
          className={cn(
            'w-full flex items-center justify-start',
            spacing.gap.md,
            spacing.padding.x.md,
            spacing.padding.y.sm,
            colors.bg.success,
            colors.text.success,
            INTERACTIVE_PATTERNS.SUCCESS_HOVER
          )}
        >
          <PhoneCall className={iconSizes.md} />
          {t('contactCard.actions.call')}
        </Button>
        <Button
          onClick={onNewTask}
          className={cn(
            'w-full flex items-center justify-start',
            spacing.gap.md,
            spacing.padding.x.md,
            spacing.padding.y.sm,
            colors.bg.warning,
            colors.text.warning,
            INTERACTIVE_PATTERNS.PURPLE_HOVER
          )}
        >
          <Plus className={iconSizes.md} />
          {t('tasks.newTask')}
        </Button>
        <Button
          onClick={onEdit}
          className={cn(
            'w-full flex items-center justify-start',
            spacing.gap.md,
            spacing.padding.x.md,
            spacing.padding.y.sm,
            colors.bg.secondary,
            colors.text.muted,
            INTERACTIVE_PATTERNS.SUBTLE_HOVER
          )}
        >
          <Edit3 className={iconSizes.md} />
          {t('leadCard.edit')}
        </Button>
      </div>
    </div>
  );
}
