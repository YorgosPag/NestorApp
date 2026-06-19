'use client';

/**
 * BeamDiagram3DOverlay — 3Δ διαγράμματα M/V/N δοκαριών (ADR-483 / Slice 6).
 *
 * Το 3Δ αντίστοιχο του 2Δ {@link StructuralDiagramOverlay} (δοκάρια σε κάτοψη), για την
 * **3Δ προβολή**: όταν το toggle «Διαγράμματα M/V/N» είναι ON **και** η προβολή είναι 3Δ,
 * προσθέτει στη σκηνή ένα transient `THREE.Group` με την κορδέλα διαγράμματος του επιλεγμένου
 * εντατικού μεγέθους στο **κάθετο επίπεδο που περιέχει τον άξονα κάθε δοκαριού** (Revit/Robot).
 * Δίδυμο του {@link ColumnDiagram3DOverlay} (κατακόρυφα μέλη) — ΕΝΑ toggle οδηγεί και τα δύο.
 *
 * **Lifecycle = mirror του {@link ColumnDiagram3DOverlay}:** useEffect → `scene.add` →
 * cleanup `scene.remove` + dispose (geometry/material/texture). **ADR-040 safe:** subscribes
 * ΜΟΝΟ σε low-freq stores (`AnalysisResultsStore`/`AnalyticalModelStore` γράφονται μόνο στην
 * «Ανάλυση») + view toggles. Σε **αντίθεση** με τις κολώνες, το beam επίπεδο είναι **fixed**
 * (Revit-style, ΟΧΙ billboard) → **κανένα per-frame work / scheduler register** (στατικό group·
 * οι ετικέτες είναι sprites που auto-face την κάμερα από μόνες τους). Αν ζητηθεί nadir
 * readability, ο beam mesh builder μπορεί να flag-άρει τα pivots + εδώ register
 * `billboardDiagramPivots` (LOW + camera-dirty), όπως ο column overlay.
 *
 * **Full automation (ADR-487/488):** το `isAnalysisEngaged` περιλαμβάνει ήδη το
 * `showAnalysisDiagrams` → ο FEM solver μένει ζωντανός όσο το overlay είναι ON, άρα τα
 * διαγράμματα ακολουθούν κάθε στατική μεταβολή χωρίς νέο trigger.
 *
 * @see ./beam-diagram-3d-geometry.ts — pure data (analytical → ribbon paths)
 * @see ./beam-diagram-3d-mesh.ts — three.js builder
 * @see ./ColumnDiagram3DOverlay.tsx — column δίδυμο (κατακόρυφος άξονας, full-billboard)
 * @see ../../components/dxf-layout/StructuralDiagramOverlay.tsx — 2Δ δίδυμο
 */

import { useEffect, useMemo, useSyncExternalStore, type MutableRefObject } from 'react';
import * as THREE from 'three';
import type { ThreeJsSceneManager } from '../scene/ThreeJsSceneManager';
import { useViewMode3DStore } from '../stores/ViewMode3DStore';
import { useAnalysisDiagramViewStore } from '../../state/analysis-diagram-view-store';
import { AnalysisResultsStore } from '../../bim/structural/analytical/solver/analysis-results-store';
import { AnalyticalModelStore } from '../../bim/structural/analytical/analytical-model-store';
import { buildBeamDiagram3DPaths } from './beam-diagram-3d-geometry';
import { buildBeamDiagram3DGroup } from './beam-diagram-3d-mesh';

export interface BeamDiagram3DOverlayProps {
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

export function BeamDiagram3DOverlay({ managerRef }: BeamDiagram3DOverlayProps): null {
  // Leaf subscriptions (ADR-040): toggle + component + render mode + low-freq stores.
  const showDiagrams = useAnalysisDiagramViewStore((s) => s.showAnalysisDiagrams);
  const component = useAnalysisDiagramViewStore((s) => s.diagramComponent);
  const mode = useViewMode3DStore((s) => s.mode);
  const result = useSyncExternalStore(AnalysisResultsStore.subscribe, AnalysisResultsStore.get, AnalysisResultsStore.get);
  const model = useSyncExternalStore(AnalyticalModelStore.subscribe, AnalyticalModelStore.get, AnalyticalModelStore.get);
  // Ενεργό σε οποιαδήποτε 3Δ προβολή (3d-raster/3d-preview/3d-final)· το 2Δ overlay
  // (δοκάρια, κάτοψη) καλύπτει το `mode === '2d'`. Συμπληρωματικά, μηδέν επικάλυψη.
  const active = showDiagrams && mode !== '2d';

  // Group χτίζεται μόνο όταν active· κάθε αλλαγή (results/model/component) παράγει νέο group
  // → το effect cleanup αφαιρεί+disposes το προηγούμενο πριν προσθέσει το νέο.
  const group = useMemo<THREE.Group | null>(() => {
    if (!active) return null;
    return buildBeamDiagram3DGroup(buildBeamDiagram3DPaths(model, result, { component }));
  }, [active, model, result, component]);

  useEffect(() => {
    const manager = managerRef.current;
    if (!manager || !group) return;
    manager.scene.add(group);
    // Fixed κάθετο επίπεδο (Revit-style): ο προσανατολισμός κλειδώνεται στο build → καμία
    // per-frame εργασία/scheduler. Οι ετικέτες (Sprite) κοιτούν την κάμερα μόνες τους.
    return () => {
      manager.scene.remove(group);
      disposeDiagramGroup(group);
    };
  }, [managerRef, group]);

  return null;
}
