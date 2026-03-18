'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

// =============================================================================
// 🏢 ENTERPRISE: Centralized Fullscreen Container (ADR-241)
// =============================================================================
//
// Two modes:
//  - "overlay" (default): CSS fixed overlay — children do NOT remount.
//    Ideal for EntityFilesManager, canvas-based views.
//  - "dialog": Radix Dialog portal — proper focus trap + overlay.
//    Ideal for GanttView, data views.
//
// Usage:
//  <FullscreenContainer isFullscreen={fs.isFullscreen} onToggle={fs.toggle}>
//    {children}
//  </FullscreenContainer>
// =============================================================================

type ToggleButtonPosition = 'top-right' | 'none';

export interface FullscreenContainerProps {
  /** Children rendered inside the container */
  children: React.ReactNode;
  /** Whether fullscreen is active */
  isFullscreen: boolean;
  /** Toggle callback */
  onToggle: () => void;
  /** Exit callback (for Dialog onOpenChange) */
  onExit?: () => void;
  /** Rendering mode */
  mode?: 'overlay' | 'dialog';
  /** Toggle button position (default: 'top-right'). Set to 'none' to hide. */
  togglePosition?: ToggleButtonPosition;
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
 * Centralized container that wraps children in a fullscreen view.
 *
 * @example Overlay mode (EntityFilesManager)
 * ```tsx
 * const fs = useFullscreen();
 * <FullscreenContainer isFullscreen={fs.isFullscreen} onToggle={fs.toggle}>
 *   <Card>...</Card>
 * </FullscreenContainer>
 * ```
 *
 * @example Dialog mode (GanttView)
 * ```tsx
 * const fs = useFullscreen();
 * <FullscreenContainer
 *   isFullscreen={fs.isFullscreen}
 *   onToggle={fs.toggle}
 *   onExit={fs.exit}
 *   mode="dialog"
 *   headerContent={<span>Χρονοδιάγραμμα</span>}
 * >
 *   <GanttChart ... />
 * </FullscreenContainer>
 * ```
 */
export function FullscreenContainer({
  children,
  isFullscreen,
  onToggle,
  onExit,
  mode = 'overlay',
  togglePosition = 'top-right',
  headerContent,
  className,
  fullscreenClassName,
  ariaLabel,
}: FullscreenContainerProps) {
  if (mode === 'dialog') {
    return (
      <DialogModeContainer
        isFullscreen={isFullscreen}
        onToggle={onToggle}
        onExit={onExit ?? onToggle}
        togglePosition={togglePosition}
        headerContent={headerContent}
        className={className}
        fullscreenClassName={fullscreenClassName}
        ariaLabel={ariaLabel}
      >
        {children}
      </DialogModeContainer>
    );
  }

  return (
    <OverlayModeContainer
      isFullscreen={isFullscreen}
      onToggle={onToggle}
      togglePosition={togglePosition}
      headerContent={headerContent}
      className={className}
      fullscreenClassName={fullscreenClassName}
      ariaLabel={ariaLabel}
    >
      {children}
    </OverlayModeContainer>
  );
}

// =============================================================================
// TOGGLE BUTTON (shared)
// =============================================================================

interface ToggleButtonProps {
  isFullscreen: boolean;
  onToggle: () => void;
}

function FullscreenToggleButton({ isFullscreen, onToggle }: ToggleButtonProps) {
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
// OVERLAY MODE
// =============================================================================

interface OverlayModeProps {
  children: React.ReactNode;
  isFullscreen: boolean;
  onToggle: () => void;
  togglePosition: ToggleButtonPosition;
  headerContent?: React.ReactNode;
  className?: string;
  fullscreenClassName?: string;
  ariaLabel?: string;
}

function OverlayModeContainer({
  children,
  isFullscreen,
  onToggle,
  togglePosition,
  headerContent,
  className,
  fullscreenClassName,
  ariaLabel,
}: OverlayModeProps) {
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
          {togglePosition !== 'none' && (
            <FullscreenToggleButton isFullscreen onToggle={onToggle} />
          )}
        </header>
      )}
      {children}
    </section>
  );

  return portalTarget ? createPortal(fullscreenContent, portalTarget) : null;
}

// =============================================================================
// DIALOG MODE
// =============================================================================

interface DialogModeProps {
  children: React.ReactNode;
  isFullscreen: boolean;
  onToggle: () => void;
  onExit: () => void;
  togglePosition: ToggleButtonPosition;
  headerContent?: React.ReactNode;
  className?: string;
  fullscreenClassName?: string;
  ariaLabel?: string;
}

function DialogModeContainer({
  children,
  isFullscreen,
  onToggle,
  onExit,
  togglePosition,
  headerContent,
  className,
  fullscreenClassName,
  ariaLabel,
}: DialogModeProps) {
  const colors = useSemanticColors();

  return (
    <>
      {/* Fullscreen view: Radix Dialog (children render ONLY inside Dialog) */}
      <Dialog open={isFullscreen} onOpenChange={(open) => { if (!open) onExit(); }}>
        <DialogContent
          className={cn(
            'max-w-[95vw] w-[95vw] h-[90vh] flex flex-col p-0 gap-0',
            colors.bg.primary,
            fullscreenClassName,
          )}
          hideCloseButton
        >
          {/* Accessible title (always required for Dialog) */}
          <DialogTitle className="sr-only">
            {ariaLabel ?? 'Fullscreen view'}
          </DialogTitle>

          {headerContent && (
            <header className="flex items-center justify-between shrink-0 border-b px-4 py-2">
              <span className="flex items-center gap-2">{headerContent}</span>
              {togglePosition !== 'none' && (
                <FullscreenToggleButton isFullscreen onToggle={onToggle} />
              )}
            </header>
          )}

          <section className="flex-1 min-h-0 flex flex-col overflow-auto">
            {children}
          </section>
        </DialogContent>
      </Dialog>
    </>
  );
}
