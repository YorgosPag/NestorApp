'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Ruler, ZoomIn, ZoomOut } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface MapControlsProps {
    showNearbyProjects: boolean;
    setShowNearbyProjects: (show: boolean) => void;
    selectedLayer: 'all' | 'active' | 'completed';
    setSelectedLayer: (layer: 'all' | 'active' | 'completed') => void;
}

export function MapControls({
    showNearbyProjects,
    setShowNearbyProjects,
    selectedLayer,
    setSelectedLayer,
}: MapControlsProps) {
    // 🏢 ENTERPRISE: i18n hook for translations
    const { t } = useTranslation('building');
    const iconSizes = useIconSizes();
    return (
        <div className="mt-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
                <div className="flex items-center gap-2">
                    <Checkbox
                        id="nearby-projects"
                        checked={!!showNearbyProjects}
                        onCheckedChange={(checked) => setShowNearbyProjects(!!checked)}
                    />
                    <Label htmlFor="nearby-projects" className="text-sm">
                        {t('tabs.map.controls.showNearby')}
                    </Label>
                </div>

                <div className="flex items-center gap-2">
                    <Label className="text-sm">{t('tabs.map.controls.filter')}</Label>
                    <Select value={selectedLayer} onValueChange={(value) => setSelectedLayer(value as 'all' | 'active' | 'completed')}>
                        <SelectTrigger className={`w-[180px] ${iconSizes.xl} text-sm`}>
                            <SelectValue placeholder={t('tabs.map.controls.selectFilter')} />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">{t('filters.allProjects')}</SelectItem>
                            <SelectItem value="active">{t('tabs.map.controls.activeOnly')}</SelectItem>
                            <SelectItem value="completed">{t('tabs.map.controls.completedOnly')}</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="flex items-center gap-2">
                <Button variant="outline" size="sm">
                    <ZoomIn className={`${iconSizes.sm} mr-2`} /> {t('tabs.map.controls.zoomIn')}
                </Button>
                <Button variant="outline" size="sm">
                    <ZoomOut className={`${iconSizes.sm} mr-2`} /> {t('tabs.map.controls.zoomOut')}
                </Button>
                <Button variant="outline" size="sm">
                    <Ruler className={`${iconSizes.sm} mr-2`} /> {t('tabs.map.controls.measureDistance')}
                </Button>
            </div>
        </div>
    );
}
