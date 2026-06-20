/**
 * @file style-store-sync.ts
 * @description 🏢 SSoT — the ONE place that maps effective DXF settings → the
 * legacy style stores (`toolStyleStore`, `textStyleStore`, `completionStyleStore`,
 * `gripStyleStore`).
 *
 * ## Why this exists
 * Before this module the "settings → store" mapping was duplicated across two
 * independent subsystems, and each wrote a DIFFERENT (sometimes partial) subset:
 *   1. `providers/StyleManagerProvider.tsx` — inline `syncLineStore` /
 *      `syncTextStore` / `syncCompletionStore` (FULL writes).
 *   2. `settings/sync/storeSync.ts` — `mapLineToToolStyle` / `mapTextToTextStyle`
 *      / `mapGripToGripStyle` → the hexagonal port adapters (LOSSY: only
 *      stroke/fill/width/opacity for tool; font/size/color/weight/style for text;
 *      size + 3 colors for grip).
 * Two writers into the same store with diverging field coverage = a latent
 * last-writer-wins hazard (the partial path could silently stomp advanced fields).
 *
 * ## The fix (mirrors the blessed `grip-style-sync.ts` pattern)
 * Each store gets exactly ONE full-state mapper here. Every caller
 * (StyleManagerProvider + storeSync) delegates to these — idempotent, so multiple
 * callers are safe (same input ⇒ same store state). The grip writer already lived
 * in `grip-style-sync.ts`; it is re-exported here so all four share one import
 * surface, without creating a second grip writer.
 *
 * The mapping bodies are byte-for-byte the prior StyleManagerProvider logic
 * (the authoritative full mappings) — no behavioural change to the mapping itself.
 */

import { toolStyleStore } from './ToolStyleStore';
import { textStyleStore } from './TextStyleStore';
import { completionStyleStore } from './CompletionStyleStore';
import { withOpacity } from '../config/color-config';
import type { LineSettings } from '../settings-core/types';

// 🏢 Single grip writer — re-exported, NOT re-implemented (see grip-style-sync.ts).
export { syncGripStyleStoreFromSettings } from './grip-style-sync';

/**
 * Text fields consumed by the text-store mapper. Kept structurally minimal so
 * both the full domain `TextSettings` and the provider's effective text settings
 * satisfy it (the boolean styling flags are optional for backward-compat).
 */
export interface TextStyleSyncInput {
  enabled: boolean;
  fontFamily: string;
  fontSize: number;
  color: string;
  isBold?: boolean;
  isItalic?: boolean;
  isUnderline?: boolean;
  isStrikethrough?: boolean;
  isSuperscript?: boolean;
  isSubscript?: boolean;
  opacity: number;
}

/**
 * Push full effective line settings → `toolStyleStore` (the drawing/preview style).
 * Idempotent.
 */
export function syncToolStyleStoreFromSettings(settings: LineSettings): void {
  // Use centralized withOpacity function instead of manual rgba construction
  toolStyleStore.set({
    enabled: settings.enabled,
    strokeColor: settings.color,
    lineWidth: settings.lineWidth,
    opacity: settings.opacity,
    fillColor: withOpacity(settings.color, 0), // Fully transparent fill
    lineType: settings.lineType,
  });
}

/**
 * Push full effective text settings → `textStyleStore`. Idempotent.
 */
export function syncTextStyleStoreFromSettings(settings: TextStyleSyncInput): void {
  const getTextDecoration = (): string => {
    const decorations: string[] = [];
    if (settings.isUnderline) decorations.push('underline');
    if (settings.isStrikethrough) decorations.push('line-through');
    return decorations.join(' ') || 'none';
  };

  textStyleStore.set({
    enabled: settings.enabled,
    fontFamily: settings.fontFamily,
    fontSize: settings.fontSize,
    color: settings.color,
    fontWeight: settings.isBold ? 'bold' : 'normal',
    fontStyle: settings.isItalic ? 'italic' : 'normal',
    textDecoration: getTextDecoration(),
    opacity: settings.opacity / 100,
    isSuperscript: settings.isSuperscript,
    isSubscript: settings.isSubscript,
  });
}

/**
 * Push full effective (completion-mode) line settings → `completionStyleStore`.
 * Mirrors the tool mapper plus the completion-only dash/cap/join fields. Idempotent.
 */
export function syncCompletionStyleStoreFromSettings(settings: LineSettings): void {
  completionStyleStore.set({
    enabled: settings.enabled,
    color: settings.color,
    fillColor: withOpacity(settings.color, 0), // Fully transparent fill
    lineWidth: settings.lineWidth,
    opacity: settings.opacity,
    lineType: settings.lineType,
    dashScale: settings.dashScale ?? 1.0,
    lineCap: settings.lineCap ?? 'round',
    lineJoin: settings.lineJoin ?? 'round',
    dashOffset: settings.dashOffset ?? 0,
    breakAtCenter: settings.breakAtCenter ?? false,
  });
}
