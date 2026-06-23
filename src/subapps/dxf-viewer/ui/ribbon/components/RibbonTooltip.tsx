'use client';

/**
 * ADR-345 — Ribbon tooltip umbrella: ONE on/off control for ALL ribbon tooltips.
 *
 * Giorgio 2026-06-23: the tooltips on every ribbon button merely repeated the
 * already-visible label/shortcut → pure noise while hovering the ribbon. Instead
 * of stripping `<Tooltip>` out of the 15 scattered ribbon files (and risking drift
 * the next time a button is added), every ribbon control imports
 * `Tooltip` / `TooltipTrigger` / `TooltipContent` FROM HERE. This thin wrapper
 * re-exports the global Radix primitives but gates them behind a single flag:
 *
 *   RIBBON_TOOLTIPS_ENABLED = false → no ribbon tooltip renders (current state)
 *   RIBBON_TOOLTIPS_ENABLED = true  → every ribbon tooltip returns, all at once
 *
 * The rest of the app (toolbar, statusbar, dialogs, overlays) keeps its own
 * tooltips — those import the global primitive directly and are unaffected. So the
 * ribbon tooltips are a scoped SUBSET of the app-wide tooltip set, with their own
 * switch: flip one line here to toggle them on demand.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-345-ribbon-system.md
 */

import React from 'react';
import {
  Tooltip as UiTooltip,
  TooltipTrigger as UiTooltipTrigger,
  TooltipContent as UiTooltipContent,
} from '@/components/ui/tooltip';

/**
 * Single source of truth for ribbon-tooltip visibility. Flip to `true` to restore
 * every ribbon tooltip at once. Annotated `boolean` (not the literal `false`) so the
 * enabled branch stays reachable for the type-checker.
 */
export const RIBBON_TOOLTIPS_ENABLED: boolean = false;

/** Ribbon-scoped Tooltip root — passes through when enabled, renders children only when off. */
export const Tooltip: React.FC<React.ComponentProps<typeof UiTooltip>> = (props) =>
  RIBBON_TOOLTIPS_ENABLED ? <UiTooltip {...props} /> : <>{props.children}</>;

/** Ribbon-scoped trigger — when off, renders the wrapped element (the button) as-is. */
export const TooltipTrigger: React.FC<React.ComponentProps<typeof UiTooltipTrigger>> = (props) =>
  RIBBON_TOOLTIPS_ENABLED ? <UiTooltipTrigger {...props} /> : <>{props.children}</>;

/** Ribbon-scoped content — when off, renders nothing (no floating label). */
export const TooltipContent: React.FC<React.ComponentProps<typeof UiTooltipContent>> = (props) =>
  RIBBON_TOOLTIPS_ENABLED ? <UiTooltipContent {...props} /> : null;
