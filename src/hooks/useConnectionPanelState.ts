'use client';

import { useState } from 'react';
import type { Connection, ConnectionType, PropertyGroup } from '@/types/connections';
import { useNotifications } from '@/providers/NotificationProvider';
import { CONNECTION_DEFAULTS } from '@/config/connection-config';

interface UseConnectionPanelStateProps {
    selectedPropertyIds: string[];
    setConnections: React.Dispatch<React.SetStateAction<Connection[]>>;
    setGroups: React.Dispatch<React.SetStateAction<PropertyGroup[]>>;
    isConnecting: boolean;
    setIsConnecting: React.Dispatch<React.SetStateAction<boolean>>;
}

export function useConnectionPanelState({
    selectedPropertyIds,
    setConnections,
    setGroups,
    isConnecting,
    setIsConnecting,
}: UseConnectionPanelStateProps) {
    const notifications = useNotifications();
    const [connectionType, setConnectionType] = useState<ConnectionType>('related');

    const toggleConnectionMode = () => {
        setIsConnecting(!isConnecting);
        if (!isConnecting) {
            notifications.info('✏️ Ενεργοποίηση Σύνδεσης: Επιλέξτε δύο ακίνητα για να τα συνδέσετε');
        } else {
            notifications.info('❌ Απενεργοποίηση Σύνδεσης');
        }
    };

    const createGroup = () => {
        const groupName = prompt('Εισάγετε όνομα για την ομάδα:');
        if (!groupName) return;

        if (selectedPropertyIds.length < 2) {
            notifications.error('❌ Αποτυχία Ομαδοποίησης: Πρέπει να επιλέξετε τουλάχιστον 2 ακίνητα');
            return;
        }

        const newGroup: PropertyGroup = {
            id: `group_${Date.now()}`,
            name: groupName,
            propertyIds: selectedPropertyIds,
            color: CONNECTION_DEFAULTS.propertyGroupColor,
        };

        setGroups(prev => [...prev, newGroup]);
        notifications.success(`✅ Η ομάδα "${groupName}" δημιουργήθηκε`);
    };

    const clearConnections = () => {
        setConnections([]);
        notifications.success('✅ Όλες οι συνδέσεις διαγράφηκαν');
    };
    
    const deleteGroup = (groupId: string) => {
        setGroups(prev => prev.filter(g => g.id !== groupId));
    };

    return {
        connectionType,
        setConnectionType,
        toggleConnectionMode,
        createGroup,
        clearConnections,
        deleteGroup,
    };
}
