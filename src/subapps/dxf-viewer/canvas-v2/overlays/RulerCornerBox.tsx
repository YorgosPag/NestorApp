'use client';

/**
 * 🏢 ENTERPRISE: RulerCornerBox Component
 * CAD-GRADE Corner Box at ruler intersection (AutoCAD/Revit/Blender standard)
 *
 * Features:
 * - Single Click: Zoom to Fit (all entities)
 * - Double Click: Zoom 100% (1:1 scale)
 * - Ctrl+Click: Zoom Previous (history)
 * - Right Click / ArrowDown / Shift+F10: zoom menu (APG menu button with a default action —
 *   click stays Zoom to Fit, the menu is the secondary path; ADR-598 G11)
 * - Scroll Wheel: Quick zoom in/out
 * - Hover: Tooltip with instructions
 * - Keyboard: F=Fit, 0=100%, +/- zoom (when focused)
 * - Accessibility: WCAG 2.1 AA compliant
 *
 * @see ADR-009: Corner Box Feature Implementation
 * @see ADR-009 in docs/centralized-systems/reference/adr-index.md
 */

import React, { memo, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useTranslation } from '@/i18n';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
// ADR-598 G11: presets = ONE `menuitemradio` group (shared with ZoomControls)
import { ViewScalePresetRadioItems } from '../../ui/components/ViewScalePresetRadioItems';

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

// 🏢 ADR-418: the 1:N presets with the real active scale (`aria-checked`).
// Radix lazy-renders DropdownMenuContent → this leaf only subscribes while the menu is open.
function ZoomPresetRadioLeaf({
  onZoomToRatio,
  labelledBy,
}: {
  onZoomToRatio: (ratioN: number) => void;
  labelledBy: string;
}) {
  const { ratioN } = useViewScale();
  return (
    <ViewScalePresetRadioItems
      currentRatioN={ratioN}
      onSelectPreset={onZoomToRatio}
      aria-labelledby={labelledBy}
    />
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
  // No useViewScale() here — zoom-reactive rendering pushed to ZoomDisplayLeaf + ZoomPresetRadioLeaf.
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

  const presetsLabelId = useId();

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

  // Split button: the Radix trigger opens on left `pointerdown`, but here the left click IS
  // Zoom to Fit. `preventDefault` makes Radix skip its handler (composeEventHandlers); the
  // `click` still fires. Enter/Space are already prevented in `handleKeyDown`, so only
  // ArrowDown (Radix) and the context-menu path (right click, Shift+F10, Menu key) open it.
  const suppressTriggerPointerToggle = useCallback((e: React.PointerEvent) => {
    if (e.button === 0) e.preventDefault();
  }, []);

  // ===== RENDER =====
  // DropdownMenuTrigger wraps the button (menu-button semantics: aria-haspopup/expanded/controls
  // come from Radix). Tooltip wraps the same button for hover behavior.

  return (
    <TooltipProvider delayDuration={500}>
    <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
      <Tooltip>
        <DropdownMenuTrigger asChild>
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
              onPointerDown={suppressTriggerPointerToggle}
              onContextMenu={handleContextMenu}
              onWheel={handleWheel}
              onKeyDown={handleKeyDown}
              aria-label={t('rulerCornerBox.aria.viewScale', { scale: '1:1' })}
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
        </DropdownMenuTrigger>

        <TooltipContent side="right" sideOffset={8}>
          {tooltipContent}
        </TooltipContent>
      </Tooltip>

      <DropdownMenuContent
        side="right"
        align="end"
        sideOffset={8}
        alignOffset={80}
        className={`${styles.menuContent} z-[var(--z-index-tooltip)]`}
      >
        <DropdownMenuItem onSelect={onZoomToFit}>
          <span className={styles.menuItemIcon} aria-hidden><FitIcon /></span>
          {t('rulerCornerBox.menu.zoomToFit')}
          <DropdownMenuShortcut>F</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onZoomActualSize}>
          <span className={styles.menuItemIcon} aria-hidden><Zoom100Icon /></span>
          {t('rulerCornerBox.menu.actualSize')}
          <DropdownMenuShortcut>0</DropdownMenuShortcut>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem onSelect={onZoomIn}>
          <span className={styles.menuItemIcon} aria-hidden><ZoomInIcon /></span>
          {t('rulerCornerBox.menu.zoomIn')}
          <DropdownMenuShortcut>+</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onZoomOut}>
          <span className={styles.menuItemIcon} aria-hidden><ZoomOutIcon /></span>
          {t('rulerCornerBox.menu.zoomOut')}
          <DropdownMenuShortcut>-</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onZoomPrevious}>
          <span className={styles.menuItemIcon} aria-hidden><HistoryIcon /></span>
          {t('rulerCornerBox.menu.previousView')}
          <DropdownMenuShortcut>P</DropdownMenuShortcut>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuLabel id={presetsLabelId}>{t('rulerCornerBox.menu.viewScalePresets')}</DropdownMenuLabel>
        <ZoomPresetRadioLeaf onZoomToRatio={onZoomToRatio} labelledBy={presetsLabelId} />
      </DropdownMenuContent>
    </DropdownMenu>
    </TooltipProvider>
  );
});

export default RulerCornerBox;
