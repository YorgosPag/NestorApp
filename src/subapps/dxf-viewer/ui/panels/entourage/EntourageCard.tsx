'use client';

/**
 * ADR-654 M6 — μία κάρτα του generic entourage palette (άνθρωποι/οχήματα).
 *
 * Γενίκευση του `FurniturePlanCard`: raster thumbnail (τα sprites ΕΙΝΑΙ ήδη raster) + όνομα,
 * καθαρά presentational. Typed σε `EntourageDef` ⇒ ίδια κάρτα για κάθε οικογένεια. Η ίδια η
 * επιλογή (resolve FULL url + tool activation) ζει στον γονέα.
 *
 * @see ./use-entourage-palette.ts — thumbnails + select
 */

import React from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { EntourageDef } from '../../../data/entourage-catalog-core';

export interface EntourageCardProps {
  readonly def: EntourageDef;
  readonly displayName: string;
  /** ADR-655 — σύγχρονο URL από το registry· ποτέ pending. */
  readonly thumbnailUrl: string;
  readonly isActive: boolean;
  readonly onSelect: (def: EntourageDef) => void;
}

export const EntourageCard: React.FC<EntourageCardProps> = ({
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
              {/* `loading="lazy"` — μόνο οι ορατές κάρτες χτυπούν τον proxy (packs με εκατοντάδες sprites). */}
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
