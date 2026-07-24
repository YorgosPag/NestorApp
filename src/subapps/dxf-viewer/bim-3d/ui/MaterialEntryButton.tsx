'use client';

/**
 * MaterialEntryButton — ADR-687 Φ8. ΕΝΑ swatch-κουμπί για ένα `LibraryEntry`, κοινό για την κάτω
 * μπάρα «Υλικά όψης» (Ν.2, σκηνή) ΚΑΙ το popover «Βιβλιοθήκη» (Ν.2, όλα) — μηδέν sibling clone (N.18).
 * Render = rendered σφαίρα (`<MaterialSwatch sphere>`, C4D Material Manager) + label· click/drag →
 * το `entry.apply` (`FaceAppearance`), ίδιο apply path με πριν (ADR-539/679).
 *
 * @see ./material-library-index.ts — LibraryEntry (+ `apply`)
 * @see ./polygon-material-dnd.ts — drag MIME/serialize SSoT
 */

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { MaterialSwatch } from '../../ui/components/shared/MaterialSwatch';
import type { FaceAppearance } from '../../bim/types/face-appearance-types';
import { BIM_MATERIAL_MIME, serializeFaceAppearanceDrag } from './polygon-material-dnd';
import type { LibraryEntry } from './material-library-index';

interface MaterialEntryButtonProps {
  readonly entry: LibraryEntry;
  readonly onApply: (value: FaceAppearance) => void;
  /** Body/library swatches = draggable (Cinema 4D drag-drop)· finish = click-only. Default true. */
  readonly draggable?: boolean;
  readonly className?: string;
  readonly swatchClassName?: string;
}

export function MaterialEntryButton({
  entry,
  onApply,
  draggable = true,
  className,
  swatchClassName,
}: MaterialEntryButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          draggable={draggable}
          onDragStart={
            draggable
              ? (e) => {
                  e.dataTransfer.setData(BIM_MATERIAL_MIME, serializeFaceAppearanceDrag(entry.apply));
                  e.dataTransfer.effectAllowed = 'copy';
                }
              : undefined
          }
          onClick={() => onApply(entry.apply)}
          className={className}
        >
          <MaterialSwatch
            sphere
            materialId={entry.materialId}
            category={entry.category}
            thumbnailUrl={entry.thumbnailUrl}
            albedoUrl={entry.albedoUrl}
            appearance={entry.appearance}
            color={entry.color}
            className={swatchClassName}
          />
          <span className="w-full truncate text-center">{entry.label}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent>{entry.label}</TooltipContent>
    </Tooltip>
  );
}
