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

export function StorageInfo() {
  // 🏢 ENTERPRISE: i18n support
  const { t } = useTranslation('common');

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
          <p className="text-xs text-muted-foreground">
            {t('storage.availableSpace', { size: '7.6 GB' })}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
