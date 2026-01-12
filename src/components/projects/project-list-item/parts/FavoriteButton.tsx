
'use client';

import React from 'react';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GROUP_HOVER_PATTERNS, HOVER_TEXT_EFFECTS } from '@/components/ui/effects';
import { useIconSizes } from '@/hooks/useIconSizes';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface FavoriteButtonProps {
    isFavorite: boolean;
    onToggleFavorite: () => void;
}

export function FavoriteButton({ isFavorite, onToggleFavorite }: FavoriteButtonProps) {
    // 🏢 ENTERPRISE: i18n hook for translations
    const { t } = useTranslation('common');
    const iconSizes = useIconSizes();
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onToggleFavorite();
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    className={`absolute top-2 right-2 opacity-0 ${GROUP_HOVER_PATTERNS.SHOW_ON_GROUP} transition-opacity z-10 p-1`}
                    aria-label={isFavorite ? t('favorites.remove') : t('favorites.add')}
                >
                    <Star
                        className={cn(
                            `${iconSizes.sm} transition-colors`,
                            isFavorite
                            ? "text-yellow-500 fill-yellow-500"
                            : `text-gray-400 ${HOVER_TEXT_EFFECTS.YELLOW}`
                        )}
                    />
                </button>
            </TooltipTrigger>
            <TooltipContent>
                <p>{isFavorite ? t('favorites.remove') : t('favorites.add')}</p>
            </TooltipContent>
        </Tooltip>
    );
}
