'use client';

import React from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import type { StorageUnit, StorageType, StorageStatus } from '@/types/storage';
import { StorageCardBackground } from './StorageCardBackground';
import { StorageCardActions } from './StorageCardActions';
import { StorageCardStatus } from './StorageCardStatus';

interface StorageCardHeaderProps {
    unit: StorageUnit;
    isSelected: boolean;
    isFavorite: boolean;
    onSelect: () => void;
    onEdit: () => void;
    onDelete: () => void;
    onToggleFavorite: () => void;
    getStatusColor: (status: StorageStatus) => string;
    getStatusLabel: (status: StorageStatus) => string;
    getTypeLabel: (type: StorageType) => string;
}

export function StorageCardHeader({
    unit,
    isSelected,
    isFavorite,
    onSelect,
    onEdit,
    onDelete,
    onToggleFavorite,
    getStatusColor,
    getStatusLabel,
    getTypeLabel
}: StorageCardHeaderProps) {
    return (
        <>
            <div className="absolute top-3 left-3 z-20">
                <Checkbox
                    checked={isSelected}
                    onCheckedChange={onSelect}
                    className="bg-white/80 backdrop-blur-sm"
                />
            </div>

            <div className="h-24 relative overflow-hidden group">
                <StorageCardBackground type={unit.type} />
                <StorageCardActions
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onToggleFavorite={onToggleFavorite}
                    isFavorite={isFavorite}
                />
                <StorageCardStatus
                    unit={unit}
                    isFavorite={isFavorite}
                    getStatusColor={getStatusColor}
                    getStatusLabel={getStatusLabel}
                    getTypeLabel={getTypeLabel}
                />
                {isSelected && (
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary to-purple-500" />
                )}
            </div>
        </>
    );
}
