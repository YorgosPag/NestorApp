/**
 * ADR-651 Φάση Μ — **καθαρό parsing** του untrusted wire body του `sheet-set-plan` route.
 *
 * Ζει χωριστά από το `route.ts` ώστε να είναι **unit-testable χωρίς** mock ολόκληρου του auth/rate-limit
 * stack: ίδιο σκεπτικό με τα καθαρά parsers του `_ai-route-helpers` (`readLocale`/`optionalString`).
 * Ο κανόνας «κακοσχηματισμένο ⇒ ασφαλές default, ποτέ throw» ζει εδώ, σε ένα σημείο.
 */

import type { SheetSetPlanLevel } from '@/subapps/dxf-viewer/text-engine/title-block/ai/ai-sheet-set-reconcile';

/** Λογικά όρια (φραγή κακόβουλου/υπερμεγέθους payload). */
export const MAX_INTENT_CHARS = 2_000;
export const MAX_LEVELS = 200;
export const MAX_LEVEL_FIELD_CHARS = 200;

/** Untrusted string → κομμένο string ή `''` (ποτέ throw). */
function readString(value: unknown): string {
  return typeof value === 'string' ? value.slice(0, MAX_LEVEL_FIELD_CHARS) : '';
}

/**
 * Untrusted `levels` → έγκυροι `SheetSetPlanLevel`: μόνο αντικείμενα με **μη-κενό id** περνούν (το id
 * είναι η ταυτότητα με την οποία το reconcile ταιριάζει τους ορόφους). Κόβει στο `MAX_LEVELS`.
 */
export function readSheetSetPlanLevels(value: unknown): SheetSetPlanLevel[] {
  if (!Array.isArray(value)) return [];
  const levels: SheetSetPlanLevel[] = [];
  for (const raw of value.slice(0, MAX_LEVELS)) {
    if (typeof raw !== 'object' || raw === null) continue;
    const record = raw as Record<string, unknown>;
    const id = readString(record.id).trim();
    if (!id) continue;
    levels.push({ id, name: readString(record.name), label: readString(record.label) });
  }
  return levels;
}
