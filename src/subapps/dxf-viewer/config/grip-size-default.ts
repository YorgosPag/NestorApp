/**
 * @file grip-size-default.ts
 * @description 🏢 SSoT — Default base grip size (DIP/px). AutoCAD GRIPSIZE = 7.
 *
 * THE single source of truth for the default grip pixel size. Every default
 * surface that previously hardcoded this number — `GripStyleStore`, both
 * `DEFAULT_GRIP_SETTINGS` (types + settings-core), FACTORY `GRIP_DEFAULTS`,
 * `validateGripSize`, `UI_SIZE_DEFAULTS.GRIP_SIZE`, the specific-settings
 * mock — MUST import this constant. Never re-hardcode it.
 *
 * Why a dedicated zero-import leaf module: the value is needed by both very
 * low-level config (`validation-bounds-config` → `geometry-utils` chain) and
 * higher-level settings. Hosting it in any module that has its own imports
 * risks a circular import; a leaf with no dependencies is cycle-proof.
 *
 * History: this value was previously declared in ~6 places split between 14,
 * 7 and 5, which made selection grips render "sometimes big, sometimes small"
 * depending on which default / sync path won at a given lifecycle moment.
 * Unified to 7 (Giorgio, 2026-06-20).
 *
 * NOTE: preview-DRAW grips (`PREVIEW_DEFAULTS` / `DEFAULT_PREVIEW_OPTIONS` = 6)
 * are a separate, internally-consistent domain and intentionally NOT bound to
 * this constant.
 */
export const GRIP_SIZE_DEFAULT = 7;
