/**
 * SSoT (N.18) — η βάση των BIM overlays που **δεν εκπέμπουν λαβές**.
 *
 * Ο θερμικός χώρος είναι δεμένος στους τοίχους του (ADR-422 L0) και η γραμμή διαχωρισμού χώρου
 * επεξεργάζεται με επανατοποθέτηση (ADR-437 D-F): κανένα από τα δύο δεν έχει τι να σύρει ο άνθρωπος.
 * Η απάντηση «καμία λαβή» γράφεται εδώ μία φορά· η επιλογή τους σηματοδοτείται από το
 * `paintGriplessOverlayHalos` (bim-polygon-render), όχι από λαβές.
 */
import { BaseEntityRenderer } from '../../../rendering/entities/BaseEntityRenderer';
import type { EntityModel, GripInfo } from '../../../rendering/types/Types';

export abstract class GriplessBimRenderer extends BaseEntityRenderer {
  getGrips(_entity: EntityModel): GripInfo[] {
    return [];
  }
}
