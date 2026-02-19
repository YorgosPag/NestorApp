'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';
// 🏢 ENTERPRISE: Centralized icon mapping (supports string icon names)
import { getIconComponent } from '@/components/generic/utils/IconMapping';

interface PlaceholderTabProps {
  title?: string;
  icon?: React.ElementType | string; // 🏢 ENTERPRISE: Supports both component and string icon names
  building?: Record<string, unknown>; // Optional building prop
  [key: string]: unknown; // Allow additional props from UniversalTabsRenderer
}

const PlaceholderTab = ({ title = 'Content', icon: Icon, building, ...additionalProps }: PlaceholderTabProps) => {
  // 🏢 ENTERPRISE: i18n hook for translations
  const { t } = useTranslation('building');
  const iconSizes = useIconSizes();
  const { createBorder, quick } = useBorderTokens();

  // 🏢 ENTERPRISE: Translate title if it's an i18n key
  const translateTitle = (titleProp: string): string => {
    if (titleProp.includes('.')) {
      const translated = t(titleProp);
      return translated === titleProp ? titleProp : translated;
    }
    return titleProp;
  };

  const translatedTitle = translateTitle(title);

  // 🏢 ENTERPRISE: Icon resolution - supports string names and React components
  // String icons are resolved via centralized IconMapping
  const FallbackIcon = () => <span className={`${iconSizes.xl3} text-muted-foreground mb-2 text-4xl`}>📦</span>;
  const IconComponent = typeof Icon === 'string'
    ? getIconComponent(Icon)
    : Icon || FallbackIcon;

  return (
    <section className={`flex flex-col items-center justify-center ${iconSizes.xl12} ${createBorder('medium', 'hsl(var(--border))', 'dashed')} ${quick.card} bg-muted/50`}>
      <IconComponent className={`${iconSizes.xl3} text-muted-foreground mb-2`} />
      <h2 className="text-xl font-semibold text-muted-foreground mb-2">{translatedTitle}</h2>
      <p className="text-sm text-muted-foreground text-center max-w-md">
        {t('placeholder.comingSoon', { title: translatedTitle.toLowerCase() })}
      </p>
      <Button variant="outline" className="mt-2">
        <Plus className={`${iconSizes.sm} mr-2`} />
        {t('placeholder.add', { title: translatedTitle })}
      </Button>
    </section>
  );
};

export default PlaceholderTab;
