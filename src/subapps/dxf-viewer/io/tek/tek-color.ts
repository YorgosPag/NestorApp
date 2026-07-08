/**
 * Tekton .TEK IMPORT — χρώμα `<color>` → canonical scene hex (SSoT).
 *
 * ΑΚΡΙΒΗΣ αντιστροφή του export `colorHex6` (RGB straight, ΟΧΙ BGR swap) + το `#` που
 * περιμένει ο renderer/CSS: χωρίς `#` το `strokeStyle` είναι άκυρο → μαύρη/αόρατη γραμμή.
 * Το `colorHex6` (normalize σε 6 hex chars + fallback) μένει το export-side SSoT· εδώ
 * προστίθεται ΜΟΝΟ το import-side `#` prefix. Πρώην αντιγραμμένο verbatim ως local
 * `tekColorToHex` σε `tek-primitive-to-scene.ts` + `tek-structural-to-scene.ts`.
 *
 * @see ../../export/core/tek/tek-xml-writer.ts — `colorHex6` (validation/fallback SSoT)
 * @see ./tek-primitive-to-scene.ts · ./tek-structural-to-scene.ts — consumers
 */

import { colorHex6 } from '../../export/core/tek/tek-xml-writer';

/**
 * Tekton `<color>` (RGB hex, χωρίς `#`) → canonical `#RRGGBB` του Νέστορα. Reuse του
 * export SSoT `colorHex6` για validation/fallback + `#` prefix για renderer/CSS.
 */
export function tekColorToHex(raw: string): string {
  return `#${colorHex6(raw)}`;
}
