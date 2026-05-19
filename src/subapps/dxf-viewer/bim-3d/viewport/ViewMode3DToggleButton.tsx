"use client";

import { useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useViewMode3DStore, selectIs3D } from '../stores/ViewMode3DStore';

// Visible only in 2D mode — entry point into 3D viewport (ADR-366 §9 Q1).
// In 3D mode this component unmounts; the Three.js ViewCube takes over top-right.
export function ViewMode3DToggleButton() {
  const { t } = useTranslation('bim3d');
  const is3D = useSyncExternalStore(
    useViewMode3DStore.subscribe,
    () => selectIs3D(useViewMode3DStore.getState()),
    () => false,
  );

  if (is3D) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={() => useViewMode3DStore.getState().toggle2D3D()}
          aria-label={t('modeToggle.aria')}
          className="absolute right-3 top-3 z-30 flex select-none items-center gap-1.5 rounded border border-border bg-background/80 px-2 py-1.5 text-xs font-semibold text-foreground shadow-md backdrop-blur-sm transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <CubeIcon />
          {t('modeToggle.label')}
        </button>
      </TooltipTrigger>
      <TooltipContent>{t('modeToggle.tooltip2d')}</TooltipContent>
    </Tooltip>
  );
}

function CubeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M7 1L12.5 4V10L7 13L1.5 10V4L7 1Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M7 1V7M7 7L12.5 4M7 7L1.5 4" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" strokeOpacity="0.6" />
    </svg>
  );
}
