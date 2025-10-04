
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

interface RowActionsProps {
    isFavorite: boolean;
    onToggleFavorite: () => void;
}

export function RowActions({ isFavorite, onToggleFavorite }: RowActionsProps) {
    return (
        <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-6 w-6 p-0" 
                        onMouseDown={(e) => e.stopPropagation()}
                        aria-label="Περισσότερες ενέργειες"
                    >
                        <MoreVertical className="w-3 h-3" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem><Eye className="w-4 h-4 mr-2" />Προβολή</DropdownMenuItem>
                    <DropdownMenuItem><Edit className="w-4 h-4 mr-2" />Επεξεργασία</DropdownMenuItem>
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
