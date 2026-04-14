'use client';

import React from 'react';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
import '@/lib/design-system';

interface PropertyEditPanelProps {
    selectedPolygonId: string | null;
}

export function PropertyEditPanel({ selectedPolygonId }: PropertyEditPanelProps) {
    // 🏢 ENTERPRISE: i18n hook
    const { t } = useTranslation(['properties', 'properties-detail', 'properties-enums', 'properties-viewer']);
    const colors = useSemanticColors();

    return (
        <div className="space-y-4">
            <h4 className="font-medium">{t('editPanel.title')}</h4>
            {selectedPolygonId ? (
                <div className="space-y-3">
                    <p className={cn("text-sm", colors.text.muted)}>
                        {t('editPanel.selected')} {selectedPolygonId}
                    </p>
                    {/* Property editing controls will go here */}
                </div>
            ) : (
                <p className={cn("text-sm", colors.text.muted)}>
                    {t('editPanel.selectToEdit')}
                </p>
            )}
        </div>
    );
}
