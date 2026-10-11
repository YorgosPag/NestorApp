/**
 * wizard-meta-binding — από την επιλογή του οδηγού κάτοψης στη δέσμευση του provisioner (ADR-914).
 *
 * Ο οδηγός σε mode `'create'` επιστρέφει το ίδιο `WizardCompleteMeta` με την εισαγωγή και τη
 * φόρτωση (`scopedWizardMeta`). Εδώ γίνεται η ΜΙΑ μετάφρασή του σε `LevelProvisionBinding`.
 *
 * @module subapps/dxf-viewer/ui/components/open-create/wizard-meta-binding
 */

import { ENTITY_TYPES } from '@/config/domain-constants';
import type { WizardCompleteMeta } from '@/features/floorplan-import';
import type { LevelProvisionBinding } from '../../../systems/levels/level-provision';

/**
 * Η δέσμευση της νέας κενής κάτοψης, ή `null` όταν η επιλογή δεν ορίζει κάτοχο που ξέρει να
 * γεννήσει ο provisioner.
 *
 * @param fallbackLabel Όνομα όταν ο οδηγός δεν έδωσε ετικέτα (μεταφρασμένο από τον καλούντα).
 */
export function wizardMetaToBinding(
  meta: WizardCompleteMeta,
  fallbackLabel: string,
): LevelProvisionBinding | null {
  const label = meta.entityLabel || fallbackLabel;
  const projectId = meta.projectId || undefined;

  switch (meta.entityType) {
    case ENTITY_TYPES.FLOOR: {
      const floorId = meta.floorId || meta.entityId;
      return floorId
        ? { kind: 'storey', floorId, buildingId: meta.buildingId ?? null, projectId, label }
        : null;
    }
    case ENTITY_TYPES.PROPERTY:
      // Πολυεπίπεδη μονάδα: η κάτοψη ανήκει στον όροφο του ΕΠΙΠΕΔΟΥ της που επιλέχθηκε.
      return meta.entityId
        ? {
            kind: 'property',
            propertyId: meta.entityId,
            floorId: meta.levelFloorId || meta.floorId || null,
            buildingId: meta.buildingId ?? null,
            projectId,
            label,
          }
        : null;
    case ENTITY_TYPES.BUILDING:
      return meta.entityId ? { kind: 'building', buildingId: meta.entityId, projectId, label } : null;
    case ENTITY_TYPES.PROJECT:
      return meta.entityId ? { kind: 'project', projectId: meta.entityId, label } : null;
    default:
      return null;
  }
}
