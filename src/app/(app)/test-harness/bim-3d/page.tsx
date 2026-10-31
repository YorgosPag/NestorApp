'use client';

import { notFound } from 'next/navigation';
import { isTestHarnessRouteEnabled } from '@/config/test-harness-access';
import { LazyHarnessRoutes } from '@/utils/lazyHarnessRoutes';

// ADR-280 §11.8 Β4.3 — από το μητρώο (`lazyHarnessRoutes`): το chunk φέρνει τα κείμενά του. `'use client'` γιατί ένας server
// component δεν μπαίνει με τελεία σε client module· ο φρουρός διαβάζει μόνο `NODE_ENV`, που ενσωματώνεται και στον client.
const Bim3DHarness = LazyHarnessRoutes.HarnessBim3D;

/**
 * Headless 3D BIM render harness (ADR-550 Φ2 golden-image verification).
 * Mirrors the 2D `/test-harness/dxf-canvas` pattern: mounts the REAL 3D viewport
 * with a deterministic fixture scene so Playwright can screenshot the WebGL render.
 * Dev-only — 404 in production.
 */
export default function Bim3DTestPage() {
  if (!isTestHarnessRouteEnabled()) notFound();
  return <Bim3DHarness />;
}
