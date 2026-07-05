/**
 * ADR-559 §3f — Canonical text-settings SCHEMA (Single Source of Truth for the SHAPE).
 *
 * Before this, the text-settings object shape was re-declared as **5 independent interfaces**
 * (`contexts/TextSettingsContext.tsx TextSettings`, `settings-core/types/domain.ts TextSettings`,
 * `ui/.../shared/LinePreview.tsx TextSettings`, `ui/.../shared/CurrentSettingsDisplay.tsx
 * TextSettings`, plus the unrelated tiny CSS-preview input in `useSettingsPreview.ts`). Adding
 * ONE field meant editing every copy by hand. Sibling of the grip §3b duplication.
 *
 * This file defines the shape ONCE; every other stored/context/view-model text-settings type is
 * a PROJECTION (`type X = Pick<TextSettingsBase, ...>`) of this base — never a re-declaration.
 * A new text field is added in exactly ONE place (`TextSettingsBase`).
 *
 * NOTE: TYPE shape only. DEFAULT VALUES stay per-context (mirror grip §3b) — not merged here.
 *
 * The tiny CSS-preview input in `useSettingsPreview.ts` (`{ color, fontSize, fontFamily,
 * fontWeight?: 'normal'|'bold', fontStyle? }` — `fontWeight` is a CSS string union, NOT the
 * numeric 100-900 weight of the stored settings) is NOT a projection of this base; it was
 * de-collision-renamed to `TextCssPreviewInput`, mirroring `GripCssPreviewInput`.
 */

// Primitive text-layout unions — canonical home here, re-exported from
// `settings-core/types/domain.ts` so barrel importers stay unchanged (dependency-leaf).
export type TextAlign = 'left' | 'center' | 'right' | 'justify';
export type TextBaseline = 'top' | 'middle' | 'bottom' | 'alphabetic';

/**
 * The full text-settings shape as it lives in STORED user settings (domain) — the one place a
 * new text field is added. Context / preview / display view-models `Pick<>` their subset from it.
 */
export interface TextSettingsBase {
  enabled: boolean;
  fontFamily: string;
  fontSize: number;         // 2.5 - 10mm (ISO 3098)
  fontWeight: number;       // 100 - 900
  fontStyle: 'normal' | 'italic' | 'oblique';
  color: string;
  opacity: number;
  letterSpacing: number;    // -5 - 10
  lineHeight: number;       // 0.8 - 3.0
  textAlign: TextAlign;
  textBaseline: TextBaseline;

  // Boolean text styling (backward compatibility)
  isBold: boolean;
  isItalic: boolean;
  isUnderline: boolean;
  isStrikethrough: boolean;
  isSuperscript: boolean;
  isSubscript: boolean;

  // Shadow
  shadowEnabled: boolean;
  shadowOffsetX: number;
  shadowOffsetY: number;
  shadowBlur: number;
  shadowColor: string;

  // Outline
  strokeEnabled: boolean;
  strokeWidth: number;
  strokeColor: string;

  // Background
  backgroundEnabled: boolean;
  backgroundColor: string;
  backgroundPadding: number;

  activeTemplate: string | null;
}
