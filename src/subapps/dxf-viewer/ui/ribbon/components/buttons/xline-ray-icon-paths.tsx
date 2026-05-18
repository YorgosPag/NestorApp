'use client';
/**
 * ADR-359 Phase 10.b — SVG path constants for XLINE + RAY ribbon buttons.
 * Pure data: JSX element constants, no rendering logic.
 * Split from RibbonButtonIconPaths.tsx for SRP (N.7.1 Google file-size standard).
 */
import React from 'react';
import { ICON_CLICK_COLORS } from '../../../../config/color-config';
import { dot } from './RibbonButtonIconPaths';

// XLINE — infinite line (both-direction ticks + center origin dot).
export const XLINE_PATH = (
  <>
    <line x1="2" y1="12" x2="22" y2="12" />
    <line x1="2" y1="9" x2="2" y2="15" />
    <line x1="22" y1="9" x2="22" y2="15" />
    {dot(12, 12, ICON_CLICK_COLORS.FIRST)}
  </>
);

// RAY — semi-infinite line (origin dot + arrowhead).
export const RAY_PATH = (
  <>
    <line x1="4" y1="12" x2="20" y2="12" />
    <polyline points="17,9 20,12 17,15" fill="none" />
    {dot(4, 12, ICON_CLICK_COLORS.FIRST)}
  </>
);
