import { notFound } from 'next/navigation';
import Bim3DHarness from './Bim3DHarness';

/**
 * Headless 3D BIM render harness (ADR-550 Φ2 golden-image verification).
 * Mirrors the 2D `/test-harness/dxf-canvas` pattern: mounts the REAL 3D viewport
 * with a deterministic fixture scene so Playwright can screenshot the WebGL render.
 * Dev-only — 404 in production.
 */
export default function Bim3DTestPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <Bim3DHarness />;
}
