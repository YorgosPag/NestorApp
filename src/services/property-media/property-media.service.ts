/**
 * =============================================================================
 * 🏢 ENTERPRISE: Property Media Service — SSoT reader for `files` collection
 * =============================================================================
 *
 * Single source of truth for reading property-linked media (photos,
 * floorplans, etc.) from the canonical `files` collection. Server-only —
 * uses Admin SDK, bypasses client Firestore rules for trusted callers
 * (authenticated API routes, public showcase resolvers, PDF generators).
 *
 * ## Why a service
 *
 * Multiple surfaces need the same query shape (`companyId + entityType +
 * entityId + category`):
 *   - Public showcase API (`api/showcase/[token]/route.ts`) — metadata only
 *   - Showcase PDF generator — metadata + Storage buffers for embedding
 *   - Future: admin previews, brokerage packs, email attachments
 *
 * Centralising here prevents drift (filter order, tenant isolation, limits)
 * and lets us harden ownership checks in one place.
 *
 * ## SSoT anchors
 *
 * - `COLLECTIONS.FILES` (firestore-collections.ts) — collection name
 * - `ENTITY_TYPES.PROPERTY`, `FILE_CATEGORIES.*` (domain-constants.ts) —
 *   filter values
 * - `getAdminFirestore()` / `getAdminBucket()` (firebaseAdmin.ts) —
 *   server credentials
 *
 * @module services/property-media/property-media.service
 * @enterprise ADR-312 (Property Showcase), ADR-031 (File Storage)
 */

import 'server-only';

import { getAdminBucket, getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { ENTITY_TYPES, type FileCategory } from '@/config/domain-constants';
import { createModuleLogger } from '@/lib/telemetry/Logger';

const logger = createModuleLogger('PropertyMediaService');

const DEFAULT_LIST_LIMIT = 30;
const DEFAULT_DOWNLOAD_LIMIT = 6;

export interface PropertyMediaItem {
  id: string;
  storagePath: string;
  displayName?: string;
  originalFilename?: string;
  contentType?: string;
  sizeBytes?: number;
  downloadUrl?: string;
  createdAtMs?: number;
  /** Lowercased file extension (no dot). e.g. "dxf", "jpg". */
  ext?: string;
  /** Raster preview URL — present for DXF after `onDxfProcessedFinalize` ran. */
  thumbnailUrl?: string;
  /** Storage path of the raster preview (used for server-side downloads). */
  thumbnailStoragePath?: string;
}

export interface PropertyMediaBuffer extends PropertyMediaItem {
  bytes: Uint8Array;
  jsPdfFormat: 'JPEG' | 'PNG';
  /** `true` when bytes were fetched from the derived `thumbnailStoragePath`. */
  fromThumbnail: boolean;
}

export interface ListPropertyMediaOptions {
  companyId: string;
  propertyId: string;
  category: FileCategory;
  limit?: number;
}

export interface DownloadPropertyMediaOptions extends ListPropertyMediaOptions {
  mimeTypes?: ReadonlyArray<'image/jpeg' | 'image/png'>;
}

const JS_PDF_FORMAT_BY_MIME: Record<string, 'JPEG' | 'PNG'> = {
  'image/jpeg': 'JPEG',
  'image/jpg': 'JPEG',
  'image/png': 'PNG',
};

function normalizeCreatedAtMs(raw: unknown): number | undefined {
  if (!raw) return undefined;
  if (typeof raw === 'object' && raw !== null && '_seconds' in raw) {
    const seconds = (raw as { _seconds?: number })._seconds;
    return typeof seconds === 'number' ? seconds * 1000 : undefined;
  }
  if (typeof raw === 'string') {
    const parsed = Date.parse(raw);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  if (typeof raw === 'number') return raw;
  return undefined;
}

function toMediaItem(id: string, data: Record<string, unknown>): PropertyMediaItem | null {
  const storagePath = data.storagePath as string | undefined;
  if (!storagePath) return null;
  const rawExt = (data.ext as string) || storagePath.split('.').pop();
  return {
    id,
    storagePath,
    displayName: (data.displayName as string) || undefined,
    originalFilename: (data.originalFilename as string) || undefined,
    contentType: (data.contentType as string) || undefined,
    sizeBytes: typeof data.sizeBytes === 'number' ? (data.sizeBytes as number) : undefined,
    downloadUrl: (data.downloadUrl as string) || undefined,
    createdAtMs: normalizeCreatedAtMs(data.createdAt),
    ext: rawExt ? rawExt.toLowerCase() : undefined,
    thumbnailUrl: (data.thumbnailUrl as string) || undefined,
    thumbnailStoragePath: (data.thumbnailStoragePath as string) || undefined,
  };
}

/**
 * List active media metadata for a property/category. No buffers loaded.
 *
 * Returns only `lifecycleState === 'active'` and `isDeleted !== true`
 * records, sorted by `createdAt desc` client-side (so the query stays on
 * existing `files(companyId, entityType, entityId, category)` composite
 * index and doesn't require a new one).
 */
export async function listPropertyMedia(
  opts: ListPropertyMediaOptions
): Promise<PropertyMediaItem[]> {
  const adminDb = getAdminFirestore();
  if (!adminDb) {
    logger.warn('Admin Firestore not available; returning empty media list', {
      propertyId: opts.propertyId, category: opts.category,
    });
    return [];
  }

  const limit = opts.limit ?? DEFAULT_LIST_LIMIT;

  const snap = await adminDb
    .collection(COLLECTIONS.FILES)
    .where('companyId', '==', opts.companyId)
    .where('entityType', '==', ENTITY_TYPES.PROPERTY)
    .where('entityId', '==', opts.propertyId)
    .where('category', '==', opts.category)
    .limit(limit * 2)
    .get();

  const items: PropertyMediaItem[] = [];
  for (const d of snap.docs) {
    const data = d.data() as Record<string, unknown>;
    if (data.isDeleted === true) continue;
    const lifecycle = data.lifecycleState as string | undefined;
    if (lifecycle && lifecycle !== 'active') continue;
    const item = toMediaItem(d.id, data);
    if (item) items.push(item);
  }

  items.sort((a, b) => (b.createdAtMs ?? 0) - (a.createdAtMs ?? 0));
  return items.slice(0, limit);
}

/**
 * Count active media for a property/category (cheap metadata, no buffers).
 */
export async function countPropertyMedia(opts: ListPropertyMediaOptions): Promise<number> {
  const items = await listPropertyMedia({ ...opts, limit: opts.limit ?? 100 });
  return items.length;
}

/**
 * List media + download each buffer from Storage. Filters to jsPDF-supported
 * mimeTypes (JPEG/PNG) by default — useful for server-side PDF embedding.
 *
 * Failures on individual buffer downloads are logged and skipped (partial
 * results preferred over hard failure for a single broken object).
 */
export async function downloadPropertyMedia(
  opts: DownloadPropertyMediaOptions
): Promise<PropertyMediaBuffer[]> {
  const allowedMimes = opts.mimeTypes ?? (['image/jpeg', 'image/png'] as const);
  const limit = opts.limit ?? DEFAULT_DOWNLOAD_LIMIT;

  const metas = await listPropertyMedia({ ...opts, limit: limit * 2 });
  // Accept two shapes: (a) native raster (JPEG/PNG) served from `storagePath`,
  // (b) DXF with a generated PNG preview served from `thumbnailStoragePath`.
  // Path (b) is what makes Κάτοψη DXFs show up in the showcase PDF — see
  // `functions/src/storage/dxf-thumbnail-onfinalize.ts` (ADR-312 Phase 3).
  const candidates = metas.filter((m) => {
    if (m.contentType && (allowedMimes as ReadonlyArray<string>).includes(m.contentType)) {
      return true;
    }
    if (m.ext === 'dxf' && m.thumbnailStoragePath) return true;
    return false;
  }).slice(0, limit);

  if (candidates.length === 0) return [];

  const bucket = getAdminBucket();
  const buffers: PropertyMediaBuffer[] = [];

  await Promise.all(
    candidates.map(async (meta) => {
      try {
        const useThumbnail = meta.ext === 'dxf' && !!meta.thumbnailStoragePath;
        const path = useThumbnail ? (meta.thumbnailStoragePath as string) : meta.storagePath;
        const [buffer] = await bucket.file(path).download();
        const format: 'JPEG' | 'PNG' = useThumbnail
          ? 'PNG'
          : JS_PDF_FORMAT_BY_MIME[(meta.contentType ?? '').toLowerCase()];
        if (!format) return;
        // Copy into a dedicated ArrayBuffer. Node `Buffer` instances (returned
        // by GCS `download()`) share a pooled backing store; a mere view
        // (`new Uint8Array(buf.buffer, offset, len)`) exposes the whole pool
        // to any jsPDF code that reads `.buffer` without honouring byteOffset,
        // which produced blank images in Phase 2 despite valid buffers on the
        // wire (incident 2026-04-17). One-shot copy is cheap for ≤6 images.
        const bytes = new Uint8Array(buffer.byteLength);
        bytes.set(buffer);
        buffers.push({
          ...meta,
          bytes,
          jsPdfFormat: format,
          fromThumbnail: useThumbnail,
        });
      } catch (err) {
        logger.warn('Failed to download property media buffer; skipping', {
          propertyId: opts.propertyId,
          mediaId: meta.id,
          storagePath: meta.storagePath,
          thumbnailStoragePath: meta.thumbnailStoragePath,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    })
  );

  buffers.sort((a, b) => (b.createdAtMs ?? 0) - (a.createdAtMs ?? 0));

  const totalBytes = buffers.reduce((sum, b) => sum + b.bytes.byteLength, 0);
  logger.info('Property media buffers loaded', {
    propertyId: opts.propertyId,
    category: opts.category,
    requested: candidates.length,
    loaded: buffers.length,
    totalBytes,
    formats: buffers.map((b) => b.jsPdfFormat),
    fromThumbnailCount: buffers.filter((b) => b.fromThumbnail).length,
  });

  return buffers;
}

export const PropertyMediaService = {
  listPropertyMedia,
  countPropertyMedia,
  downloadPropertyMedia,
} as const;
