/**
 * Parametric-commit dispatch coverage (ADR-587 Φ7 — TIER-2 grip seam B).
 *
 * Δένει το ζωντανό `PARAMETRIC_COMMIT_HANDLERS` seam (`grip-parametric-dispatch.ts`)
 * με το grip discriminator domain (`GRIP_KIND_ENTITIES`, 33), ώστε να μην μπορεί να
 * αποκλίνει σιωπηλά (mirror του `rotate-entity-coverage.test.ts`):
 *  1. Golden — οι 26 params-driven kinds που δρομολογούνται εδώ (bypass vertex-stretch).
 *  2. Complement — οι 7 non-parametric kinds που ΔΕΝ δρομολογούνται εδώ
 *     (line / circle / arc / polyline / text / group / annotation-symbol) — πέφτουν
 *     στο `commitDxfGripDragModeAware` primitive/whole-entity path. Ασυμμετρία
 *     καρφωμένη ρητά (ADR-587 §4.6).
 *  3. Domain closure — golden ∪ complement === GRIP_KIND_ENTITIES (καμία διαρροή).
 *  4/5. Behavioral pins — `gripKind.on='wall'` → handler βρίσκεται· `'line'` → όχι.
 *
 * Νέος grip-producer entity → προσγειώνεται σε #1 ή #2 → σπάει το test → επιβάλλει
 * συνειδητή απόφαση (parametric handler ή primitive fall-through), αντί για σιωπηλό
 * «δεν committάρεται».
 */

// Firebase auth mock — τα type barrels αγγίζουν auth στο import path (handoff trap).
jest.mock('firebase/auth', () => ({
  __esModule: true,
  getAuth: () => ({ currentUser: null }),
  onAuthStateChanged: (_a: unknown, cb: (u: null) => void) => {
    cb(null);
    return () => {};
  },
  signInAnonymously: jest.fn(),
}));

import {
  PARAMETRIC_COMMIT_HANDLERS,
  PARAMETRIC_COMMIT_SUPPORTED_KINDS,
} from '../grip-parametric-dispatch';
import { GRIP_KIND_ENTITIES } from '../../grip-kinds';

const asSorted = (xs: readonly string[]): string[] => [...xs].sort();

const domainSet = new Set<string>(GRIP_KIND_ENTITIES);
const supportedSet = new Set<string>(PARAMETRIC_COMMIT_SUPPORTED_KINDS);

/** Οι 8 non-parametric grip kinds — δρομολογούνται στο primitive/whole-entity path. */
const NON_PARAMETRIC_KINDS = [
  'line', 'circle', 'arc', 'polyline', 'text', 'group', 'block', 'annotation-symbol',
] as const;

describe('Parametric-commit dispatch coverage — ζωντανό seam ↔ grip discriminator domain (ADR-587 Φ7)', () => {
  it('τα SUPPORTED_KINDS ταυτίζονται με τα keys του HANDLERS (29 params-driven kinds)', () => {
    expect(asSorted(PARAMETRIC_COMMIT_SUPPORTED_KINDS)).toEqual(
      asSorted(Object.keys(PARAMETRIC_COMMIT_HANDLERS)),
    );
    expect(PARAMETRIC_COMMIT_SUPPORTED_KINDS).toHaveLength(29);
  });

  it('grip kinds με parametric commit = καρφωμένο golden set (29)', () => {
    expect(asSorted(PARAMETRIC_COMMIT_SUPPORTED_KINDS)).toEqual(
      asSorted([
        'stair', 'dimension', 'wall', 'opening', 'slab', 'slab-opening', 'roof',
        'beam', 'column', 'foundation', 'mep-fixture', 'electrical-panel',
        'mep-manifold', 'mep-radiator', 'mep-boiler', 'mep-water-heater',
        'mep-segment', 'furniture', 'floorplan-symbol', 'floor-finish', 'hatch',
        'mep-underfloor', 'xline', 'ray', 'scale-bar', 'opening-info-tag',
        // ADR-654 — raster image (move / rotation / 4 corner resize· flat params, χωρίς geometry cache).
        'image',
        // ADR-683 Φ3 — εισαγόμενο πλέγμα: params-driven (position/rotationDeg) μέσω
        // UpdateImportedMeshParamsCommand. ΧΩΡΙΣ γωνιακό resize — §3.
        'imported-mesh',
        // ADR-684 Φ2/Φ3 — παραμετρικό στερεό: params-driven μέσω UpdateGenericSolidParamsCommand
        // (position/rotationDeg· box corner resize επεξεργάζεται shape.widthMm/depthMm).
        'generic-solid',
      ]),
    );
  });

  it('grip kinds ΧΩΡΙΣ parametric commit = complement (8 primitive/editor kinds)', () => {
    const noParametric = GRIP_KIND_ENTITIES.filter((k) => !supportedSet.has(k));
    expect(asSorted(noParametric)).toEqual(asSorted([...NON_PARAMETRIC_KINDS]));
  });

  it('golden ∪ complement === GRIP_KIND_ENTITIES (domain closure, 29 + 8 = 37)', () => {
    const union = [...PARAMETRIC_COMMIT_SUPPORTED_KINDS, ...NON_PARAMETRIC_KINDS];
    expect(asSorted(union)).toEqual(asSorted([...GRIP_KIND_ENTITIES]));
    expect(GRIP_KIND_ENTITIES).toHaveLength(37);
  });

  it('κανένα supported kind δεν είναι εκτός domain (seam ⊆ discriminator)', () => {
    const orphan = PARAMETRIC_COMMIT_SUPPORTED_KINDS.filter((k) => !domainSet.has(k));
    expect(orphan).toEqual([]);
  });

  it('behavioral pin — gripKind.on="wall" → parametric handler βρίσκεται εδώ', () => {
    expect(PARAMETRIC_COMMIT_HANDLERS['wall']).toBeDefined();
    expect(typeof PARAMETRIC_COMMIT_HANDLERS['wall']).toBe('function');
  });

  it('behavioral pin — gripKind.on="line" → ΔΕΝ δρομολογείται εδώ (primitive fall-through)', () => {
    expect(PARAMETRIC_COMMIT_HANDLERS['line']).toBeUndefined();
  });
});
