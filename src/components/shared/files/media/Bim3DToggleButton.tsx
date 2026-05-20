'use client';

import { useTranslation } from 'react-i18next';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

// ADR-371: prop-driven 3D toggle for Properties read-only floorplan tab.
// Mirror of ViewMode3DToggleButton but decoupled from global ViewMode3DStore —
// local state lives in FloorplanGallery (Q1: independent from /dxf/viewer state).

interface Bim3DToggleButtonProps {
  active: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

export function Bim3DToggleButton({ active, onToggle, disabled = false }: Bim3DToggleButtonProps) {
  const { t } = useTranslation('bim3d');

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onToggle}
          disabled={disabled}
          aria-label={t('modeToggle.aria')}
          aria-pressed={active}
          className="flex select-none items-center gap-1.5 rounded border border-border bg-background/80 px-2 py-1.5 text-xs font-semibold text-foreground shadow-md backdrop-blur-sm transition-colors hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-40"
        >
          <CubeIcon />
          {t('modeToggle.label')}
        </button>
      </TooltipTrigger>
      <TooltipContent>
        {active ? t('modeToggle.tooltip3d') : t('modeToggle.tooltip2d')}
      </TooltipContent>
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
