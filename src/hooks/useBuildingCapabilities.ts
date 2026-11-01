'use client';

/**
 * Ποιες πράξεις σε κτίρια και ορόφους δείχνει η οθόνη (ADR-829 §7.1) — **όχι** ποιες επιτρέπονται.
 *
 * 🔴 Τα κουμπιά φαίνονταν σε όλους και ο άνθρωπος μάθαινε την άρνηση από ωμό αγγλικό 403 αφού συμπλήρωνε τη φόρμα:
 * πόρτα σε τοίχο. Η ετυμηγορία έρχεται από τον ΕΝΑ PEP· τον έλεγχο τον ξανακάνει ο διακομιστής.
 *
 * @module hooks/useBuildingCapabilities
 */

import { useGrantedCapability } from '@/auth/hooks/useGrantedCapability';

export interface BuildingCapabilities {
  readonly canCreateBuilding: boolean;
  readonly canUpdateBuilding: boolean;
  readonly canDeleteBuilding: boolean;
  readonly canCreateFloor: boolean;
  readonly canUpdateFloor: boolean;
  readonly canDeleteFloor: boolean;
}

export function useBuildingCapabilities(): BuildingCapabilities {
  return {
    canCreateBuilding: useGrantedCapability('buildings:buildings:create').granted,
    canUpdateBuilding: useGrantedCapability('buildings:buildings:update').granted,
    canDeleteBuilding: useGrantedCapability('buildings:buildings:delete').granted,
    canCreateFloor: useGrantedCapability('projects:floors:create').granted,
    canUpdateFloor: useGrantedCapability('projects:floors:update').granted,
    canDeleteFloor: useGrantedCapability('projects:floors:delete').granted,
  };
}
