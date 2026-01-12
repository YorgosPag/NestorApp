'use client';

import React from 'react';
import type { Building } from '@/types/building/contracts';
import { Video, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createHoverBorderEffects, GROUP_HOVER_PATTERNS } from '@/components/ui/effects';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface VideosTabContentProps {
  building?: Building;
}

const VideosTabContent = ({ building }: VideosTabContentProps) => {
  // 🏢 ENTERPRISE: i18n hook for translations
  const { t } = useTranslation('building');
  const iconSizes = useIconSizes();
  const borderTokens = useBorderTokens();
  const { quick } = borderTokens;
  const hoverBorderEffects = createHoverBorderEffects(borderTokens);

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{t('videos.title')}</h3>
        <Button>
          <Upload className={`${iconSizes.sm} mr-2`} />
          {t('videos.upload')}
        </Button>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((index) => (
          <article
            key={index}
            className={`aspect-video bg-muted ${quick.card} flex items-center justify-center border border-dashed ${hoverBorderEffects.BLUE} transition-colors cursor-pointer group`}
          >
            <div className="text-center">
              <Video className={`${iconSizes.xl} text-muted-foreground ${GROUP_HOVER_PATTERNS.BLUE_ICON_ON_GROUP} mx-auto mb-2`} />
              <p className="text-sm text-muted-foreground">{t('videos.addVideo')}</p>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
};

export default VideosTabContent;
