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
 *   2. `FloorplanCascadeDeleteService` — Q8 unified cascade across
 *      `floorplan_overlays` AND `dxf_viewer_levels` →
 *      `dxf_overlay_levels/{levelId}/items`. Tenant-scoped count helper.
 *   3. `CalibrationRemapService.applyCalibration` — atomic single-batch path
 *      (overlay count ≤ 499) writes polygon updates + background transform
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
import { COLLECTIONS, SUBCOLLECTIONS } from '@/config/firestore-collections';
import type {
  BackgroundTransform,
  CalibrationData,
  NaturalBounds,
  Point2D,
  ProviderMetadata,
} from '@/subapps/dxf-viewer/floorplan-background/providers/types';

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

async function seedOverlay(args: {
  companyId: string;
  floorId: string;
  backgroundId: string;
  polygon: Point2D[];
}): Promise<string> {
  const db = getAdminApp().firestore();
  const ref = db.collection(COLLECTIONS.FLOORPLAN_OVERLAYS).doc();
  await ref.set({
    id: ref.id,
    companyId: args.companyId,
    floorId: args.floorId,
    backgroundId: args.backgroundId,
    polygon: args.polygon,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  return ref.id;
}

async function seedDxfLevel(args: {
  companyId: string;
  floorId: string;
  itemCount: number;
}): Promise<{ levelId: string; itemIds: string[] }> {
  const db = getAdminApp().firestore();
  const levelRef = db.collection(COLLECTIONS.DXF_VIEWER_LEVELS).doc();
  await levelRef.set({
    id: levelRef.id,
    companyId: args.companyId,
    floorId: args.floorId,
    createdAt: Date.now(),
  });
  const itemsCol = db
    .collection(COLLECTIONS.DXF_OVERLAY_LEVELS)
    .doc(levelRef.id)
    .collection(SUBCOLLECTIONS.DXF_OVERLAY_LEVEL_ITEMS);
  const itemIds: string[] = [];
  for (let i = 0; i < args.itemCount; i += 1) {
    const itemRef = itemsCol.doc();
    await itemRef.set({ id: itemRef.id, idx: i });
    itemIds.push(itemRef.id);
  }
  return { levelId: levelRef.id, itemIds };
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

describe('FloorplanCascadeDeleteService — Q8 unified cascade', () => {
  beforeAll(() => {
    getAdminApp();
  });

  afterAll(async () => {
    await teardown();
  });

  beforeEach(async () => {
    await clearFirestore();
  });

  it('cascadeAllPolygonsForFloor wipes both polygon systems atomically', async () => {
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

    // Seed 3 floorplan_overlays + 2 DXF levels (5 + 4 items).
    await Promise.all([
      seedOverlay({
        companyId: COMPANY_A,
        floorId: FLOOR_A,
        backgroundId: bg.id,
        polygon: [{ x: 1, y: 1 }, { x: 2, y: 2 }],
      }),
      seedOverlay({
        companyId: COMPANY_A,
        floorId: FLOOR_A,
        backgroundId: bg.id,
        polygon: [{ x: 3, y: 3 }, { x: 4, y: 4 }],
      }),
      seedOverlay({
        companyId: COMPANY_A,
        floorId: FLOOR_A,
        backgroundId: bg.id,
        polygon: [{ x: 5, y: 5 }, { x: 6, y: 6 }],
      }),
    ]);
    await seedDxfLevel({ companyId: COMPANY_A, floorId: FLOOR_A, itemCount: 5 });
    await seedDxfLevel({ companyId: COMPANY_A, floorId: FLOOR_A, itemCount: 4 });

    const before = await FloorplanCascadeDeleteService.getFloorPolygonState(
      COMPANY_A,
      FLOOR_A,
    );
    expect(before.floorplanOverlayCount).toBe(3);
    expect(before.dxfOverlayCount).toBe(9);
    expect(before.total).toBe(12);

    const result = await FloorplanCascadeDeleteService.cascadeAllPolygonsForFloor(
      COMPANY_A,
      FLOOR_A,
    );
    expect(result.floorplanOverlaysDeleted).toBe(3);
    expect(result.dxfLevelsScanned).toBe(2);
    expect(result.dxfOverlayItemsDeleted).toBe(9);

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
    expect(replay.dxfOverlayItemsDeleted).toBe(0);
  });

  it('cascadeOverlaysForBackground only wipes overlays of one bg, leaves DXF + sibling bg', async () => {
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
      seedOverlay({ companyId: COMPANY_A, floorId: FLOOR_A, backgroundId: bgA.id, polygon: [] }),
      seedOverlay({ companyId: COMPANY_A, floorId: FLOOR_A, backgroundId: bgA.id, polygon: [] }),
      seedOverlay({ companyId: COMPANY_A, floorId: FLOOR_B, backgroundId: bgB.id, polygon: [] }),
    ]);
    await seedDxfLevel({ companyId: COMPANY_A, floorId: FLOOR_A, itemCount: 2 });

    const deleted = await FloorplanCascadeDeleteService.cascadeOverlaysForBackground(
      COMPANY_A,
      bgA.id,
    );
    expect(deleted).toBe(2);

    const stateA = await FloorplanCascadeDeleteService.getFloorPolygonState(COMPANY_A, FLOOR_A);
    expect(stateA.floorplanOverlayCount).toBe(0);
    // DXF subsystem untouched.
    expect(stateA.dxfOverlayCount).toBe(2);

    const stateB = await FloorplanCascadeDeleteService.getFloorPolygonState(COMPANY_A, FLOOR_B);
    expect(stateB.floorplanOverlayCount).toBe(1);
  });

  it('cross-tenant cascade only touches matching companyId', async () => {
    const { FloorplanCascadeDeleteService } = await loadServices();

    await seedOverlay({ companyId: COMPANY_A, floorId: FLOOR_A, backgroundId: 'rbg_x', polygon: [] });
    await seedOverlay({ companyId: COMPANY_B, floorId: FLOOR_A, backgroundId: 'rbg_y', polygon: [] });

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

  it('writes new transform + calibration AND remapped polygons in one batch (≤499 overlays)', async () => {
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
      polygons.map((polygon) =>
        seedOverlay({ companyId: COMPANY_A, floorId: FLOOR_A, backgroundId: bg.id, polygon }),
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
      const remapped = snap.data()?.polygon as Point2D[];
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
      polygon: [{ x: 7, y: 7 }],
    });
    // Other tenant, same backgroundId by chance → must NOT be remapped.
    const crossTenant = await seedOverlay({
      companyId: COMPANY_B,
      floorId: FLOOR_A,
      backgroundId: bg.id,
      polygon: [{ x: 9, y: 9 }],
    });
    // Target overlay.
    const target = await seedOverlay({
      companyId: COMPANY_A,
      floorId: FLOOR_A,
      backgroundId: bg.id,
      polygon: [{ x: 4, y: 4 }],
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
    expect(untouchedDoc.data()?.polygon).toEqual([{ x: 7, y: 7 }]);

    const crossDoc = await db.collection(COLLECTIONS.FLOORPLAN_OVERLAYS).doc(crossTenant).get();
    expect(crossDoc.data()?.polygon).toEqual([{ x: 9, y: 9 }]);

    const targetDoc = await db.collection(COLLECTIONS.FLOORPLAN_OVERLAYS).doc(target).get();
    const remappedTarget = targetDoc.data()?.polygon as Point2D[];
    // newT scales by 2 → remapped = (4/2, 4/2) = (2, 2).
    expect(approxPoint(remappedTarget[0], { x: 2, y: 2 })).toBe(true);
  });
});
