// ============================================================================
// ♿ ARIA ATTRIBUTE PRESETS — Type-safe spreadable ARIA props (ADR-366 Phase 8.0)
// ============================================================================
//
// Reusable preset objects for common ARIA patterns.
// Usage: <button {...ARIA_PRESETS.TOGGLE_BUTTON(pressed)} />
// ============================================================================

export interface ToggleButtonAriaAttrs {
  role: 'button';
  'aria-pressed': boolean;
}

export interface SectionPanelAriaAttrs {
  role: 'region';
  'aria-labelledby': string;
}

export interface ViewcubeFaceAriaAttrs {
  role: 'button';
  'aria-label': string;
  'aria-current': boolean | undefined;
}

export interface RibbonToolAriaAttrs {
  'aria-label': string;
  'aria-pressed'?: boolean;
}

export const ARIA_PRESETS = {
  /** Toggle button: aria-pressed reflects pressed state. */
  TOGGLE_BUTTON: (pressed: boolean): ToggleButtonAriaAttrs => ({
    role: 'button',
    'aria-pressed': pressed,
  }),

  /** Region panel labelled by a heading element id. */
  SECTION_PANEL: (labelledById: string): SectionPanelAriaAttrs => ({
    role: 'region',
    'aria-labelledby': labelledById,
  }),

  /** ViewCube face button — aria-current marks the active canonical view. */
  VIEWCUBE_FACE: (label: string, active: boolean): ViewcubeFaceAriaAttrs => ({
    role: 'button',
    'aria-label': label,
    'aria-current': active || undefined,
  }),

  /** Ribbon tool button — aria-pressed optional (only for toggleable tools). */
  RIBBON_TOOL: (label: string, pressed?: boolean): RibbonToolAriaAttrs => ({
    'aria-label': label,
    'aria-pressed': pressed,
  }),
} as const;
