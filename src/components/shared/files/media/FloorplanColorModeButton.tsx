'use client';

/**
 * ADR-340 — «Μαύρο ↔ Έγχρωμο σχέδιο» toggle for the read-only floorplan gallery.
 *
 * Independent axis from the ☀/🌙 background theme (Giorgio Q, 2026-07-19): this button
 * controls ONLY the entity ink (colored layer colours ↔ single black ink), the theme
 * button controls ONLY the background. Big-players expose «Monochrome» as its own
 * display switch. Extracted from `FloorplanGallery` (SRP + the 500-line file ceiling),
 * mirroring the sibling `Bim3DToggleButton`.
 *
 * Shows the icon/label of the ACTION (the target state), matching the ☀/🌙 pattern.
 *
 * @module components/shared/files/media/FloorplanColorModeButton
 */

import { Contrast, Palette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface FloorplanColorModeButtonProps {
  /** True = entities forced to a single black ink; false = colored (layer colours). */
  monochrome: boolean;
  onToggle: () => void;
}

export function FloorplanColorModeButton({ monochrome, onToggle }: FloorplanColorModeButtonProps) {
  const { t } = useTranslation('files-media');
  const iconSizes = useIconSizes();
  // Label/icon describe the ACTION: colored now → offer «Μαύρο»; black now → offer «Έγχρωμο».
  const label = monochrome ? t('floorplan.colorMode.colored') : t('floorplan.colorMode.black');

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggle}
          aria-label={label}
          aria-pressed={monochrome}
        >
          {monochrome
            ? <Palette className={iconSizes.sm} aria-hidden="true" />
            : <Contrast className={iconSizes.sm} aria-hidden="true" />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
