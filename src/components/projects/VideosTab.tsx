'use client';

import React from 'react';
import { Video, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createHoverBorderEffects, GROUP_HOVER_PATTERNS } from '@/components/ui/effects';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';

export function VideosTab() {
    // 🏢 ENTERPRISE: i18n hook
    const { t } = useTranslation('projects');
    const iconSizes = useIconSizes();
    const borderTokens = useBorderTokens();
    const hoverBorderEffects = createHoverBorderEffects(borderTokens);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">{t('videosTab.title')}</h3>
                <Button>
                    <Upload className={`${iconSizes.sm} mr-2`} />
                    {t('videosTab.uploadVideo')}
                </Button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map((index) => (
                    <div
                        key={index}
                        className={`aspect-video bg-muted rounded-lg flex items-center justify-center border border-dashed border-border ${hoverBorderEffects.BLUE} transition-colors cursor-pointer group`}
                    >
                        <div className="text-center">
                            <Video className={`${iconSizes.xl} text-muted-foreground ${GROUP_HOVER_PATTERNS.BLUE_ICON_ON_GROUP} mx-auto mb-2`} />
                            <p className="text-sm text-muted-foreground">{t('videosTab.addVideo')}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
