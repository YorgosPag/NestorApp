'use client';

/**
 * ColumnDiagram3DOverlay — 3Δ διαγράμματα M/V/N κολωνών (ADR-483 / Slice 5).
 *
 * Το 3Δ αντίστοιχο του 2Δ {@link StructuralDiagramOverlay} (δοκάρια σε κάτοψη): όταν
 * το toggle «Διαγράμματα M/V/N» είναι ON **και** η προβολή είναι 3Δ, προσθέτει στη
 * σκηνή ένα transient `THREE.Group` με την κορδέλα διαγράμματος του επιλεγμένου
 * εντατικού μεγέθους κατά μήκος του κατακόρυφου άξονα κάθε κολώνας (Revit/Robot).
 *
 * **Lifecycle = mirror του {@link ProposalGhost3DOverlay}:** useEffect → `scene.add`
 * → cleanup `scene.remove` + dispose (geometry/material/texture). **ADR-040 safe:**
 * subscribes ΜΟΝΟ σε low-freq stores (`AnalysisResultsStore`/`AnalyticalModelStore`
 * γράφονται μόνο στην «Ανάλυση») + view toggles· καμία επίδραση σε hot-path/scheduler.
 * Δεν αγγίζει το `ThreeJsSceneManager` tick.
 *
 * **Full automation (ADR-487/488):** το `isAnalysisEngaged` περιλαμβάνει ήδη το
 * `showAnalysisDiagrams` → ο FEM solver μένει ζωντανός όσο το overlay είναι ON, άρα
 * τα διαγράμματα ακολουθούν κάθε στατική μεταβολή χωρίς νέο trigger.
 *
 * @see ./column-diagram-3d-geometry.ts — pure data (analytical → ribbon paths)
 * @see ./column-diagram-3d-mesh.ts — three.js builder
 * @see ../proposal/ProposalGhost3DOverlay.tsx — lifecycle template
 * @see ../../components/dxf-layout/StructuralDiagramOverlay.tsx — 2Δ δίδυμο
 */

import { useEffect, useMemo, useSyncExternalStore, type MutableRefObject } from 'react';
import * as THREE from 'three';
import type { ThreeJsSceneManager } from '../scene/ThreeJsSceneManager';
import { useViewMode3DStore } from '../stores/ViewMode3DStore';
import { useAnalysisDiagramViewStore } from '../../state/analysis-diagram-view-store';
import { AnalysisResultsStore } from '../../bim/structural/analytical/solver/analysis-results-store';
import { AnalyticalModelStore } from '../../bim/structural/analytical/analytical-model-store';
import { UnifiedFrameScheduler, RENDER_PRIORITIES } from '../../rendering/core/UnifiedFrameScheduler';
import { buildColumnDiagram3DPaths } from './column-diagram-3d-geometry';
import { buildColumnDiagram3DGroup, billboardColumnDiagrams } from './column-diagram-3d-mesh';

export interface ColumnDiagram3DOverlayProps {
  readonly managerRef: MutableRefObject<ThreeJsSceneManager | null>;
}

/** Dispose geometry + material + texture σε όλο το subtree (το overlay κατέχει το group). */
function disposeDiagramGroup(root: THREE.Object3D): void {
  root.traverse((node) => {
    const obj = node as THREE.Mesh & THREE.Sprite;
    obj.geometry?.dispose?.();
    const mat = obj.material;
    const mats = Array.isArray(mat) ? mat : mat ? [mat] : [];
    for (const m of mats) {
      const withMap = m as THREE.Material & { map?: THREE.Texture | null };
      withMap.map?.dispose?.();
      m.dispose();
    }
  });
}

export function ColumnDiagram3DOverlay({ managerRef }: ColumnDiagram3DOverlayProps): null {
  // Leaf subscriptions (ADR-040): toggle + component + render mode + low-freq stores.
  const showDiagrams = useAnalysisDiagramViewStore((s) => s.showAnalysisDiagrams);
  const component = useAnalysisDiagramViewStore((s) => s.diagramComponent);
  const mode = useViewMode3DStore((s) => s.mode);
  const result = useSyncExternalStore(AnalysisResultsStore.subscribe, AnalysisResultsStore.get, AnalysisResultsStore.get);
  const model = useSyncExternalStore(AnalyticalModelStore.subscribe, AnalyticalModelStore.get, AnalyticalModelStore.get);
  // Ενεργό σε οποιαδήποτε 3Δ προβολή (3d-raster/3d-preview/3d-final)· το 2Δ overlay
  // (δοκάρια, κάτοψη) καλύπτει το `mode === '2d'`. Συμπληρωματικά, μηδέν επικάλυψη.
  const active = showDiagrams && mode !== '2d';

  // Group χτίζεται μόνο όταν active· κάθε αλλαγή (results/model/component) παράγει νέο
  // group → το effect cleanup αφαιρεί+disposes το προηγούμενο πριν προσθέσει το νέο.
  const group = useMemo<THREE.Group | null>(() => {
    if (!active) return null;
    return buildColumnDiagram3DGroup(buildColumnDiagram3DPaths(model, result, { component }));
  }, [active, model, result, component]);

  useEffect(() => {
    const manager = managerRef.current;
    if (!manager || !group) return;
    manager.scene.add(group);

    // Billboard: κάθε per-column pivot στρέφεται γύρω από τον κατακόρυφο άξονα ώστε να
    // κοιτά την κάμερα → ευανάγνωστο σε κάθε orbit. Τρέχει AFTER το `bim-3d-scene` (LOW)
    // και ΜΟΝΟ όταν κινηθεί η κάμερα (camera-dirty signature, μηδέν idle spin· ADR-040).
    let lastSig = '';
    const unregister = UnifiedFrameScheduler.register(
      'bim-3d-column-diagrams',
      'BIM 3D Column Diagrams',
      RENDER_PRIORITIES.LOW,
      () => {
        const m = managerRef.current;
        if (m) billboardColumnDiagrams(group, m.getCamera());
      },
      () => {
        const m = managerRef.current;
        if (!m) return false;
        const p = m.getCamera().position;
        const sig = `${p.x},${p.y},${p.z}`;
        if (sig === lastSig) return false;
        lastSig = sig;
        return true;
      },
    );
    billboardColumnDiagrams(group, manager.getCamera()); // αρχικός προσανατολισμός

    return () => {
      unregister();
      manager.scene.remove(group);
      disposeDiagramGroup(group);
    };
  }, [managerRef, group]);

  return null;
}
