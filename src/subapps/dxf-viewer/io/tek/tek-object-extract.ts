/**
 * ADR-608 (Tekton .TEK IMPORT — native σύμβολα) — εξαγωγή type-7 `<object>` records →
 * ενδιάμεσα `TekObjectRecord`. Καθρέφτης (read-side) του export `OBJECT_RECORD_TEMPLATE`
 * (`export/core/tek/tek-record-templates.ts`).
 *
 * Ένα `<object>` record αναφέρεται σε ΕΝΑ built-in σύμβολο του Τέκτονα μέσω `type_res`.
 * ΠΡΟΣΟΧΗ: το record έχει **δύο** άμεσα `<type>` παιδιά — το 1ο = entity type (7), το 2ο =
 * ο `type_res` (ο catalog index στο `Obj.inf`). Θέση/περιστροφή/κλίμακα στο `<xmatrix>`.
 *
 * Reuse των DOM helpers + `recordsInFloors`/`isEntityType`/`readXMatrix` (SSoT) — καμία
 * μετατροπή μονάδων/Y-flip εδώ (γίνεται στον mapper `tek-object-to-scene.ts`).
 *
 * @see export/core/tek/tek-symbol-catalog.ts — tekSymbolFromTypeRes (αντίστροφος χάρτης)
 * @see io/tek/tek-object-to-scene.ts — tekObjectToEntity (καταναλωτής)
 */

import { directChildren, childText } from './tek-xml-reader';
import { recordsInFloors, isEntityType, readXMatrix } from './tek-primitive-extract';
import type { TekObjectRecord } from './tek-import-types';

const OBJECT_ENTITY_TYPE = 7;

/** Ο `type_res` = το ΔΕΥΤΕΡΟ άμεσο `<type>` του record (το 1ο είναι το entity type 7). */
function readTypeRes(record: Element): number | null {
  const typeEls = directChildren(record, 'type');
  if (typeEls.length < 2) return null;
  const raw = typeEls[1].textContent?.trim() ?? '';
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) ? Math.round(n) : null;
}

/** Εξάγει όλα τα `<object>` records (type 7) → `TekObjectRecord[]` (type_res + xmatrix + color). */
export function extractObjectRecords(
  root: Element,
): { objects: TekObjectRecord[]; warnings: string[] } {
  const objects: TekObjectRecord[] = [];
  const warnings: string[] = [];
  for (const record of recordsInFloors(root, 'object')) {
    if (!isEntityType(record, OBJECT_ENTITY_TYPE)) {
      warnings.push('object record χωρίς type=7 — παραλείφθηκε.');
      continue;
    }
    const typeRes = readTypeRes(record);
    if (typeRes === null) {
      warnings.push('object record χωρίς έγκυρο type_res (2ο <type>) — παραλείφθηκε.');
      continue;
    }
    objects.push({
      typeRes,
      matrix: readXMatrix(record),
      color: childText(record, 'color') ?? '',
    });
  }
  return { objects, warnings };
}
