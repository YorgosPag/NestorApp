'use client';

/**
 * ADR-676 Phase 3 PILOT — Opening Frame Profile user library SSoT data-access
 * service.
 *
 * Path: `companies/{companyId}/opening_frame_presets/{id}`.
 * 3-scope model (user-scope / company-scope / project-scope matching
 * `config.projectId`) — mirrors `BimFamilyTypeService` / `StairPresetsService`
 * field-for-field, same subcollection topology via `createSubcollectionScopedLibrary`.
 *
 * SOS N.6 — enterprise IDs ONLY: `setDoc()` + `generateOpeningFramePresetId()`.
 * Auto-id writes (`addDoc`) are forbidden by pre-commit ratchet.
 *
 * Cache TTL: 5 min per `listProfiles()` call (owned by the shared
 * `ScopedLibraryService`). Invalidated on every write.
 *
 * @see ../types/opening-frame-profile.ts — `OpeningFrameProfilePresetDoc` doc shape
 * @see ./opening-frame-profile-store.ts — resolution cache this feeds
 * @see ./bim-family-type-service.ts — the mirrored write pattern
 * @see docs/centralized-systems/reference/adrs/ADR-676-opening-component-library.md
 */

import {
  collection,
  deleteDoc,
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { z } from 'zod';

import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import { generateOpeningFramePresetId } from '@/services/enterprise-id.service';
import {
  ScopedLibraryService,
  createSubcollectionScopedLibrary,
} from '../services/scoped-library-service';
import type {
  OpeningFrameProfile,
  OpeningFrameProfilePresetDoc,
} from '../types/opening-frame-profile';

// ============================================================================
// CONFIG
// ============================================================================

export interface OpeningFrameProfileLibraryConfig {
  readonly companyId: string;
  readonly userId: string;
  readonly projectId?: string;
}

export interface SaveFrameProfileInput {
  readonly name: string;
  readonly scope: 'user' | 'company' | 'project';
  readonly origin: 'user' | 'derived';
  /** Source builtin/user profile id when `origin === 'derived'`. */
  readonly derivedFrom?: string;
  readonly profile: Omit<OpeningFrameProfile, 'id'>;
}

export interface UpdateFrameProfileInput {
  readonly name?: string;
  readonly profile?: Partial<Omit<OpeningFrameProfile, 'id'>>;
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

const FrameProfileRoleSchema = z.enum(['frame', 'sash', 'mullion', 'sill']);

/** Mirrors `Omit<OpeningFrameProfile, 'id'>` — validated before every write. */
const FrameProfileFieldsSchema = z.object({
  manufacturer: z.string().min(1),
  series: z.string().min(1),
  role: FrameProfileRoleSchema,
  faceWidth: z.number().positive(),
  depth: z.number().positive(),
  label: z.string().optional(),
});

const SaveFrameProfileInputSchema = z.object({
  name: z.string().min(1),
  scope: z.enum(['user', 'company', 'project']),
  origin: z.enum(['user', 'derived']),
  derivedFrom: z.string().min(1).optional(),
  profile: FrameProfileFieldsSchema,
});

/** Renders the first few Zod issues into a single-line, human-readable summary. */
function summarizeZodError(error: z.ZodError): string {
  return error.issues
    .slice(0, 3)
    .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    .join('; ');
}

function validateSaveInput(input: SaveFrameProfileInput): void {
  const result = SaveFrameProfileInputSchema.safeParse(input);
  if (!result.success) {
    throw new Error(`OPENING_FRAME_PRESET_INVALID_INPUT: ${summarizeZodError(result.error)}`);
  }
}

function validateProfilePatch(profile: Partial<Omit<OpeningFrameProfile, 'id'>>): void {
  const result = FrameProfileFieldsSchema.partial().safeParse(profile);
  if (!result.success) {
    throw new Error(`OPENING_FRAME_PRESET_INVALID_PATCH: ${summarizeZodError(result.error)}`);
  }
}

/** Firestore rejects `undefined` — drop undefined-valued keys before a merge write. */
function pruneUndefined(patch: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) out[key] = value;
  }
  return out;
}

// ============================================================================
// SERVICE
// ============================================================================

export class OpeningFrameProfileLibraryService {
  /**
   * Ο κοινός SSoT βιβλιοθηκών (ADR-652 M2) οδηγεί το ΔΙΑΒΑΣΜΑ (3-scope merge +
   * 5min cache + tenant isolation). Οι ΕΓΓΡΑΦΕΣ μένουν domain-specific εδώ (Zod
   * validation, tenant/scope stamping, undefined-stripping) — μιμούνται
   * `BimFamilyTypeService` / `StairPresetsService` field-for-field.
   */
  private readonly library: ScopedLibraryService<OpeningFrameProfilePresetDoc>;

  constructor(private readonly config: OpeningFrameProfileLibraryConfig) {
    this.library = createSubcollectionScopedLibrary<OpeningFrameProfilePresetDoc>({
      collectionKey: 'OPENING_FRAME_PRESETS',
      context: config,
      collectionRefFactory: () => this.collectionRef(),
      errors: {
        notFound: 'OPENING_FRAME_PRESET_NOT_FOUND',
        builtinNotMutable: 'OPENING_FRAME_PRESET_BUILTIN_NOT_MUTABLE',
      },
    });
  }

  private collectionRef() {
    return collection(
      db,
      COLLECTIONS.COMPANIES,
      this.config.companyId,
      COLLECTIONS.OPENING_FRAME_PRESETS,
    );
  }

  private docRef(id: string) {
    return doc(
      db,
      COLLECTIONS.COMPANIES,
      this.config.companyId,
      COLLECTIONS.OPENING_FRAME_PRESETS,
      id,
    );
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Presets visible to the current actor: own user-scope + all company-scope +
   * project-scope matching `config.projectId` (when provided). Firestore rules
   * enforce tenant isolation; the engine narrows by scope.
   */
  listProfiles(): Promise<readonly OpeningFrameProfilePresetDoc[]> {
    return this.library.list();
  }

  /**
   * Creates a new preset document with an enterprise ID. `projectId` is
   * persisted only when `scope === 'project'` (Firestore rejects `undefined`
   * fields — mirrors `stair-presets-service` / `bim-family-type-service`
   * payload split).
   */
  async saveProfile(input: SaveFrameProfileInput): Promise<OpeningFrameProfilePresetDoc> {
    validateSaveInput(input);
    if (input.scope === 'project' && !this.config.projectId) {
      throw new Error('OPENING_FRAME_PRESET_PROJECT_SCOPE_REQUIRES_PROJECT_ID');
    }

    const id = generateOpeningFramePresetId();
    const ref = this.docRef(id);

    const base = pruneUndefined({
      id,
      name: input.name.trim(),
      scope: input.scope,
      origin: input.origin,
      derivedFrom: input.derivedFrom,
      manufacturer: input.profile.manufacturer,
      series: input.profile.series,
      role: input.profile.role,
      faceWidth: input.profile.faceWidth,
      depth: input.profile.depth,
      label: input.profile.label,
      builtin: false,
      ownerId: this.config.userId,
      companyId: this.config.companyId,
      createdBy: this.config.userId,
      createdAt: serverTimestamp(),
      updatedBy: this.config.userId,
      updatedAt: serverTimestamp(),
    });
    const payload =
      input.scope === 'project' && this.config.projectId
        ? { ...base, projectId: this.config.projectId }
        : base;

    await setDoc(ref, payload);
    this.invalidateCache();

    return payload as unknown as OpeningFrameProfilePresetDoc;
  }

  /**
   * Partial update: name and/or profile fields only. Uses `updateDoc` (NOT
   * `setDoc`) to preserve immutable fields: `createdAt`, `companyId`, `scope`,
   * `ownerId`, `origin`, `derivedFrom`. Rejects builtin/system-seeded docs via
   * `requireMutable` before writing.
   */
  async updateProfile(id: string, patch: UpdateFrameProfileInput): Promise<void> {
    if (patch.name !== undefined && !patch.name.trim()) {
      throw new Error('OPENING_FRAME_PRESET_NAME_REQUIRED');
    }
    if (patch.profile !== undefined) {
      validateProfilePatch(patch.profile);
    }

    await this.library.requireMutable(id);

    const updatePayload = pruneUndefined({
      name: patch.name?.trim(),
      ...patch.profile,
      updatedBy: this.config.userId,
      updatedAt: serverTimestamp(),
    });

    await updateDoc(this.docRef(id), updatePayload);
    this.invalidateCache();
  }

  /**
   * Hard-deletes a preset document. Rejects builtin/system-seeded docs via
   * `requireMutable` before writing.
   */
  async deleteProfile(id: string): Promise<void> {
    await this.library.requireMutable(id);
    await deleteDoc(this.docRef(id));
    this.invalidateCache();
  }

  /**
   * Invalidates the shared 5-min read cache (owned by the ScopedLibraryService).
   * Called automatically on every write (saveProfile / updateProfile /
   * deleteProfile). Can also be called externally after a known external write.
   */
  invalidateCache(): void {
    this.library.invalidateCache();
  }
}

// ============================================================================
// FACTORY
// ============================================================================

export function createOpeningFrameProfileLibraryService(
  config: OpeningFrameProfileLibraryConfig,
): OpeningFrameProfileLibraryService {
  return new OpeningFrameProfileLibraryService(config);
}
