'use client';

import React from 'react';
import { Button } from "@/components/ui/button";
import { useButtonPatterns } from '@/hooks/useButtonPatterns';
import { useSemanticColors } from '@/hooks/useSemanticColors';
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
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Star, MoreVertical, Edit, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TRANSITION_PRESETS, HOVER_TEXT_EFFECTS, GROUP_HOVER_PATTERNS } from '@/components/ui/effects';

interface BuildingListItemActionsProps {
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onEdit: () => void;
}

export function BuildingListItemActions({ isFavorite, onToggleFavorite, onEdit }: BuildingListItemActionsProps) {
  // 🏢 ENTERPRISE: Centralized systems
  const buttonPatterns = useButtonPatterns();
  const colors = useSemanticColors();
  const iconSizes = useIconSizes();

  return (
    <div className={`absolute top-2 right-2 flex items-center gap-1 opacity-0 z-10 ${GROUP_HOVER_PATTERNS.SHOW_ON_GROUP} ${TRANSITION_PRESETS.OPACITY}`}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            {...buttonPatterns.icons.iconSmall}
            onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <Star
              className={cn(
                iconSizes.sm,
                isFavorite
                  ? `${colors.text.warning} fill-yellow-500`
                  : `${HOVER_TEXT_EFFECTS.YELLOW}`
              )}
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{isFavorite ? 'Αφαίρεση από αγαπημένα' : 'Προσθήκη στα αγαπημένα'}</p>
        </TooltipContent>
      </Tooltip>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button {...buttonPatterns.icons.iconSmall} onMouseDown={(e) => e.stopPropagation()}>
            <MoreVertical className={iconSizes.xs} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem><Eye className={`${iconSizes.sm} mr-2`} />Προβολή</DropdownMenuItem>
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(); }}><Edit className={`${iconSizes.sm} mr-2`} />Επεξεργασία</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}>
            <Star className={`${iconSizes.sm} mr-2`} />
            {isFavorite ? 'Αφαίρεση από αγαπημένα' : 'Προσθήκη στα αγαπημένα'}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
