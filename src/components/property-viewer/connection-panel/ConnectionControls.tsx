'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Link2, X, Trash2, Plus } from 'lucide-react';
import type { Connection, ConnectionType } from '@/types/connections';
import { useIconSizes } from '@/hooks/useIconSizes';

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

    return (
        <div className="space-y-2">
             <div className="space-y-2">
                <Label htmlFor="connection-type" className="text-xs">Τύπος Σύνδεσης</Label>
                <Select value={connectionType} onValueChange={(v) => setConnectionType(v as ConnectionType)}>
                    <SelectTrigger id="connection-type">
                        <SelectValue placeholder="Επιλογή τύπου" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="related">Σχετικά</SelectItem>
                        <SelectItem value="sameBuilding">Ίδιο Κτίριο</SelectItem>
                        <SelectItem value="sameFloor">Ίδιος Όροφος</SelectItem>
                        <SelectItem value="parking">Με Parking</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            
            <Button onClick={toggleConnectionMode} className="w-full" variant={isConnecting ? "destructive" : "default"}>
                {isConnecting ? <X className={`mr-2 ${iconSizes.sm}`}/> : <Link2 className={`mr-2 ${iconSizes.sm}`}/>}
                {isConnecting ? 'Ακύρωση Σύνδεσης' : 'Νέα Σύνδεση'}
            </Button>
            
            <Button onClick={createGroup} className="w-full" variant="outline" disabled={selectedPropertyIds.length < 2}>
                <Plus className={`mr-2 ${iconSizes.sm}`}/>
                Δημιουργία Ομάδας ({selectedPropertyIds.length} επιλεγμένα)
            </Button>
            
            <Button onClick={clearConnections} className="w-full" variant="outline" disabled={connections.length === 0}>
                <Trash2 className={`mr-2 ${iconSizes.sm}`}/>
                Καθαρισμός Συνδέσεων
            </Button>
        </div>
    );
}