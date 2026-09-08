'use client';

/**
 * @fileoverview **ΤΑ ΖΩΝΤΑΝΑ ΥΛΙΚΑ ΤΗΣ ΣΥΝΑΡΜΟΛΟΓΗΣΗΣ** — μία φορά, για κάθε προορισμό.
 * @related ADR-505 (export host) · ADR-668 (3Δ mesh) · ADR-845 §7.5 (Φ4.2β/Βήμα Γ)
 * @module subapps/dxf-viewer/app/dialog-hosts/useExportDeps
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΕΦΥΓΕ ΑΠΟ ΤΟΝ `ExportHost` (ADR-845 Βήμα Γ)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `ExportDeps` **δεν** είναι μια δομή που «περνάει κανείς» — είναι **τέσσερις ζωντανές
 * πηγές δεδομένων συναρμολογημένες με συγκεκριμένους κανόνες**: το ενεργό κτήριο βγαίνει από
 * το **ενεργό επίπεδο** *(όχι από το prop)*, οι όροφοι από τον κανονικό Firestore SSoT, τα
 * κτήρια **αφιλτράριστα** *(fail-open)*, και οι σκηνές **τη στιγμή της κλήσης**.
 *
 * 🔑 Με τον δεύτερο προορισμό *(δημοσίευση μοντέλου σε ακίνητο)*, μια αντιγραφή αυτών των
 * σαράντα γραμμών θα ήταν **sibling clone** — ο N.18 τον έπιασε ήδη μία φορά σε αυτή τη φάση,
 * και το `ssot:discover` **δεν** θα τον έβλεπε ποτέ *(δύο hosts, διαφορετικά ονόματα)*. Και το
 * χειρότερο δεν είναι η επανάληψη: είναι ότι μια διόρθωση στον έναν κανόνα *(π.χ. το fallback
 * του `activeBuildingId`)* θα άφηνε τον άλλον προορισμό να εξάγει **άλλο κτήριο**, σιωπηλά.
 *
 * ⚠️ **ADR-040**: μηδέν συνδρομές υψηλής συχνότητας. Οι δύο ροές Firestore
 * *(`useFloorsByBuilding`, `useFirestoreBuildings`)* είναι σπάνια μεταβαλλόμενες λίστες, όχι
 * καταστήματα καμβά — η ανησυχία της ADR-040 είναι το 60fps, όχι κάθε συνδρομή.
 */

import * as React from 'react';

import { useLevels } from '../../systems/levels';
// ADR-668 — υψόμετρα ορόφων από τον **ίδιο** κανονικό Firestore SSoT που διαβάζει το
// `useFloors3DAggregator`. ΟΧΙ `Bim3DEntitiesStore.floors` (το `elevation` έρχεται undefined →
// κάθε όροφος θα στοιβαζόταν στο Y=0).
import { useFloorsByBuilding } from '@/components/properties/shared/useFloorsByBuilding';
// ADR-668 — εγγραφές κτηρίων (baseElevation + μέλη) από τον **ένα** κοινό listener
// (`useFirestoreBuildings`, ADR-227/300), τον ίδιο που τροφοδοτεί το ζωντανό 3Δ.
import { useFirestoreBuildings } from '@/hooks/useFirestoreBuildings';
import { nowISO } from '@/lib/date-local';
import type { ExportDeps, ExportLevelScene } from '../../export/types';
import type { BuildingRef } from '../../bim/utils/bim-floor-utils';

export interface ExportDepsHandle {
  /**
   * Το κτήριο που **πράγματι** εξάγεται — από το ενεργό επίπεδο, με το prop ως εφεδρεία.
   * Εκτεθειμένο ξεχωριστά γιατί το χειριστήριο του μοντέλου το χρειάζεται **πριν** τη
   * συναρμολόγηση, για να ρωτήσει *«σε ποιο ακίνητο αυτού του κτηρίου;»*.
   */
  readonly activeBuildingId: string | null;
  /**
   * **Συλλέγει τις ζωντανές σκηνές ΤΗ ΣΤΙΓΜΗ ΤΗΣ ΚΛΗΣΗΣ** και επιστρέφει πλήρη `ExportDeps`.
   *
   * ⚠️ Καλείται **μία** φορά ανά υποβολή και το αποτέλεσμα ξαναχρησιμοποιείται αυτούσιο
   * *(ADR-767 Δ4: ο φραγμός των δεμένων πινάκων χρειάζεται τις **ίδιες** σκηνές που θα
   * εξαχθούν)*. Δύο κλήσεις θα ήταν δύο συλλογές, ελεύθερες να διαφέρουν.
   */
  readonly collect: () => ExportDeps;
}

/**
 * Τα ζωντανά υλικά που χρειάζεται **κάθε** προορισμός εξαγωγής.
 *
 * @param buildingId Το κτήριο του ξενιστή — **εφεδρεία** όταν το ενεργό επίπεδο δεν φέρει δικό του.
 */
export function useExportDeps(buildingId?: string): ExportDepsHandle {
  const { levels, currentLevelId, getLevelScene } = useLevels();

  const projectName = React.useMemo(() => {
    const level = levels.find((l) => l.id === currentLevelId);
    return level?.name ?? level?.sceneFileName ?? 'drawing';
  }, [levels, currentLevelId]);

  // ADR-668 — παράγεται από το **ΕΝΕΡΓΟ ΕΠΙΠΕΔΟ** (όχι από το prop, που σκοπεύει τη ροή IFC):
  // έτσι η εξαγόμενη στοίβα ταιριάζει με ό,τι δείχνει το ζωντανό 3Δ.
  const activeBuildingId = React.useMemo(
    () => levels.find((l) => l.id === currentLevelId)?.buildingId ?? buildingId ?? null,
    [levels, currentLevelId, buildingId],
  );

  const { floors: buildingFloors } = useFloorsByBuilding(activeBuildingId, true);

  // ADR-668 — **αφιλτράριστα κατά έργο**: ο εξαγωγέας κάνει μόνο `.find(b => b.id === …)`, άρα
  // περισσεύματα είναι αβλαβή, ενώ ένα μπαγιάτικο `projectId` θα τον **λιμοκτονούσε**
  // (fail-open beats fail-closed here).
  const { buildings: firestoreBuildings } = useFirestoreBuildings();
  const buildings = React.useMemo<BuildingRef[]>(
    () => firestoreBuildings.map((b) => ({ id: b.id, baseElevation: b.baseElevation, name: b.name })),
    [firestoreBuildings],
  );

  const collect = React.useCallback((): ExportDeps => {
    const levelScenes: ExportLevelScene[] = [];
    for (const level of levels) {
      const scene = getLevelScene(level.id);
      if (scene) levelScenes.push({ level, scene });
    }

    return {
      levelScenes,
      activeLevelId: currentLevelId,
      projectName,
      dateStr: nowISO().slice(0, 10),
      floors: buildingFloors,
      buildings,
      activeBuildingId,
    };
  }, [levels, getLevelScene, currentLevelId, projectName, buildingFloors, buildings, activeBuildingId]);

  return { activeBuildingId, collect };
}
