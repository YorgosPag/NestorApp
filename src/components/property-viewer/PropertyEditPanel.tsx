'use client';

import React from 'react';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface PropertyEditPanelProps {
    selectedPolygonId: string | null;
}

export function PropertyEditPanel({ selectedPolygonId }: PropertyEditPanelProps) {
    // 🏢 ENTERPRISE: i18n hook
    const { t } = useTranslation('properties');

    return (
        <div className="space-y-4">
            <h4 className="font-medium">{t('editPanel.title')}</h4>
            {selectedPolygonId ? (
                <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                        {t('editPanel.selected')} {selectedPolygonId}
                    </p>
                    {/* Property editing controls will go here */}
                </div>
            ) : (
                <p className="text-sm text-muted-foreground">
                    {t('editPanel.selectToEdit')}
                </p>
            )}
        </div>
    );
}
