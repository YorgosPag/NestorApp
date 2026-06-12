'use client';

/**
 * ADR-443 — Composed structural tool icon (Revit-grade, FULL SSoT).
 *
 * Renders a Revit-style base symbol (wall / column / beam / foundation pad /
 * foundation strip) plus a bottom-right "creation method" badge glyph. One
 * component × {base, method} fragment maps = 22 distinct ribbon icons from only
 * 5 + 10 fragment definitions — the SSoT alternative to 22 hand-drawn glyphs. A
 * new base or method is +1 fragment, never N×M.
 *
 * Sizing follows the `CircleIcon` pattern: no width/height here, the caller
 * passes the ribbon icon class (`dxf-ribbon-btn-icon-large|small`).
 *
 * @see structural-icon-bases.tsx · structural-icon-methods.tsx
 */

import * as React from 'react';
import { STRUCTURAL_BASE_FRAGMENTS, type StructuralBase } from './structural-icon-bases';
import { STRUCTURAL_METHOD_FRAGMENTS, type StructuralMethod } from './structural-icon-methods';

interface StructuralToolIconProps {
  base: StructuralBase;
  method: StructuralMethod;
  className?: string;
}

export const StructuralToolIcon: React.FC<StructuralToolIconProps> = ({
  base,
  method,
  className,
}) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {STRUCTURAL_BASE_FRAGMENTS[base]}
    {STRUCTURAL_METHOD_FRAGMENTS[method]}
  </svg>
);
