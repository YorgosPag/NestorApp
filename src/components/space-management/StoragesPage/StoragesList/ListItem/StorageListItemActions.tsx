'use client';

import React from 'react';
import { Button } from "@/components/ui/button";
import { useIconSizes } from '@/hooks/useIconSizes';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Star, MoreVertical, Edit, Eye, FileText, Archive } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TRANSITION_PRESETS, HOVER_TEXT_EFFECTS, GROUP_HOVER_PATTERNS } from '@/components/ui/effects';

interface StorageListItemActionsProps {
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onEdit: () => void;
}

export function StorageListItemActions({ isFavorite, onToggleFavorite, onEdit }: StorageListItemActionsProps) {
  const iconSizes = useIconSizes();

  return (
    <div className={`absolute top-2 right-2 flex items-center gap-1 opacity-0 z-10 ${GROUP_HOVER_PATTERNS.SHOW_ON_GROUP} ${TRANSITION_PRESETS.OPACITY}`}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
            onMouseDown={(e) => e.stopPropagation()}
            className={`${iconSizes.md} p-0`}
          >
            <Star
              className={cn(
                iconSizes.sm,
                isFavorite
                  ? "text-yellow-500 fill-yellow-500"
                  : `${HOVER_TEXT_EFFECTS.YELLOW}`
              )}
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{isFavorite ? 'Αφαίρεση από αγαπημένες' : 'Προσθήκη στις αγαπημένες'}</p>
        </TooltipContent>
      </Tooltip>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className={`${iconSizes.md} p-0`} onMouseDown={(e) => e.stopPropagation()}>
            <MoreVertical className={iconSizes.xs} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem><Eye className={`${iconSizes.sm} mr-2`} />Προβολή</DropdownMenuItem>
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(); }}><Edit className={`${iconSizes.sm} mr-2`} />Επεξεργασία</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem><FileText className={`${iconSizes.sm} mr-2`} />Λεπτομέρειες</DropdownMenuItem>
          <DropdownMenuItem><Archive className={`${iconSizes.sm} mr-2`} />Αρχειοθέτηση</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}>
            <Star className={`${iconSizes.sm} mr-2`} />
            {isFavorite ? 'Αφαίρεση από αγαπημένες' : 'Προσθήκη στις αγαπημένες'}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}