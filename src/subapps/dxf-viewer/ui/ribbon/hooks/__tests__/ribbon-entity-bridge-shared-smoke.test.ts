/**
 * ADR-623 — smoke coverage for the per-entity ribbon-bridge SSoT wiring.
 *
 * Cluster #14 migrated every per-entity ribbon bridge onto the four shared
 * primitives in `ribbon-entity-bridge-shared` (resolve / no-op toggles /
 * violation badge / stable-return assembler). The bridges that already have a
 * behavioural suite (Column, Opening, Foundation, the MEP family, …) exercise
 * those primitives end-to-end; this test loads the bridges WITHOUT their own
 * suite — plus the `use-ribbon-stair-bridge` that imports the shared module via
 * a cross-directory (`bim/hooks` → `ui/ribbon/hooks`) path — and asserts every
 * hook + shared export is wired. It catches a broken import path or a missing
 * re-export from the de-duplication without needing a React render.
 */

// ── Neutralize the firebase-auth import chain (jsdom can't transform the
// `@firebase/auth` node ESM source). Some bridges pull it in transitively at
// module load (e.g. thermal-space → useSpaceHeatLoads → … → firestore
// auth-context). This suite only checks module wiring, never auth. ──
jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(() => ({})),
  onAuthStateChanged: jest.fn(() => () => {}),
  connectAuthEmulator: jest.fn(),
  signInWithCustomToken: jest.fn(),
}));

import * as shared from '../ribbon-entity-bridge-shared';
import { useRibbonWallBridge } from '../useRibbonWallBridge';
import { useRibbonSlabBridge } from '../useRibbonSlabBridge';
import { useRibbonRoofBridge } from '../useRibbonRoofBridge';
import { useRibbonSlabOpeningBridge } from '../useRibbonSlabOpeningBridge';
import { useRibbonArrayBridge } from '../useRibbonArrayBridge';
import { useRibbonThermalSpaceBridge } from '../useRibbonThermalSpaceBridge';
import { useRibbonFloorFinishBridge } from '../useRibbonFloorFinishBridge';
import { useRibbonWallCoveringBridge } from '../useRibbonWallCoveringBridge';
import { useRibbonAnnotationSymbolBridge } from '../useRibbonAnnotationSymbolBridge';
import { useRibbonFloorplanSymbolBridge } from '../useRibbonFloorplanSymbolBridge';
import { useRibbonScaleBarBridge } from '../useRibbonScaleBarBridge';
import { useRibbonFurnitureBridge } from '../useRibbonFurnitureBridge';
import { useRibbonMepFixtureLibraryBridge } from '../useRibbonMepFixtureLibraryBridge';
import { useRibbonMepRiserBridge } from '../useRibbonMepRiserBridge';
import { useRibbonMepUnderfloorBridge } from '../useRibbonMepUnderfloorBridge';
import { useRibbonStairBridge } from '../../../../bim/hooks/use-ribbon-stair-bridge';

describe('ribbon entity-bridge SSoT wiring (ADR-623)', () => {
  it('exports the four shared bridge primitives', () => {
    expect(typeof shared.useResolveSelectedEntity).toBe('function');
    expect(typeof shared.useNoopToggles).toBe('function');
    expect(typeof shared.useViolationBadgeState).toBe('function');
    expect(typeof shared.useStableBridge).toBe('function');
  });

  it('loads every migrated bridge hook that lacks its own behavioural suite', () => {
    const hooks = [
      useRibbonWallBridge,
      useRibbonSlabBridge,
      useRibbonRoofBridge,
      useRibbonSlabOpeningBridge,
      useRibbonArrayBridge,
      useRibbonThermalSpaceBridge,
      useRibbonFloorFinishBridge,
      useRibbonWallCoveringBridge,
      useRibbonAnnotationSymbolBridge,
      useRibbonFloorplanSymbolBridge,
      useRibbonScaleBarBridge,
      useRibbonFurnitureBridge,
      useRibbonMepFixtureLibraryBridge,
      useRibbonMepRiserBridge,
      useRibbonMepUnderfloorBridge,
      useRibbonStairBridge,
    ];
    for (const hook of hooks) {
      expect(typeof hook).toBe('function');
    }
  });
});
