/**
 * ADR-608 — **Nestor dimension appearance SSoT** (Giorgio 2026-07-10).
 *
 * The single, browser-calibrated set of *structural* dimension-style values (annotation scale,
 * text height, arrow size/block, text placement, background mask). Consumed by BOTH:
 *   - `NESTOR_DEFAULT_TEMPLATE` (app-created dims), and
 *   - `tek-dim-to-dimension` (Tekton-imported dims),
 * so a dimension drawn in the app is the SAME size/shape/layout as one imported from `.tek` — no
 * divergence, no duplicated magic numbers. Only **colour** stays per-source (the app keeps its
 * green Nestor identity; the Tekton import carries the per-record 4-colour scheme).
 *
 * Rationale for the numbers (all paper-mm unless noted):
 *   - `SCALE` 150 — annotation scale (1:100 × 1.5 readability). Wins in `resolveEffectiveDimscale`
 *     (>1), so dims are readable independent of the flaky auto drawing-scale.
 *   - `TEXT_HEIGHT` 0.8 → 0.8×150 = 120 (world) readable text.
 *   - `ARROW_SIZE` 1.2 → 1.2×150 = 180 arrow length; the «Βέλος 2» proportions live in the
 *     `tektonArrow2` arrowhead block (base/length/tick/leader/inset).
 *   - `ARROW_BLOCK` `tektonArrow2` — mirrored outline triangle + tip tick + centre leader + dim-line
 *     pull-back (the calibrated Tekton head).
 *   - `TEXT_PLACEMENT` centered (co-axial with the dim line) · `TEXT_FILL` backgroundColor (mask =
 *     live canvas background, so text cuts the line cleanly).
 */

import type { DimTextVerticalPlacement, DimTextFillMode } from '../../types/dimension';

export const NESTOR_DIM_ANNOTATION_SCALE = 150;
export const NESTOR_DIM_TEXT_HEIGHT = 0.8;
export const NESTOR_DIM_ARROW_SIZE = 1.2;
export const NESTOR_DIM_ARROW_BLOCK = 'tektonArrow2';
export const NESTOR_DIM_TEXT_PLACEMENT: DimTextVerticalPlacement = 'centered';
export const NESTOR_DIM_TEXT_FILL: DimTextFillMode = 'backgroundColor';
