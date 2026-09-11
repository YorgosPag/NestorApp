'use client';

import { COMMON_NAMESPACES } from '@/i18n/namespace-bundles';
import React from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';

// =============================================================================
// 🏢 ENTERPRISE: FullscreenToggleButton (ADR-241)
// =============================================================================
//
// Σε δικό του αρχείο από 2026-09-11: το `FullscreenOverlay` απέκτησε σταθερό ξενιστή, επιφάνεια και ιδιοκτησία
// Escape / focus, και ένα αρχείο που θα τα κρατούσε όλα θα έσπαγε το όριο SRP. Το `FullscreenOverlay` το ξαναεξάγει,
// οπότε κανένας από τους καταναλωτές δεν αλλάζει εισαγωγή.
// =============================================================================

export interface ToggleButtonProps {
  isFullscreen: boolean;
  onToggle: () => void;
}

export function FullscreenToggleButton({ isFullscreen, onToggle }: ToggleButtonProps) {
  const iconSizes = useIconSizes();
  const { t } = useTranslation(COMMON_NAMESPACES);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          onClick={onToggle}
          aria-label={isFullscreen ? t('fullscreen.exit') : t('fullscreen.enter')}
          aria-pressed={isFullscreen}
        >
          {isFullscreen
            ? <Minimize2 className={iconSizes.sm} aria-hidden="true" />
            : <Maximize2 className={iconSizes.sm} aria-hidden="true" />
          }
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {isFullscreen ? t('fullscreen.exitTooltip') : t('fullscreen.enterTooltip')}
      </TooltipContent>
    </Tooltip>
  );
}
