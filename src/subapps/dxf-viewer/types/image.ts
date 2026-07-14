/**
 * ADR-651 Φάση Ε — Raster Image entity (εικόνα σε ορθογώνιο, «plumbing» ενός νέου τύπου).
 *
 * Δεδικασμένος, **non-BIM** entity που τοποθετεί μια raster εικόνα μέσα σε ορθογώνιο
 * πλαίσιο στον 2Δ καμβά (μοτίβο AutoCAD IMAGE / Revit Image, DXF INSERT σύμβαση: y-up,
 * `position` = κάτω-αριστερή γωνία). Sibling του `ScaleBarEntity` στο γενικό `Entity[]`
 * της σκηνής: plain `extends BaseEntity`, ΚΑΜΙΑ IFC εξαγωγή, ΚΑΝΕΝΑ 3Δ mesh → ΔΕΝ μπαίνει
 * στο `isBimEntityType`.
 *
 * Το entity κρατά ΜΟΝΟ `url` (reference σε asset — https download URL Firebase Storage ή
 * data URL), ΠΟΤΕ raw pixels/base64 blob μέσα στα πεδία γεωμετρίας (ίδιο σκεπτικό με το
 * `HatchImageFill.assetId`, ADR-643 Φ1 — inline θα φούσκωνε κάθε scene/undo-snapshot).
 *
 * @see types/scale-bar.ts — το sibling template (non-BIM standalone entity)
 * @see rendering/entities/ImageRenderer.ts — ο 2Δ renderer (contain-fit + rotation)
 * @see rendering/entities/shared/hatch-image-cache.ts — reused decode/cache SSoT (ADR-643 Φ1)
 */

import type { Point2D } from '../rendering/types/Types';
import type { BaseEntity, DxfImageExportMarker } from './entities';

export interface ImageEntity extends BaseEntity {
  type: 'image';
  /** Κάτω-αριστερή γωνία σε μονάδες σχεδίου (y-up — σύμβαση DXF INSERT). */
  position: Point2D;
  /** Πλάτος σε μονάδες σχεδίου. */
  width: number;
  /** Ύψος σε μονάδες σχεδίου. */
  height: number;
  /** Πηγή: https download URL (Firebase Storage) ή data URL. Reference σε asset, ΠΟΤΕ pixels. */
  url: string;
  /** Γωνία περιστροφής σε μοίρες (CCW γύρω από το `position`). */
  rotation?: number;
  /**
   * ADR-654 — αρχικό («intrinsic») πλάτος/ύψος σε ΜΟΝΑΔΕΣ ΣΧΕΔΙΟΥ, όπως το έδωσε ο catalog
   * τη στιγμή της τοποθέτησης (`place-entourage.ts`). SSoT για το κουμπί «Επαναφορά Διαστάσεων»
   * (Δρόμος A — «store native size», PowerPoint «Reset Size»): το reset πατά `width`/`height`
   * πίσω σε αυτά, κρατώντας σταθερό το κέντρο. Προαιρετικά — legacy/μη-entourage εικόνες
   * (detail-sheet, AI title-block) δεν τα έχουν → το reset πέφτει σε aspect-only fallback από
   * το decoded pixel μέγεθος. ΠΟΤΕ δεν αλλάζουν από resize/scale (μένουν το «εργοστασιακό» μέγεθος).
   */
  intrinsicWidth?: number;
  intrinsicHeight?: number;
  /** ADR-643 Φ5b marker για πιστή DXF εξαγωγή ως IMAGE/IMAGEDEF (τον γεμίζει ο export pre-pass). */
  dxfImageExport?: DxfImageExportMarker;
}

export const isImageEntity = (entity: { type: string }): entity is ImageEntity =>
  entity.type === 'image';
