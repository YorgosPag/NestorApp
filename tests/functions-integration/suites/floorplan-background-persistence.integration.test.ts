/**
 * =============================================================================
 * Integration test — Floorplan Background persistence (ADR-340 Phase 8)
 * =============================================================================
 *
 * Validates the three Phase 7 server services against a live Firestore
 * emulator (Admin SDK):
 *
 *   1. `FloorplanBackgroundService` — CRUD round-trip + tenant isolation +
 *      immutables/locked guards.
 *   2. `FloorplanCascadeDeleteService` — cascade over `floorplan_overlays`.
 *      Tenant-scoped count helper. (The legacy `dxf_overlay_levels` arm was
 *      removed post-WIPE in ADR-340 Phase 9 STEP L — this suite no longer
 *      asserts it.)
 *   3. `CalibrationRemapService.applyCalibration` — atomic single-batch path
 *      (overlay count ≤ 499) writes geometry updates + background transform
 *      together; world-position invariance preserved.
 *
 * Why this suite lives in `tests/functions-integration/`:
 *   - Admin SDK reads `FIRESTORE_EMULATOR_HOST` at module-load time, so it
 *     must be set in `setup-env.ts` BEFORE any service file is imported. The
 *     functions-integration jest config wires that for us; the main jest
 *     config does not (and uses jsdom anyway).
 *   - `firebase-admin` doesn't run in jsdom — must be `node`.
 *
 * The pure-math half of the calibration suite lives in
 * `src/services/floorplan-background/__tests__/persistence.integration.test.ts`
 * and runs in the main jest run.
 *
 * Run: `npm run test:functions-integration -- floorplan-background`
 * Prerequisite: `firebase emulators:start --only firestore`.
 *
 * @see ADR-340 §5.3 (persistence integration tests)
 * @see ADR-340 §6 Phase 8 (visual + a11y + emulator + finalize)
 */

import {
  getAdminApp,
  clearFirestore,
  teardown,
} from '../_harness/emulator';
import { COLLECTIONS } from '@/config/firestore-collections';
import type {
  BackgroundTransform,
  CalibrationData,
  NaturalBounds,
  Point2D,
  ProviderMetadata,
} from '@/subapps/dxf-viewer/floorplan-background/providers/types';
import type { OverlayGeometry, OverlayRole } from '@/types/floorplan-overlays';

// ============================================================================
// FIXTURES
// ============================================================================

const COMPANY_A = 'co-alpha';
const COMPANY_B = 'co-bravo';
const FLOOR_A = 'floor-101';
const FLOOR_B = 'floor-202';
const ACTOR = 'integration-actor';

const NATURAL_BOUNDS: NaturalBounds = { width: 1000, height: 800 };
const META_PDF: ProviderMetadata = {
  pdfPageNumber: 1,
  imageOrientation: undefined,
  imageMimeType: undefined,
  imageDecoderUsed: 'native',
};
const META_IMG: ProviderMetadata = {
  pdfPageNumber: undefined,
  imageOrientation: 1,
  imageMimeType: 'image/png',
  imageDecoderUsed: 'native',
};

const IDENTITY: BackgroundTransform = {
  translateX: 0,
  translateY: 0,
  scaleX: 1,
  scaleY: 1,
  rotation: 0,
};

function approxPoint(a: Point2D, b: Point2D, eps = 1e-6): boolean {
  return Math.abs(a.x - b.x) < eps && Math.abs(a.y - b.y) < eps;
}

// Lazy imports — services read FIRESTORE_EMULATOR_HOST at SDK init, so we
// must let setup-env.ts populate the env first (loaded by jest setupFiles).
async function loadServices() {
  const { FloorplanBackgroundService } = await import(
    '@/services/floorplan-background/floorplan-background.service'
  );
  const { FloorplanCascadeDeleteService } = await import(
    '@/services/floorplan-background/floorplan-cascade-delete.service'
  );
  const { CalibrationRemapService } = await import(
    '@/services/floorplan-background/calibration-remap.service'
  );
  return {
    FloorplanBackgroundService,
    FloorplanCascadeDeleteService,
    CalibrationRemapService,
  };
}

// ============================================================================
// SEED HELPERS
// ============================================================================

/** Build a polygon geometry — the storage shape since ADR-340 Phase 8. */
function poly(...vertices: Point2D[]): OverlayGeometry {
  return { type: 'polygon', vertices };
}

/** Read back the vertices of a stored polygon overlay (empty if not a polygon). */
function readVertices(raw: unknown): Point2D[] {
  const g = raw as OverlayGeometry | undefined;
  return g?.type === 'polygon' ? g.vertices : [];
}

async function seedOverlay(args: {
  companyId: string;
  floorId: string;
  backgroundId: string;
  geometry: OverlayGeometry;
  role?: OverlayRole;
}): Promise<string> {
  const db = getAdminApp().firestore();
  const ref = db.collection(COLLECTIONS.FLOORPLAN_OVERLAYS).doc();
  await ref.set({
    id: ref.id,
    companyId: args.companyId,
    floorId: args.floorId,
    backgroundId: args.backgroundId,
    geometry: args.geometry,
    role: args.role ?? 'auxiliary',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    createdBy: ACTOR,
  });
  return ref.id;
}

// ============================================================================
// SUITES
// ============================================================================

describe('FloorplanBackgroundService — Firestore round-trip', () => {
  beforeAll(() => {
    getAdminApp();
  });

  afterAll(async () => {
    await teardown();
  });

  beforeEach(async () => {
    await clearFirestore();
  });

  it('create + getById + listByFloor + patchTransform + deleteById round-trip', async () => {
    const { FloorplanBackgroundService } = await loadServices();

    const created = await FloorplanBackgroundService.create({
      companyId: COMPANY_A,
      floorId: FLOOR_A,
      fileId: 'file_123',
      providerId: 'pdf-page',
      providerMetadata: META_PDF,
      naturalBounds: NATURAL_BOUNDS,
      createdBy: ACTOR,
    });

    expect(created.id).toMatch(/^rbg_/);
    expect(created.transform).toEqual(IDENTITY);
    expect(created.opacity).toBe(1);
    expect(created.visible).toBe(true);
    expect(created.locked).toBe(false);

    const fetched = await FloorplanBackgroundService.getById(created.id, COMPANY_A);
    expect(fetched).not.toBeNull();
    expect(fetched?.fileId).toBe('file_123');

    const listed = await FloorplanBackgroundService.listByFloor(COMPANY_A, FLOOR_A);
    expect(listed).toHaveLength(1);
    expect(listed[0].id).toBe(created.id);

    const patched = await FloorplanBackgroundService.patchTransform(created.id, {
      companyId: COMPANY_A,
      transform: { translateX: 50, scaleX: 2 },
      opacity: 0.8,
      visible: false,
      locked: false,
      updatedBy: ACTOR,
    });
    expect(patched.transform.translateX).toBe(50);
    expect(patched.transform.scaleX).toBe(2);
    expect(patched.transform.scaleY).toBe(1); // untouched
    expect(patched.opacity).toBeCloseTo(0.8);
    expect(patched.visible).toBe(false);

    const deleted = await FloorplanBackgroundService.deleteById(created.id, COMPANY_A);
    expect(deleted).toBe(true);

    const afterDelete = await FloorplanBackgroundService.getById(created.id, COMPANY_A);
    expect(afterDelete).toBeNull();
  });

  it('tenant isolation — cross-company getById/listByFloor return null/empty', async () => {
    const { FloorplanBackgroundService } = await loadServices();

    const created = await FloorplanBackgroundService.create({
      companyId: COMPANY_A,
      floorId: FLOOR_A,
      fileId: 'file_xyz',
      providerId: 'image',
      providerMetadata: META_IMG,
      naturalBounds: NATURAL_BOUNDS,
      createdBy: ACTOR,
    });

    const crossRead = await FloorplanBackgroundService.getById(created.id, COMPANY_B);
    expect(crossRead).toBeNull();

    const crossList = await FloorplanBackgroundService.listByFloor(COMPANY_B, FLOOR_A);
    expect(crossList).toHaveLength(0);

    await expect(
      FloorplanBackgroundService.patchTransform(created.id, {
        companyId: COMPANY_B,
        transform: { translateX: 1 },
        updatedBy: ACTOR,
      }),
    ).rejects.toThrow(/cross-tenant/i);

    await expect(
      FloorplanBackgroundService.deleteById(created.id, COMPANY_B),
    ).rejects.toThrow(/cross-tenant/i);
  });

  it('locked background rejects transform patch', async () => {
    const { FloorplanBackgroundService } = await loadServices();

    const created = await FloorplanBackgroundService.create({
      companyId: COMPANY_A,
      floorId: FLOOR_A,
      fileId: 'file_lock',
      providerId: 'image',
      providerMetadata: META_IMG,
      naturalBounds: NATURAL_BOUNDS,
      createdBy: ACTOR,
    });

    await FloorplanBackgroundService.patchTransform(created.id, {
      companyId: COMPANY_A,
      transform: {},
      locked: true,
      updatedBy: ACTOR,
    });

    await expect(
      FloorplanBackgroundService.patchTransform(created.id, {
        companyId: COMPANY_A,
        transform: { translateX: 99 },
        updatedBy: ACTOR,
      }),
    ).rejects.toThrow(/locked/i);

    // Unlock path is allowed.
    const unlocked = await FloorplanBackgroundService.patchTransform(created.id, {
      companyId: COMPANY_A,
      transform: {},
      locked: false,
      updatedBy: ACTOR,
    });
    expect(unlocked.locked).toBe(false);
  });

  it('countByFileId is global (CF context) — counts across companies', async () => {
    const { FloorplanBackgroundService } = await loadServices();
    const sharedFile = 'file_shared_999';

    await FloorplanBackgroundService.create({
      companyId: COMPANY_A,
      floorId: FLOOR_A,
      fileId: sharedFile,
      providerId: 'pdf-page',
      providerMetadata: META_PDF,
      naturalBounds: NATURAL_BOUNDS,
      createdBy: ACTOR,
    });
    await FloorplanBackgroundService.create({
      companyId: COMPANY_B,
      floorId: FLOOR_B,
      fileId: sharedFile,
      providerId: 'pdf-page',
      providerMetadata: META_PDF,
      naturalBounds: NATURAL_BOUNDS,
      createdBy: ACTOR,
    });

    const count = await FloorplanBackgroundService.countByFileId(sharedFile);
    expect(count).toBe(2);
  });
});

describe('FloorplanCascadeDeleteService — floorplan_overlays cascade', () => {
  beforeAll(() => {
    getAdminApp();
  });

  afterAll(async () => {
    await teardown();
  });

  beforeEach(async () => {
    await clearFirestore();
  });

  it('cascadeAllPolygonsForFloor wipes every overlay of the floor and is idempotent', async () => {
    const { FloorplanBackgroundService, FloorplanCascadeDeleteService } = await loadServices();

    const bg = await FloorplanBackgroundService.create({
      companyId: COMPANY_A,
      floorId: FLOOR_A,
      fileId: 'file_cascade',
      providerId: 'image',
      providerMetadata: META_IMG,
      naturalBounds: NATURAL_BOUNDS,
      createdBy: ACTOR,
    });

    // Seed 3 floorplan_overlays on the target floor.
    await Promise.all([
      seedOverlay({
        companyId: COMPANY_A,
        floorId: FLOOR_A,
        backgroundId: bg.id,
        geometry: poly({ x: 1, y: 1 }, { x: 2, y: 2 }),
      }),
      seedOverlay({
        companyId: COMPANY_A,
        floorId: FLOOR_A,
        backgroundId: bg.id,
        geometry: poly({ x: 3, y: 3 }, { x: 4, y: 4 }),
      }),
      seedOverlay({
        companyId: COMPANY_A,
        floorId: FLOOR_A,
        backgroundId: bg.id,
        geometry: poly({ x: 5, y: 5 }, { x: 6, y: 6 }),
      }),
    ]);

    const before = await FloorplanCascadeDeleteService.getFloorPolygonState(
      COMPANY_A,
      FLOOR_A,
    );
    expect(before.floorplanOverlayCount).toBe(3);
    expect(before.total).toBe(3);

    const result = await FloorplanCascadeDeleteService.cascadeAllPolygonsForFloor(
      COMPANY_A,
      FLOOR_A,
    );
    expect(result.floorplanOverlaysDeleted).toBe(3);

    const after = await FloorplanCascadeDeleteService.getFloorPolygonState(
      COMPANY_A,
      FLOOR_A,
    );
    expect(after.total).toBe(0);

    // Idempotent re-run.
    const replay = await FloorplanCascadeDeleteService.cascadeAllPolygonsForFloor(
      COMPANY_A,
      FLOOR_A,
    );
    expect(replay.floorplanOverlaysDeleted).toBe(0);
  });

  it('cascadeOverlaysForBackground wipes one background only — same-floor and sibling-floor overlays survive', async () => {
    const { FloorplanBackgroundService, FloorplanCascadeDeleteService } = await loadServices();

    const bgA = await FloorplanBackgroundService.create({
      companyId: COMPANY_A,
      floorId: FLOOR_A,
      fileId: 'file_a',
      providerId: 'image',
      providerMetadata: META_IMG,
      naturalBounds: NATURAL_BOUNDS,
      createdBy: ACTOR,
    });
    const bgB = await FloorplanBackgroundService.create({
      companyId: COMPANY_A,
      floorId: FLOOR_B,
      fileId: 'file_b',
      providerId: 'image',
      providerMetadata: META_IMG,
      naturalBounds: NATURAL_BOUNDS,
      createdBy: ACTOR,
    });

    await Promise.all([
      seedOverlay({
        companyId: COMPANY_A, floorId: FLOOR_A, backgroundId: bgA.id, geometry: poly({ x: 1, y: 1 }),
      }),
      seedOverlay({
        companyId: COMPANY_A, floorId: FLOOR_A, backgroundId: bgA.id, geometry: poly({ x: 2, y: 2 }),
      }),
      seedOverlay({
        companyId: COMPANY_A, floorId: FLOOR_B, backgroundId: bgB.id, geometry: poly({ x: 3, y: 3 }),
      }),
    ]);
    // Same floor as bgA, but bound to another background → must survive: the
    // background-scoped cascade must NOT degrade into a floor-wide wipe.
    await seedOverlay({
      companyId: COMPANY_A,
      floorId: FLOOR_A,
      backgroundId: 'rbg_unrelated_777',
      geometry: poly({ x: 4, y: 4 }),
    });

    const deleted = await FloorplanCascadeDeleteService.cascadeOverlaysForBackground(
      COMPANY_A,
      bgA.id,
    );
    expect(deleted).toBe(2);

    const stateA = await FloorplanCascadeDeleteService.getFloorPolygonState(COMPANY_A, FLOOR_A);
    expect(stateA.floorplanOverlayCount).toBe(1); // the unrelated-background overlay

    const stateB = await FloorplanCascadeDeleteService.getFloorPolygonState(COMPANY_A, FLOOR_B);
    expect(stateB.floorplanOverlayCount).toBe(1);
  });

  it('cross-tenant cascade only touches matching companyId', async () => {
    const { FloorplanCascadeDeleteService } = await loadServices();

    await seedOverlay({
      companyId: COMPANY_A, floorId: FLOOR_A, backgroundId: 'rbg_x', geometry: poly({ x: 1, y: 1 }),
    });
    await seedOverlay({
      companyId: COMPANY_B, floorId: FLOOR_A, backgroundId: 'rbg_y', geometry: poly({ x: 2, y: 2 }),
    });

    const result = await FloorplanCascadeDeleteService.cascadeAllPolygonsForFloor(
      COMPANY_A,
      FLOOR_A,
    );
    expect(result.floorplanOverlaysDeleted).toBe(1);

    const stateB = await FloorplanCascadeDeleteService.getFloorPolygonState(COMPANY_B, FLOOR_A);
    expect(stateB.floorplanOverlayCount).toBe(1);
  });
});

describe('CalibrationRemapService.applyCalibration — atomic remap', () => {
  beforeAll(() => {
    getAdminApp();
  });

  afterAll(async () => {
    await teardown();
  });

  beforeEach(async () => {
    await clearFirestore();
  });

  it('writes new transform + calibration AND remapped geometry in one batch (≤499 overlays)', async () => {
    const { FloorplanBackgroundService, CalibrationRemapService } = await loadServices();

    const bg = await FloorplanBackgroundService.create({
      companyId: COMPANY_A,
      floorId: FLOOR_A,
      fileId: 'file_calib',
      providerId: 'image',
      providerMetadata: META_IMG,
      naturalBounds: NATURAL_BOUNDS,
      createdBy: ACTOR,
    });

    // Seed 3 overlays with known polygons.
    const polygons: Point2D[][] = [
      [{ x: 10, y: 20 }, { x: 30, y: 40 }],
      [{ x: 0, y: 0 }, { x: 100, y: 100 }],
      [{ x: -5, y: 5 }],
    ];
    const overlayIds = await Promise.all(
      polygons.map((vertices) =>
        seedOverlay({
          companyId: COMPANY_A,
          floorId: FLOOR_A,
          backgroundId: bg.id,
          geometry: poly(...vertices),
        }),
      ),
    );

    const newTransform: BackgroundTransform = {
      translateX: 100,
      translateY: -50,
      scaleX: 2,
      scaleY: 2,
      rotation: 0,
    };
    const calibration: CalibrationData = {
      method: 'two-point',
      pointA: { x: 0, y: 0 },
      pointB: { x: 100, y: 0 },
      realDistance: 1000,
      unit: 'mm',
      rotationDerived: false,
      calibratedAt: Date.now(),
      calibratedBy: ACTOR,
    };

    const result = await CalibrationRemapService.applyCalibration({
      companyId: COMPANY_A,
      backgroundId: bg.id,
      oldTransform: IDENTITY,
      newTransform,
      calibration,
      updatedBy: ACTOR,
    });

    expect(result.overlaysRemapped).toBe(3);
    expect(result.overlaysSkipped).toBe(0);
    expect(result.atomicWithBackground).toBe(true);

    const reread = await FloorplanBackgroundService.getById(bg.id, COMPANY_A);
    expect(reread?.transform).toEqual(newTransform);
    expect(reread?.calibration).not.toBeNull();
    expect(reread?.calibration?.method).toBe('two-point');
    expect(reread?.calibration?.realDistance).toBe(1000);
    expect(reread?.calibration?.unit).toBe('mm');

    // Verify each polygon was remapped to preserve world position.
    const db = getAdminApp().firestore();
    for (let i = 0; i < overlayIds.length; i += 1) {
      const snap = await db.collection(COLLECTIONS.FLOORPLAN_OVERLAYS).doc(overlayIds[i]).get();
      const remapped = readVertices(snap.data()?.geometry);
      expect(remapped).toHaveLength(polygons[i].length);
      // newTransform = scale 2 + translate (100, -50). For a vertex v, world = v.
      // After remap: vertex_new such that newT(vertex_new) = v.
      // → vertex_new.x = (v.x - 100) / 2, vertex_new.y = (v.y + 50) / 2
      for (let j = 0; j < polygons[i].length; j += 1) {
        const v = polygons[i][j];
        const expected: Point2D = { x: (v.x - 100) / 2, y: (v.y + 50) / 2 };
        expect(approxPoint(remapped[j], expected)).toBe(true);
      }
    }
  });

  it('skips overlays from other companies and other backgrounds', async () => {
    const { FloorplanBackgroundService, CalibrationRemapService } = await loadServices();

    const bg = await FloorplanBackgroundService.create({
      companyId: COMPANY_A,
      floorId: FLOOR_A,
      fileId: 'file_iso',
      providerId: 'image',
      providerMetadata: META_IMG,
      naturalBounds: NATURAL_BOUNDS,
      createdBy: ACTOR,
    });

    // Same company, different background → must NOT be remapped.
    const otherBgId = 'rbg_other_999';
    const untouched = await seedOverlay({
      companyId: COMPANY_A,
      floorId: FLOOR_A,
      backgroundId: otherBgId,
      geometry: poly({ x: 7, y: 7 }),
    });
    // Other tenant, same backgroundId by chance → must NOT be remapped.
    const crossTenant = await seedOverlay({
      companyId: COMPANY_B,
      floorId: FLOOR_A,
      backgroundId: bg.id,
      geometry: poly({ x: 9, y: 9 }),
    });
    // Target overlay.
    const target = await seedOverlay({
      companyId: COMPANY_A,
      floorId: FLOOR_A,
      backgroundId: bg.id,
      geometry: poly({ x: 4, y: 4 }),
    });

    await CalibrationRemapService.applyCalibration({
      companyId: COMPANY_A,
      backgroundId: bg.id,
      oldTransform: IDENTITY,
      newTransform: { ...IDENTITY, scaleX: 2, scaleY: 2 },
      calibration: {
        method: 'two-point',
        pointA: { x: 0, y: 0 },
        pointB: { x: 1, y: 0 },
        realDistance: 2,
        unit: 'mm',
        rotationDerived: false,
        calibratedAt: Date.now(),
        calibratedBy: ACTOR,
      },
      updatedBy: ACTOR,
    });

    const db = getAdminApp().firestore();
    const untouchedDoc = await db.collection(COLLECTIONS.FLOORPLAN_OVERLAYS).doc(untouched).get();
    expect(readVertices(untouchedDoc.data()?.geometry)).toEqual([{ x: 7, y: 7 }]);

    const crossDoc = await db.collection(COLLECTIONS.FLOORPLAN_OVERLAYS).doc(crossTenant).get();
    expect(readVertices(crossDoc.data()?.geometry)).toEqual([{ x: 9, y: 9 }]);

    const targetDoc = await db.collection(COLLECTIONS.FLOORPLAN_OVERLAYS).doc(target).get();
    const remappedTarget = readVertices(targetDoc.data()?.geometry);
    // newT scales by 2 → remapped = (4/2, 4/2) = (2, 2).
    expect(approxPoint(remappedTarget[0], { x: 2, y: 2 })).toBe(true);
  });

  // Regression anchor: `overlaysRemapped` used to return the number of docs
  // MATCHED rather than REWRITTEN. A doc with no usable `geometry` is skipped,
  // yet the result still claimed it had been remapped — so a suite whose seed
  // wrote the wrong field reported full success while writing nothing at all.
  // Skipped docs must be counted separately and never inflate the remap count.
  it('counts docs it actually rewrote — malformed geometry is reported as skipped', async () => {
    const { FloorplanBackgroundService, CalibrationRemapService } = await loadServices();

    const bg = await FloorplanBackgroundService.create({
      companyId: COMPANY_A,
      floorId: FLOOR_A,
      fileId: 'file_malformed',
      providerId: 'image',
      providerMetadata: META_IMG,
      naturalBounds: NATURAL_BOUNDS,
      createdBy: ACTOR,
    });

    const good = await seedOverlay({
      companyId: COMPANY_A,
      floorId: FLOOR_A,
      backgroundId: bg.id,
      geometry: poly({ x: 8, y: 8 }),
    });

    // Doc carrying no `geometry` at all — the service cannot remap it.
    const db = getAdminApp().firestore();
    const brokenRef = db.collection(COLLECTIONS.FLOORPLAN_OVERLAYS).doc();
    await brokenRef.set({
      id: brokenRef.id,
      companyId: COMPANY_A,
      floorId: FLOOR_A,
      backgroundId: bg.id,
      role: 'auxiliary',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      createdBy: ACTOR,
    });

    const result = await CalibrationRemapService.applyCalibration({
      companyId: COMPANY_A,
      backgroundId: bg.id,
      oldTransform: IDENTITY,
      newTransform: { ...IDENTITY, scaleX: 2, scaleY: 2 },
      calibration: {
        method: 'two-point',
        pointA: { x: 0, y: 0 },
        pointB: { x: 1, y: 0 },
        realDistance: 2,
        unit: 'mm',
        rotationDerived: false,
        calibratedAt: Date.now(),
        calibratedBy: ACTOR,
      },
      updatedBy: ACTOR,
    });

    // 2 docs matched, only 1 was rewritable.
    expect(result.overlaysRemapped).toBe(1);
    expect(result.overlaysSkipped).toBe(1);

    const goodDoc = await db.collection(COLLECTIONS.FLOORPLAN_OVERLAYS).doc(good).get();
    expect(approxPoint(readVertices(goodDoc.data()?.geometry)[0], { x: 4, y: 4 })).toBe(true);

    // The unrewritable doc is left alone — never silently zeroed.
    const brokenDoc = await brokenRef.get();
    expect(brokenDoc.data()?.geometry).toBeUndefined();

    // The calibration itself still lands on the background.
    const reread = await FloorplanBackgroundService.getById(bg.id, COMPANY_A);
    expect(reread?.transform.scaleX).toBe(2);
  });
});
