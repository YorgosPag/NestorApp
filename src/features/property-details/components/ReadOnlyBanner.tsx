// 🌐 i18n: All labels converted to i18n keys - 2026-01-18
'use client';
import { useIconSizes } from '@/hooks/useIconSizes';
import { CommonBadge } from '@/core/badges';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
// 🏢 ENTERPRISE: Centralized action icons/colors (ZERO hardcoded values)
import { NAVIGATION_ACTIONS } from '@/components/navigation/config/navigation-entities';

export function ReadOnlyBanner() {
  const { t } = useTranslation('properties');
  const iconSizes = useIconSizes();
  return (
    <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
      <NAVIGATION_ACTIONS.view.icon className={cn(iconSizes.sm, NAVIGATION_ACTIONS.view.color)} />
      <span className="text-xs text-muted-foreground">{t(NAVIGATION_ACTIONS.view.label, { ns: 'common' })}</span>
      <CommonBadge
        status="property"
        customLabel={t('details.publicView')}
        variant="outline"
        className="text-xs ml-auto"
      />
    </div>
  );
}
