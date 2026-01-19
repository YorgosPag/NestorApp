
'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Eye, Edit, MoreVertical, Star } from 'lucide-react';
import { GROUP_HOVER_PATTERNS } from '@/components/ui/effects';
import { useIconSizes } from '@/hooks/useIconSizes';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface RowActionsProps {
    isFavorite: boolean;
    onToggleFavorite: () => void;
}

export function RowActions({ isFavorite, onToggleFavorite }: RowActionsProps) {
    // 🏢 ENTERPRISE: i18n hook
    const { t } = useTranslation('projects');
    const iconSizes = useIconSizes();

    return (
        <div className={`absolute bottom-2 right-2 opacity-0 ${GROUP_HOVER_PATTERNS.SHOW_ON_GROUP} transition-opacity`}>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="ghost"
                        size="sm"
                        className={`${iconSizes.lg} p-0`}
                        onMouseDown={(e) => e.stopPropagation()}
                        aria-label={t('rowActions.moreActions')}
                    >
                        <MoreVertical className={iconSizes.xs} />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem><Eye className={`${iconSizes.sm} mr-2`} />{t('card.actions.view')}</DropdownMenuItem>
                    <DropdownMenuItem><Edit className={`${iconSizes.sm} mr-2`} />{t('card.actions.edit')}</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}>
                        <Star className={`${iconSizes.sm} mr-2`} />
                        {isFavorite ? t('rowActions.removeFromFavorites') : t('rowActions.addToFavorites')}
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}
