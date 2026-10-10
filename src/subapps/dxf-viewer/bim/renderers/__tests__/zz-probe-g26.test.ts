jest.mock('firebase/auth', () => ({
  __esModule: true,
  getAuth: () => ({ currentUser: null }),
  onAuthStateChanged: (_a: unknown, cb: (u: null) => void) => { cb(null); return () => {}; },
  signInAnonymously: jest.fn(),
}));

import { writeFileSync } from 'fs';
import { PIXEL_GATE_SAMPLES } from '../../../print/public-floorplan/pixel-gate/pixel-gate-samples';
import { RoofRenderer } from '../RoofRenderer';
import { FoundationRenderer } from '../FoundationRenderer';
import { BeamRenderer } from '../BeamRenderer';
import { FloorFinishRenderer } from '../FloorFinishRenderer';
import { ThermalSpaceRenderer } from '../ThermalSpaceRenderer';
import { SpaceSeparatorRenderer } from '../SpaceSeparatorRenderer';
import { GenericSolidRenderer } from '../GenericSolidRenderer';
import { MepFixtureRenderer } from '../MepFixtureRenderer';
import { paintedBy } from './structural-samples';

const cell = {
  centre: { x: 2500, y: 2500 }, from: { x: 1000, y: 2500 }, to: { x: 4000, y: 2500 },
  ring: [{ x: 1000, y: 1000 }, { x: 4000, y: 1000 }, { x: 4000, y: 4000 }, { x: 1000, y: 4000 }],
};

it('probe', () => {
  const out: Record<string, unknown> = {};
  const run = (type: keyof typeof PIXEL_GATE_SAMPLES, create: Parameters<typeof paintedBy>[0], index = 0) => {
    const entity = PIXEL_GATE_SAMPLES[type]!(cell)[index];
    out[`${type}#${index}`] = paintedBy(create, entity as { id: string });
  };
  run('roof', (c) => new RoofRenderer(c));
  run('foundation', (c) => new FoundationRenderer(c));
  run('beam', (c) => new BeamRenderer(c));
  run('floor-finish', (c) => new FloorFinishRenderer(c));
  run('thermal-space', (c) => new ThermalSpaceRenderer(c));
  run('space-separator', (c) => new SpaceSeparatorRenderer(c));
  run('generic-solid', (c) => new GenericSolidRenderer(c));
  run('mep-fixture', (c) => new MepFixtureRenderer(c), 0);
  writeFileSync(process.env.G26_PROBE_OUT as string, JSON.stringify(out, null, 1));
});
