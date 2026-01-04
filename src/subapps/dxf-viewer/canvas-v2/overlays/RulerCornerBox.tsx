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
 * @see centralized_systems.md - Rule #X: Zoom System
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

// ===== ORIGIN MARKER ICON =====

function OriginMarkerIcon({ color }: { color: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* Horizontal line */}
      <line x1="4" y1="12" x2="20" y2="12" />
      {/* Vertical line */}
      <line x1="12" y1="4" x2="12" y2="20" />
      {/* Center circle */}
      <circle cx="12" cy="12" r="2" fill={color} />
    </svg>
  );
}

// ===== MENU ICONS =====

function FitIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
    </svg>
  );
}

function ZoomInIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
      <line x1="11" y1="8" x2="11" y2="14" />
      <line x1="8" y1="11" x2="14" y2="11" />
    </svg>
  );
}

function ZoomOutIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
      <line x1="8" y1="11" x2="14" y2="11" />
    </svg>
  );
}

function Zoom100Icon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <text x="12" y="15" textAnchor="middle" fontSize="8" fill="currentColor">1:1</text>
    </svg>
  );
}

function HistoryIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  );
}

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

  // Format zoom percentage
  const zoomPercent = Math.round(currentScale * 100);
  const zoomDisplay = zoomPercent >= 1000 ? `${(zoomPercent / 1000).toFixed(1)}k%` : `${zoomPercent}%`;

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

    // Double-click detection (within 300ms)
    if (timeSinceLastClick < 300) {
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
      }, 300);
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

  return (
    <TooltipProvider delayDuration={500}>
      {/* 🏢 FIX (2026-01-04): Menu opens ONLY on right-click, not left-click */}
      <DropdownMenu
        open={isMenuOpen}
        onOpenChange={(open) => {
          // Only allow CLOSING from Radix - OPENING is controlled by handleContextMenu
          if (!open) setIsMenuOpen(false);
        }}
      >
        {/* 🏢 FIX (2026-01-04): DropdownMenuTrigger wraps the button so menu positions correctly */}
        <DropdownMenuTrigger asChild>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
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
        </DropdownMenuTrigger>

        {/* ===== CONTEXT MENU ===== */}
        {/* 🏢 FIX (2026-01-04): Menu position - bottom-left of menu at top-right of corner box */}
        <DropdownMenuContent
          className={styles.menuContent}
          side="top"
          align="start"
          sideOffset={4}
          alignOffset={rulerWidth}
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
                  Math.abs(currentScale - scale) < 0.01 && styles.active
                )}
                onClick={() => {
                  onZoomToScale(scale);
                  setIsMenuOpen(false);
                }}
                aria-pressed={Math.abs(currentScale - scale) < 0.01}
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
