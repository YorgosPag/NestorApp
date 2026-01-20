'use client';

import React from 'react';
import { PageHeader } from '@/core/headers';
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
import { CommonBadge } from '@/core/badges';
import type { ViewMode } from '@/core/headers';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface PropertyPageHeaderProps {
  showDashboard: boolean;
  setShowDashboard: (show: boolean) => void;
  viewMode: 'list' | 'grid';
  setViewMode: (mode: 'list' | 'grid') => void;
}

export function PropertyPageHeader({
  showDashboard,
  setShowDashboard,
  viewMode,
  setViewMode
}: PropertyPageHeaderProps) {
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation('properties');

  return (
    <PageHeader
      variant="static"
      layout="single-row"
      title={{
        icon: NAVIGATION_ENTITIES.unit.icon,
        title: t('header.title'),
        badge: (
          <CommonBadge
            status="property"
            customLabel={t('header.subtitle')}
            variant="secondary"
            className="text-xs"
          />
        )
      }}
      actions={{
        showDashboard,
        onDashboardToggle: () => setShowDashboard(!showDashboard),
        viewMode: viewMode as ViewMode,
        onViewModeChange: (mode) => setViewMode(mode as 'list' | 'grid'),
        addButton: {
          label: t('header.newProperty'),
          onClick: () => console.log('Add property')
        }
      }}
    />
  );
}
