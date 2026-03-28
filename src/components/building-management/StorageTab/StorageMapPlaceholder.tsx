'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MapPin } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import '@/lib/design-system';

export function StorageMapPlaceholder() {
    // 🏢 ENTERPRISE: i18n hook for translations
    const { t } = useTranslation('building');
    const colors = useSemanticColors();
    const iconSizes = useIconSizes();
    const { quick } = useBorderTokens();
    return (
        <Card>
            <CardHeader>
                <CardTitle>{t('storageMap.title')}</CardTitle>
            </CardHeader>
            <CardContent>
                <section className={`${iconSizes.xl12} bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg border border-dashed ${quick.muted} flex items-center justify-center`}>
                    <div className="text-center">
                        <MapPin className={`${iconSizes.xl3} ${colors.text.muted} mx-auto mb-2`} />
                        <p className={colors.text.muted}>{t('storageMap.description')}</p>
                        <p className={cn("text-sm mt-2", colors.text.muted)}>{t('storageMap.comingSoon')}</p>
                    </div>
                </section>
            </CardContent>
        </Card>
    );
}