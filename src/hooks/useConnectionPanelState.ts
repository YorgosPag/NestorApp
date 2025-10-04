'use client';

import { useState } from 'react';
import type { Connection, ConnectionType, PropertyGroup } from '@/types/connections';
import { useToast } from '@/hooks/useToast';

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
    const { toast } = useToast();
    const [connectionType, setConnectionType] = useState<ConnectionType>('related');

    const toggleConnectionMode = () => {
        setIsConnecting(!isConnecting);
        if (!isConnecting) {
            toast({ title: "Ενεργοποίηση Σύνδεσης", description: "Επιλέξτε δύο ακίνητα για να τα συνδέσετε."});
        } else {
            toast({ title: "Απενεργοποίηση Σύνδεσης", variant: "info" });
        }
    };

    const createGroup = () => {
        const groupName = prompt('Εισάγετε όνομα για την ομάδα:');
        if (!groupName) return;

        if (selectedPropertyIds.length < 2) {
            toast({ title: "Αποτυχία Ομαδοποίησης", description: "Πρέπει να επιλέξετε τουλάχιστον 2 ακίνητα.", variant: "error" });
            return;
        }

        const newGroup: PropertyGroup = {
            id: `group_${Date.now()}`,
            name: groupName,
            propertyIds: selectedPropertyIds,
            color: '#3B82F6',
        };

        setGroups(prev => [...prev, newGroup]);
        toast({ title: "Επιτυχία", description: `Η ομάδα "${groupName}" δημιουργήθηκε.`});
    };

    const clearConnections = () => {
        setConnections([]);
        toast({ title: "Επιτυχία", description: "Όλες οι συνδέσεις διαγράφηκαν."});
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