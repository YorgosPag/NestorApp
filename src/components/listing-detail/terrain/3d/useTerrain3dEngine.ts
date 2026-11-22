'use client';

/**
 * @fileoverview **Ο ΚΑΤΟΧΟΣ ΤΗΣ ΜΗΧΑΝΗΣ ΣΤΟ REACT** — δημιουργία στην προσάρτηση, καταστροφή στην αποπροσάρτηση (ADR-920 §14.5).
 * @related `terrain-3d-engine.ts` · `spatial-tour/viewer/useTourPanoramaEngine.ts` (ίδιο μοτίβο) · `@/hooks/useEventCallback`
 * @module components/listing-detail/terrain/3d/useTerrain3dEngine
 *
 * 🔑 **Η υπερβολή ΔΕΝ ξαναφτιάχνει τη μηχανή**: νέα γεωμετρία ⇒ `setGeometry`, η κάμερα μένει όπου την άφησε ο άνθρωπος.
 *   Η μηχανή ξαναφτιάχνεται μόνο αν αλλάξουν οι λέξεις του κύβου (αλλαγή γλώσσας: οι υφές του κύβου ζωγραφίζονται μία φορά).
 * 🔑 **Μέγεθος από `ResizeObserver`**, όχι από `window.resize`: ο καμβάς αλλάζει και όταν αλλάζει η στήλη της σελίδας.
 * 🔍 **Η επιθεώρηση ΔΕΝ περνά από το React** (ADR-920 §14.10, κανόνας ADR-040): συνδρομή στο store → `engine.setInspect`
 *   απευθείας. Κανένα render του καμβά ανά κίνηση δείκτη. Νέα μηχανή (αλλαγή γλώσσας) ⇒ παίρνει αμέσως την τρέχουσα κατάσταση.
 */

import { useCallback, useEffect, useRef, type RefObject } from 'react';

import { useEventCallback } from '@/hooks/useEventCallback';
import type { ViewCubeOptions } from '@/lib/three/view-cube/view-cube';
import type { Terrain3dGeometry } from '@/lib/terrain/publication/terrain-3d-geometry';

import type { TerrainInspectStore } from '../terrain-inspect-store';
import { createTerrain3dEngine, type Terrain3dEngine } from './terrain-3d-engine';
import { terrain3dInspectViewOf } from './terrain-3d-inspect-view';

export interface UseTerrain3dEngineArgs {
  readonly canvasRef: RefObject<HTMLCanvasElement | null>;
  readonly cubeHostRef: RefObject<HTMLElement | null>;
  readonly geometry: Terrain3dGeometry;
  readonly cubeLabels: ViewCubeOptions['labels'];
  readonly onContextLost: () => void;
  /** ADR-920 §14.10 — το store της επιθεώρησης (`null` χωρίς πάροχο: σκέτος θεατής). */
  readonly inspect: TerrainInspectStore | null;
}

/** Η τρέχουσα κατάσταση της επιθεώρησης → μηχανή. */
function pushInspect(engine: Terrain3dEngine | null, store: TerrainInspectStore | null): void {
  if (engine && store) engine.setInspect(terrain3dInspectViewOf(store.get(), store));
}

/** Το μέγεθος του καμβά → μηχανή. Επιστρέφει την αποσύνδεση. */
function observeSize(canvas: HTMLCanvasElement, engine: Terrain3dEngine): () => void {
  const observer = new ResizeObserver(([entry]) => {
    if (entry) engine.resize(entry.contentRect.width, entry.contentRect.height);
  });
  observer.observe(canvas);
  return () => observer.disconnect();
}

export interface Terrain3dEngineHandle {
  /** Επαναφορά της όψης (κουμπί «Αρχική όψη»). */
  readonly home: () => void;
  /** Getter τη στιγμή του συμβάντος (κανόνας ADR-040) — `null` πριν την προσάρτηση / μετά την καταστροφή. */
  readonly getEngine: () => Terrain3dEngine | null;
}

export function useTerrain3dEngine(args: UseTerrain3dEngineArgs): Terrain3dEngineHandle {
  const { canvasRef, cubeHostRef, geometry, cubeLabels, inspect } = args;
  const inspectRef = useRef(inspect);
  inspectRef.current = inspect;
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
    pushInspect(engine, inspectRef.current);
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

  useEffect(() => {
    if (inspect === null) return undefined;
    pushInspect(engineRef.current, inspect);
    return inspect.subscribe(() => pushInspect(engineRef.current, inspect));
  }, [inspect]);

  const getEngine = useCallback(() => engineRef.current, []);
  return { home: () => engineRef.current?.home(), getEngine };
}
