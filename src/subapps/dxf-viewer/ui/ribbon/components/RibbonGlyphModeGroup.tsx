'use client';

/**
 * RibbonGlyphModeGroup — SSoT της σειράς μικρών κουμπιών-εικονιδίων «ένα από Ν» της κορδέλας
 * (Revit «Draw gallery» · ArchiCAD Info Box «Geometry Method»).
 *
 * Εξήχθη από το `RibbonWallDrawModeWidget` (ADR-565 §12) τη στιγμή που χρειάστηκε δεύτερος
 * καταναλωτής — η μέθοδος γεωμετρίας της εντολής «Περιοχή» (ADR-933) — ώστε η ίδια σήμανση
 * (`<nav>` + `aria-pressed`, ενεργό φωτισμένο) να μη γραφτεί δύο φορές (N.18).
 *
 * Τα glyphs είναι inline SVG του καταναλωτή· τα κοινά χαρακτηριστικά τους ζουν στο
 * `RIBBON_GLYPH_PROPS` (μηδέν inline CSS — μόνο SVG attributes, N.3).
 */

import React from 'react';
import { cn } from '@/lib/utils';

/** Κοινά SVG presentation attrs για όλα τα glyphs της ομάδας (18px, 20×20). */
export const RIBBON_GLYPH_PROPS = {
  width: 18,
  height: 18,
  viewBox: '0 0 20 20',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

export interface RibbonGlyphMode {
  readonly id: string;
  /** Πλήρες προσβάσιμο όνομα (ήδη μεταφρασμένο). */
  readonly ariaLabel: string;
}

interface RibbonGlyphModeGroupProps<TMode extends RibbonGlyphMode> {
  /** Όνομα της ομάδας (ήδη μεταφρασμένο). */
  readonly label: string;
  readonly modes: readonly TMode[];
  readonly activeId: string | null;
  readonly onPick: (mode: TMode) => void;
  readonly renderGlyph: (mode: TMode) => React.ReactNode;
}

export function RibbonGlyphModeGroup<TMode extends RibbonGlyphMode>({
  label,
  modes,
  activeId,
  onPick,
  renderGlyph,
}: RibbonGlyphModeGroupProps<TMode>): React.JSX.Element {
  return (
    <nav className="flex items-center gap-0.5" aria-label={label}>
      {modes.map((mode) => {
        const isActive = mode.id === activeId;
        return (
          <button
            key={mode.id}
            type="button"
            aria-pressed={isActive}
            aria-label={mode.ariaLabel}
            onClick={() => onPick(mode)}
            className={cn(
              'flex h-7 w-7 items-center justify-center rounded border transition-colors',
              // Μελάνι με token ΣΚΟΠΟΥ (CHECK 3.38 / ADR-770): το `text-primary` στο σκοτεινό θέμα
              // ταυτίζεται με το `--card` (1,00:1). Το περίγραμμα/φόντο μένουν token επιφάνειας.
              isActive
                ? 'border-primary/40 bg-primary/10 text-[hsl(var(--text-info))]'
                : 'border-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground',
            )}
          >
            {renderGlyph(mode)}
          </button>
        );
      })}
    </nav>
  );
}
