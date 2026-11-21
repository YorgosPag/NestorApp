'use client';

/**
 * @fileoverview **Ο ΚΑΤΟΧΟΣ ΤΗΣ ΜΗΧΑΝΗΣ ΣΤΟ REACT** — δημιουργία στην προσάρτηση, καταστροφή στην αποπροσάρτηση (ADR-920 §14.5).
 * @related `terrain-3d-engine.ts` · `spatial-tour/viewer/useTourPanoramaEngine.ts` (ίδιο μοτίβο) · `@/hooks/useEventCallback`
 * @module components/listing-detail/terrain/3d/useTerrain3dEngine
 *
 * 🔑 **Η υπερβολή ΔΕΝ ξαναφτιάχνει τη μηχανή**: νέα γεωμετρία ⇒ `setGeometry`, η κάμερα μένει όπου την άφησε ο άνθρωπος.
 *   Η μηχανή ξαναφτιάχνεται μόνο αν αλλάξουν οι λέξεις του κύβου (αλλαγή γλώσσας: οι υφές του κύβου ζωγραφίζονται μία φορά).
 * 🔑 **Μέγεθος από `ResizeObserver`**, όχι από `window.resize`: ο καμβάς αλλάζει και όταν αλλάζει η στήλη της σελίδας.
 */

import { useEffect, useRef, type RefObject } from 'react';

import { useEventCallback } from '@/hooks/useEventCallback';
import type { ViewCubeOptions } from '@/lib/three/view-cube/view-cube';
import type { Terrain3dGeometry } from '@/lib/terrain/publication/terrain-3d-geometry';

import { createTerrain3dEngine, type Terrain3dEngine } from './terrain-3d-engine';

export interface UseTerrain3dEngineArgs {
  readonly canvasRef: RefObject<HTMLCanvasElement | null>;
  readonly cubeHostRef: RefObject<HTMLElement | null>;
  readonly geometry: Terrain3dGeometry;
  readonly cubeLabels: ViewCubeOptions['labels'];
  readonly onContextLost: () => void;
}

/** Το μέγεθος του καμβά → μηχανή. Επιστρέφει την αποσύνδεση. */
function observeSize(canvas: HTMLCanvasElement, engine: Terrain3dEngine): () => void {
  const observer = new ResizeObserver(([entry]) => {
    if (entry) engine.resize(entry.contentRect.width, entry.contentRect.height);
  });
  observer.observe(canvas);
  return () => observer.disconnect();
}

/** Επιστρέφει την επαναφορά της όψης (για το κουμπί «Αρχική όψη»). */
export function useTerrain3dEngine(args: UseTerrain3dEngineArgs): { readonly home: () => void } {
  const { canvasRef, cubeHostRef, geometry, cubeLabels } = args;
  const engineRef = useRef<Terrain3dEngine | null>(null);
  /** Η γεωμετρία που έχει ήδη η μηχανή — ώστε η πρώτη απόδοση να μην ανεβάσει τα buffers δύο φορές. */
  const appliedRef = useRef<Terrain3dGeometry | null>(null);
  const geometryRef = useRef(geometry);
  geometryRef.current = geometry;
  const onContextLost = useEventCallback(args.onContextLost);

  useEffect(() => {
    const canvas = canvasRef.current;
    const cubeHost = cubeHostRef.current;
    if (canvas === null || cubeHost === null) return undefined;
    const engine = createTerrain3dEngine({ canvas, cubeHost, geometry: geometryRef.current, cubeLabels, onContextLost });
    engineRef.current = engine;
    appliedRef.current = geometryRef.current;
    const stopObserving = observeSize(canvas, engine);
    return () => {
      stopObserving();
      engineRef.current = null;
      engine.dispose();
    };
  }, [canvasRef, cubeHostRef, cubeLabels, onContextLost]);

  useEffect(() => {
    if (engineRef.current === null || appliedRef.current === geometry) return;
    appliedRef.current = geometry;
    engineRef.current.setGeometry(geometry);
  }, [geometry]);

  return { home: () => engineRef.current?.home() };
}
