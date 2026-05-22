/**
 * Shared CSS custom-property token constants for the DXF Viewer style modules.
 * Kept here to avoid circular imports between DxfViewerComponents.styles.ts and
 * its extracted sub-modules (dxf-toolbar.styles.ts, dxf-cursor.styles.ts).
 *
 * @internal — consumed only by DXF viewer style files, not by components directly.
 */

export const CSS_VARS = {
  // Background
  BG_PRIMARY:   'hsl(var(--background))',        // semantic background (dark)
  BG_SECONDARY: 'hsl(var(--muted))',             // semantic muted background
  BG_TERTIARY:  'hsl(var(--muted)/0.5)',         // semantic muted/50 background
  BG_LIGHT:     'hsl(var(--background)/0.1)',    // semantic light background
  BG_SURFACE:   'hsl(var(--card))',              // semantic card background
  BG_INFO:      'hsl(var(--primary))',           // semantic primary background

  // Text
  TEXT_PRIMARY:   'hsl(var(--foreground))',           // semantic foreground text
  TEXT_SECONDARY: 'hsl(var(--muted-foreground))',     // semantic muted-foreground text
  TEXT_MUTED:     'hsl(var(--muted-foreground)/0.7)', // semantic muted text (dimmed)
  TEXT_ERROR:     'hsl(var(--destructive))',          // semantic destructive text

  // Shadow
  SHADOW_RING_OFFSET: 'hsl(var(--muted))',   // ring-offset semantic
  SHADOW_RING_FOCUS:  'hsl(var(--primary))', // ring semantic
} as const;

export const TYPOGRAPHY_CSS = {
  XS:   '0.75rem',  // 12px
  SM:   '0.875rem', // 14px
  BASE: '1rem',     // 16px
  LG:   '1.125rem', // 18px
} as const;

export const FONT_WEIGHT_CSS = {
  NORMAL:   400,
  MEDIUM:   500,
  SEMIBOLD: 600,
  BOLD:     700,
} as const;
