'use client';

import React from 'react';
import { User } from 'lucide-react';
import { cn } from '@/lib/utils';
// 🏢 ENTERPRISE: All icons from centralized NAVIGATION_ENTITIES
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
import type { ExtendedPropertyDetails } from '@/types/property-viewer';
import { useIconSizes } from '@/hooks/useIconSizes';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';
// 🏢 ENTERPRISE: Centralized spacing tokens
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import '@/lib/design-system';

interface PropertyContactsProps {
  owner: ExtendedPropertyDetails['owner'];
  agent: ExtendedPropertyDetails['agent'];
}

export function PropertyContacts({ owner, agent }: PropertyContactsProps) {
  const iconSizes = useIconSizes();
  const spacing = useSpacingTokens();
  const colors = useSemanticColors();
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation('properties');

  return (
    <div className={spacing.spaceBetween.sm}>
      {owner && (
        <div className={spacing.spaceBetween.sm}>
          <h4 className={`text-xs font-medium flex items-center ${spacing.gap.sm}`}>
            <User className={iconSizes.xs} />
            {t('contacts.owner')}
          </h4>
          <div className={`${spacing.spaceBetween.sm} ${spacing.padding.left.sm}`}>
            <p className="text-xs">{owner.name}</p>
            {/* 🏢 ENTERPRISE: Using centralized phone icon/color */}
            {owner.phone && (
              <div className={`flex items-center ${spacing.gap.sm} text-xs`}>
                <NAVIGATION_ENTITIES.phone.icon className={cn(iconSizes.xs, NAVIGATION_ENTITIES.phone.color)} />
                <span className={colors.text.muted}>{owner.phone}</span>
              </div>
            )}
            {/* 🏢 ENTERPRISE: Using centralized email icon/color */}
            {owner.email && (
              <div className={`flex items-center ${spacing.gap.sm} text-xs`}>
                <NAVIGATION_ENTITIES.email.icon className={cn(iconSizes.xs, NAVIGATION_ENTITIES.email.color)} />
                <span className={colors.text.muted}>{owner.email}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {agent && (
        <div className={spacing.spaceBetween.sm}>
          <h4 className={`text-xs font-medium flex items-center ${spacing.gap.sm}`}>
            <User className={iconSizes.xs} />
            {t('contacts.agent')}
          </h4>
          <div className={`${spacing.spaceBetween.sm} ${spacing.padding.left.sm}`}>
            <p className="text-xs">{agent.name}</p>
            {/* 🏢 ENTERPRISE: Using centralized phone icon/color */}
            {agent.phone && (
              <div className={`flex items-center ${spacing.gap.sm} text-xs`}>
                <NAVIGATION_ENTITIES.phone.icon className={cn(iconSizes.xs, NAVIGATION_ENTITIES.phone.color)} />
                <span className={colors.text.muted}>{agent.phone}</span>
              </div>
            )}
            {/* 🏢 ENTERPRISE: Using centralized email icon/color */}
            {agent.email && (
              <div className={`flex items-center ${spacing.gap.sm} text-xs`}>
                <NAVIGATION_ENTITIES.email.icon className={cn(iconSizes.xs, NAVIGATION_ENTITIES.email.color)} />
                <span className={colors.text.muted}>{agent.email}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
