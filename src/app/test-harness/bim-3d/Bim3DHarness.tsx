'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { AuthProvider } from '@/auth/contexts/AuthContext';
import { getActiveSceneManager } from '@/subapps/dxf-viewer/bim-3d/scene/active-scene-manager-registry';
import { POINT_ENTITIES_FIXTURE } from '@/subapps/dxf-viewer/bim-3d/__fixtures__/point-entities-scene-fixture';

/**
 * 3D BIM render harness (ADR-550 Φ2). Mounts the REAL `BimViewport3D` with the
 * external-entities prop (`bimEntities`) so it renders the fixture scene WITHOUT
 * Firebase/Firestore/auth project data (ADR-371 read-only pipeline). Once the
 * Three.js scene manager appears (registered globally via `setActiveSceneManager`),
 * the camera is fit-framed and a `bim-3d-ready` marker is exposed for Playwright.
 */
const BimViewport3D = dynamic(
  () => import('@/subapps/dxf-viewer/bim-3d/viewport/BimViewport3D').then((m) => m.BimViewport3D),
  { ssr: false },
);

declare global {
  interface Window {
    __bim3dTest: {
      /** True once the Three.js scene manager is mounted. */
      isReady: () => boolean;
      /** Fit-frame the camera to the whole scene (zoom-extents). */
      frame: () => void;
    };
  }
}

export default function Bim3DHarness() {
  const [ready, setReady] = useState(false);

  // Expose the imperative test handle (re-bound each render; cheap).
  useEffect(() => {
    window.__bim3dTest = {
      isReady: () => !!getActiveSceneManager(),
      frame: () => getActiveSceneManager()?.frameSelectionOrFitExtents(),
    };
  });

  // Poll for the scene manager (created in BimViewport3D's mount effect), then
  // fit-frame the camera and flag readiness for the screenshot.
  useEffect(() => {
    let raf = 0;
    let settleTimer: ReturnType<typeof setTimeout> | undefined;
    const poll = () => {
      const mgr = getActiveSceneManager();
      if (mgr) {
        // Let the initial entity sync complete a tick, then fit-frame.
        settleTimer = setTimeout(() => {
          getActiveSceneManager()?.frameSelectionOrFitExtents();
          setReady(true);
        }, 250);
        return;
      }
      raf = requestAnimationFrame(poll);
    };
    raf = requestAnimationFrame(poll);
    return () => {
      cancelAnimationFrame(raf);
      if (settleTimer) clearTimeout(settleTimer);
    };
  }, []);

  return (
    <AuthProvider>
      <main className="fixed inset-0 overflow-hidden bg-background">
        <section className="relative h-full w-full">
          <BimViewport3D visible readOnly bimEntities={POINT_ENTITIES_FIXTURE} />
          {ready ? (
            <div data-testid="bim-3d-ready" className="absolute left-0 top-0 h-px w-px" />
          ) : (
            <div data-testid="loading" />
          )}
        </section>
      </main>
    </AuthProvider>
  );
}
