'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Eye, Pencil, Unlink2, Trash2 } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import '@/lib/design-system';

interface Props {
  onEdit: () => void;
  onDelete: () => void;
  onToggleFavorite: () => void;
  isFavorite: boolean;
}

export function StorageCardActions({ onEdit, onDelete }: Props) {
  const { t } = useTranslation('building');

  return (
    <nav className="absolute top-3 right-3 z-10 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" className="h-7 w-7 bg-background/80 backdrop-blur-sm shadow-sm" onClick={(e) => { e.stopPropagation(); }}>
            <Eye className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t('spaceActions.view')}</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" className="h-7 w-7 bg-background/80 backdrop-blur-sm shadow-sm" onClick={(e) => { e.stopPropagation(); onEdit(); }}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t('spaceActions.edit')}</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" className="h-7 w-7 bg-background/80 backdrop-blur-sm shadow-sm text-amber-600 hover:text-amber-700" onClick={(e) => { e.stopPropagation(); }}>
            <Unlink2 className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t('spaceActions.unlink')}</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" className="h-7 w-7 bg-background/80 backdrop-blur-sm shadow-sm text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); onDelete(); }}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t('spaceActions.delete')}</TooltipContent>
      </Tooltip>
    </nav>
  );
}
