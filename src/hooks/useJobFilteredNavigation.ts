'use client';

/**
 * ADR-748 Φάση 3 — Η πλοήγηση **περασμένη από τα δύο φίλτρα**, μία φορά.
 *
 * ΤΑ ΔΥΟ ΦΙΛΤΡΑ ΕΙΝΑΙ ΔΙΑΔΟΧΙΚΑ ΚΑΙ ΑΝΕΞΑΡΤΗΤΑ (§14.5) — μην τα ενώσεις:
 *
 *   1. **ΔΙΚΑΙΩΜΑ** → `filterItemsByPermissions()` μέσα στο
 *      `smart-navigation-factory`. Υπάρχει και τρέχει από πριν· είναι ασφάλεια
 *      στο UI επίπεδο και **δεν το αγγίζουμε**.
 *   2. **ΕΝΕΡΓΗ ΔΟΥΛΕΙΑ** → `filterItemsByJob()`. Καθαρή ετικέτα ορατότητας.
 *
 * Ένα στοιχείο εμφανίζεται όταν *(α)* ανήκει στην ενεργή δουλειά **ΚΑΙ** *(β)*
 * ο έλεγχος δικαιωμάτων το έχει ήδη επιτρέψει. 🔒 Η δουλειά **ΠΟΤΕ** δεν
 * προσθέτει δικαίωμα — μόνο αφαιρεί θόρυβο (§5, Ε5.η).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΓΙΑΤΙ HOOK ΚΑΙ ΟΧΙ ΥΠΟΛΟΓΙΣΜΟΣ ΜΕΣΑ ΣΤΟ `AppSidebar`
 *
 * Τον **ίδιο** αριθμό «Χ κρυμμένα» χρειάζεται και ο διακόπτης στο header. Δύο
 * ανεξάρτητοι υπολογισμοί = δύο αριθμοί που θα αποκλίνουν την πρώτη φορά που θα
 * αλλάξει ο κανόνας — το κλασικό «δύο λίστες, μία αλήθεια» που όλο το ADR-748
 * κυνηγά. Ένας hook, δύο καταναλωτές, **ένα** μονοπάτι κώδικα.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * @see docs/centralized-systems/reference/adrs/ADR-748-role-based-workspaces.md §14
 */

import { useMemo } from 'react';
import {
  getMainMenuItems,
  getToolsMenuItems,
  getSettingsMenuItems,
} from '@/config/navigation';
import type { MenuItem } from '@/config/navigation';
import { filterItemsByJob } from '@/config/jobs-access';
import { useActiveJob } from '@/contexts/ActiveJobContext';
import { useEffectivePermissions } from '@/hooks/useEffectivePermissions';

export interface JobFilteredNavigation {
  readonly mainMenuItems: MenuItem[];
  readonly toolsMenuItems: MenuItem[];
  readonly settingsMenuItems: MenuItem[];
  /**
   * Α-3/Ε5.ε — πόσα στοιχεία έκρυψε **η ενεργή δουλειά** (όχι τα δικαιώματα:
   * όσα κόβει το permission δεν είναι «κρυμμένα», είναι **ανύπαρκτα** για τον
   * χρήστη και δεν επαναφέρονται με κλικ. Δύο διαφορετικά πράγματα — η ένωσή
   * τους σε έναν αριθμό θα υποσχόταν επαναφορά που δεν μπορεί να γίνει).
   */
  readonly hiddenCount: number;
}

export function useJobFilteredNavigation(): JobFilteredNavigation {
  const { permissions } = useEffectivePermissions();
  const { activeJob } = useActiveJob();

  return useMemo(() => {
    const permissionList = [...permissions];
    const main = filterItemsByJob(getMainMenuItems(permissionList), activeJob);
    const tools = filterItemsByJob(getToolsMenuItems(permissionList), activeJob);
    const settings = filterItemsByJob(getSettingsMenuItems(permissionList), activeJob);

    return {
      mainMenuItems: [...main.visible],
      toolsMenuItems: [...tools.visible],
      settingsMenuItems: [...settings.visible],
      hiddenCount: main.hiddenCount + tools.hiddenCount + settings.hiddenCount,
    };
  }, [permissions, activeJob]);
}
