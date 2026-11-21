// ============================================================================
// RELATIONSHIP POSITION PRESETS — SSoT (ADR-372 §Β3 · §8.3)
// ============================================================================
//
// A position is «preset key OR free text» (Salesforce/HubSpot «Title»): a chosen
// preset is stored as a stable, locale-independent KEY; anything the user typed
// is user data. Whether a position manages people is declared HERE, on the
// preset — like SuccessFactors' «Is People Manager» flag on the position — and
// is NEVER guessed from the words of a free-text title.
//
// Pure leaf module — no React, no I/O.
// ============================================================================

export interface PositionPreset {
  /** Stored value (locale-independent key). */
  value: string;
  /** i18n key of the display label. */
  labelKey: string;
  /** The position manages people. */
  managerial: boolean;
}

/** Predefined positions, in dropdown order. Users may also type a custom one. */
export const POSITION_PRESETS: readonly PositionPreset[] = [
  { value: 'director', labelKey: 'relationships.presets.positions.director', managerial: true },
  { value: 'manager', labelKey: 'relationships.presets.positions.manager', managerial: true },
  { value: 'supervisor', labelKey: 'relationships.presets.positions.supervisor', managerial: true },
  { value: 'engineer', labelKey: 'relationships.presets.positions.engineer', managerial: false },
  { value: 'accountant', labelKey: 'relationships.presets.positions.accountant', managerial: false },
  { value: 'secretary', labelKey: 'relationships.presets.positions.secretary', managerial: false },
  { value: 'technician', labelKey: 'relationships.presets.positions.technician', managerial: false },
  { value: 'sales_rep', labelKey: 'relationships.presets.positions.salesRep', managerial: false },
];

/** Is the stored position a preset declared as people-managing? Free text ⇒ `false`. */
export function isManagerialPosition(position: string | null | undefined): boolean {
  const key = position?.trim();
  return !!key && POSITION_PRESETS.some(preset => preset.value === key && preset.managerial);
}
