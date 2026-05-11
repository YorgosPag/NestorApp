/**
 * SHX → Open Font Substitution Table (ADR-344 Q20)
 *
 * When a DXF file references a SHX font that is not present in the company's
 * font library, FontLoader consults this table to select the closest open
 * equivalent. Substitution is accompanied by a MissingFontReport that lists
 * affected entity IDs so the user can decide whether to upload the original.
 *
 * Font choices:
 *  - romans/simplex/txt → Liberation Sans (metric-compatible sans-serif)
 *  - romand             → Liberation Sans Bold (duplex → bold sans)
 *  - isocpeur           → ISO 3098 engineering lettering (bundled LFF fallback)
 *  - gothicg / gothice  → UnifrakturMaguntia (MIT, Google Fonts)
 *  - unknown            → Liberation Sans (generic fallback)
 *
 * @module text-engine/fonts/font-substitution-table
 */

/** Describes one SHX → open-font substitution entry. */
export interface FontSubstitutionEntry {
  /** The exact SHX filename (lowercase, no path) referenced in the DXF STYLE table. */
  readonly shxName: string;
  /** The substitute font family name recognised by FontLoader. */
  readonly substituteFamily: string;
  /** Human-readable explanation shown in MissingFontBanner. */
  readonly reason: string;
}

/**
 * Ordered substitution table.  FontLoader iterates this array and returns the
 * first entry whose `shxName` matches the missing SHX (case-insensitive).
 * The final entry with `shxName: '*'` acts as a catch-all fallback.
 */
export const FONT_SUBSTITUTION_TABLE: readonly FontSubstitutionEntry[] = [
  {
    shxName: 'romans.shx',
    substituteFamily: 'Liberation Sans',
    reason: 'romans (stroke simplex) → Liberation Sans (metric-compatible sans-serif)',
  },
  {
    shxName: 'romand.shx',
    substituteFamily: 'Liberation Sans Bold',
    reason: 'romand (stroke duplex) → Liberation Sans Bold',
  },
  {
    shxName: 'isocpeur.shx',
    substituteFamily: 'ISO 3098',
    reason: 'isocpeur → ISO 3098 engineering lettering (bundled LFF fallback)',
  },
  {
    shxName: 'isocpeur',
    substituteFamily: 'ISO 3098',
    reason: 'isocpeur (no extension) → ISO 3098 engineering lettering',
  },
  {
    shxName: 'txt.shx',
    substituteFamily: 'Liberation Mono',
    reason: 'txt (monospaced stroke) → Liberation Mono',
  },
  {
    shxName: 'simplex.shx',
    substituteFamily: 'Liberation Sans',
    reason: 'simplex (stroke) → Liberation Sans',
  },
  {
    shxName: 'gothicg.shx',
    substituteFamily: 'UnifrakturMaguntia',
    reason: 'gothicg (Gothic stroke) → UnifrakturMaguntia (MIT, Google Fonts)',
  },
  {
    shxName: 'gothice.shx',
    substituteFamily: 'UnifrakturMaguntia',
    reason: 'gothice (Gothic stroke) → UnifrakturMaguntia (MIT, Google Fonts)',
  },
  {
    shxName: '*',
    substituteFamily: 'Liberation Sans',
    reason: 'Unknown SHX → Liberation Sans (generic fallback)',
  },
] as const;

/**
 * Look up the best open-font substitute for a missing SHX filename.
 * Comparison is case-insensitive.  Falls back to Liberation Sans for unknowns.
 */
export function lookupSubstitute(shxFilename: string): FontSubstitutionEntry {
  const lower = shxFilename.toLowerCase();
  const exact = FONT_SUBSTITUTION_TABLE.find(
    (entry) => entry.shxName !== '*' && entry.shxName === lower,
  );
  if (exact) return exact;
  // catch-all is always the last entry
  return FONT_SUBSTITUTION_TABLE[FONT_SUBSTITUTION_TABLE.length - 1];
}
