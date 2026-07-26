'use client';

/**
 * @module ui/surface-context
 * @enterprise ADR-710 §11 — How deep a section shell is, as a fact of position.
 *
 * ## The defect this exists to make unwritable
 *
 * The app has two shells that each own a framed section: `ReportSection` (58 consumers)
 * and `ChartCard` (14). Both render a `<Card>` and both hardcoded an `<h3>`. Nesting one
 * in the other therefore produced `Card > CardContent > Card > CardContent` **and** an
 * `<h3>` inside an `<h3>` — a visual defect and a semantic one, since heading level is
 * how a screen-reader user builds the page outline (WCAG 1.3.1).
 *
 * Material 3 and Polaris both answer "don't nest cards". Carbon answers "the chart does
 * not render its own tile". All three leave the rule in **documentation**. This module
 * is the same rule as a **mechanism** — the nesting cannot be written, because the shell
 * that would nest throws on sight.
 *
 * ## Why depth is context and not a prop
 *
 * A `frame="bare"` prop would be the shell branching on *who is calling it*, which is
 * precisely the shape ADR-710 §2 rejects — it moves the duplication into the call site's
 * config object where only a token-level clone detector can see it. Depth is not a
 * caller's preference; it is a fact about **position in the tree**, which is what React
 * context is for. This is the established heading-level pattern (Heydon Pickering;
 * `react-headings`), applied to surfaces as well as headings.
 *
 * ## Why the nesting check throws instead of degrading
 *
 * A silent auto-degrade ("I'm nested, so I'll skip my `<Card>`") would render correctly
 * and hide the mistake forever. A throw surfaces it on the first render and the first
 * test. The message names the fix, so the throw is a instruction, not a punishment.
 *
 * @see ChartCard.tsx — declares a surface, refuses to nest
 * @see ChartPlot.tsx — the frameless level, for when the frame is already owned
 */

import { createContext, useContext, type ReactNode } from 'react';

/**
 * Number of section shells enclosing this point. `0` = page level.
 *
 * Only shells that own a *frame plus a heading* increment it. A plain `<Card>` used as a
 * layout box does not — the count tracks document structure, not boxes with borders.
 */
const SurfaceDepthContext = createContext(0);

/** Heading level a shell at depth 0 uses. Page `<h1>` and route `<h2>` sit above it. */
const BASE_HEADING_LEVEL = 3;

/** The deepest real heading. HTML stops at 6; rendering an `h7` is a bug, not a level. */
const MAX_HEADING_LEVEL = 6;

export type HeadingTag = 'h3' | 'h4' | 'h5' | 'h6';

export interface SurfaceBoundaryProps {
  readonly children: ReactNode;
}

/**
 * Marks everything inside as one level deeper.
 *
 * Rendered by a shell that owns a framed, titled section — `ChartCard` and
 * `ReportSection`. It publishes the fact; it does not decide what anyone does with it.
 */
export function SurfaceBoundary({ children }: SurfaceBoundaryProps) {
  const depth = useContext(SurfaceDepthContext);
  return (
    <SurfaceDepthContext.Provider value={depth + 1}>{children}</SurfaceDepthContext.Provider>
  );
}

/** How many section shells enclose this point. */
export function useSurfaceDepth(): number {
  return useContext(SurfaceDepthContext);
}

/** Whether a section shell already owns the frame here. */
export function useIsInsideSurface(): boolean {
  return useContext(SurfaceDepthContext) > 0;
}

/**
 * The heading element a shell should render at this depth.
 *
 * Clamped at `h6` rather than throwing: a document nested seven shells deep has a layout
 * problem, but silently emitting an invalid `<h7>` would additionally break the outline
 * that this module exists to protect.
 */
export function useHeadingTag(): HeadingTag {
  const depth = useContext(SurfaceDepthContext);
  const level = Math.min(BASE_HEADING_LEVEL + depth, MAX_HEADING_LEVEL);
  return `h${level}` as HeadingTag;
}

/**
 * Refuse to render a second frame around an already-framed region.
 *
 * `shellName` is what threw; `frameless` is the component the caller should use instead.
 * Call it from a shell's body **before** it renders its `<Card>`.
 */
export function assertOutsideSurface(shellName: string, frameless: string): void {
  throw new Error(
    `<${shellName}> renders its own card and cannot be nested inside another framed ` +
      `section — that produces a card inside a card and a heading inside a heading. ` +
      `Use <${frameless}> here: it is the same shell without the frame, for when the ` +
      `enclosing section already owns it.`,
  );
}
