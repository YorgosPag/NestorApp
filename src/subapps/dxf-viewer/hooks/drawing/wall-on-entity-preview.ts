/**
 * @module wall-on-entity-preview
 * @description ADR-363 Phase 1J — ζωντανό WYSIWYG φάντασμα για το εργαλείο «Τοίχος πάνω σε
 * οντότητα» (`wall-on-entity`). Μέχρι τώρα το on-entity mode ΔΕΝ είχε 2D preview: το
 * `generatePreviewEntity` δρομολογεί μόνο `tool === 'wall'`, οπότε ο `wall-on-entity` έβγαζε
 * `null` (κανένα φάντασμα). Εδώ ζει ο ΑΠΟΚΛΕΙΣΤΙΚΟΣ generator του, που **καθρεφτίζει τον commit**
 * (`use-wall-commit.commitOnEntity`) με reuse των ΙΔΙΩΝ pure builders — μηδέν νέα geometry:
 *
 *   - awaitingStart (hover-to-pick): `pickWallSourceFromEntity` πάνω στην οντότητα κάτω από τον
 *     κέρσορα· γραμμή → φάντασμα τοίχου (side = live cursor). Κλειστό/τίποτα → `null` (η κλειστή
 *     πηγή δείχνει την υπάρχουσα πράσινη διακεκομμένη περίμετρο μέσω `isRegionHoverPreviewTool`).
 *   - awaitingSide (πηγή διαλεγμένη): το `use-wall-preview-sync` έχει ήδη γράψει την picked γραμμή
 *     ως `startPoint`/`endPoint` στο `wallPreviewStore` → φάντασμα πάνω της, side = live cursor.
 *
 * preview ≡ commit by construction: ίδιος `buildWallForLine` με το `commitOnEntity`.
 *
 * @see ../../bim/walls/wall-from-entity.ts — pickWallSourceFromEntity / buildWallForLine (SSoT)
 * @see ./use-wall-commit.ts — commitOnEntity (ο commit που καθρεφτίζεται)
 * @see ./drawing-preview-generator.ts — δρομολόγηση του σκέτου 'wall'
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §6 Phase 1J
 */

import type { Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import type { ExtendedSceneEntity } from './drawing-types';
import type { SceneUnits } from '../../utils/scene-units';
import { pickWallSourceFromEntity, buildWallForLine } from '../../bim/walls/wall-from-entity';
import { wallPreviewStore } from '../../bim/walls/wall-preview-store';
import { getDefaultLayerId } from '../../stores/LayerStore';
import { toWysiwygPreviewEntity } from './wysiwyg-preview-shared';
import { TOLERANCE_CONFIG } from '../../config/tolerance-config';
import { getImmediateTransform } from '../../systems/cursor/ImmediateTransformStore';

const PREVIEW_ID = 'preview_wall_on_entity';

/**
 * Flag το χτισμένο on-entity wall entity ως WYSIWYG ghost (ίδιο SSoT wrapper με όλα τα member
 * previews). `null` όταν ο validator απορρίψει (π.χ. μηδενικό μήκος) → ο caller καθαρίζει το frame.
 */
function toGhost(entity: ReturnType<typeof buildWallForLine>): ExtendedSceneEntity | null {
  return entity ? toWysiwygPreviewEntity(entity, PREVIEW_ID) : null;
}

/**
 * ADR-363 Phase 1J — το ζωντανό preview του `wall-on-entity`. Καλείται από το `updatePreview`
 * (που έχει πρόσβαση στα scene entities + κέρσορα), όχι από το `generatePreviewEntity` (ο τύπος
 * `DrawingTool` δεν περιλαμβάνει το `wall-on-entity`). Επιστρέφει ΕΝΑ φάντασμα τοίχου ή `null`.
 */
export function generateWallOnEntityPreview(
  cursor: Readonly<Point2D>,
  sceneEntities: readonly Entity[],
  sceneUnits: SceneUnits = 'mm',
): ExtendedSceneEntity | null {
  const st = wallPreviewStore.get();
  const levelId = getDefaultLayerId();

  // awaitingSide — η πηγή (γραμμή) έχει ήδη διαλεγεί· το `use-wall-preview-sync` έγραψε
  // start/end = picked line. Το σώμα «φουσκώνει» προς τον κέρσορα (η πλευρά που θα κλειδώσει).
  if (st.startPoint && st.endPoint) {
    return toGhost(buildWallForLine(st.startPoint, st.endPoint, cursor, st.overrides, sceneUnits, levelId));
  }

  // awaitingStart — hover-to-pick: διάλεξε την οντότητα κάτω από τον κέρσορα (ίδιος
  // `pickWallSourceFromEntity` + tolerance με το commit, `useWallTool.onCanvasClick`).
  const tol = TOLERANCE_CONFIG.SNAP_DEFAULT / getImmediateTransform().scale;
  const source = pickWallSourceFromEntity(cursor, sceneEntities, tol);
  // Γραμμή → μονός τοίχος (side = live cursor). Κλειστό → η πράσινη διακεκομμένη περίμετρος
  // (region hover preview) το αναλαμβάνει· εδώ `null` (ο single-entity preview canvas δεν
  // ζωγραφίζει N τοίχους). Τίποτα κάτω από τον κέρσορα → `null`.
  if (source?.kind === 'line') {
    return toGhost(buildWallForLine(source.start, source.end, cursor, st.overrides, sceneUnits, levelId));
  }
  return null;
}
