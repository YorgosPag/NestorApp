/**
 * ADR-559 — Canonical grip-settings SCHEMA (Single Source of Truth for the SHAPE).
 *
 * Before this, the grip-settings object shape was re-declared as **5 independent interfaces**
 * (`settings-core/types/domain.ts GripSettings`, `stores/GripStyleStore.ts GripStyle`,
 * `types/gripSettings.ts GripSettings`, `rendering/types/Types.ts GripSettings`,
 * `ui/hooks/useUnifiedSpecificSettings.ts MockGripSettings`). Adding ONE field (e.g. the new
 * `gripObjLimit`) meant editing all five by hand — fragile, easy to miss one.
 *
 * This file defines the shape ONCE via composition; every other grip-settings type is a
 * PROJECTION (`&` / `Omit` / `extends`) of these pieces — never a re-declaration. So a new
 * grip field is added in exactly ONE place (`GripSettingsBase`) and propagates everywhere.
 *
 * NOTE: this centralizes the TYPE shape only. The DEFAULT VALUES stay per-context (stored /
 * runtime / draft / hover / preview legitimately differ — e.g. aperture 10 vs 20, draft vs
 * hover grip size, sentinel vs resolved colours), so those default objects are intentionally
 * NOT merged here.
 *
 * The three legitimate "stages" (big-player DTO → domain → view-model):
 *   • Input DTO (`GripSettingsFull`) — fullest, sentinel `cold: string | null`, + legacy compat.
 *   • Stored (domain `GripSettings`) — `GripSettingsBase` + sentinel colours (no render extras).
 *   • Runtime/preview (`GripStyle` / mock) — render extras + RESOLVED `cold: string`.
 */

/** Grip colours with the AutoCAD/Revit sentinel: `cold: null` ⇒ resolve via `GRIP_COLD_COLOR` SSoT. */
export interface GripColors {
  cold: string | null; // Unselected — null = use GRIP_COLD_COLOR SSoT (Revit-style sentinel)
  warm: string;        // Hover (Hot Pink / orange)
  hot: string;         // Selected (Red - ACI 1)
  contour: string;     // Contour (Black)
}

/** Grip colours after the sentinel is resolved at write/render time (`cold` is always concrete). */
export interface ResolvedGripColors {
  cold: string;
  warm: string;
  hot: string;
  contour: string;
}

/**
 * The grip-settings fields that live in STORED user settings (domain) — and that every
 * runtime / preview projection also carries. This is the one place a new grip field is added.
 */
export interface GripSettingsBase {
  enabled: boolean;          // Enable/disable grip system
  showGrips: boolean;        // Show/hide grips on selected entities
  gripSize: number;          // GRIPSIZE
  pickBoxSize: number;       // PICKBOX
  apertureSize: number;      // APERTURE
  opacity: number;           // Grip opacity (0.0 - 1.0)
  showAperture: boolean;     // APBOX: show/hide osnap aperture
  multiGripEdit: boolean;    // Allow multi-grip operations
  snapToGrips: boolean;      // Enable snap to grips
  showMidpoints: boolean;    // Show midpoint grips
  showCenters: boolean;      // Show center grips
  showQuadrants: boolean;    // Show quadrant grips
  maxGripsPerEntity: number; // Max grips per SINGLE entity (performance cap, AutoCAD-style)
  gripObjLimit: number;      // AutoCAD GRIPOBJLIMIT: hide ALL grips above this selection-object count (0 = no limit)
}

/** Render-time extras that exist on the runtime/input types but NOT in stored settings. */
export interface GripStyleExtras {
  showGripTips: boolean;     // Show grip tooltips
  dpiScale: number;          // DPI scaling factor
}

/** Legacy-compat optional fields kept on the input-DTO / rendering type only. */
export interface GripSettingsLegacyCompat {
  size?: number;
  hoverSize?: number;
  color?: string;
  hoverColor?: string;
  selectedColor?: string;
  strokeWidth?: number;
  showLabels?: boolean;
}

/**
 * Fullest grip-settings input DTO (AutoCAD-style): base + render extras + legacy compat, with
 * SENTINEL colours. The `types/gripSettings.ts` and `rendering/types/Types.ts` `GripSettings`
 * are exactly this.
 */
export type GripSettingsFull = GripSettingsBase & GripStyleExtras & GripSettingsLegacyCompat & {
  colors: GripColors;
};
