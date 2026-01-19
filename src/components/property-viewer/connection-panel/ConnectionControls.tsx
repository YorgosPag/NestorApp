'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Link2, X, Trash2, Plus } from 'lucide-react';
import type { Connection, ConnectionType } from '@/types/connections';
import { useIconSizes } from '@/hooks/useIconSizes';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface ConnectionControlsProps {
    connectionType: ConnectionType;
    setConnectionType: (type: ConnectionType) => void;
    isConnecting: boolean;
    toggleConnectionMode: () => void;
    selectedPropertyIds: string[];
    createGroup: () => void;
    connections: Connection[];
    clearConnections: () => void;
}

export function ConnectionControls({
    connectionType,
    setConnectionType,
    isConnecting,
    toggleConnectionMode,
    selectedPropertyIds,
    createGroup,
    connections,
    clearConnections,
}: ConnectionControlsProps) {
    const iconSizes = useIconSizes();
    // 🏢 ENTERPRISE: i18n hook
    const { t } = useTranslation('properties');

    return (
        <div className="space-y-2">
             <div className="space-y-2">
                <Label htmlFor="connection-type" className="text-xs">
                    {t('connectionPanel.controls.typeLabel')}
                </Label>
                <Select value={connectionType} onValueChange={(v) => setConnectionType(v as ConnectionType)}>
                    <SelectTrigger id="connection-type">
                        <SelectValue placeholder={t('connectionPanel.controls.typePlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="related">{t('connectionPanel.controls.types.related')}</SelectItem>
                        <SelectItem value="sameBuilding">{t('connectionPanel.controls.types.sameBuilding')}</SelectItem>
                        <SelectItem value="sameFloor">{t('connectionPanel.controls.types.sameFloor')}</SelectItem>
                        <SelectItem value="parking">{t('connectionPanel.controls.types.parking')}</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <Button onClick={toggleConnectionMode} className="w-full" variant={isConnecting ? "destructive" : "default"}>
                {isConnecting ? <X className={`mr-2 ${iconSizes.sm}`}/> : <Link2 className={`mr-2 ${iconSizes.sm}`}/>}
                {isConnecting ? t('connectionPanel.controls.cancelConnection') : t('connectionPanel.controls.newConnection')}
            </Button>

            <Button onClick={createGroup} className="w-full" variant="outline" disabled={selectedPropertyIds.length < 2}>
                <Plus className={`mr-2 ${iconSizes.sm}`}/>
                {t('connectionPanel.controls.createGroup', { count: selectedPropertyIds.length })}
            </Button>

            <Button onClick={clearConnections} className="w-full" variant="outline" disabled={connections.length === 0}>
                <Trash2 className={`mr-2 ${iconSizes.sm}`}/>
                {t('connectionPanel.controls.clearConnections')}
            </Button>
        </div>
    );
}