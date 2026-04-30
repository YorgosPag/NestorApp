import type { CommercialStatus, LinkedSpace } from '@/types/property';
import type { Property } from '@/types/property-viewer';
import { normalizePropertyType } from '@/constants/property-types';
import { normalizeCommercialStatus as normalizeCommercialStatusSSoT } from '@/constants/commercial-statuses';
import { ENTITY_TYPES } from '@/config/domain-constants';
import {
  createProperty as createPropertyRecord,
  deleteProperty as deletePropertyRecord,
  updateProperty as updatePropertyRecord,
  updatePropertyCoverage as updatePropertyCoverageRecord,
} from '@/services/properties.service';
import { propagateEntityLabelRenameWithPolicy } from '@/services/filesystem/file-mutation-gateway';
import { safeFireAndForget } from '@/lib/safe-fire-and-forget';
import {
  archiveProperty,
  checkBOQReferences,
  loadPropertyContext,
  restoreProperty,
} from './property-deletion-guard';

const SOLD_LOCKED_FIELDS: ReadonlySet<string> = new Set([
  'code', 'type', 'name', 'areas', 'layout', 'floor', 'floorId',
  'commercialStatus', 'buildingId', 'linkedSpaces',
  'orientations', 'condition', 'energy', 'systemsOverride',
  'finishes', 'interiorFeatures', 'securityFeatures',
  'levels', 'isMultiLevel', 'levelData',
]);

const RESERVED_LOCKED_FIELDS: ReadonlySet<string> = new Set(['code', 'type', 'name']);

/**
 * Top-level fields legitimately mutated by the sale-revert flow
 * (reserved/sold → for-sale). Keeps the transition surgical — everything
 * else in SOLD_LOCKED_FIELDS stays protected against accidental edits.
 */
const REVERT_ALLOWED_FIELDS: ReadonlySet<string> = new Set([
  'commercialStatus',
  'commercial',
]);

type PropertyMutationIntent =
  | 'create'
  | 'update'
  | 'building-link'
  | 'linked-spaces';

type PropertyMutationPayload = Partial<Property> & Record<string, unknown>;

type PropertyMutationCurrentState = {
  readonly commercialStatus?: string | null;
  readonly buildingId?: string | null;
  readonly floorId?: string | null;
  readonly name?: string | null;
};

interface PropertyMutationContext {
  readonly intent: PropertyMutationIntent;
  readonly propertyId?: string;
  readonly currentProperty?: PropertyMutationCurrentState | null;
  readonly updates: PropertyMutationPayload;
}

interface GuardedPropertyUpdateInput {
  readonly propertyId: string;
  readonly currentProperty: PropertyMutationCurrentState;
  readonly updates: Record<string, unknown>;
}

interface GuardedPropertyCreateInput {
  readonly propertyData: Record<string, unknown>;
}

interface GuardedPropertyLinkInput {
  readonly propertyId: string;
  readonly currentProperty: PropertyMutationCurrentState;
  readonly buildingId: string | null;
  readonly floorId: string | null;
  /** ADR-233: Clear entity code when building is disconnected */
  readonly clearCode?: boolean;
}

interface GuardedPropertyLinkedSpacesInput {
  readonly propertyId: string;
  readonly currentProperty: PropertyMutationCurrentState;
  readonly linkedSpaces: LinkedSpace[];
}

interface GuardedPropertyRevertInput {
  readonly propertyId: string;
  readonly currentProperty: PropertyMutationCurrentState;
  readonly updates: Record<string, unknown>;
}

interface GuardedPropertyDeleteInput {
  readonly propertyId: string;
}

interface GuardedPropertyCoverageInput {
  readonly propertyId: string;
  readonly coverage: Partial<{
    hasPhotos: boolean;
    hasFloorplans: boolean;
    hasDocuments: boolean;
  }>;
}


export class PropertyMutationPolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PropertyMutationPolicyError';
  }
}

export class InvalidPropertyTypeError extends PropertyMutationPolicyError {
  constructor(rawValue: unknown) {
    super(`Invalid property type: ${String(rawValue)}. Must match a canonical PropertyType (see src/constants/property-types.ts).`);
    this.name = 'InvalidPropertyTypeError';
  }
}

export class InvalidCommercialStatusError extends PropertyMutationPolicyError {
  constructor(rawValue: unknown) {
    super(`Invalid commercial status: ${String(rawValue)}. Must match a canonical CommercialStatus (see src/constants/commercial-statuses.ts).`);
    this.name = 'InvalidCommercialStatusError';
  }
}

function isBlank(value: unknown): boolean {
  return typeof value !== 'string' || value.trim().length === 0;
}

function readCurrentCommercialStatus(
  currentProperty: PropertyMutationCurrentState | null | undefined,
): CommercialStatus | null {
  const status = currentProperty?.commercialStatus;
  return typeof status === 'string' ? status as CommercialStatus : null;
}

/**
 * Write-time enum normalization (ADR-287 Batch 13).
 *
 * Normalizes enum-typed fields in a Firestore write payload to their canonical
 * SSoT values BEFORE persistence. Throws if a provided value cannot be resolved
 * to a canonical token, preventing dirty data from entering the database.
 *
 * Null/undefined values and missing keys are passed through untouched — the
 * caller controls whether a field is being set at all.
 *
 * Currently covers: `type` (PropertyType), `commercialStatus` (CommercialStatus).
 */
function normalizeEnumFieldsForWrite(payload: Record<string, unknown>): void {
  if ('type' in payload && payload.type !== null && payload.type !== undefined) {
    const canonical = normalizePropertyType(payload.type);
    if (!canonical) {
      throw new InvalidPropertyTypeError(payload.type);
    }
    payload.type = canonical;
  }

  if (
    'commercialStatus' in payload &&
    payload.commercialStatus !== null &&
    payload.commercialStatus !== undefined
  ) {
    const canonical = normalizeCommercialStatusSSoT(payload.commercialStatus);
    if (!canonical) {
      throw new InvalidCommercialStatusError(payload.commercialStatus);
    }
    payload.commercialStatus = canonical;
  }
}

function assertKnownPropertyContext(context: PropertyMutationContext): void {
  if (context.intent === 'create') {
    return;
  }

  if (!context.propertyId || context.propertyId === '__new__') {
    throw new PropertyMutationPolicyError('Cannot mutate an unsaved property.');
  }

  if (!context.currentProperty) {
    throw new PropertyMutationPolicyError('Property mutation context is required.');
  }
}

function assertFieldLocking(
  commercialStatus: CommercialStatus | null,
  updateKeys: readonly string[],
): void {
  if (!commercialStatus) {
    return;
  }

  const attemptedReservedFields = updateKeys.filter((key) => RESERVED_LOCKED_FIELDS.has(key));
  const attemptedSoldFields = updateKeys.filter((key) => SOLD_LOCKED_FIELDS.has(key));

  if (commercialStatus === 'reserved' && attemptedReservedFields.length > 0) {
    throw new PropertyMutationPolicyError(
      `Cannot modify locked fields on a reserved property: ${attemptedReservedFields.join(', ')}`,
    );
  }

  if ((commercialStatus === 'sold' || commercialStatus === 'rented') && attemptedSoldFields.length > 0) {
    throw new PropertyMutationPolicyError(
      `Cannot modify locked fields on a ${commercialStatus} property: ${attemptedSoldFields.join(', ')}`,
    );
  }
}

function assertCreatePolicy(propertyData: Record<string, unknown>): void {
  if (isBlank(propertyData.name)) {
    throw new PropertyMutationPolicyError('Property name is required before creation.');
  }
}

function assertLinkPolicy(
  updates: PropertyMutationPayload,
  currentProperty: PropertyMutationCurrentState,
): void {
  const nextBuildingId = typeof updates.buildingId === 'string'
    ? updates.buildingId
    : currentProperty.buildingId;
  const nextFloorId = typeof updates.floorId === 'string'
    ? updates.floorId
    : currentProperty.floorId;

  if (nextFloorId && !nextBuildingId) {
    throw new PropertyMutationPolicyError('Cannot assign a floor without a building.');
  }
}

function assertLinkedSpacesPolicy(currentProperty: PropertyMutationCurrentState): void {
  if (!currentProperty.buildingId) {
    throw new PropertyMutationPolicyError('Property must be linked to a building before managing linked spaces.');
  }
}

function assertPropertyMutationPolicy(context: PropertyMutationContext): void {
  assertKnownPropertyContext(context);

  if (context.intent === 'create') {
    assertCreatePolicy(context.updates);
    return;
  }

  const currentProperty = context.currentProperty!;
  const updateKeys = Object.keys(context.updates);
  const commercialStatus = readCurrentCommercialStatus(currentProperty);
  assertFieldLocking(commercialStatus, updateKeys);

  if (context.intent === 'building-link') {
    assertLinkPolicy(context.updates, currentProperty);
  }

  if (context.intent === 'linked-spaces') {
    assertLinkedSpacesPolicy(currentProperty);
  }
}

export async function createPropertyWithPolicy({
  propertyData,
}: GuardedPropertyCreateInput): Promise<{ success: boolean; propertyId?: string; error?: string; errorCode?: string }> {
  assertPropertyMutationPolicy({
    intent: 'create',
    updates: propertyData,
  });

  normalizeEnumFieldsForWrite(propertyData);

  return createPropertyRecord(propertyData);
}

export async function updatePropertyWithPolicy({
  propertyId,
  currentProperty,
  updates,
}: GuardedPropertyUpdateInput): Promise<{ success: boolean }> {
  assertPropertyMutationPolicy({
    intent: 'update',
    propertyId,
    currentProperty,
    updates,
  });

  normalizeEnumFieldsForWrite(updates);

  const result = await updatePropertyRecord(propertyId, updates as Partial<Property>);

  if (result.success) {
    const nextName = typeof updates.name === 'string' ? updates.name.trim() : null;
    const previousName = typeof currentProperty.name === 'string' ? currentProperty.name.trim() : null;
    if (nextName && nextName.length > 0 && nextName !== previousName) {
      safeFireAndForget(
        propagateEntityLabelRenameWithPolicy({
          entityType: ENTITY_TYPES.PROPERTY,
          entityId: propertyId,
          newEntityLabel: nextName,
        }),
        'PropertyMutationGateway.propagateEntityLabelRename',
        { propertyId, nextName },
      );
    }
  }

  return result;
}

/**
 * Sale-revert mutation (reserved/sold → for-sale).
 *
 * `updatePropertyWithPolicy` keeps `commercialStatus` in `SOLD_LOCKED_FIELDS`
 * so a sold property cannot be silently flipped back by a generic edit form.
 * Revert is the ONE legitimate way to flip that status — so it gets its own
 * gateway that validates the transition shape strictly:
 *   - Current status must be `reserved` or `sold`.
 *   - Target `commercialStatus` must be `for-sale`.
 *   - Payload limited to `REVERT_ALLOWED_FIELDS` (commercialStatus + commercial).
 * Any deviation throws — the caller must use `updatePropertyWithPolicy`
 * for anything else.
 */
export async function revertPropertySaleWithPolicy({
  propertyId,
  currentProperty,
  updates,
}: GuardedPropertyRevertInput): Promise<{ success: boolean }> {
  if (!propertyId || propertyId === '__new__') {
    throw new PropertyMutationPolicyError('Cannot mutate an unsaved property.');
  }
  if (!currentProperty) {
    throw new PropertyMutationPolicyError('Property mutation context is required.');
  }

  const currentStatus = readCurrentCommercialStatus(currentProperty);
  if (currentStatus !== 'reserved' && currentStatus !== 'sold') {
    throw new PropertyMutationPolicyError(
      `Revert only allowed from reserved or sold status (current: ${currentStatus ?? 'unknown'}).`,
    );
  }

  const updateKeys = Object.keys(updates);
  const disallowed = updateKeys.filter((key) => !REVERT_ALLOWED_FIELDS.has(key));
  if (disallowed.length > 0) {
    throw new PropertyMutationPolicyError(
      `Revert can only modify: ${[...REVERT_ALLOWED_FIELDS].join(', ')}. Forbidden: ${disallowed.join(', ')}`,
    );
  }

  normalizeEnumFieldsForWrite(updates);

  if (updates.commercialStatus !== 'for-sale') {
    throw new PropertyMutationPolicyError(
      `Revert target must be 'for-sale' (got: ${String(updates.commercialStatus)}).`,
    );
  }

  return updatePropertyRecord(propertyId, updates as Partial<Property>);
}

export async function updatePropertyBuildingLinkWithPolicy({
  propertyId,
  currentProperty,
  buildingId,
  floorId,
  clearCode,
}: GuardedPropertyLinkInput): Promise<{ success: boolean }> {
  const updates: Record<string, unknown> = {
    buildingId,
    floorId,
    ...(clearCode ? { code: '' } : {}),
  };

  assertPropertyMutationPolicy({
    intent: 'building-link',
    propertyId,
    currentProperty,
    updates,
  });

  return updatePropertyRecord(propertyId, updates as Partial<Property>);
}

export async function updatePropertyLinkedSpacesWithPolicy({
  propertyId,
  currentProperty,
  linkedSpaces,
}: GuardedPropertyLinkedSpacesInput): Promise<{ success: boolean }> {
  const updates: Record<string, unknown> = { linkedSpaces };

  assertPropertyMutationPolicy({
    intent: 'linked-spaces',
    propertyId,
    currentProperty,
    updates,
  });

  return updatePropertyRecord(propertyId, updates as Partial<Property>);
}

export async function deletePropertyWithPolicy({
  propertyId,
}: GuardedPropertyDeleteInput): Promise<{ success: boolean }> {
  if (!propertyId || propertyId === '__new__') {
    throw new PropertyMutationPolicyError('Cannot delete an unsaved property.');
  }

  // ADR-329 §3.9 — defense-in-depth: BOQ-reference guard at the service
  // boundary. UI should call checkBOQReferences() first and offer the
  // archive flow; this throw is the fail-safe.
  const ctx = await loadPropertyContext(propertyId);
  if (ctx) {
    const report = await checkBOQReferences(ctx.companyId, ctx.buildingId, propertyId);
    if (report.blocked) {
      throw new PropertyMutationPolicyError(
        `BOQ_REFERENCES_BLOCK_DELETE: ${report.totalRefs} measurement task(s) reference this property`,
      );
    }
  }

  return deletePropertyRecord(propertyId);
}

export async function archivePropertyWithPolicy({
  propertyId, userId,
}: { propertyId: string; userId: string }): Promise<{ success: boolean }> {
  if (!propertyId || propertyId === '__new__') {
    throw new PropertyMutationPolicyError('Cannot archive an unsaved property.');
  }
  if (!userId) {
    throw new PropertyMutationPolicyError('Archive requires authenticated user.');
  }
  await archiveProperty(propertyId, userId);
  return { success: true };
}

export async function restorePropertyWithPolicy({
  propertyId,
}: { propertyId: string }): Promise<{ success: boolean }> {
  if (!propertyId) {
    throw new PropertyMutationPolicyError('Cannot restore an unsaved property.');
  }
  await restoreProperty(propertyId);
  return { success: true };
}

export async function updatePropertyCoverageWithPolicy({
  propertyId,
  coverage,
}: GuardedPropertyCoverageInput): Promise<{ success: boolean }> {
  if (!propertyId || propertyId === '__new__') {
    throw new PropertyMutationPolicyError('Cannot update coverage for an unsaved property.');
  }

  return updatePropertyCoverageRecord(propertyId, coverage);
}

