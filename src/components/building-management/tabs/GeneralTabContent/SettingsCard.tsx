'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Settings } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';

export function SettingsCard() {
  // 🏢 ENTERPRISE: i18n hook for translations
  const { t } = useTranslation('building');
  const iconSizes = useIconSizes();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className={iconSizes.md} />
          {t('tabs.general.settings.title')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center space-x-2">
          <Checkbox id="show-on-web" />
          <Label htmlFor="show-on-web">{t('tabs.general.settings.showOnWeb')}</Label>
        </div>
      </CardContent>
    </Card>
  );
}
