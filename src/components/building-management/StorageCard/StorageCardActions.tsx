'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Eye, Trash2, Star, MoreVertical } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
import { TRANSITION_PRESETS, HOVER_BACKGROUND_EFFECTS, GROUP_HOVER_PATTERNS } from '@/components/ui/effects';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface Props {
  onEdit: () => void;
  onDelete: () => void;
  onToggleFavorite: () => void;
  isFavorite: boolean;
}

export function StorageCardActions({ onEdit, onDelete, onToggleFavorite, isFavorite }: Props) {
  // 🏢 ENTERPRISE: i18n hook for translations
  const { t } = useTranslation('building');
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  return (
    <div className={`absolute top-3 right-3 z-10 opacity-0 ${GROUP_HOVER_PATTERNS.SHOW_ON_GROUP} ${TRANSITION_PRESETS.OPACITY}`}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className={`${iconSizes.lg} p-1 ${colors.bg.primary}/80 backdrop-blur-sm shadow-sm ${HOVER_BACKGROUND_EFFECTS.LIGHT}`}>
            <MoreVertical className={iconSizes.sm} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(); }}>
            <Eye className={`${iconSizes.sm} mr-2`} />
            {t('storage.card.actions.viewEdit')}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}>
            <Star className={cn(`${iconSizes.sm} mr-2`, isFavorite && "text-yellow-500 fill-yellow-500")} />
            {isFavorite ? t('storage.card.actions.removeFromFavorites') : t('storage.card.actions.addToFavorites')}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDelete(); }} className="text-destructive focus:text-destructive">
            <Trash2 className={`${iconSizes.sm} mr-2`} />
            {t('storage.card.actions.delete')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
