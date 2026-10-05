/**
 * Ο δράστης μιας αλυσίδας ορόφου για τα tests: ο άνθρωπος `user_1` άλλαξε τον όροφο `floor_cause`,
 * και η γραμμή του στο ιστορικό είναι η `eaud_cause`.
 */
import type { FloorCascadeActor } from '../_shared/floor-cascade-audit';

export const CASCADE_USER = 'user_1';

export const CASCADE_ACTOR: FloorCascadeActor = {
  updatedBy: CASCADE_USER,
  cause: {
    auditId: 'eaud_cause',
    initiatedBy: CASCADE_USER,
    initiatedByName: 'Γιώργος',
    entityType: 'floor',
    entityId: 'floor_cause',
    entityName: 'Ισόγειο',
  },
};
