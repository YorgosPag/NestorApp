"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ThemeProgressBar } from "@/core/progress/ThemeProgressBar";
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
import '@/lib/design-system';

export function StorageInfo() {
  // 🏢 ENTERPRISE: i18n support
  const { t } = useTranslation(['common', 'common-account', 'common-actions', 'common-empty-states', 'common-navigation', 'common-photos', 'common-sales', 'common-shared', 'common-status', 'common-validation']);
  const colors = useSemanticColors();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('storage.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span>{t('storage.used')}</span>
            <span className="font-medium">2.4 GB / 10 GB</span>
          </div>
          <ThemeProgressBar
            progress={24}
            label=""
            size="sm"
            showPercentage={false}
          />
          <p className={cn("text-xs", colors.text.muted)}>
            {t('storage.availableSpace', { size: '7.6 GB' })}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
