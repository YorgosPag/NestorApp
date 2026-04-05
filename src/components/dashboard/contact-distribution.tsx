"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ThemeProgressBar } from "@/core/progress/ThemeProgressBar";
import { User, Building2, Landmark } from "lucide-react";
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import '@/lib/design-system';

export function ContactDistribution() {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const { t } = useTranslation('dashboard');
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('contactDistribution.title')}</CardTitle>
        <CardDescription>{t('contactDistribution.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User className={`${iconSizes.sm} ${colors.text.info}`} />
                <span className="text-sm font-medium">{t('contactDistribution.individuals')}</span>
              </div>
              <span className={`text-sm ${colors.text.muted}`}>
                856 (68.6%)
              </span>
            </div>
            <ThemeProgressBar
              progress={68.6}
              label=""
              size="sm"
              showPercentage={false}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className={`${iconSizes.sm} ${colors.text.accent}`} />
                <span className="text-sm font-medium">{t('contactDistribution.companies')}</span>
              </div>
              <span className={`text-sm ${colors.text.muted}`}>312 (25%)</span>
            </div>
            <ThemeProgressBar
              progress={25}
              label=""
              size="sm"
              showPercentage={false}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Landmark className={`${iconSizes.sm} ${colors.text.success}`} />
                <span className="text-sm font-medium">{t('contactDistribution.services')}</span>
              </div>
              <span className={`text-sm ${colors.text.muted}`}>79 (6.4%)</span>
            </div>
            <ThemeProgressBar
              progress={6.4}
              label=""
              size="sm"
              showPercentage={false}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
