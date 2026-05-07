/**
 * =============================================================================
 * 🏢 ENTERPRISE: Floorplan Background Persistence Service (Admin SDK)
 * =============================================================================
 *
 * Server-side CRUD for the `floorplan_backgrounds` domain entity (ADR-340 §3.4).
 *
 * Tenant isolation: every read/write enforces `companyId == ctx.companyId`.
 * Immutables (ADR-340 D6): naturalBounds, companyId, floorId, fileId, providerId, providerMetadata.
 *
 * @module services/floorplan-background/floorplan-background.service
 * @enterprise ADR-340 Phase 7
 */

import 'server-only';

import {
  getAdminFirestore,
  FieldValue,
  type Firestore,
} from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { generateFloorplanBackgroundId } from '@/services/enterprise-id.service';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import type {
  FloorplanBackground,
  BackgroundTransform,
  CalibrationData,
  NaturalBounds,
  ProviderId,
  ProviderMetadata,
} from '@/subapps/dxf-viewer/floorplan-background/providers/types';

const logger = createModuleLogger('FloorplanBackgroundService');

// ============================================================================
// TYPES
// ============================================================================

export interface CreateFloorplanBackgroundInput {
  companyId: string;
  floorId: string;
  fileId: string;
  providerId: ProviderId;
  providerMetadata: ProviderMetadata;
  naturalBounds: NaturalBounds;
  createdBy: string;
}

export interface PatchTransformInput {
  companyId: string;
  transform: Partial<BackgroundTransform>;
  opacity?: number;
  visible?: boolean;
  locked?: boolean;
  updatedBy: string;
}

export interface PatchCalibrationInput {
  companyId: string;
  transform: Partial<BackgroundTransform>;
  calibration: CalibrationData;
  updatedBy: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_TRANSFORM: BackgroundTransform = {
  translateX: 0,
  translateY: 0,
  scaleX: 1,
  scaleY: 1,
  rotation: 0,
};

const VALID_PROVIDER_IDS: ReadonlyArray<ProviderId> = ['pdf-page', 'image'];

// ============================================================================
// HELPERS
// ============================================================================

function getDb(): Firestore {
  return getAdminFirestore();
}

function backgroundsRef() {
  return getDb().collection(COLLECTIONS.FLOORPLAN_BACKGROUNDS);
}

function clamp01(v: number): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return 1;
  return Math.max(0, Math.min(1, v));
}

function sanitizeMetadata(meta: ProviderMetadata): ProviderMetadata {
  // Firestore rejects `undefined`. Build only with defined keys.
  const out: ProviderMetadata = {
    imageDecoderUsed: meta.imageDecoderUsed === 'utif' ? 'utif' : 'native',
  };
  if (typeof meta.pdfPageNumber === 'number') out.pdfPageNumber = meta.pdfPageNumber;
  if (typeof meta.imageOrientation === 'number') out.imageOrientation = meta.imageOrientation;
  if (typeof meta.imageMimeType === 'string') out.imageMimeType = meta.imageMimeType;
  return out;
}

function pickTransformPatch(p: Partial<BackgroundTransform>): Partial<BackgroundTransform> {
  const out: Partial<BackgroundTransform> = {};
  if (typeof p.translateX === 'number' && Number.isFinite(p.translateX)) out.translateX = p.translateX;
  if (typeof p.translateY === 'number' && Number.isFinite(p.translateY)) out.translateY = p.translateY;
  if (typeof p.scaleX === 'number' && Number.isFinite(p.scaleX) && p.scaleX > 0) out.scaleX = p.scaleX;
  if (typeof p.scaleY === 'number' && Number.isFinite(p.scaleY) && p.scaleY > 0) out.scaleY = p.scaleY;
  if (typeof p.rotation === 'number' && Number.isFinite(p.rotation)) out.rotation = p.rotation;
  return out;
}

function rowToEntity(id: string, row: FirebaseFirestore.DocumentData): FloorplanBackground {
  return {
    id,
    companyId: row.companyId,
    floorId: row.floorId,
    fileId: row.fileId,
    providerId: row.providerId,
    providerMetadata: row.providerMetadata ?? {},
    naturalBounds: row.naturalBounds,
    transform: row.transform ?? DEFAULT_TRANSFORM,
    calibration: row.calibration ?? null,
    opacity: typeof row.opacity === 'number' ? row.opacity : 1,
    visible: row.visible !== false,
    locked: row.locked === true,
    createdAt: typeof row.createdAt === 'number' ? row.createdAt : 0,
    updatedAt: typeof row.updatedAt === 'number' ? row.updatedAt : 0,
    createdBy: row.createdBy,
    updatedBy: row.updatedBy ?? row.createdBy,
  };
}

// ============================================================================
// SERVICE
// ============================================================================

export class FloorplanBackgroundService {
  /**
   * Create a new floorplan_backgrounds doc.
   * Caller must have already created the FileRecord (`files/{fileId}`) and
   * verified RBAC. Idempotency is at API layer (replace flow handles dedupe).
   */
  static async create(input: CreateFloorplanBackgroundInput): Promise<FloorplanBackground> {
    if (!VALID_PROVIDER_IDS.includes(input.providerId)) {
      throw new Error(`Invalid providerId: ${input.providerId}`);
    }
    if (!input.naturalBounds || input.naturalBounds.width <= 0 || input.naturalBounds.height <= 0) {
      throw new Error('Invalid naturalBounds');
    }

    const id = generateFloorplanBackgroundId();
    const now = Date.now();

    const doc: Omit<FloorplanBackground, 'id'> = {
      companyId: input.companyId,
      floorId: input.floorId,
      fileId: input.fileId,
      providerId: input.providerId,
      providerMetadata: sanitizeMetadata(input.providerMetadata),
      naturalBounds: input.naturalBounds,
      transform: { ...DEFAULT_TRANSFORM },
      calibration: null,
      opacity: 1,
      visible: true,
      locked: false,
      createdAt: now,
      updatedAt: now,
      createdBy: input.createdBy,
      updatedBy: input.createdBy,
    };

    await backgroundsRef().doc(id).set({ id, ...doc });
    logger.info('Floorplan background created', { id, floorId: input.floorId, companyId: input.companyId });
    return { id, ...doc };
  }

  /**
   * Read a single background by id, enforcing tenant isolation.
   * Returns null if not found or cross-tenant.
   */
  static async getById(id: string, companyId: string): Promise<FloorplanBackground | null> {
    const snap = await backgroundsRef().doc(id).get();
    if (!snap.exists) return null;
    const row = snap.data() as FirebaseFirestore.DocumentData;
    if (row.companyId !== companyId) {
      logger.warn('Cross-tenant getById denied', { id, requested: companyId, actual: row.companyId });
      return null;
    }
    return rowToEntity(id, row);
  }

  /**
   * List backgrounds for a floor (currently 0 or 1 — Q2 single-target).
   * Tenant-scoped query.
   */
  static async listByFloor(companyId: string, floorId: string): Promise<FloorplanBackground[]> {
    const q = await backgroundsRef()
      .where('companyId', '==', companyId)
      .where('floorId', '==', floorId)
      .get();
    return q.docs.map((d) => rowToEntity(d.id, d.data()));
  }

  /**
   * Patch transform / opacity / visible / locked. Immutables guarded server-side.
   */
  static async patchTransform(id: string, input: PatchTransformInput): Promise<FloorplanBackground> {
    const ref = backgroundsRef().doc(id);
    const result = await getDb().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new Error(`Background not found: ${id}`);
      const row = snap.data() as FirebaseFirestore.DocumentData;
      if (row.companyId !== input.companyId) {
        throw new Error('Cross-tenant patch denied');
      }
      if (row.locked === true && input.locked !== false) {
        throw new Error('Background is locked');
      }

      const transformPatch = pickTransformPatch(input.transform);
      const next: FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData> = {
        transform: { ...row.transform, ...transformPatch },
        updatedAt: Date.now(),
        updatedBy: input.updatedBy,
      };
      if (typeof input.opacity === 'number') next.opacity = clamp01(input.opacity);
      if (typeof input.visible === 'boolean') next.visible = input.visible;
      if (typeof input.locked === 'boolean') next.locked = input.locked;

      tx.update(ref, next);
      return rowToEntity(id, { ...row, ...next });
    });
    return result;
  }

  /**
   * Patch transform + calibration atomically. Polygon remap is delegated to
   * CalibrationRemapService (called BEFORE this in the same outer batch when
   * polygons exist).
   */
  static async patchCalibration(id: string, input: PatchCalibrationInput): Promise<FloorplanBackground> {
    const ref = backgroundsRef().doc(id);
    const result = await getDb().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new Error(`Background not found: ${id}`);
      const row = snap.data() as FirebaseFirestore.DocumentData;
      if (row.companyId !== input.companyId) {
        throw new Error('Cross-tenant patch denied');
      }
      if (row.locked === true) {
        throw new Error('Background is locked');
      }

      const transformPatch = pickTransformPatch(input.transform);
      const next: FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData> = {
        transform: { ...row.transform, ...transformPatch },
        calibration: input.calibration,
        updatedAt: Date.now(),
        updatedBy: input.updatedBy,
      };
      tx.update(ref, next);
      return rowToEntity(id, { ...row, ...next });
    });
    return result;
  }

  /**
   * Delete a background by id (tenant-scoped). Cascade is handled by:
   * - `FloorplanCascadeDeleteService.cascadeOverlaysForBackground()` BEFORE this call
   * - Cloud Function `onDeleteFloorplanBackground` for fileId ref-count + Storage cleanup
   */
  static async deleteById(id: string, companyId: string): Promise<boolean> {
    const ref = backgroundsRef().doc(id);
    try {
      await getDb().runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists) return;
        const row = snap.data() as FirebaseFirestore.DocumentData;
        if (row.companyId !== companyId) {
          throw new Error('Cross-tenant delete denied');
        }
        tx.delete(ref);
      });
      logger.info('Floorplan background deleted', { id, companyId });
      return true;
    } catch (err) {
      logger.error('Delete failed', { id, error: getErrorMessage(err) });
      throw err;
    }
  }

  /**
   * Count backgrounds referencing a fileId (used by CF for ref-count cleanup).
   * Server-side only. Cross-company aware: searches globally (CF context).
   */
  static async countByFileId(fileId: string): Promise<number> {
    const q = await backgroundsRef().where('fileId', '==', fileId).count().get();
    return q.data().count;
  }
}

export { FieldValue };
