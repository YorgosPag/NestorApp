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
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Star, MoreVertical, Edit, Eye, Copy, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GROUP_HOVER_PATTERNS, HOVER_TEXT_EFFECTS } from '@/components/ui/effects';
import { useIconSizes } from '@/hooks/useIconSizes';

interface UnitListItemActionsProps {
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onEdit: () => void;
}

export function UnitListItemActions({ isFavorite, onToggleFavorite, onEdit }: UnitListItemActionsProps) {
  const iconSizes = useIconSizes();
  return (
    <div className={`absolute top-2 right-2 flex items-center gap-1 opacity-0 ${GROUP_HOVER_PATTERNS.SHOW_ON_GROUP} transition-opacity z-10`}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
            onMouseDown={(e) => e.stopPropagation()}
            className={`${iconSizes.lg} p-0`}
          >
            <Star
              className={cn(
                `${iconSizes.sm} transition-colors`,
                isFavorite
                  ? "text-yellow-500 fill-yellow-500"
                  : `text-gray-400 ${HOVER_TEXT_EFFECTS.YELLOW}`
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
          <Button 
            variant="ghost" 
            size="sm" 
            className={`${iconSizes.lg} p-0`} 
            onMouseDown={(e) => e.stopPropagation()}
          >
            <MoreVertical className={iconSizes.xs} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem>
            <Eye className={`${iconSizes.sm} mr-2`} />
            Προβολή
          </DropdownMenuItem>
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(); }}>
            <Edit className={`${iconSizes.sm} mr-2`} />
            Επεξεργασία
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Copy className={`${iconSizes.sm} mr-2`} />
            Αντιγραφή
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}>
            <Star className={`${iconSizes.sm} mr-2`} />
            {isFavorite ? 'Αφαίρεση από αγαπημένα' : 'Προσθήκη στα αγαπημένα'}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-red-600">
            <Trash2 className={`${iconSizes.sm} mr-2`} />
            Διαγραφή
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}