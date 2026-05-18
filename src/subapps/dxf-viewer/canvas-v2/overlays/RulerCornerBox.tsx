'use client';

/**
 * 🏢 ENTERPRISE: RulerCornerBox Component
 * CAD-GRADE Corner Box at ruler intersection (AutoCAD/Revit/Blender standard)
 *
 * Features:
 * - Single Click: Zoom to Fit (all entities)
 * - Double Click: Zoom 100% (1:1 scale)
 * - Ctrl+Click: Zoom Previous (history)
 * - Right Click: Context Menu with zoom options
 * - Scroll Wheel: Quick zoom in/out
 * - Hover: Tooltip with instructions
 * - Keyboard: F=Fit, 0=100%, +/- zoom (when focused)
 * - Accessibility: WCAG 2.1 AA compliant
 *
 * @see ADR-009: Corner Box Feature Implementation
 * @see ADR-009 in docs/centralized-systems/reference/adr-index.md
 */

import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from '@/i18n';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import styles from './RulerCornerBox.module.css';
// 🏢 ADR-079: Centralized Movement Detection Constants (Zoom Preset Matching)
import { MOVEMENT_DETECTION } from '../../config/tolerance-config';
// 🏢 ADR-098: Centralized Timing Constants (Double-Click Window)
import { PANEL_LAYOUT } from '../../config/panel-tokens';
// 🏢 ADR-081: Centralized percentage formatting
import { formatPercent } from '../../rendering/entities/shared/distance-label-utils';
// 🏢 ENTERPRISE (2026-02-01): Centralized Menu Icons - ADR-133
import {
  FitIcon,
  ZoomInIcon,
  ZoomOutIcon,
  Zoom100Icon,
  HistoryIcon,
  OriginMarkerIcon,
} from '../../ui/icons/MenuIcons';
// ADR-040 Phase VIII: micro-leaf subscribes to ZoomStore directly
import { useCurrentZoom } from '../../systems/zoom/ZoomStore';

// ===== TYPES =====

interface RulerCornerBoxProps {
  /** Width of the vertical ruler (left) */
  rulerWidth: number;
  /** Height of the horizontal ruler (bottom) */
  rulerHeight: number;
  /** Background color (from ruler settings) */
  backgroundColor: string;
  /** Text color (from ruler settings) */
  textColor: string;
  /** Callback for Zoom to Fit */
  onZoomToFit: () => void;
  /** Callback for Zoom to 100% */
  onZoom100: () => void;
  /** Callback for Zoom In */
  onZoomIn: () => void;
  /** Callback for Zoom Out */
  onZoomOut: () => void;
  /** Callback for Zoom Previous (history) */
  onZoomPrevious: () => void;
  /** Callback for Zoom to specific scale */
  onZoomToScale: (scale: number) => void;
  /** Callback for wheel zoom */
  onWheelZoom?: (delta: number) => void;
  /** Optional className for custom styling */
  className?: string;
}

// ===== ZOOM PRESETS =====

const ZOOM_PRESETS = [
  { label: '25%', scale: 0.25 },
  { label: '50%', scale: 0.5 },
  { label: '100%', scale: 1.0 },
  { label: '150%', scale: 1.5 },
  { label: '200%', scale: 2.0 },
  { label: '400%', scale: 4.0 },
] as const;

// ===== MICRO-LEAVES (ADR-040) =====

// Subscribes to ZoomStore; renders zoom % + updates button aria-label imperatively.
// Keeps RulerCornerBox stable under React.memo — no parent re-render on zoom.
function ZoomDisplayLeaf({
  buttonRef,
  ariaLabelFn,
}: {
  buttonRef: React.RefObject<HTMLButtonElement | null>;
  ariaLabelFn: (zoomPercent: number) => string;
}) {
  const scale = useCurrentZoom();
  const zoomPercent = Math.round(scale * 100);
  const display = zoomPercent >= 1000 ? `${(zoomPercent / 1000).toFixed(1)}k%` : formatPercent(scale);
  useEffect(() => {
    buttonRef.current?.setAttribute('aria-label', ariaLabelFn(zoomPercent));
  }, [zoomPercent, ariaLabelFn, buttonRef]);
  return <span className={styles.zoomLevel} aria-live="polite">{display}</span>;
}

// Subscribes to ZoomStore; renders preset buttons with correct active state.
// Radix lazy-renders PopoverContent → this leaf only runs when popover is open.
function ZoomPresetButtons({
  onZoomToScale,
  closeMenu,
}: {
  onZoomToScale: (scale: number) => void;
  closeMenu: () => void;
}) {
  const currentScale = useCurrentZoom();
  return (
    <>
      {ZOOM_PRESETS.map(({ label, scale }) => (
        <button
          key={label}
          type="button"
          className={cn(
            styles.zoomPresetButton,
            Math.abs(currentScale - scale) < MOVEMENT_DETECTION.ZOOM_PRESET_MATCH && styles.active,
          )}
          onClick={() => { onZoomToScale(scale); closeMenu(); }}
          aria-pressed={Math.abs(currentScale - scale) < MOVEMENT_DETECTION.ZOOM_PRESET_MATCH}
        >
          {label}
        </button>
      ))}
    </>
  );
}

// ===== MAIN COMPONENT =====

// ADR-040 perf: React.memo prevents re-renders on scene change (parent CanvasLayerStack re-renders
// when dxfScene changes, but RulerCornerBox only depends on zoom state and stable callbacks).
const RulerCornerBox = memo(function RulerCornerBox({
  rulerWidth,
  rulerHeight,
  backgroundColor,
  textColor,
  onZoomToFit,
  onZoom100,
  onZoomIn,
  onZoomOut,
  onZoomPrevious,
  onZoomToScale,
  onWheelZoom,
  className,
}: RulerCornerBoxProps) {
  const { t } = useTranslation('dxf-viewer-panels');
  // No useCurrentZoom() here — zoom-reactive rendering pushed to ZoomDisplayLeaf + ZoomPresetButtons.
  // React.memo on this component now works for zoom too (only re-renders on prop/state change).
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const lastClickRef = useRef<number>(0);
  const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const ariaLabelFn = useCallback(
    (zoomPercent: number) => t('rulerCornerBox.aria.cornerBox', { zoomPercent }),
    [t],
  );

  const closeMenu = useCallback(() => setIsMenuOpen(false), []);

  // ===== CLICK HANDLERS =====

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (isMenuOpen) return;

    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      onZoomPrevious();
      return;
    }

    const now = Date.now();
    const timeSinceLastClick = now - lastClickRef.current;

    if (timeSinceLastClick < PANEL_LAYOUT.TIMING.DOUBLE_CLICK_WINDOW) {
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current);
        clickTimeoutRef.current = null;
      }
      onZoom100();
      lastClickRef.current = 0;
    } else {
      lastClickRef.current = now;
      clickTimeoutRef.current = setTimeout(() => {
        onZoomToFit();
        clickTimeoutRef.current = null;
      }, PANEL_LAYOUT.TIMING.DOUBLE_CLICK_WINDOW);
    }
  }, [isMenuOpen, onZoomToFit, onZoom100, onZoomPrevious]);

  // ===== WHEEL HANDLER =====

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (onWheelZoom) {
      onWheelZoom(e.deltaY);
    } else {
      if (e.deltaY < 0) {
        onZoomIn();
      } else {
        onZoomOut();
      }
    }
  }, [onWheelZoom, onZoomIn, onZoomOut]);

  // ===== KEYBOARD HANDLER =====

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key.toLowerCase()) {
      case 'f':
        e.preventDefault();
        onZoomToFit();
        break;
      case '0':
        e.preventDefault();
        onZoom100();
        break;
      case '+':
      case '=':
        e.preventDefault();
        onZoomIn();
        break;
      case '-':
        e.preventDefault();
        onZoomOut();
        break;
      case 'p':
        e.preventDefault();
        onZoomPrevious();
        break;
      case 'enter':
      case ' ':
        e.preventDefault();
        onZoomToFit();
        break;
      default:
        break;
    }
  }, [onZoomToFit, onZoom100, onZoomIn, onZoomOut, onZoomPrevious]);

  // ===== CONTEXT MENU HANDLER =====

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsMenuOpen(true);
  }, []);

  // ===== TOOLTIP CONTENT =====

  const tooltipContent = useMemo(() => (
    <section className={styles.tooltipContent}>
      <div className={styles.tooltipLine}>
        <span className={styles.tooltipKey}>{t('rulerCornerBox.tooltip.click')}</span>
        <span className={styles.tooltipAction}>{t('rulerCornerBox.tooltip.zoomToFit')}</span>
      </div>
      <div className={styles.tooltipLine}>
        <span className={styles.tooltipKey}>{t('rulerCornerBox.tooltip.double')}</span>
        <span className={styles.tooltipAction}>{t('rulerCornerBox.tooltip.zoom100')}</span>
      </div>
      <div className={styles.tooltipLine}>
        <span className={styles.tooltipKey}>{t('rulerCornerBox.tooltip.ctrlClick')}</span>
        <span className={styles.tooltipAction}>{t('rulerCornerBox.tooltip.previousView')}</span>
      </div>
      <div className={styles.tooltipLine}>
        <span className={styles.tooltipKey}>{t('rulerCornerBox.tooltip.rightClick')}</span>
        <span className={styles.tooltipAction}>{t('rulerCornerBox.tooltip.zoomMenu')}</span>
      </div>
      <div className={styles.tooltipLine}>
        <span className={styles.tooltipKey}>{t('rulerCornerBox.tooltip.scroll')}</span>
        <span className={styles.tooltipAction}>{t('rulerCornerBox.tooltip.quickZoom')}</span>
      </div>
    </section>
  ), [t]);

  const handlePopoverOpenChange = useCallback((open: boolean) => {
    if (!open) setIsMenuOpen(false);
  }, []);

  // ===== RENDER =====
  // PopoverAnchor wraps the button: positions the PopoverContent without adding click handlers.
  // Tooltip wraps the same button for hover behavior — both use the same anchor element.

  return (
    <TooltipProvider delayDuration={500}>
    <Popover open={isMenuOpen} onOpenChange={handlePopoverOpenChange}>
      <Tooltip>
        <PopoverAnchor asChild>
          <TooltipTrigger asChild>
            <button
              ref={buttonRef}
              type="button"
              data-ruler-corner-box="true"
              className={cn(styles.cornerBox, className)}
              style={{
                left: 0,
                bottom: 0,
                width: rulerWidth,
                height: rulerHeight,
                backgroundColor,
                color: textColor,
              }}
              onClick={handleClick}
              onContextMenu={handleContextMenu}
              onWheel={handleWheel}
              onKeyDown={handleKeyDown}
              aria-label={t('rulerCornerBox.aria.cornerBox', { zoomPercent: 100 })}
              aria-haspopup="menu"
              aria-expanded={isMenuOpen}
              tabIndex={0}
            >
              <div className={styles.content}>
                <span className={styles.originMarker}>
                  <OriginMarkerIcon color={textColor} />
                </span>
                <ZoomDisplayLeaf buttonRef={buttonRef} ariaLabelFn={ariaLabelFn} />
              </div>
              <span className={styles.srOnly}>
                {t('rulerCornerBox.aria.srOnly')}
              </span>
            </button>
          </TooltipTrigger>
        </PopoverAnchor>

        <TooltipContent side="right" sideOffset={8}>
          {tooltipContent}
        </TooltipContent>
      </Tooltip>

      <PopoverContent
        side="right"
        align="end"
        sideOffset={8}
        alignOffset={80}
        className={`${styles.menuContent} z-[1800]`}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <button type="button" role="menuitem" className={styles.menuItem} onClick={() => { onZoomToFit(); closeMenu(); }}>
          <span className={styles.menuItemIcon}><FitIcon /></span>
          <span className={styles.menuItemLabel}>{t('rulerCornerBox.menu.zoomToFit')}</span>
          <span className={styles.menuItemShortcut}>F</span>
        </button>

        <button type="button" role="menuitem" className={styles.menuItem} onClick={() => { onZoom100(); closeMenu(); }}>
          <span className={styles.menuItemIcon}><Zoom100Icon /></span>
          <span className={styles.menuItemLabel}>{t('rulerCornerBox.menu.zoom100')}</span>
          <span className={styles.menuItemShortcut}>0</span>
        </button>

        <div role="separator" className={styles.menuSeparator} />

        <button type="button" role="menuitem" className={styles.menuItem} onClick={() => { onZoomIn(); closeMenu(); }}>
          <span className={styles.menuItemIcon}><ZoomInIcon /></span>
          <span className={styles.menuItemLabel}>{t('rulerCornerBox.menu.zoomIn')}</span>
          <span className={styles.menuItemShortcut}>+</span>
        </button>

        <button type="button" role="menuitem" className={styles.menuItem} onClick={() => { onZoomOut(); closeMenu(); }}>
          <span className={styles.menuItemIcon}><ZoomOutIcon /></span>
          <span className={styles.menuItemLabel}>{t('rulerCornerBox.menu.zoomOut')}</span>
          <span className={styles.menuItemShortcut}>-</span>
        </button>

        <button type="button" role="menuitem" className={styles.menuItem} onClick={() => { onZoomPrevious(); closeMenu(); }}>
          <span className={styles.menuItemIcon}><HistoryIcon /></span>
          <span className={styles.menuItemLabel}>{t('rulerCornerBox.menu.previousView')}</span>
          <span className={styles.menuItemShortcut}>P</span>
        </button>

        <div role="separator" className={styles.menuSeparator} />

        <div className={styles.menuSection}>{t('rulerCornerBox.menu.zoomPresets')}</div>
        <nav className={styles.zoomPresets} aria-label={t('rulerCornerBox.aria.zoomPresets')}>
          <ZoomPresetButtons onZoomToScale={onZoomToScale} closeMenu={closeMenu} />
        </nav>
      </PopoverContent>
    </Popover>
    </TooltipProvider>
  );
});

export default RulerCornerBox;
