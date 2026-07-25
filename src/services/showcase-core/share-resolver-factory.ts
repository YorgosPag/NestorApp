/**
 * =============================================================================
 * SHOWCASE CORE — Share Resolver Factory (ADR-699, supersedes ADR-321 Phase 1.1)
 * =============================================================================
 *
 * A showcase share resolver is now a **declaration**: name the collection, the
 * two keys the resolved shape exposes, the document fields the title is read
 * from, and whether a PDF path is mandatory. No callbacks.
 *
 * ## Why the `buildResolvedData` hook was removed
 *
 * The previous factory (ADR-321) already owned resolve/projection/validate/
 * canShare and every surface called it — yet the five resolver files were still
 * near-identical, because the hook it asked for was the *same object literal*
 * five times with different key names. Two of the five (property, project)
 * never migrated at all and stayed 338 duplicate tokens apart.
 *
 * That is the "over-parameterised factory" of ADR-698 §3: a factory that takes
 * code where it could take data has not centralised anything, it has moved the
 * boilerplate one level down — and static tooling reports it as clean, because
 * everyone does import the SSoT. Only jscpd sees the clone living inside the
 * config object.
 *
 * So the hook became four data fields, and the surfaces became declarations.
 *
 * @module services/showcase-core/share-resolver-factory
 * @see adrs/ADR-699-share-resolver-declarations.md
 */

import { createModuleLogger } from '@/lib/telemetry';
import {
  createTenantOwnershipGuard,
  loadSharedEntityDoc,
} from '@/services/sharing/resolver-core/share-entity-access';
import {
  buildSafePublicProjection,
  normalizeRegenTimestamp,
  pickFirstStringField,
  validateShareBaseInput,
} from '@/services/sharing/resolver-core/share-resolver-primitives';
import type {
  CreateShareInput,
  ShareEntityDefinition,
  ShareEntityType,
  ShareRecord,
  ValidationResult,
} from '@/types/sharing';

// ============================================================================
// SHAPE
// ============================================================================

/**
 * What every showcase surface resolves to: five shared facts plus the two keys
 * that carry the surface's own vocabulary (`buildingId` / `buildingTitle`, …).
 */
export type ShowcaseResolvedData<
  TIdKey extends string,
  TTitleKey extends string,
> = {
  shareId: string;
  token: string;
  pdfStoragePath: string | null;
  pdfRegeneratedAt: string | null;
  note: string | null;
} & { [K in TIdKey]: string } & { [K in TTitleKey]: string | null };

export interface ShowcaseShareResolverConfig<
  TIdKey extends string,
  TTitleKey extends string,
> {
  /** Share entityType discriminator (e.g. `'building_showcase'`). */
  entityType: ShareEntityType;
  /** Firestore collection constant (e.g. `COLLECTIONS.BUILDINGS`). */
  collection: string;
  /** Key carrying the entity id, and the label used in validation messages. */
  idField: TIdKey;
  /** Key carrying the human title. */
  titleField: TTitleKey;
  /** Document fields tried, in order, for the title. First non-empty wins. */
  titleSourceFields: readonly string[];
  /**
   * Whether creating a share requires `showcaseMeta.pdfStoragePath`.
   *
   * `false` for parking and storage — those surfaces publish a payload but have
   * no PDF generator yet, and demanding a path would make them unshareable.
   */
  requiresPdfPath: boolean;
}

// ============================================================================
// FACTORY
// ============================================================================

/** `'building_showcase'` → `'BuildingShowcaseShareResolver'`. */
function loggerNameFor(entityType: ShareEntityType): string {
  const pascal = entityType
    .split('_')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
  return `${pascal}ShareResolver`;
}

/**
 * Attach the two declared keys to the shared facts.
 *
 * TypeScript cannot infer a mapped type from a computed key whose name is a
 * generic parameter, so the assertion is unavoidable — it is confined to this
 * one function, and the anchor suite asserts the real key set at runtime.
 */
function withDeclaredKeys<TIdKey extends string, TTitleKey extends string>(
  shared: {
    shareId: string;
    token: string;
    pdfStoragePath: string | null;
    pdfRegeneratedAt: string | null;
    note: string | null;
  },
  idField: TIdKey,
  entityId: string,
  titleField: TTitleKey,
  title: string | null,
): ShowcaseResolvedData<TIdKey, TTitleKey> {
  return {
    ...shared,
    [idField]: entityId,
    [titleField]: title,
  } as ShowcaseResolvedData<TIdKey, TTitleKey>;
}

export function createShowcaseShareResolver<
  TIdKey extends string,
  TTitleKey extends string,
>(
  config: ShowcaseShareResolverConfig<TIdKey, TTitleKey>,
): ShareEntityDefinition<ShowcaseResolvedData<TIdKey, TTitleKey>> {
  const logger = createModuleLogger(loggerNameFor(config.entityType));

  async function resolve(
    share: ShareRecord,
  ): Promise<ShowcaseResolvedData<TIdKey, TTitleKey>> {
    const data = await loadSharedEntityDoc({
      collection: config.collection,
      share,
      logger,
      missingMessage: 'Showcase share points to missing entity',
    });

    return withDeclaredKeys(
      {
        shareId: share.id,
        token: share.token,
        pdfStoragePath: share.showcaseMeta?.pdfStoragePath ?? null,
        pdfRegeneratedAt: normalizeRegenTimestamp(share.showcaseMeta?.pdfRegeneratedAt),
        note: share.note ?? null,
      },
      config.idField,
      share.entityId,
      config.titleField,
      pickFirstStringField(data, config.titleSourceFields),
    );
  }

  function validateCreateInput(input: CreateShareInput): ValidationResult {
    const base = validateShareBaseInput(input, {
      entityType: config.entityType,
      entityIdLabel: config.idField,
    });
    if (!base.valid) return base;

    if (config.requiresPdfPath && !input.showcaseMeta?.pdfStoragePath?.trim()) {
      return { valid: false, reason: 'showcaseMeta.pdfStoragePath required' };
    }
    return { valid: true };
  }

  return {
    resolve,
    safePublicProjection: share => buildSafePublicProjection(share, 'showcaseMeta'),
    validateCreateInput,
    canShare: createTenantOwnershipGuard(config.collection),
    renderPublic: () => null,
  };
}
