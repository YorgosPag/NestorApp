/**
 * UserSettings — Zod schema + types (SSoT for the Firestore document shape).
 *
 * The repository validates every read/write against this schema so that a
 * malformed local cache or an out-of-band Firestore mutation can never
 * silently corrupt downstream consumers (cursor / rulers-grid / dxfSettings /
 * snap). Slice schemas use `deepPartial()` flavor so each Phase wires its
 * subsystem incrementally without forcing other phases to ship same-time.
 *
 * @module services/user-settings/user-settings-schema
 * @enterprise ADR-XXX (UserSettings SSoT — Firestore-backed industry pattern)
 */

import { z } from 'zod';

// ─── Cursor / crosshair / selection ──────────────────────────────────────────

const lineStyleEnum = z.enum(['solid', 'dashed', 'dotted', 'dash-dot']);

const crosshairSchema = z.object({
  enabled: z.boolean(),
  size_percent: z.number().min(0).max(100),
  color: z.string(),
  line_width: z.number().min(0).max(20),
  line_style: lineStyleEnum,
  opacity: z.number().min(0).max(1),
  use_cursor_gap: z.boolean(),
  center_gap_px: z.number().min(0).max(100),
  lock_to_dpr: z.boolean(),
  ui_scale: z.number().min(0.1).max(10),
});

const cursorPickboxSchema = z.object({
  enabled: z.boolean(),
  shape: z.enum(['circle', 'square']),
  size: z.number().min(1).max(200),
  color: z.string(),
  line_style: lineStyleEnum,
  line_width: z.number().min(0).max(20),
  opacity: z.number().min(0).max(1),
});

const selectionBoxFaceSchema = z.object({
  fillColor: z.string(),
  fillOpacity: z.number().min(0).max(1),
  borderColor: z.string(),
  borderOpacity: z.number().min(0).max(1),
  borderStyle: lineStyleEnum,
  borderWidth: z.number().min(0).max(20),
});

const cursorSettingsSchema = z.object({
  crosshair: crosshairSchema,
  cursor: cursorPickboxSchema,
  selection: z.object({
    window: selectionBoxFaceSchema,
    crossing: selectionBoxFaceSchema,
  }),
  behavior: z.object({
    snap_indicator: z.boolean(),
    coordinate_display: z.boolean(),
    dynamic_input: z.boolean(),
    cursor_tooltip: z.boolean(),
  }),
  performance: z.object({
    use_raf: z.boolean(),
    throttle_ms: z.number().min(0).max(1000),
    precision_mode: z.boolean(),
  }),
});

// ─── Rulers / grid ───────────────────────────────────────────────────────────
// Permissive (passthrough) — owned by RulersGridSystem domain types, validated
// at the boundary of that subsystem (Phase 4).

const rulersGridSettingsSchema = z
  .object({
    rulers: z.unknown().optional(),
    grid: z.unknown().optional(),
    origin: z.unknown().optional(),
    isVisible: z.boolean().optional(),
  })
  .passthrough();

// ─── DXF settings (line / text / grip) ──────────────────────────────────────
// Permissive — schema owned by EnterpriseDxfSettingsProvider (Phase 3).

const dxfSettingsSliceSchema = z
  .object({
    line: z.unknown().optional(),
    text: z.unknown().optional(),
    grip: z.unknown().optional(),
  })
  .passthrough();

// ─── Snap (active types only — master flag stays ephemeral) ─────────────────

const snapSettingsSchema = z.object({
  activeTypes: z.array(z.string()),
  tolerance: z.number().min(0).max(100).optional(),
});

// ─── Top-level document ─────────────────────────────────────────────────────

export const USER_SETTINGS_SCHEMA_VERSION = 1 as const;

export const userSettingsSchema = z.object({
  userId: z.string().min(1),
  companyId: z.string().min(1),
  schemaVersion: z.literal(USER_SETTINGS_SCHEMA_VERSION),
  dxfViewer: z
    .object({
      cursor: cursorSettingsSchema.optional(),
      rulersGrid: rulersGridSettingsSchema.optional(),
      dxfSettings: dxfSettingsSliceSchema.optional(),
      snap: snapSettingsSchema.optional(),
    })
    .optional(),
  updatedAt: z.unknown().optional(),
  updatedBy: z.string().optional(),
});

export type UserSettingsDoc = z.infer<typeof userSettingsSchema>;
export type CursorSettingsSlice = z.infer<typeof cursorSettingsSchema>;
export type RulersGridSettingsSlice = z.infer<typeof rulersGridSettingsSchema>;
export type DxfSettingsSlice = z.infer<typeof dxfSettingsSliceSchema>;
export type SnapSettingsSlice = z.infer<typeof snapSettingsSchema>;

/** All known slice paths under `dxfViewer`. Used by repository.update<T>(path, ...). */
export type DxfViewerSlicePath =
  | 'dxfViewer.cursor'
  | 'dxfViewer.rulersGrid'
  | 'dxfViewer.dxfSettings'
  | 'dxfViewer.snap';
