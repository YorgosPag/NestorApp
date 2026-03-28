'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import '@/lib/design-system';

// =============================================================================
// 🏢 ENTERPRISE: FullscreenOverlay (ADR-241 — composition refactor)
// =============================================================================
//
// Single-responsibility: CSS fixed overlay via React Portal.
// Children do NOT remount — ideal for EntityFilesManager, canvas views.
//
// For dialog-based fullscreen, use <Dialog> + <DialogContent size="fullscreen">
// directly (composition over abstraction).
//
// Usage:
//  const fs = useFullscreen();
//  <FullscreenOverlay isFullscreen={fs.isFullscreen} onToggle={fs.toggle}>
//    {children}
//  </FullscreenOverlay>
// =============================================================================

// =============================================================================
// TOGGLE BUTTON (standalone, exported)
// =============================================================================

interface ToggleButtonProps {
  isFullscreen: boolean;
  onToggle: () => void;
}

export function FullscreenToggleButton({ isFullscreen, onToggle }: ToggleButtonProps) {
  const iconSizes = useIconSizes();
  const { t } = useTranslation('common');

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

// =============================================================================
// FULLSCREEN OVERLAY
// =============================================================================

export interface FullscreenOverlayProps {
  /** Children rendered inside the container */
  children: React.ReactNode;
  /** Whether fullscreen is active */
  isFullscreen: boolean;
  /** Toggle callback */
  onToggle: () => void;
  /** Optional header content rendered in fullscreen mode */
  headerContent?: React.ReactNode;
  /** Additional className on the container wrapper */
  className?: string;
  /** Additional className applied only when in fullscreen */
  fullscreenClassName?: string;
  /** Accessible label for the fullscreen region */
  ariaLabel?: string;
}

/**
 * CSS fixed overlay that renders children via React Portal when fullscreen.
 * Children are NOT remounted — state is preserved across transitions.
 *
 * @example
 * ```tsx
 * const fs = useFullscreen();
 * <FullscreenOverlay isFullscreen={fs.isFullscreen} onToggle={fs.toggle}>
 *   <Card>...</Card>
 * </FullscreenOverlay>
 * ```
 */
export function FullscreenOverlay({
  children,
  isFullscreen,
  onToggle,
  headerContent,
  className,
  fullscreenClassName,
  ariaLabel,
}: FullscreenOverlayProps) {
  const colors = useSemanticColors();

  // Portal target — must be client-side only
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setPortalTarget(document.body);
  }, []);

  // Normal (non-fullscreen): render children inline
  if (!isFullscreen) {
    return (
      <section className={className} aria-label={ariaLabel}>
        {children}
      </section>
    );
  }

  // Fullscreen: render via portal to escape overflow-hidden ancestors
  const fullscreenContent = (
    <section
      className={cn(
        'fixed inset-0 z-50 flex flex-col overflow-auto',
        colors.bg.primary,
        fullscreenClassName,
      )}
      aria-label={ariaLabel}
      role="dialog"
      aria-modal
    >
      {headerContent && (
        <header className="flex items-center justify-between shrink-0 border-b px-4 py-2">
          <span className="flex items-center gap-2">{headerContent}</span>
          <FullscreenToggleButton isFullscreen onToggle={onToggle} />
        </header>
      )}
      {children}
    </section>
  );

  return portalTarget ? createPortal(fullscreenContent, portalTarget) : null;
}
