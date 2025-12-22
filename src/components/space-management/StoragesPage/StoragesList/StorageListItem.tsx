'use client';

import React from 'react';
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from '@/lib/utils';
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';
import type { Storage } from '@/types/storage/contracts';

import { StorageListItemHeader } from './ListItem/StorageListItemHeader';
import { StorageListItemStats } from './ListItem/StorageListItemStats';
import { StorageListItemFooter } from './ListItem/StorageListItemFooter';
import { StorageListItemActions } from './ListItem/StorageListItemActions';

interface StorageListItemProps {
  storage: Storage;
  isSelected: boolean;
  isFavorite: boolean;
  onSelect: () => void;
  onToggleFavorite: () => void;
}

export function StorageListItem({
    storage,
    isSelected,
    isFavorite,
    onSelect,
    onToggleFavorite
}: StorageListItemProps) {

    return (
        <TooltipProvider>
            <div
                className={cn(
                    "relative p-3 rounded-lg border cursor-pointer group",
                    INTERACTIVE_PATTERNS.CARD_STANDARD,
                    isSelected
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20 shadow-sm"
                    : cn("border-border bg-card", INTERACTIVE_PATTERNS.BORDER_BLUE, INTERACTIVE_PATTERNS.ACCENT_HOVER_SUBTLE)
                )}
                onClick={onSelect}
            >
                <StorageListItemActions
                    isFavorite={isFavorite}
                    onToggleFavorite={onToggleFavorite}
                    onEdit={() => console.log('Edit clicked')}
                />

                <StorageListItemHeader storage={storage} />

                <StorageListItemStats storage={storage} />

                <StorageListItemFooter
                    lastUpdated={storage.lastUpdated}
                    owner={storage.owner}
                />

                {isSelected && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-r-full" />
                )}
            </div>
        </TooltipProvider>
    );
}