'use client';

import React from 'react';
import { Button } from "@/components/ui/button";
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
  return (
    <div className={`absolute top-2 right-2 flex items-center gap-1 opacity-0 z-10 ${GROUP_HOVER_PATTERNS.SHOW_ON_GROUP} ${TRANSITION_PRESETS.OPACITY}`}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
            onMouseDown={(e) => e.stopPropagation()}
            className="h-6 w-6 p-0"
          >
            <Star
              className={cn(
                "w-4 h-4",
                isFavorite
                  ? "text-yellow-500 fill-yellow-500"
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
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onMouseDown={(e) => e.stopPropagation()}>
            <MoreVertical className="w-3 h-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem><Eye className="w-4 h-4 mr-2" />Προβολή</DropdownMenuItem>
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(); }}><Edit className="w-4 h-4 mr-2" />Επεξεργασία</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}>
            <Star className="w-4 h-4 mr-2" />
            {isFavorite ? 'Αφαίρεση από αγαπημένα' : 'Προσθήκη στα αγαπημένα'}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
