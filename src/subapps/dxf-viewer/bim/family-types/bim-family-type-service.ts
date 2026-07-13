'use client';

/**
 * ADR-412 — BIM Family Types SSoT data-access service.
 *
 * Path: `companies/{companyId}/bim_family_types/{typeId}`.
 * 3-scope model: user-scope (own user) / company-scope / project-scope matching
 * `config.projectId`. All three reside in the same subcollection; the `scope`
 * field discriminates. Mirrors `StairPresetsService` exactly.
 *
 * SOS N.6 — enterprise IDs ONLY: `setDoc()` + `generateBimFamilyTypeId()`.
 * Auto-id writes (`add` variant) are forbidden by pre-commit ratchet.
 *
 * Cache TTL: 5 min per `listTypes()` call. Invalidated on every write.
 *
 * Zod validation: `saveType` validates the full document before write;
 * `updateType` validates the patch fields via the matching category schema.
 *
 * EntityAuditService.recordChange() is NOT called here — this service is a pure
 * data-access layer. Audit is recorded at the COMMAND layer (ADR-412 Φ5):
 * `UpdateFamilyTypeCommand` / `createDeleteFamilyTypeCommand` fire
 * `recordFamilyTypeChange()` (→ /api/audit-trail/record) alongside the optimistic
 * store update, so undo re-runs it symmetrically. See `bim-family-type-audit-client.ts`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-412-bim-family-types.md
 */

import {
  collection,
  deleteDoc,
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';

import type { ZodError } from 'zod';

import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import { generateBimFamilyTypeId } from '@/services/enterprise-id.service';
import {
  ScopedLibraryService,
  createSubcollectionScopedLibrary,
} from '../services/scoped-library-service';
import {
  BimFamilyTypeSchema,
  WallTypeParamsSchema,
  SlabTypeParamsSchema,
  StairTypeParamsSchema,
  RoofTypeParamsSchema,
  OpeningTypeParamsSchema,
} from '../types/bim-family-type.schemas';
import type {
  BimFamilyType,
  BimFamilyTypeScope,
  BimFamilyTypeOrigin,
  BimTypeParamsByCategory,
} from '../types/bim-family-type';

// ============================================================================
// CONFIG
// ============================================================================

export interface BimFamilyTypeServiceConfig {
  readonly companyId: string;
  readonly userId: string;
  readonly projectId?: string;
}

export interface SaveTypeInput<C extends keyof BimTypeParamsByCategory = keyof BimTypeParamsByCategory> {
  readonly name: string;
  readonly category: C;
  readonly scope: BimFamilyTypeScope;
  readonly origin: BimFamilyTypeOrigin;
  readonly typeParams: BimTypeParamsByCategory[C];
}

export interface UpdateTypeInput {
  readonly name?: string;
  /**
   * When provided, `category` MUST accompany `typeParams` so the correct Zod
   * schema can be selected for pre-write validation (avoids a Firestore read).
   */
  readonly typeParams?: BimTypeParamsByCategory[keyof BimTypeParamsByCategory];
  /** Required when `typeParams` is present — used to select the Zod schema. */
  readonly category?: keyof BimTypeParamsByCategory;
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/** Renders the first few Zod issues into a single-line, human-readable summary. */
function summarizeZodError(error: ZodError): string {
  return error.issues
    .slice(0, 3)
    .map((i) => `${i.path.join('.')}: ${i.message}`)
    .join('; ');
}

/**
 * Validates `typeParams` for the given category before writing to Firestore.
 * Uses the discriminated Zod schemas from `bim-family-type.schemas.ts`.
 * Throws a descriptive error when validation fails.
 */
function validateTypeParams(
  category: keyof BimTypeParamsByCategory,
  typeParams: BimTypeParamsByCategory[keyof BimTypeParamsByCategory],
): void {
  const schemaByCategory = {
    wall: WallTypeParamsSchema,
    slab: SlabTypeParamsSchema,
    stair: StairTypeParamsSchema,
    roof: RoofTypeParamsSchema,
    opening: OpeningTypeParamsSchema,
  } as const;

  const schema = schemaByCategory[category];
  const result = schema.safeParse(typeParams);
  if (!result.success) {
    throw new Error(`BIM_FAMILY_TYPE_INVALID_PARAMS [${category}]: ${summarizeZodError(result.error)}`);
  }
}

/**
 * Validates the full document payload (post-assembly) via `BimFamilyTypeSchema`
 * before the `setDoc` write. Belt-and-suspenders: catches cross-field
 * inconsistencies (e.g. scope=project but projectId absent).
 */
function validateDocument(payload: BimFamilyType): void {
  const result = BimFamilyTypeSchema.safeParse(payload);
  if (!result.success) {
    throw new Error(`BIM_FAMILY_TYPE_INVALID_DOCUMENT: ${summarizeZodError(result.error)}`);
  }
}

/**
 * Stamps tenant/timestamp fields (companyId, owner/created/updated) and
 * attaches `projectId` only when `scope === 'project'` (Firestore rejects
 * `undefined` fields). Shared by `saveType` and `createTypeWithId`.
 */
function stampTenantAndScope<C extends keyof BimTypeParamsByCategory>(
  config: BimFamilyTypeServiceConfig,
  entity: Omit<
    BimFamilyType<C>,
    'companyId' | 'ownerId' | 'createdBy' | 'createdAt' | 'updatedBy' | 'updatedAt' | 'projectId'
  >,
): BimFamilyType<C> {
  const base: BimFamilyType<C> = {
    ...entity,
    companyId: config.companyId,
    ownerId: config.userId,
    createdBy: config.userId,
    createdAt: serverTimestamp() as BimFamilyType['createdAt'],
    updatedBy: config.userId,
    updatedAt: serverTimestamp() as BimFamilyType['updatedAt'],
  } as BimFamilyType<C>;

  return entity.scope === 'project' && config.projectId
    ? { ...base, projectId: config.projectId }
    : base;
}

// ============================================================================
// SERVICE
// ============================================================================

export class BimFamilyTypeService {
  /**
   * Ο κοινός SSoT βιβλιοθηκών (ADR-652 M2) οδηγεί το ΔΙΑΒΑΣΜΑ (3-scope merge + 5min
   * cache + tenant isolation). Οι ΕΓΓΡΑΦΕΣ μένουν domain-specific εδώ (Zod validation,
   * category schema, stampTenantAndScope, undo restore) — δεν ταιριάζουν στο γενικό
   * `create/patch` του πυρήνα. Subcollection topology μέσω `collectionRefFactory`.
   */
  private readonly library: ScopedLibraryService<BimFamilyType>;

  constructor(private readonly config: BimFamilyTypeServiceConfig) {
    // Subcollection COMPANIES/{companyId}/bim_family_types — ΑΚΡΙΒΩΣ οι ίδιες queries με
    // πριν (3-scope, companyId σε κάθε bucket) μέσω του κοινού συνθέτη· μηδέν rules/index risk.
    this.library = createSubcollectionScopedLibrary<BimFamilyType>({
      collectionKey: 'BIM_FAMILY_TYPES',
      context: config,
      collectionRefFactory: () => this.collectionRef(),
      errors: {
        notFound: 'BIM_FAMILY_TYPE_NOT_FOUND',
        builtinNotMutable: 'BIM_FAMILY_TYPE_BUILTIN_NOT_MUTABLE',
      },
    });
  }

  private collectionRef() {
    return collection(
      db,
      COLLECTIONS.COMPANIES,
      this.config.companyId,
      COLLECTIONS.BIM_FAMILY_TYPES,
    );
  }

  private docRef(typeId: string) {
    return doc(
      db,
      COLLECTIONS.COMPANIES,
      this.config.companyId,
      COLLECTIONS.BIM_FAMILY_TYPES,
      typeId,
    );
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Returns all family types visible to the current actor:
   *   - own user-scope types
   *   - all company-scope types
   *   - project-scope types matching `config.projectId` (when provided)
   *
   * Optional `category` filter is applied in-memory after the 3-scope merge
   * (avoids a 4th Firestore round-trip; dataset is small).
   * Firestore rules enforce tenant isolation; this narrows by scope.
   */
  async listTypes(
    category?: keyof BimTypeParamsByCategory,
  ): Promise<readonly BimFamilyType[]> {
    // 3-scope merge + 5min cache + tenant isolation ζουν στον κοινό ScopedLibraryService.
    // Το `category` filter μένει in-memory (μικρό dataset· αποφεύγει 4ο round-trip) — ΙΔΙΑ
    // συμπεριφορά με πριν (φιλτράρισμα ΜΕΤΑ το merge).
    const merged = await this.library.list();
    return category ? merged.filter((t) => t.category === category) : merged;
  }

  /**
   * Creates a new family type document with an enterprise ID.
   * Validates `typeParams` via the Zod schema before writing.
   * `projectId` is persisted only when `scope === 'project'` (Firestore
   * rejects `undefined` fields — mirrors stair-presets-service payload split).
   */
  async saveType<C extends keyof BimTypeParamsByCategory>(
    input: SaveTypeInput<C>,
  ): Promise<BimFamilyType<C>> {
    if (!input.name.trim()) {
      throw new Error('BIM_FAMILY_TYPE_NAME_REQUIRED');
    }
    if (input.scope === 'project' && !this.config.projectId) {
      throw new Error('BIM_FAMILY_TYPE_PROJECT_SCOPE_REQUIRES_PROJECT_ID');
    }

    validateTypeParams(input.category, input.typeParams);

    const id = generateBimFamilyTypeId();
    const ref = this.docRef(id);

    const payload: BimFamilyType<C> = stampTenantAndScope(this.config, {
      id,
      name: input.name.trim(),
      category: input.category,
      scope: input.scope,
      origin: input.origin,
      typeParams: input.typeParams,
    });

    validateDocument(payload as BimFamilyType);

    await setDoc(ref, payload);
    this.invalidateCache();

    return payload;
  }

  /**
   * Partial update: name and/or typeParams only.
   * Uses `updateDoc` (NOT `setDoc`) to preserve immutable fields:
   * `createdAt`, `companyId`, `scope`, `ownerId`.
   * Validates updated `typeParams` before write when provided.
   */
  async updateType(
    typeId: string,
    patch: UpdateTypeInput,
  ): Promise<void> {
    if (patch.name !== undefined && !patch.name.trim()) {
      throw new Error('BIM_FAMILY_TYPE_NAME_REQUIRED');
    }
    if (patch.typeParams !== undefined && !patch.category) {
      throw new Error('BIM_FAMILY_TYPE_CATEGORY_REQUIRED_FOR_PARAMS_UPDATE');
    }
    if (patch.typeParams !== undefined && patch.category !== undefined) {
      validateTypeParams(patch.category, patch.typeParams);
    }

    const updatePayload: Record<string, unknown> = {
      updatedBy: this.config.userId,
      updatedAt: serverTimestamp(),
    };

    if (patch.name !== undefined) {
      updatePayload['name'] = patch.name.trim();
    }
    if (patch.typeParams !== undefined) {
      updatePayload['typeParams'] = patch.typeParams;
    }

    await updateDoc(this.docRef(typeId), updatePayload);
    this.invalidateCache();
  }

  /**
   * Hard-deletes a family type document.
   */
  async deleteType(typeId: string): Promise<void> {
    await deleteDoc(this.docRef(typeId));
    this.invalidateCache();
  }

  /**
   * ADR-412 Φ5 — re-creates a previously deleted type with its ORIGINAL id
   * (undo of `deleteType`). Unlike `saveType` (which mints a NEW enterprise id),
   * this preserves the id so detached instances re-link correctly on undo. The
   * snapshot was a valid persisted doc, so no re-validation is needed.
   */
  async restoreType(type: BimFamilyType): Promise<void> {
    await setDoc(this.docRef(type.id), type);
    this.invalidateCache();
  }

  /**
   * ADR-412 — persists a freshly-minted type that ALREADY carries its enterprise
   * id (unlike `saveType`, which mints a new one). The auto-type-on-create flow
   * needs the id synchronously (to stamp the wall + insert into the store before
   * the network round-trip), so it generates the id via the enterprise-id SSoT
   * and hands the built type here for the fire-and-forget persist. Validates the
   * `typeParams` + the full document, and stamps tenant/timestamp fields exactly
   * like `saveType`.
   *
   * @see ./auto-wall-type.ts §buildAutoWallType
   */
  async createTypeWithId<C extends keyof BimTypeParamsByCategory>(
    type: BimFamilyType<C>,
  ): Promise<BimFamilyType<C>> {
    validateTypeParams(type.category, type.typeParams);

    const payload: BimFamilyType<C> = stampTenantAndScope(this.config, type);

    validateDocument(payload as BimFamilyType);

    await setDoc(this.docRef(type.id), payload);
    this.invalidateCache();

    return payload;
  }

  /**
   * Invalidates the shared 5-min read cache (owned by the ScopedLibraryService).
   * Called automatically on every write (saveType / updateType / deleteType /
   * restoreType / createTypeWithId). Can also be called externally when an
   * external mutation is known to have occurred.
   */
  invalidateCache(): void {
    this.library.invalidateCache();
  }
}

// ============================================================================
// FACTORY
// ============================================================================

export function createBimFamilyTypeService(
  config: BimFamilyTypeServiceConfig,
): BimFamilyTypeService {
  return new BimFamilyTypeService(config);
}
