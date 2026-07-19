'use client';

/**
 * ADR-340 — «Χρώμα σχεδίου» ink picker for the read-only floorplan gallery.
 *
 * Independent axis from the ☀/🌙 background theme (Giorgio Q, 2026-07-19): the theme
 * button owns the BACKGROUND, this control owns the ENTITY ink. Two states:
 *  - `inkColor === null` → «Έγχρωμο» (layer colours, the DXF as authored);
 *  - `inkColor === '#rrggbb'` → every entity forced to that single ink (e.g. WHITE lines
 *    on a dark background, BLACK on light — big-player «Monochrome», any colour the user
 *    picks via the native/OS colour picker).
 *
 * The ink is applied downstream by `applyMonochromeInk` (a `source-in` recolor of the
 * already-rendered pixels), so ANY hex works with zero engine changes. Extracted from
 * `FloorplanGallery` for SRP + the 500-line ceiling, sibling of `Bim3DToggleButton`.
 *
 * @module components/shared/files/media/FloorplanInkPicker
 */

import { useState } from 'react';
import { Palette } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';

/** Default ink offered by the swatch — white, so the first pick is visible on the dark theme. */
const DEFAULT_INK = '#ffffff';

interface FloorplanInkPickerProps {
  /** null = colored (layer colours); a hex = force every entity to that single ink. */
  inkColor: string | null;
  onChange: (inkColor: string | null) => void;
}

export function FloorplanInkPicker({ inkColor, onChange }: FloorplanInkPickerProps) {
  const { t } = useTranslation('files-media');
  const iconSizes = useIconSizes();
  // Remember the last picked ink so returning from «Έγχρωμο» keeps the user's colour.
  const [pickedInk, setPickedInk] = useState(DEFAULT_INK);
  const colored = inkColor === null;
  const swatch = inkColor ?? pickedInk;

  return (
    <span className="flex items-center gap-1">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onChange(null)}
            aria-label={t('floorplan.colorMode.colored')}
            aria-pressed={colored}
            className={cn(colored && 'bg-accent text-accent-foreground')}
          >
            <Palette className={iconSizes.sm} aria-hidden="true" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t('floorplan.colorMode.colored')}</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <label
            className={cn(
              'inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded border border-border',
              !colored && 'ring-2 ring-primary',
            )}
            aria-label={t('floorplan.colorMode.pick')}
          >
            <input
              type="color"
              value={swatch}
              onChange={(e) => { setPickedInk(e.target.value); onChange(e.target.value); }}
              className="h-5 w-5 cursor-pointer rounded border-0 bg-transparent p-0"
            />
          </label>
        </TooltipTrigger>
        <TooltipContent>{t('floorplan.colorMode.pick')}</TooltipContent>
      </Tooltip>
    </span>
  );
}
