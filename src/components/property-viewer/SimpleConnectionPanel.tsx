'use client';

import React from 'react';
import type { Property } from '@/types/property-viewer';
import type { Connection, PropertyGroup } from '@/types/connections';
import { useConnectionPanelState } from '@/hooks/useConnectionPanelState';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';

import { ConnectionControls } from './connection-panel/ConnectionControls';
import { GroupManager } from './connection-panel/GroupManager';
import { Legend } from './connection-panel/Legend';

interface SimpleConnectionPanelProps {
    properties: Property[];
    selectedPropertyIds: string[];
    connections: Connection[];
    setConnections: React.Dispatch<React.SetStateAction<Connection[]>>;
    groups: PropertyGroup[];
    setGroups: React.Dispatch<React.SetStateAction<PropertyGroup[]>>;
    isConnecting: boolean;
    setIsConnecting: React.Dispatch<React.SetStateAction<boolean>>;
}

export function SimpleConnectionPanel(props: SimpleConnectionPanelProps) {
    const {
        connectionType,
        setConnectionType,
        toggleConnectionMode,
        createGroup,
        clearConnections,
        deleteGroup
    } = useConnectionPanelState(props);
    // 🏢 ENTERPRISE: i18n hook
    const { t } = useTranslation('properties');

    return (
        <div className="space-y-4">
            <h4 className="font-semibold text-sm">{t('connectionPanel.title')}</h4>
            
            <ConnectionControls 
                connectionType={connectionType}
                setConnectionType={setConnectionType}
                isConnecting={props.isConnecting}
                toggleConnectionMode={toggleConnectionMode}
                selectedPropertyIds={props.selectedPropertyIds}
                createGroup={createGroup}
                connections={props.connections}
                clearConnections={clearConnections}
            />
            
            <GroupManager 
                groups={props.groups}
                onDelete={deleteGroup}
            />
            
            <Legend />
        </div>
    );
}