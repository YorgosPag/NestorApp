'use client';

/**
 * Ποιες πράξεις σε κτίρια και ορόφους δείχνει η οθόνη (ADR-829 §7.1) — **όχι** ποιες επιτρέπονται.
 *
 * 🔴 Τα κουμπιά φαίνονταν σε όλους και ο άνθρωπος μάθαινε την άρνηση από ωμό αγγλικό 403 αφού συμπλήρωνε τη φόρμα:
 * πόρτα σε τοίχο. Η ετυμηγορία έρχεται από τον ΕΝΑ PEP· τον έλεγχο τον ξανακάνει ο διακομιστής.
 *
 * ADR-926 Κ7 — με `projectId`, στην απάντηση της εταιρείας προστίθεται η απάντηση του διακομιστή για το έργο. Αθροιστικά,
 * όπως ο κριτής. Χωρίς έργο, ο ρόλος έργου δεν έχει σημείο εφαρμογής: ο PM δημιουργεί κτίριο μέσα από έργο.
 *
 * @module hooks/useBuildingCapabilities
 */

import { useGrantedCapability } from '@/auth/hooks/useGrantedCapability';
import { useProjectCapabilities } from '@/hooks/useProjectCapabilities';

export interface BuildingCapabilities {
  readonly canCreateBuilding: boolean;
  readonly canUpdateBuilding: boolean;
  readonly canDeleteBuilding: boolean;
  readonly canCreateFloor: boolean;
  readonly canUpdateFloor: boolean;
  readonly canDeleteFloor: boolean;
}

export function useBuildingCapabilities(projectId?: string | null): BuildingCapabilities {
  const inProject = useProjectCapabilities(projectId);

  const canCreateBuilding = useGrantedCapability('buildings:buildings:create').granted;
  const canUpdateBuilding = useGrantedCapability('buildings:buildings:update').granted;
  const canDeleteBuilding = useGrantedCapability('buildings:buildings:delete').granted;
  const canCreateFloor = useGrantedCapability('projects:floors:create').granted;
  const canUpdateFloor = useGrantedCapability('projects:floors:update').granted;
  const canDeleteFloor = useGrantedCapability('projects:floors:delete').granted;

  return {
    canCreateBuilding: canCreateBuilding || inProject?.['buildings:buildings:create'] === true,
    canUpdateBuilding: canUpdateBuilding || inProject?.['buildings:buildings:update'] === true,
    canDeleteBuilding: canDeleteBuilding || inProject?.['buildings:buildings:delete'] === true,
    canCreateFloor: canCreateFloor || inProject?.['projects:floors:create'] === true,
    canUpdateFloor: canUpdateFloor || inProject?.['projects:floors:update'] === true,
    // Εκτός καταλόγου: ο όροφος δεν έχει κάδο, άρα μόνο η εταιρεία (ADR-926 §4).
    canDeleteFloor,
  };
}
