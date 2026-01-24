// 🌐 i18n: All labels converted to i18n keys - 2026-01-18
'use client';
import { useIconSizes } from '@/hooks/useIconSizes';
import { CommonBadge } from '@/core/badges';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
// 🏢 ENTERPRISE: Centralized action icons/colors (ZERO hardcoded values)
import { NAVIGATION_ACTIONS } from '@/components/navigation/config/navigation-entities';
// 🏢 ENTERPRISE: Centralized spacing tokens
import { useSpacingTokens } from '@/hooks/useSpacingTokens';

export function ReadOnlyBanner() {
  const { t } = useTranslation('properties');
  const iconSizes = useIconSizes();
  const spacing = useSpacingTokens();

  return (
    // 🏢 ENTERPRISE: Using centralized spacing tokens - NO hardcoded values
    <div className={`flex items-center ${spacing.gap.sm} ${spacing.padding.sm} bg-muted/50 rounded-md`}>
      <NAVIGATION_ACTIONS.view.icon className={cn(iconSizes.sm, NAVIGATION_ACTIONS.view.color, 'shrink-0')} />
      <span className="text-xs text-muted-foreground truncate">{t(NAVIGATION_ACTIONS.view.label, { ns: 'navigation' })}</span>
      <CommonBadge
        status="property"
        customLabel={t('details.publicView')}
        variant="outline"
        className="text-xs ml-auto shrink-0"
      />
    </div>
  );
}
