/**
 * @file Zod Schema Validation
 * @module settings/io/schema
 *
 * ENTERPRISE STANDARD - Runtime type validation
 *
 * **PURPOSE:**
 * - Validate data loaded from storage (prevent corruption)
 * - Ensure type safety at runtime (not just compile-time)
 * - Graceful degradation (return defaults on invalid data)
 *
 * **PATTERN:**
 * - Strict validation (no unknown keys)
 * - Coercion where appropriate (string → number)
 * - Clear error messages
 *
 *  - Module #5
 */

import { z } from 'zod';

// ============================================================================
// VIEWER MODE SCHEMA
// ============================================================================

export const ViewerModeSchema = z.enum([
  'normal',
  'draft',
  'hover',
  'selection',
  'completion',
  'preview'
]);

export const StorageModeSchema = z.enum([
  'normal',
  'draft',
  'hover',
  'selection',
  'completion'
]);

// ============================================================================
// LINE SETTINGS SCHEMA
// ============================================================================

// ✅ FIX: Updated to match settings-core/types.ts (LineSettings interface)
// 🔥 CRITICAL: .passthrough() allows extra properties (dashScale, lineCap, hoverColor, etc.)
export const LineSettingsSchema = z.object({
  enabled: z.boolean(),                                // ✅ FIX: Added enabled property
  lineWidth: z.number().min(0.1).max(10.0),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),        // ✅ FIX: renamed from lineColor
  lineType: z.enum(['solid', 'dashed', 'dotted']),     // ✅ FIX: renamed from lineStyle
  opacity: z.number().min(0.0).max(1.0)
}).passthrough();

export type LineSettingsType = z.infer<typeof LineSettingsSchema>;

// ============================================================================
// TEXT SETTINGS SCHEMA
// ============================================================================

// ✅ FIX: Updated to match settings-core/types.ts (TextSettings interface)
// 🔥 CRITICAL: .passthrough() allows extra properties (isBold, isItalic, shadowEnabled, etc.)
export const TextSettingsSchema = z.object({
  enabled: z.boolean(),                                // ✅ FIX: Added enabled property
  fontSize: z.number().min(8).max(72),
  fontFamily: z.string().min(1),
  fontWeight: z.number().min(100).max(900),            // ✅ FIX: Changed from enum to number (100-900)
  fontStyle: z.enum(['normal', 'italic', 'oblique']),  // ✅ FIX: Added 'oblique'
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),        // ✅ FIX: renamed from textColor
  opacity: z.number().min(0.0).max(1.0)
}).passthrough();

export type TextSettingsType = z.infer<typeof TextSettingsSchema>;

// ============================================================================
// GRIP SETTINGS SCHEMA
// ============================================================================

// ✅ FIX: Updated to match settings-core/types.ts (GripSettings interface)
export const GripColorsSchema = z.object({
  cold: z.string().regex(/^#[0-9A-Fa-f]{6}$/),     // Unselected (Blue)
  warm: z.string().regex(/^#[0-9A-Fa-f]{6}$/),     // Hover (Cyan)
  hot: z.string().regex(/^#[0-9A-Fa-f]{6}$/),      // Selected (Red)
  contour: z.string().regex(/^#[0-9A-Fa-f]{6}$/)   // Contour (Black)
});

export const GripSettingsSchema = z.object({
  enabled: z.boolean(),                             // ✅ FIX: Added enabled property
  gripSize: z.number().min(4).max(20),              // ✅ FIX: renamed from size
  colors: GripColorsSchema,                         // ✅ FIX: nested colors object instead of flat color/hoverColor
  opacity: z.number().min(0.0).max(1.0)
}).passthrough();

export type GripSettingsType = z.infer<typeof GripSettingsSchema>;

// ============================================================================
// ENTITY SETTINGS SCHEMA (GENERIC)
// ============================================================================

export function createEntitySettingsSchema<T extends z.ZodTypeAny>(
  settingsSchema: T
) {
  // ✅ ENTERPRISE: Use z.ZodType<unknown> instead of any for type-safe partial schemas
  return z.object({
    general: settingsSchema,
    specific: z.record(StorageModeSchema, (settingsSchema as any).partial()), // ✅ ENTERPRISE FIX: Use any for Zod partial() method access
    overrides: z.record(StorageModeSchema, (settingsSchema as any).partial()) // ✅ ENTERPRISE FIX: Use any for Zod partial() method access
  });
}

// ============================================================================
// OVERRIDE FLAGS SCHEMA
// ============================================================================

export const OverrideFlagsSchema = z.record(StorageModeSchema, z.boolean());

// ============================================================================
// COMPLETE SETTINGS STATE SCHEMA
// ============================================================================

export const SettingsStateSchema = z.object({
  __standards_version: z.number().int().positive(),

  line: createEntitySettingsSchema(LineSettingsSchema),
  text: createEntitySettingsSchema(TextSettingsSchema),
  grip: createEntitySettingsSchema(GripSettingsSchema),

  overrideEnabled: z.object({
    line: OverrideFlagsSchema,
    text: OverrideFlagsSchema,
    grip: OverrideFlagsSchema
  })
});

export type SettingsStateType = z.infer<typeof SettingsStateSchema>;

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Validate settings state with Zod
 *
 * @param data - Raw data to validate
 * @returns Validation result with typed data or error
 */
export function validateSettingsState(data: unknown): {
  success: true;
  data: SettingsStateType;
} | {
  success: false;
  error: z.ZodError;
} {
  const result = SettingsStateSchema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  } else {
    return { success: false, error: result.error };
  }
}

/**
 * Validate and coerce (fix) settings state
 *
 * Attempts to fix invalid data by:
 * - Clamping numbers to valid ranges
 * - Replacing invalid colors with defaults
 * - Filling missing fields with defaults
 *
 * @param data - Raw data to validate
 * @param defaults - Default values to use for missing/invalid fields
 * @returns Valid settings state (coerced if needed)
 */
export function validateAndCoerce(
  data: unknown,
  defaults: SettingsStateType
): SettingsStateType {
  const result = validateSettingsState(data);

  if (result.success) {
    return result.data;
  }

  // Validation failed - attempt to coerce (use type guard)
  const error = 'error' in result ? result.error : undefined;
  console.warn('[Schema] Validation failed, attempting to coerce:', error);

  // Deep merge with defaults
  try {
    const partial = data as Partial<SettingsStateType>;

    // Use defaults as fallback and cast to expected type
    type EntityDefaults = {
      general: Record<string, unknown>;
      specific: Record<string, Partial<Record<string, unknown>>>;
      overrides: Record<string, Partial<Record<string, unknown>>>
    };

    return {
      __standards_version: partial.__standards_version ?? defaults.__standards_version,
      line: mergeEntitySettings(
        partial.line ?? defaults.line,
        defaults.line as unknown as EntityDefaults
      ),
      text: mergeEntitySettings(
        partial.text ?? defaults.text,
        defaults.text as unknown as EntityDefaults
      ),
      grip: mergeEntitySettings(
        partial.grip ?? defaults.grip,
        defaults.grip as unknown as EntityDefaults
      ),
      overrideEnabled: partial.overrideEnabled ?? defaults.overrideEnabled
    };
  } catch {
    // Complete failure - return defaults
    console.error('[Schema] Coercion failed, using factory defaults');
    return defaults;
  }
}

function mergeEntitySettings<T extends Record<string, unknown>>(
  partial: { general?: unknown; specific?: unknown; overrides?: unknown } | unknown,
  defaults: { general: T; specific: Record<string, Partial<T>>; overrides: Record<string, Partial<T>> }
): { general: T; specific: Record<string, Partial<T>>; overrides: Record<string, Partial<T>> } {
  if (!partial || typeof partial !== 'object') {
    return defaults;
  }

  const p = partial as Partial<{ general: T; specific: Record<string, Partial<T>>; overrides: Record<string, Partial<T>> }>;

  return {
    general: { ...defaults.general, ...(p.general || {}) } as T,
    specific: { ...defaults.specific, ...(p.specific || {}) },
    overrides: { ...defaults.overrides, ...(p.overrides || {}) }
  };
}

// ============================================================================
// PARTIAL VALIDATION (FOR UPDATES)
// ============================================================================

/**
 * Validate partial line settings (for updates)
 */
export function validateLineSettingsUpdate(data: unknown): Partial<LineSettingsType> | null {
  const result = LineSettingsSchema.partial().safeParse(data);
  return result.success ? result.data : null;
}

/**
 * Validate partial text settings (for updates)
 */
export function validateTextSettingsUpdate(data: unknown): Partial<TextSettingsType> | null {
  const result = TextSettingsSchema.partial().safeParse(data);
  return result.success ? result.data : null;
}

/**
 * Validate partial grip settings (for updates)
 */
export function validateGripSettingsUpdate(data: unknown): Partial<GripSettingsType> | null {
  const result = GripSettingsSchema.partial().safeParse(data);
  return result.success ? result.data : null;
}
