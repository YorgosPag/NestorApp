'use client';

import React from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { UnifiedDashboard, type DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
import {
  Users,
  Wifi,
  Coffee,
  Dumbbell,
  Trees,
  Shield,
  Building,
  TrendingUp,
} from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';

export default function CommonSpacesPage() {
  const iconSizes = useIconSizes();
  const { quick } = useBorderTokens();
  const colors = useSemanticColors();
  // 🏢 ENTERPRISE: i18n support
  const { t } = useTranslation('common');

  // Placeholder stats for Common Spaces - inside component for i18n access
  const commonStats: DashboardStat[] = [
    {
      title: t('spaces.commonSpaces.stats.commonSpaces'),
      value: '42',
      description: t('spaces.commonSpaces.stats.allCommonSpaces'),
      icon: Users,
      color: 'blue',
      trend: { value: 0, label: t('spaces.commonSpaces.stats.stable') }
    },
    {
      title: t('spaces.commonSpaces.stats.recreationSpaces'),
      value: '18',
      description: t('spaces.commonSpaces.stats.recreationDesc'),
      icon: Coffee,
      color: 'green',
      trend: { value: 0, label: t('spaces.commonSpaces.stats.stable') }
    },
    {
      title: t('spaces.commonSpaces.stats.serviceSpaces'),
      value: '16',
      description: t('spaces.commonSpaces.stats.serviceDesc'),
      icon: Shield,
      color: 'purple',
      trend: { value: 0, label: t('spaces.commonSpaces.stats.stable') }
    },
    {
      title: t('spaces.commonSpaces.stats.outdoorSpaces'),
      value: '8',
      description: t('spaces.commonSpaces.stats.outdoorDesc'),
      icon: Trees,
      color: 'orange',
      trend: { value: 0, label: t('spaces.commonSpaces.stats.stable') }
    }
  ];
  return (
    <TooltipProvider>
      <div className={`flex h-screen ${colors.bg.primary}`}>
        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className={`border-b ${colors.bg.primary}/95 backdrop-blur supports-[backdrop-filter]:${colors.bg.primary}/60`}>
            <div className="flex h-14 items-center px-4">
              <div className="flex items-center gap-2">
                <Users className={`${iconSizes.md} text-muted-foreground`} />
                <h1 className="text-lg font-semibold">{t('spaces.commonSpaces.headerTitle')}</h1>
              </div>
              <div className="ml-auto text-sm text-muted-foreground">
                {t('spaces.commonSpaces.headerSubtitle')}
              </div>
            </div>
          </div>

          {/* Dashboard Stats */}
          <div className="p-6 space-y-6">
            <UnifiedDashboard
              title={t('spaces.commonSpaces.title')}
              stats={commonStats}
              variant="modern"
            />

            {/* Common Areas Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Lounges & Kitchenettes */}
              <div className={`p-6 bg-card ${quick.card} hover:bg-accent/50 transition-colors cursor-pointer`}>
                <div className="flex items-center gap-3 mb-3">
                  <div className={`p-2 ${colors.bg.success}/10 rounded-lg`}>
                    <Coffee className={`${iconSizes.md} ${colors.text.success}`} />
                  </div>
                  <h3 className="font-semibold">{t('spaces.commonSpaces.cards.lounges.title')}</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  {t('spaces.commonSpaces.cards.lounges.description')}
                </p>
                <div className="text-2xl font-bold">12</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('spaces.commonSpaces.cards.lounges.details')}
                </p>
              </div>

              {/* Gyms & Spa */}
              <div className={`p-6 bg-card ${quick.card} hover:bg-accent/50 transition-colors cursor-pointer`}>
                <div className="flex items-center gap-3 mb-3">
                  <div className={`p-2 ${colors.bg.info}/10 rounded-lg`}>
                    <Dumbbell className={`${iconSizes.md} ${colors.text.info}`} />
                  </div>
                  <h3 className="font-semibold">{t('spaces.commonSpaces.cards.gyms.title')}</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  {t('spaces.commonSpaces.cards.gyms.description')}
                </p>
                <div className="text-2xl font-bold">6</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('spaces.commonSpaces.cards.gyms.details')}
                </p>
              </div>

              {/* Technical Spaces */}
              <div className={`p-6 bg-card ${quick.card} hover:bg-accent/50 transition-colors cursor-pointer`}>
                <div className="flex items-center gap-3 mb-3">
                  <div className={`p-2 ${colors.bg.warning}/10 rounded-lg`}>
                    <Shield className={`${iconSizes.md} ${colors.text.warning}`} />
                  </div>
                  <h3 className="font-semibold">{t('spaces.commonSpaces.cards.technical.title')}</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  {t('spaces.commonSpaces.cards.technical.description')}
                </p>
                <div className="text-2xl font-bold">16</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('spaces.commonSpaces.cards.technical.details')}
                </p>
              </div>

              {/* Outdoor Spaces */}
              <div className={`p-6 bg-card ${quick.card} hover:bg-accent/50 transition-colors cursor-pointer`}>
                <div className="flex items-center gap-3 mb-3">
                  <div className={`p-2 ${colors.bg.warning}/10 rounded-lg`}>
                    <Trees className={`${iconSizes.md} ${colors.text.accent}`} />
                  </div>
                  <h3 className="font-semibold">{t('spaces.commonSpaces.cards.outdoor.title')}</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  {t('spaces.commonSpaces.cards.outdoor.description')}
                </p>
                <div className="text-2xl font-bold">8</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('spaces.commonSpaces.cards.outdoor.details')}
                </p>
              </div>
            </div>

            {/* Detailed Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Indoor Common Areas */}
              <section className="space-y-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Users className={iconSizes.md} />
                  {t('spaces.commonSpaces.sections.indoor.title')}
                </h2>

                <div className={`p-6 bg-card ${quick.card}`}>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground flex items-center gap-2">
                        <Coffee className={iconSizes.sm} />
                        {t('spaces.commonSpaces.sections.indoor.commonLounges')}
                      </span>
                      <span className="font-medium">{t('spaces.commonSpaces.sections.spaces', { count: 8 })}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground flex items-center gap-2">
                        <Wifi className={iconSizes.sm} />
                        {t('spaces.commonSpaces.sections.indoor.businessCenters')}
                      </span>
                      <span className="font-medium">{t('spaces.commonSpaces.sections.spaces', { count: 4 })}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground flex items-center gap-2">
                        <Dumbbell className={iconSizes.sm} />
                        {t('spaces.commonSpaces.sections.indoor.gyms')}
                      </span>
                      <span className="font-medium">{t('spaces.commonSpaces.sections.spaces', { count: 6 })}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground flex items-center gap-2">
                        <Building className={iconSizes.sm} />
                        {t('spaces.commonSpaces.sections.indoor.commonRooms')}
                      </span>
                      <span className="font-medium">{t('spaces.commonSpaces.sections.spaces', { count: 16 })}</span>
                    </div>
                  </div>
                </div>
              </section>

              {/* Outdoor & Technical */}
              <section className="space-y-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Shield className={iconSizes.md} />
                  {t('spaces.commonSpaces.sections.outdoorTechnical.title')}
                </h2>

                <div className={`p-6 bg-card ${quick.card}`}>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground flex items-center gap-2">
                        <Trees className={iconSizes.sm} />
                        {t('spaces.commonSpaces.sections.outdoorTechnical.sharedGardens')}
                      </span>
                      <span className="font-medium">{t('spaces.commonSpaces.sections.spaces', { count: 5 })}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground flex items-center gap-2">
                        <Coffee className={iconSizes.sm} />
                        {t('spaces.commonSpaces.sections.outdoorTechnical.terraces')}
                      </span>
                      <span className="font-medium">{t('spaces.commonSpaces.sections.spaces', { count: 3 })}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground flex items-center gap-2">
                        <Shield className={iconSizes.sm} />
                        {t('spaces.commonSpaces.sections.outdoorTechnical.boilerRooms')}
                      </span>
                      <span className="font-medium">{t('spaces.commonSpaces.sections.spaces', { count: 8 })}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground flex items-center gap-2">
                        <Wifi className={iconSizes.sm} />
                        {t('spaces.commonSpaces.sections.outdoorTechnical.mechanical')}
                      </span>
                      <span className="font-medium">{t('spaces.commonSpaces.sections.spaces', { count: 8 })}</span>
                    </div>
                  </div>
                </div>
              </section>
            </div>

            {/* Info Message */}
            <div className={`p-4 bg-muted/50 ${quick.card}`}>
              <div className="flex items-center gap-2 text-sm">
                <Users className={iconSizes.sm} />
                <span className="font-medium">{t('spaces.commonSpaces.info.title')}</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {t('spaces.commonSpaces.info.description')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}