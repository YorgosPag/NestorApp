'use client';

/**
 * @fileoverview **Ο ΚΥΚΛΟΣ ΖΩΗΣ ΤΗΣ ΜΗΧΑΝΗΣ** — γέννηση στην προσάρτηση, μέγεθος από το `ResizeObserver`, θέαση από το
 * store, `dispose` στην αποπροσάρτηση (ADR-884 Φ1 · §4.8).
 * @related `tour-panorama-engine.ts` · `tour-camera-store.ts`
 * @module components/spatial-tour/viewer/useTourPanoramaEngine
 *
 * 🔑 **Ένας κάτοχος**: ο καμβάς ανήκει σε αυτό το hook· καμία άλλη διαδρομή δεν φτιάχνει ή σβήνει πλαίσιο WebGL
 * (δύο γεννήσεις στο StrictMode ⇒ η πρώτη **απελευθερώνεται** πριν τη δεύτερη).
 */

import { type RefObject, useEffect, useState } from 'react';

import type { TourCameraStore } from './tour-camera-store';
import { createTourPanoramaEngine, type TourPanoramaEngine } from './tour-panorama-engine';

export function useTourPanoramaEngine(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  camera: TourCameraStore,
): TourPanoramaEngine | null {
  const [engine, setEngine] = useState<TourPanoramaEngine | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return;
    const created = createTourPanoramaEngine(canvas);
    const fit = () => {
      const { width, height } = canvas.getBoundingClientRect();
      created.resize(width, height, window.devicePixelRatio || 1);
      camera.set({ ...camera.get(), aspect: height > 0 ? width / height : camera.get().aspect });
    };
    const observer = new ResizeObserver(fit);
    observer.observe(canvas);
    fit();
    const unsubscribe = camera.subscribe(() => created.setView(camera.get().view));
    created.setView(camera.get().view);
    setEngine(created);
    return () => {
      unsubscribe();
      observer.disconnect();
      created.dispose();
      setEngine(null);
    };
  }, [canvasRef, camera]);

  return engine;
}
