/**
 * ADR-443 — Structural tool icon METHOD (creation-method) badge fragments (data).
 *
 * A small bottom-right glyph (~x14–22, y14–22) overlaid on a base symbol by
 * `StructuralToolIcon.tsx` to distinguish HOW a member is created. Shared across
 * ALL families (wall / column / beam / foundation) — this is the SSoT win: a new
 * creation method = one fragment here, reused by every base.
 *
 * `single` (placed directly, no modifier) renders no badge. The `tie` method
 * (two members + transverse link) keeps the foundation tie-beam visually distinct
 * from strip-from-wall (`on-entity`).
 *
 * Authoring rules: viewBox 0 0 24 24, stroke=currentColor (inherited). Keep the
 * glyph inside the bottom-right corner so it reads as a badge over any base.
 */

import * as React from 'react';

export type StructuralMethod =
  | 'single'
  | 'on-entity'
  | 'region-lines'
  | 'region-inside'
  | 'region-box'
  | 'from-perimeter'
  | 'discrete-from-perimeter'
  | 'discrete-from-perimeter-walls'
  | 'from-grid'
  | 'sketch-polygon'
  | 'tie';

export const STRUCTURAL_METHOD_FRAGMENTS: Record<StructuralMethod, React.ReactNode> = {
  // Placed directly — no creation-method modifier.
  single: null,
  // On a host entity: pick a reference line, drop the member on it.
  'on-entity': (
    <>
      <line x1="15" y1="22" x2="22" y2="15" strokeWidth="1.3" />
      <circle cx="18.5" cy="18.5" r="1.3" fill="currentColor" stroke="none" />
    </>
  ),
  // From picked boundary lines (open polyline).
  'region-lines': (
    <polyline points="15,22 15,16 21,16" fill="none" strokeWidth="1.3" />
  ),
  // From a point inside a closed region.
  'region-inside': (
    <>
      <rect x="15" y="15" width="7" height="7" rx="0.8" strokeWidth="1.2" />
      <circle cx="18.5" cy="18.5" r="1.4" fill="currentColor" stroke="none" />
    </>
  ),
  // From a window/box selection (dashed rectangle).
  'region-box': (
    <rect x="15" y="15.5" width="7.5" height="6" rx="0.5" strokeWidth="1.2" strokeDasharray="2,1.3" />
  ),
  // From a closed perimeter (continuous outline).
  'from-perimeter': (
    <path d="M15 21.5 L15.5 15.5 L20.5 15 L22 19 L18.5 22 Z" fill="none" strokeWidth="1.2" />
  ),
  // Discrete members at perimeter corners (outline + corner dots).
  'discrete-from-perimeter': (
    <>
      <rect x="15.5" y="15.5" width="6.5" height="6.5" fill="none" strokeWidth="1" />
      <circle cx="15.5" cy="15.5" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="22" cy="15.5" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="22" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="22" cy="22" r="1.1" fill="currentColor" stroke="none" />
    </>
  ),
  // Discrete members at wall-outline corners (double line + corner dots).
  'discrete-from-perimeter-walls': (
    <>
      <polyline points="15,22 15,15.5 22,15.5" fill="none" strokeWidth="1" />
      <polyline points="17,22 17,17.5 22,17.5" fill="none" strokeWidth="1" />
      <circle cx="15" cy="15.5" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="22" cy="15.5" r="1.1" fill="currentColor" stroke="none" />
    </>
  ),
  // Sketched vertex-by-vertex (open click path + vertex dots) — ADR-363
  // §column-polygon-sketch «Κολώνα από σχεδιασμένο πολύγωνο» (ίδιο engine με slab).
  'sketch-polygon': (
    <>
      <polyline points="15,21.5 15.5,15.5 21.5,16 20,21.5" fill="none" strokeWidth="1.1" />
      <circle cx="15" cy="21.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="15.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="21.5" cy="16" r="1" fill="currentColor" stroke="none" />
      <circle cx="20" cy="21.5" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  // From a structural grid (grid lines + intersection dots).
  'from-grid': (
    <>
      <path d="M17 14.8 V22.5 M20.5 14.8 V22.5 M14.8 17 H22.5 M14.8 20.5 H22.5" strokeWidth="1" />
      <circle cx="17" cy="17" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="20.5" cy="17" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="17" cy="20.5" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="20.5" cy="20.5" r="0.9" fill="currentColor" stroke="none" />
    </>
  ),
  // Tie member linking two parallel members (two bars + transverse tie).
  tie: (
    <>
      <line x1="15" y1="16.5" x2="22" y2="16.5" strokeWidth="1.3" />
      <line x1="15" y1="20.5" x2="22" y2="20.5" strokeWidth="1.3" />
      <line x1="18.5" y1="16.5" x2="18.5" y2="20.5" strokeWidth="1.1" />
    </>
  ),
};
