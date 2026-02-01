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

import React, { useCallback, useRef, useState } from 'react';
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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

// ===== TYPES =====

interface RulerCornerBoxProps {
  /** Width of the vertical ruler (left) */
  rulerWidth: number;
  /** Height of the horizontal ruler (bottom) */
  rulerHeight: number;
  /** Current zoom scale (1.0 = 100%) */
  currentScale: number;
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
  /** Viewport dimensions for calculations */
  viewport: { width: number; height: number };
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

// ===== MAIN COMPONENT =====

export default function RulerCornerBox({
  rulerWidth,
  rulerHeight,
  currentScale,
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
  viewport,
}: RulerCornerBoxProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const lastClickRef = useRef<number>(0);
  const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Format zoom percentage (ADR-081: Uses centralized formatPercent)
  const zoomPercent = Math.round(currentScale * 100);
  const zoomDisplay = zoomPercent >= 1000 ? `${(zoomPercent / 1000).toFixed(1)}k%` : formatPercent(currentScale);

  // ===== CLICK HANDLERS =====

  const handleClick = useCallback((e: React.MouseEvent) => {
    // Prevent if right-click menu is open
    if (isMenuOpen) return;

    // Ctrl+Click = Zoom Previous
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      onZoomPrevious();
      return;
    }

    const now = Date.now();
    const timeSinceLastClick = now - lastClickRef.current;

    // Double-click detection (within DOUBLE_CLICK_WINDOW ms)
    if (timeSinceLastClick < PANEL_LAYOUT.TIMING.DOUBLE_CLICK_WINDOW) {
      // Clear single-click timeout
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current);
        clickTimeoutRef.current = null;
      }
      // Double-click = Zoom 100%
      onZoom100();
      lastClickRef.current = 0;
    } else {
      // Potential single-click, wait to confirm
      lastClickRef.current = now;
      clickTimeoutRef.current = setTimeout(() => {
        // Single-click = Zoom to Fit
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
      // Default behavior: zoom in/out
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
    // 🏢 FIX (2026-01-04): Right-click MUST open the menu as per ADR-009 documentation
    setIsMenuOpen(true);
  }, []);

  // ===== TOOLTIP CONTENT =====

  const tooltipContent = (
    <section className={styles.tooltipContent}>
      <div className={styles.tooltipLine}>
        <span className={styles.tooltipKey}>Click:</span>
        <span className={styles.tooltipAction}>Zoom to Fit</span>
      </div>
      <div className={styles.tooltipLine}>
        <span className={styles.tooltipKey}>Double:</span>
        <span className={styles.tooltipAction}>Zoom 100%</span>
      </div>
      <div className={styles.tooltipLine}>
        <span className={styles.tooltipKey}>Ctrl+Click:</span>
        <span className={styles.tooltipAction}>Previous View</span>
      </div>
      <div className={styles.tooltipLine}>
        <span className={styles.tooltipKey}>Right-Click:</span>
        <span className={styles.tooltipAction}>Zoom Menu</span>
      </div>
      <div className={styles.tooltipLine}>
        <span className={styles.tooltipKey}>Scroll:</span>
        <span className={styles.tooltipAction}>Quick Zoom</span>
      </div>
    </section>
  );

  // ===== RENDER =====

  // 🏢 FIX (2026-01-04): Use ref to position menu relative to button
  const buttonRef = useRef<HTMLButtonElement>(null);

  return (
    <TooltipProvider delayDuration={500}>
      {/* 🏢 FIX (2026-01-04): Simplified structure - Tooltip wraps button directly */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            ref={buttonRef}
            type="button"
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
            aria-label={`Zoom controls. Current zoom: ${zoomPercent}%. Click to fit, double-click for 100%, right-click for menu.`}
            aria-haspopup="menu"
            aria-expanded={isMenuOpen}
            tabIndex={0}
          >
            <div className={styles.content}>
              <span className={styles.originMarker}>
                <OriginMarkerIcon color={textColor} />
              </span>
              <span className={styles.zoomLevel} aria-live="polite">
                {zoomDisplay}
              </span>
            </div>
            <span className={styles.srOnly}>
              Corner box zoom controls
            </span>
          </button>
        </TooltipTrigger>

        <TooltipContent side="right" sideOffset={8}>
          {tooltipContent}
        </TooltipContent>
      </Tooltip>

      {/* 🏢 FIX (2026-01-04): DropdownMenu SEPARATE from Tooltip - no nesting conflict */}
      <DropdownMenu
        open={isMenuOpen}
        onOpenChange={(open) => {
          if (!open) setIsMenuOpen(false);
        }}
      >
        {/* Hidden trigger - menu positioned via CSS */}
        <DropdownMenuTrigger asChild>
          <span
            className={styles.hiddenTrigger}
            style={{
              position: 'absolute',
              left: rulerWidth,
              bottom: rulerHeight,
              width: 1,
              height: 1,
              pointerEvents: 'none',
            }}
          />
        </DropdownMenuTrigger>

        {/* ===== CONTEXT MENU ===== */}
        <DropdownMenuContent
          className={styles.menuContent}
          side="top"
          align="start"
          sideOffset={4}
        >
          {/* Primary Actions */}
          <DropdownMenuItem
            className={styles.menuItem}
            onClick={onZoomToFit}
          >
            <span className={styles.menuItemIcon}><FitIcon /></span>
            <span className={styles.menuItemLabel}>Zoom to Fit</span>
            <span className={styles.menuItemShortcut}>F</span>
          </DropdownMenuItem>

          <DropdownMenuItem
            className={styles.menuItem}
            onClick={onZoom100}
          >
            <span className={styles.menuItemIcon}><Zoom100Icon /></span>
            <span className={styles.menuItemLabel}>Zoom 100%</span>
            <span className={styles.menuItemShortcut}>0</span>
          </DropdownMenuItem>

          <DropdownMenuSeparator className={styles.menuSeparator} />

          {/* Zoom In/Out */}
          <DropdownMenuItem
            className={styles.menuItem}
            onClick={onZoomIn}
          >
            <span className={styles.menuItemIcon}><ZoomInIcon /></span>
            <span className={styles.menuItemLabel}>Zoom In</span>
            <span className={styles.menuItemShortcut}>+</span>
          </DropdownMenuItem>

          <DropdownMenuItem
            className={styles.menuItem}
            onClick={onZoomOut}
          >
            <span className={styles.menuItemIcon}><ZoomOutIcon /></span>
            <span className={styles.menuItemLabel}>Zoom Out</span>
            <span className={styles.menuItemShortcut}>-</span>
          </DropdownMenuItem>

          <DropdownMenuItem
            className={styles.menuItem}
            onClick={onZoomPrevious}
          >
            <span className={styles.menuItemIcon}><HistoryIcon /></span>
            <span className={styles.menuItemLabel}>Previous View</span>
            <span className={styles.menuItemShortcut}>P</span>
          </DropdownMenuItem>

          <DropdownMenuSeparator className={styles.menuSeparator} />

          {/* Zoom Presets */}
          <div className={styles.menuSection}>Zoom Presets</div>
          <nav className={styles.zoomPresets} aria-label="Zoom presets">
            {ZOOM_PRESETS.map(({ label, scale }) => (
              <button
                key={label}
                type="button"
                className={cn(
                  styles.zoomPresetButton,
                  // 🏢 ADR-079: Use centralized zoom preset matching threshold
                  Math.abs(currentScale - scale) < MOVEMENT_DETECTION.ZOOM_PRESET_MATCH && styles.active
                )}
                onClick={() => {
                  onZoomToScale(scale);
                  setIsMenuOpen(false);
                }}
                aria-pressed={Math.abs(currentScale - scale) < MOVEMENT_DETECTION.ZOOM_PRESET_MATCH}
              >
                {label}
              </button>
            ))}
          </nav>
        </DropdownMenuContent>
      </DropdownMenu>
    </TooltipProvider>
  );
}
