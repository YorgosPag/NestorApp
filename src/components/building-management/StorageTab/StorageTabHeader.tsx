'use client';

import React from 'react';
import { Button } from "@/components/ui/button";
import { Archive, Plus, MapPin, Package } from 'lucide-react';
import type { StorageType } from '@/types/storage';

interface StorageTabHeaderProps {
    buildingName: string;
    viewMode: 'list' | 'map';
    onSetViewMode: (mode: 'list' | 'map') => void;
    onAddNew: (type: StorageType) => void;
}

export function StorageTabHeader({
    buildingName,
    viewMode,
    onSetViewMode,
    onAddNew,
}: StorageTabHeaderProps) {
    return (
        <div className="flex items-center justify-between">
            <div>
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Archive className="w-5 h-5" />
                    Αποθήκες & Parking
                </h3>
                <p className="text-sm text-muted-foreground">
                    Διαχείριση αποθηκών και θέσεων στάθμευσης του κτιρίου {buildingName}
                </p>
            </div>
            <div className="flex items-center gap-2">
                <Button
                    variant={viewMode === 'list' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => onSetViewMode('list')}
                >
                    <Package className="w-4 h-4 mr-2" /> Λίστα
                </Button>
                <Button
                    variant={viewMode === 'map' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => onSetViewMode('map')}
                >
                    <MapPin className="w-4 h-4 mr-2" /> Χάρτης
                </Button>
                <Button onClick={() => onAddNew('storage')} className="bg-blue-600 hover:bg-blue-700">
                    <Plus className="w-4 h-4 mr-2" />
                    Νέα Αποθήκη
                </Button>
                <Button onClick={() => onAddNew('parking')} className="bg-orange-600 hover:bg-orange-700">
                    <Plus className="w-4 h-4 mr-2" />
                    Νέα Θέση Στάθμευσης
                </Button>
            </div>
        </div>
    );
}