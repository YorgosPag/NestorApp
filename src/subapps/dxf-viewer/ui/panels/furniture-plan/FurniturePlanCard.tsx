'use client';

/**
 * ADR-654 — μία κάρτα του palette «Έπιπλα Κάτοψης».
 *
 * Mirror του `BlockLibraryCard`, απλοποιημένο στο ελάχιστο: raster thumbnail (όχι vector
 * SVG preview — τα sprites ΕΙΝΑΙ ήδη raster) + όνομα. Καθαρά presentational· η ίδια η
 * επιλογή (resolve FULL url + tool activation) ζει στον γονέα.
 *
 * @see ./hooks/useFurniturePlanPalette.ts — thumbnails + selectFurniture
 */

import React from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { FurniturePlanDef } from '../../../data/furniture-plan-catalog';

export interface FurniturePlanCardProps {
  readonly def: FurniturePlanDef;
  readonly displayName: string;
  /** ADR-655 — σύγχρονο URL από το registry· ποτέ pending (γι' αυτό έφυγε το busy spinner). */
  readonly thumbnailUrl: string;
  readonly isActive: boolean;
  readonly onSelect: (def: FurniturePlanDef) => void;
}

export const FurniturePlanCard: React.FC<FurniturePlanCardProps> = ({
  def,
  displayName,
  thumbnailUrl,
  isActive,
  onSelect,
}) => {
  return (
    <article
      className={`relative flex flex-col rounded-md border transition-colors ${
        isActive ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted'
      }`}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => onSelect(def)}
            aria-pressed={isActive}
            className="flex w-full flex-col items-stretch gap-1 p-2 text-left"
          >
            <span className="flex h-16 items-center justify-center rounded bg-muted/40 p-1">
              {/* `loading="lazy"` — μόνο οι ορατές κάρτες χτυπούν τον proxy. Κρίσιμο όταν το
                  pack μεγαλώσει σε εκατοντάδες sprites. */}
              <img
                src={thumbnailUrl}
                alt=""
                aria-hidden="true"
                loading="lazy"
                className="h-full w-full object-contain"
              />
            </span>
            <span className="truncate text-xs font-medium">{displayName}</span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom">{displayName}</TooltipContent>
      </Tooltip>
    </article>
  );
};
