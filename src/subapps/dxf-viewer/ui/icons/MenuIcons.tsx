'use client';

/**
 * 🏢 ENTERPRISE: Centralized Menu Icons
 * Single source of truth for context menu & zoom control icons
 *
 * @description Κεντρικοποιημένα SVG icons για context menus και zoom controls.
 * Αντικαθιστά inline icon definitions σε RulerCornerBox.tsx και DrawingContextMenu.tsx
 *
 * @see ADR-133: Centralized SVG Stroke Width Tokens
 * @see ADR-009: Corner Box Feature Implementation
 * @see ADR-047: Drawing Tool Keyboard Shortcuts & Context Menu
 *
 * @author Γιώργος Παγώνης + Claude Code (Anthropic AI)
 * @since 2026-02-01
 * @version 1.0.0
 */

import React from 'react';
import { PANEL_LAYOUT } from '../../config/panel-tokens';

// ============================================================================
// TYPES
// ============================================================================

interface IconProps {
  /** Optional className for custom styling */
  className?: string;
  /** Optional color (defaults to 'currentColor') */
  color?: string;
}

// ============================================================================
// BASE SVG WRAPPER
// ============================================================================

const STROKE_WIDTH = PANEL_LAYOUT.SVG_ICON.STROKE_WIDTH.STANDARD;

interface SvgWrapperProps extends IconProps {
  children: React.ReactNode;
}

function SvgWrapper({ children, className, color = 'currentColor' }: SvgWrapperProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={STROKE_WIDTH}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

// ============================================================================
// ZOOM ICONS (RulerCornerBox)
// ============================================================================

/**
 * Fit to screen icon (expand arrows to corners)
 * Used in: RulerCornerBox zoom menu
 */
export function FitIcon({ className, color }: IconProps) {
  return (
    <SvgWrapper className={className} color={color}>
      <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
    </SvgWrapper>
  );
}

/**
 * Zoom in icon (magnifying glass with plus)
 * Used in: RulerCornerBox zoom menu
 */
export function ZoomInIcon({ className, color }: IconProps) {
  return (
    <SvgWrapper className={className} color={color}>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
      <line x1="11" y1="8" x2="11" y2="14" />
      <line x1="8" y1="11" x2="14" y2="11" />
    </SvgWrapper>
  );
}

/**
 * Zoom out icon (magnifying glass with minus)
 * Used in: RulerCornerBox zoom menu
 */
export function ZoomOutIcon({ className, color }: IconProps) {
  return (
    <SvgWrapper className={className} color={color}>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
      <line x1="8" y1="11" x2="14" y2="11" />
    </SvgWrapper>
  );
}

/**
 * Zoom 100% icon (1:1 scale box)
 * Used in: RulerCornerBox zoom menu
 */
export function Zoom100Icon({ className, color }: IconProps) {
  return (
    <SvgWrapper className={className} color={color}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <text x="12" y="15" textAnchor="middle" fontSize="8" fill="currentColor">1:1</text>
    </SvgWrapper>
  );
}

/**
 * History/previous view icon (clock with arrow)
 * Used in: RulerCornerBox zoom menu for "Previous View"
 */
export function HistoryIcon({ className, color }: IconProps) {
  return (
    <SvgWrapper className={className} color={color}>
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </SvgWrapper>
  );
}

/**
 * Origin marker icon (crosshair with center dot)
 * Used in: RulerCornerBox as main icon display
 */
export function OriginMarkerIcon({ className, color }: IconProps) {
  return (
    <SvgWrapper className={className} color={color}>
      {/* Horizontal line */}
      <line x1="4" y1="12" x2="20" y2="12" />
      {/* Vertical line */}
      <line x1="12" y1="4" x2="12" y2="20" />
      {/* Center circle */}
      <circle cx="12" cy="12" r="2" fill={color || 'currentColor'} />
    </SvgWrapper>
  );
}

// ============================================================================
// DRAWING CONTEXT MENU ICONS (DrawingContextMenu)
// ============================================================================

/**
 * Enter/finish icon (return arrow)
 * Used in: DrawingContextMenu for finishing drawing operations
 */
export function EnterIcon({ className, color }: IconProps) {
  return (
    <SvgWrapper className={className} color={color}>
      <polyline points="9 10 4 15 9 20" />
      <path d="M20 4v7a4 4 0 0 1-4 4H4" />
    </SvgWrapper>
  );
}

/**
 * Close polygon icon (3D layers/polygon)
 * Used in: DrawingContextMenu for closing polygon shapes
 */
export function ClosePolygonIcon({ className, color }: IconProps) {
  return (
    <SvgWrapper className={className} color={color}>
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <path d="M2 17l10 5 10-5" />
      <path d="M2 12l10 5 10-5" />
    </SvgWrapper>
  );
}

/**
 * Undo icon (curved arrow back)
 * Used in: DrawingContextMenu for undoing last point
 */
export function UndoIcon({ className, color }: IconProps) {
  return (
    <SvgWrapper className={className} color={color}>
      <path d="M3 7v6h6" />
      <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
    </SvgWrapper>
  );
}

/**
 * Cancel icon (X in circle)
 * Used in: DrawingContextMenu for canceling drawing operations
 */
export function CancelIcon({ className, color }: IconProps) {
  return (
    <SvgWrapper className={className} color={color}>
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </SvgWrapper>
  );
}

/**
 * Flip arc direction icon (two opposing arcs with arrows)
 * Used in: DrawingContextMenu for arc tools (arc-3p, arc-cse, arc-sce)
 *
 * @note Uses THIN stroke width for detailed arc visualization
 */
export function FlipArcIcon({ className, color }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke={color || 'currentColor'}
      strokeWidth={PANEL_LAYOUT.SVG_ICON.STROKE_WIDTH.THIN}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {/* Top arc with arrow right */}
      <path d="M5 12 A 7 7 0 0 1 19 12" />
      <polyline points="16 9 19 12 16 15" />
      {/* Bottom arc with arrow left (dashed) */}
      <path d="M5 12 A 7 7 0 0 0 19 12" strokeDasharray="3,2" opacity="0.6" />
      <polyline points="8 9 5 12 8 15" opacity="0.6" />
    </svg>
  );
}
