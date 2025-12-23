'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Eye, Edit, Trash2, Star, MoreVertical } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { cn } from '@/lib/utils';
import { TRANSITION_PRESETS, HOVER_BACKGROUND_EFFECTS, GROUP_HOVER_PATTERNS } from '@/components/ui/effects';

interface Props {
  onEdit: () => void;
  onDelete: () => void;
  onToggleFavorite: () => void;
  isFavorite: boolean;
}

export function StorageCardActions({ onEdit, onDelete, onToggleFavorite, isFavorite }: Props) {
  const iconSizes = useIconSizes();
  return (
    <div className={`absolute top-3 right-3 z-10 opacity-0 ${GROUP_HOVER_PATTERNS.SHOW_ON_GROUP} ${TRANSITION_PRESETS.OPACITY}`}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className={`${iconSizes.lg} p-1 bg-white/80 backdrop-blur-sm shadow-sm ${HOVER_BACKGROUND_EFFECTS.LIGHT}`}>
            <MoreVertical className={iconSizes.sm} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(); }}>
            <Eye className={`${iconSizes.sm} mr-2`} />
            Προβολή / Επεξεργασία
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}>
            <Star className={cn(`${iconSizes.sm} mr-2`, isFavorite && "text-yellow-500 fill-yellow-500")} />
            {isFavorite ? 'Αφαίρεση από αγαπημένα' : 'Προσθήκη στα αγαπημένα'}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDelete(); }} className="text-destructive focus:text-destructive">
            <Trash2 className={`${iconSizes.sm} mr-2`} />
            Διαγραφή
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
