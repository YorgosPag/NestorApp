'use client';

import React from 'react';
import { Button } from "@/components/ui/button";
import { Archive, Plus, MapPin, Package } from 'lucide-react';
import { HOVER_BACKGROUND_EFFECTS } from '@/components/ui/effects';
import { useIconSizes } from '@/hooks/useIconSizes';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface StorageTabHeaderProps {
    buildingName: string;
    viewMode: 'list' | 'map';
    onSetViewMode: (mode: 'list' | 'map') => void;
    onAddNew: () => void;
}

export function StorageTabHeader({
    buildingName,
    viewMode,
    onSetViewMode,
    onAddNew,
}: StorageTabHeaderProps) {
    // 🏢 ENTERPRISE: i18n hook for translations
    const { t } = useTranslation('building');
    const iconSizes = useIconSizes();

    return (
        <header className="flex items-center justify-between">
            <div>
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Archive className={iconSizes.md} />
                    {t('storageTabHeader.title')}
                </h3>
                <p className="text-sm text-muted-foreground">
                    {t('storageTabHeader.description', { buildingName })}
                </p>
            </div>
            <nav className="flex items-center gap-2">
                <Button
                    variant={viewMode === 'list' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => onSetViewMode('list')}
                >
                    <Package className={`${iconSizes.sm} mr-2`} /> {t('storageTabHeader.listView')}
                </Button>
                <Button
                    variant={viewMode === 'map' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => onSetViewMode('map')}
                >
                    <MapPin className={`${iconSizes.sm} mr-2`} /> {t('storageTabHeader.mapView')}
                </Button>
                <Button onClick={onAddNew} className={`bg-blue-600 ${HOVER_BACKGROUND_EFFECTS.BLUE_BUTTON}`}>
                    <Plus className={`${iconSizes.sm} mr-2`} />
                    {t('storageTabHeader.newStorage')}
                </Button>
            </nav>
        </header>
    );
}