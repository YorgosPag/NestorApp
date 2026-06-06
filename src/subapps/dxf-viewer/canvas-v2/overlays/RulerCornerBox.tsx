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
// 🏢 ADR-098: Centralized Timing Constants (Double-Click Window)
import { PANEL_LAYOUT } from '../../config/panel-tokens';
// 🏢 ENTERPRISE (2026-02-01): Centralized Menu Icons - ADR-133
import {
  FitIcon,
  ZoomInIcon,
  ZoomOutIcon,
  Zoom100Icon,
  HistoryIcon,
  OriginMarkerIcon,
} from '../../ui/icons/MenuIcons';
// 🏢 ADR-418: real view-scale (1:N) micro-leaf hook + ratio presets SSoT
import { useViewScale } from '../../systems/zoom/hooks/useViewScale';
import { VIEW_SCALE_MENU_PRESETS, isViewRatioActive } from '../../utils/view-scale';

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
  /** 🏢 ADR-418: Callback for Zoom to 1:1 actual size */
  onZoomActualSize: () => void;
  /** Callback for Zoom In */
  onZoomIn: () => void;
  /** Callback for Zoom Out */
  onZoomOut: () => void;
  /** Callback for Zoom Previous (history) */
  onZoomPrevious: () => void;
  /** 🏢 ADR-418: Callback for Zoom to a real drawing scale 1:N */
  onZoomToRatio: (ratioN: number) => void;
  /** Callback for wheel zoom */
  onWheelZoom?: (delta: number) => void;
  /** Optional className for custom styling */
  className?: string;
  /** When false, hides the OriginMarkerIcon (cross lines) */
  showTicks?: boolean;
  /** When false, hides the ZoomDisplayLeaf (1:N scale text) */
  showLabels?: boolean;
  /** When false, hides the ZoomDisplayLeaf (1:N scale text) */
  showUnits?: boolean;
}

// ===== MICRO-LEAVES (ADR-040) =====

// 🏢 ADR-418: subscribes to the view-scale leaf; renders real "1:N" scale +
// updates button aria-label imperatively. Keeps RulerCornerBox stable under
// React.memo — no parent re-render on zoom.
function ZoomDisplayLeaf({
  buttonRef,
  ariaLabelFn,
}: {
  buttonRef: React.RefObject<HTMLButtonElement | null>;
  ariaLabelFn: (ratioLabel: string) => string;
}) {
  const { label } = useViewScale();
  useEffect(() => {
    buttonRef.current?.setAttribute('aria-label', ariaLabelFn(label));
  }, [label, ariaLabelFn, buttonRef]);
  return <span className={styles.zoomLevel} aria-live="polite">{label}</span>;
}

// 🏢 ADR-418: renders 1:N preset buttons with correct active state.
// Radix lazy-renders PopoverContent → this leaf only runs when popover is open.
function ZoomPresetButtons({
  onZoomToRatio,
  closeMenu,
}: {
  onZoomToRatio: (ratioN: number) => void;
  closeMenu: () => void;
}) {
  const { ratioN } = useViewScale();
  return (
    <>
      {VIEW_SCALE_MENU_PRESETS.map((presetN) => {
        const active = isViewRatioActive(ratioN, presetN);
        return (
          <button
            key={presetN}
            type="button"
            className={cn(styles.zoomPresetButton, active && styles.active)}
            onClick={() => { onZoomToRatio(presetN); closeMenu(); }}
            aria-pressed={active}
          >
            {`1:${presetN}`}
          </button>
        );
      })}
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
  onZoomActualSize,
  onZoomIn,
  onZoomOut,
  onZoomPrevious,
  onZoomToRatio,
  onWheelZoom,
  className,
  showTicks,
  showLabels,
  showUnits,
}: RulerCornerBoxProps) {
  const { t } = useTranslation('dxf-viewer-panels');
  // No useViewScale() here — zoom-reactive rendering pushed to ZoomDisplayLeaf + ZoomPresetButtons.
  // React.memo on this component now works for zoom too (only re-renders on prop/state change).
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const lastClickRef = useRef<number>(0);
  const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // 🏢 ADR-418: aria reflects the real view scale (e.g. "1:69"), not a pixel %.
  const ariaLabelFn = useCallback(
    (ratioLabel: string) => t('rulerCornerBox.aria.viewScale', { scale: ratioLabel }),
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
      onZoomActualSize();
      lastClickRef.current = 0;
    } else {
      lastClickRef.current = now;
      clickTimeoutRef.current = setTimeout(() => {
        onZoomToFit();
        clickTimeoutRef.current = null;
      }, PANEL_LAYOUT.TIMING.DOUBLE_CLICK_WINDOW);
    }
  }, [isMenuOpen, onZoomToFit, onZoomActualSize, onZoomPrevious]);

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
        onZoomActualSize();
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
  }, [onZoomToFit, onZoomActualSize, onZoomIn, onZoomOut, onZoomPrevious]);

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
        <span className={styles.tooltipAction}>{t('rulerCornerBox.tooltip.actualSize')}</span>
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
              aria-label={t('rulerCornerBox.aria.viewScale', { scale: '1:1' })}
              aria-haspopup="menu"
              aria-expanded={isMenuOpen}
              tabIndex={0}
            >
              <div className={styles.content}>
                {showTicks !== false && (
                  <span className={styles.originMarker}>
                    <OriginMarkerIcon color={textColor} />
                  </span>
                )}
                {showTicks !== false && showLabels !== false && showUnits !== false && (
                  <ZoomDisplayLeaf buttonRef={buttonRef} ariaLabelFn={ariaLabelFn} />
                )}
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

        <button type="button" role="menuitem" className={styles.menuItem} onClick={() => { onZoomActualSize(); closeMenu(); }}>
          <span className={styles.menuItemIcon}><Zoom100Icon /></span>
          <span className={styles.menuItemLabel}>{t('rulerCornerBox.menu.actualSize')}</span>
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

        <div className={styles.menuSection}>{t('rulerCornerBox.menu.viewScalePresets')}</div>
        <nav className={styles.zoomPresets} aria-label={t('rulerCornerBox.aria.viewScalePresets')}>
          <ZoomPresetButtons onZoomToRatio={onZoomToRatio} closeMenu={closeMenu} />
        </nav>
      </PopoverContent>
    </Popover>
    </TooltipProvider>
  );
});

export default RulerCornerBox;
