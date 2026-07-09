/**
 * ADR-608 (Tekton .TEK IMPORT — native σύμβολα) — mapper `TekObjectRecord` → scene entity.
 *
 * Αντιστρέφει τον export (`dxf-to-tek.ts::collectTekObjects`): ένα type-7 `<object>` με
 * `type_res` → το ΔΙΚΟ ΜΑΣ `AnnotationSymbolEntity` μέσω του αντίστροφου χάρτη
 * `tekSymbolFromTypeRes` (SSoT `tek-symbol-catalog.ts`). Index round-trip μόνο — ΚΑΜΙΑ
 * ανάγνωση της ιδιόκτητης `.asc` γεωμετρίας LH· ζωγραφίζουμε το δικό μας σύμβολο.
 *
 *   - **Θέση + Y-flip:** μέσω του SSoT `tekMetersToScene` (καθρέφτης του `sceneXYToTekMeters`).
 *   - **Περιστροφή:** γωνία u-άξονα (x00,x01), Y-flipped — ΙΔΙΑ σύμβαση με τον text mapper.
 *   - **Χωρίς δικό μας equivalent** (άνθρωποι/αυτοκίνητα/βέλη…): `entity=null` + `warning` με
 *     ονομαστική ταυτοποίηση (`tektonSymbolName`), ώστε να ΜΗΝ χάνεται σιωπηλά.
 *
 * @see export/core/tek/tek-symbol-catalog.ts — tekSymbolFromTypeRes / tektonSymbolName
 * @see io/tek/tek-primitive-to-scene.ts — tekTextToEntity (ίδια σύμβαση xmatrix)
 */

import { tekMetersToScene } from '../../export/core/tek/tek-geometry';
import { tekSymbolFromTypeRes, tektonSymbolName } from '../../export/core/tek/tek-symbol-catalog';
import { radToDeg } from '../../rendering/entities/shared/geometry-angle-utils';
import { generateEntityId } from '@/services/enterprise-id-convenience';
import {
  DEFAULT_ANNOTATION_SYMBOL_SIZE_MM,
  type AnnotationSymbolEntity,
} from '../../types/annotation-symbol';
import type { SceneUnits } from '../../utils/scene-units';
import type { TekObjectRecord } from './tek-import-types';

/** Αποτέλεσμα mapping ενός `<object>`: είτε δικό μας σύμβολο, είτε ονομαστικό warning. */
export interface TekObjectMapResult {
  readonly entity: AnnotationSymbolEntity | null;
  readonly warning: string | null;
}

/**
 * `<object>` (type-7) record → `AnnotationSymbolEntity` μέσω του αντίστροφου χάρτη `type_res`.
 * Θέση από `xmatrix` translation (Y-flipped SSoT)· περιστροφή = γωνία u-άξονα (Y-flipped)·
 * μέγεθος = default annotative (το native μέγεθος του Τέκτονα δεν κωδικοποιείται στο index).
 * `type_res` χωρίς δικό μας σύμβολο → `entity=null` + ονομαστικό warning.
 */
export function tekObjectToEntity(rec: TekObjectRecord, units: SceneUnits): TekObjectMapResult {
  const match = tekSymbolFromTypeRes(rec.typeRes);
  if (!match) {
    const name = tektonSymbolName(rec.typeRes);
    const label = name ? `"${name}" (type_res ${rec.typeRes})` : `type_res ${rec.typeRes}`;
    return {
      entity: null,
      warning: `Σύμβολο Τέκτονα ${label} — χωρίς αντίστοιχο δικό μας σύμβολο, παραλείφθηκε.`,
    };
  }
  const m = rec.matrix;
  const entity: AnnotationSymbolEntity = {
    id: generateEntityId(),
    type: 'annotation-symbol',
    layerId: '',
    position: tekMetersToScene(m.x20, m.x21, units),
    kind: match.kind,
    symbolId: match.symbolId,
    sizeMm: DEFAULT_ANNOTATION_SYMBOL_SIZE_MM,
    rotation: -radToDeg(Math.atan2(m.x01, m.x00)) || 0, // Y-flip· || 0 αποφεύγει −0
  };
  return { entity, warning: null };
}
