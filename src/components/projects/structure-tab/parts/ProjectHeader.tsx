'use client';

import React from 'react';
// 🏢 ENTERPRISE: Using centralized entity config for Building icon
import { NAVIGATION_ENTITIES } from '@/components/navigation/config/navigation-entities';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { useTypography } from '@/hooks/useTypography';
import { useIconSizes } from '@/hooks/useIconSizes';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface ProjectHeaderProps {
  name: string;
  buildingsCount: number;
  totalUnits: number;
}

export function ProjectHeader({ name, buildingsCount, totalUnits }: ProjectHeaderProps) {
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation('projects');
  const colors = useSemanticColors();
  const spacing = useSpacingTokens();
  const typography = useTypography();
  const iconSizes = useIconSizes();

  return (
    <div className={cn("flex items-center", spacing.gap.sm, spacing.padding.md, colors.bg.infoSubtle, "rounded-lg border")}>
      <NAVIGATION_ENTITIES.building.icon className={cn(NAVIGATION_ENTITIES.building.color, iconSizes.lg)} />
      <div>
        <div className={cn(typography.heading.sm, colors.text.foreground)}>{name}</div>
        <div className={cn(typography.body.sm, colors.text.muted)}>
          {t('structure.buildingsCount', { count: buildingsCount })} • {t('structure.unitsCount', { count: totalUnits })}
        </div>
      </div>
    </div>
  );
}
