'use client';

import React from 'react';
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from '@/lib/utils';
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/hooks/useSemanticColors';
import type { Storage } from '@/types/storage/contracts';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('StorageListItem');

import { StorageListItemHeader } from './ListItem/StorageListItemHeader_old';
import { StorageListItemStats } from './ListItem/StorageListItemStats_old';
import { StorageListItemFooter } from './ListItem/StorageListItemFooter_old';
import { StorageListItemActions } from './ListItem/StorageListItemActions_old';

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
    const { quick, getStatusBorder } = useBorderTokens();
    const colors = useSemanticColors();

    return (
        <TooltipProvider>
            <div
                className={cn(
                    `relative p-3 ${quick.card} border cursor-pointer group`,
                    INTERACTIVE_PATTERNS.CARD_STANDARD,
                    isSelected
                    ? `${getStatusBorder('info')} ${colors.bg.info} shadow-sm`
                    : cn("border-border bg-card", INTERACTIVE_PATTERNS.BORDER_BLUE, INTERACTIVE_PATTERNS.ACCENT_HOVER_SUBTLE)
                )}
                onClick={onSelect}
            >
                <StorageListItemActions
                    isFavorite={isFavorite}
                    onToggleFavorite={onToggleFavorite}
                    onEdit={() => logger.info('Edit clicked')}
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