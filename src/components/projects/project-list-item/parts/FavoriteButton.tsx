
'use client';

import React from 'react';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GROUP_HOVER_PATTERNS, HOVER_TEXT_EFFECTS } from '@/components/ui/effects';

interface FavoriteButtonProps {
    isFavorite: boolean;
    onToggleFavorite: () => void;
}

export function FavoriteButton({ isFavorite, onToggleFavorite }: FavoriteButtonProps) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onToggleFavorite();
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    className={`absolute top-2 right-2 opacity-0 ${GROUP_HOVER_PATTERNS.SHOW_ON_GROUP} transition-opacity z-10 p-1`}
                    aria-label={isFavorite ? "Αφαίρεση από αγαπημένα" : "Προσθήκη στα αγαπημένα"}
                >
                    <Star
                        className={cn(
                            "w-4 h-4 transition-colors",
                            isFavorite
                            ? "text-yellow-500 fill-yellow-500"
                            : `text-gray-400 ${HOVER_TEXT_EFFECTS.YELLOW}`
                        )}
                    />
                </button>
            </TooltipTrigger>
            <TooltipContent>
                <p>{isFavorite ? 'Αφαίρεση από αγαπημένα' : 'Προσθήκη στα αγαπημένα'}</p>
            </TooltipContent>
        </Tooltip>
    );
}
