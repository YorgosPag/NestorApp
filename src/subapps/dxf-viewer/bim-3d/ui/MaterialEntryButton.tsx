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

import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { MaterialSwatch } from '../../ui/components/shared/MaterialSwatch';
import type { FaceAppearance } from '../../bim/types/face-appearance-types';
import { BIM_MATERIAL_MIME, serializeFaceAppearanceDrag } from './polygon-material-dnd';
import type { LibraryEntry } from './material-library-index';

/**
 * ADR-688 — «σε χρήση εδώ» treatment (Cinema 4D Material Manager active tag / Revit «current
 * material»): φωτεινό πλαίσιο + offset gap + απαλό glow + χρωματικό tint, ώστε να ΞΕΧΩΡΙΖΕΙ έντονα
 * πάνω στη γεμάτη σκούρα μπάρα (το παλιό διακριτικό `ring-2` μόλις φαινόταν). `relative` = anchor
 * για το corner badge.
 */
const ACTIVE_HIGHLIGHT_CLASSES =
  'relative ring-2 ring-[hsl(var(--bg-info))] ring-offset-2 ring-offset-black/80 ' +
  'bg-[hsl(var(--bg-info)/0.18)] shadow-[0_0_12px_1px_hsl(var(--bg-info)/0.55)]';

interface MaterialEntryButtonProps {
  readonly entry: LibraryEntry;
  readonly onApply: (value: FaceAppearance) => void;
  /** Body/library swatches = draggable (Cinema 4D drag-drop)· finish = click-only. Default true. */
  readonly draggable?: boolean;
  /**
   * ADR-687 Φ8 — this entry is the CURRENTLY applied material of the selected entity/face
   * (`resolveEntityCurrentMaterialId`/`resolveFaceCurrentMaterialId`). Renders a highlight ring
   * (Revit "current material" / C4D active tag). Optional, defaults false — back-compat for
   * existing callers that don't compute an active id.
   */
  readonly active?: boolean;
  readonly className?: string;
  readonly swatchClassName?: string;
}

export function MaterialEntryButton({
  entry,
  onApply,
  draggable = true,
  active = false,
  className,
  swatchClassName,
}: MaterialEntryButtonProps) {
  const { t } = useTranslation('bim3d');
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
          aria-current={active ? 'true' : undefined}
          aria-label={active ? t('polygonMode.activeMaterialLabel') : undefined}
          className={active ? `${className ?? ''} ${ACTIVE_HIGHLIGHT_CLASSES}` : className}
        >
          {active && (
            <span
              className="pointer-events-none absolute right-0.5 top-0.5 z-10 flex h-4 w-4 items-center justify-center rounded-full bg-[hsl(var(--bg-info))] text-white shadow ring-1 ring-black/40"
              aria-hidden="true"
            >
              <Check size={11} strokeWidth={3} />
            </span>
          )}
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
