
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

interface RowActionsProps {
    isFavorite: boolean;
    onToggleFavorite: () => void;
}

export function RowActions({ isFavorite, onToggleFavorite }: RowActionsProps) {
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
                        aria-label="Περισσότερες ενέργειες"
                    >
                        <MoreVertical className={iconSizes.xs} />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem><Eye className={`${iconSizes.sm} mr-2`} />Προβολή</DropdownMenuItem>
                    <DropdownMenuItem><Edit className={`${iconSizes.sm} mr-2`} />Επεξεργασία</DropdownMenuItem>
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
