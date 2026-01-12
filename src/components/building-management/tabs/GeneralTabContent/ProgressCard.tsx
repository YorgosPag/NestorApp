'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CommonBadge } from '@/core/badges';
import { ThemeProgressBar } from '@/core/progress/ThemeProgressBar';
import { TrendingUp } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface ProgressCardProps {
    progress: number;
}

export function ProgressCard({ progress }: ProgressCardProps) {
  // 🏢 ENTERPRISE: i18n hook for translations
  const { t } = useTranslation('building');
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className={iconSizes.md} />
          {t('tabs.general.progress.title')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>{t('tabs.general.progress.completionPercentage')}</Label>
            <CommonBadge
              status="building"
              customLabel={t('tabs.general.progress.completed', { percent: progress })}
              className={`${colors.bg.info} ${colors.text.info}`}
            />
          </div>
          <ThemeProgressBar
            progress={progress}
            label={t('tabs.general.progress.completionPercentage')}
            size="md"
            showPercentage={false}
          />

          <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-xs">
            <div className={cn("p-2 rounded text-center", progress >= 25 ? `${colors.bg.success} ${colors.text.success}` : `${colors.bg.secondary} ${colors.text.muted}`)}>
              <div className="font-medium">{t('tabs.general.progress.phases.foundations')}</div>
              <div>0-25%</div>
            </div>
            <div className={cn("p-2 rounded text-center", progress >= 50 ? `${colors.bg.success} ${colors.text.success}` : `${colors.bg.secondary} ${colors.text.muted}`)}>
              <div className="font-medium">{t('tabs.general.progress.phases.construction')}</div>
              <div>25-50%</div>
            </div>
            <div className={cn("p-2 rounded text-center", progress >= 75 ? `${colors.bg.success} ${colors.text.success}` : `${colors.bg.secondary} ${colors.text.muted}`)}>
              <div className="font-medium">{t('tabs.general.progress.phases.finishing')}</div>
              <div>50-75%</div>
            </div>
            <div className={cn("p-2 rounded text-center", progress >= 100 ? `${colors.bg.success} ${colors.text.success}` : `${colors.bg.secondary} ${colors.text.muted}`)}>
              <div className="font-medium">{t('tabs.general.progress.phases.delivery')}</div>
              <div>75-100%</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
