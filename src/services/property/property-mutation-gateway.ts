import type { CommercialStatus, LinkedSpace } from '@/types/property';
import type { Property } from '@/types/property-viewer';
import {
  createProperty as createPropertyRecord,
  deleteProperty as deletePropertyRecord,
  updateProperty as updatePropertyRecord,
  updatePropertyCoverage as updatePropertyCoverageRecord,
  updateMultiplePropertiesOwner as updateMultiplePropertiesOwnerRecord,
} from '@/services/properties.service';

const SOLD_LOCKED_FIELDS: ReadonlySet<string> = new Set([
  'code', 'type', 'name', 'areas', 'layout', 'floor', 'floorId',
  'commercialStatus', 'buildingId', 'linkedSpaces',
  'orientations', 'condition', 'energy', 'systemsOverride',
  'finishes', 'interiorFeatures', 'securityFeatures',
  'levels', 'isMultiLevel', 'levelData',
]);

const RESERVED_LOCKED_FIELDS: ReadonlySet<string> = new Set(['code', 'type', 'name']);

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

interface GuardedBulkAssignOwnerInput {
  readonly propertyIds: readonly string[];
  readonly contactId: string;
}

export class PropertyMutationPolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PropertyMutationPolicyError';
  }
}

function isBlank(value: unknown): boolean {
  return typeof value !== 'string' || value.trim().length === 0;
}

function normalizeCommercialStatus(
  currentProperty: PropertyMutationCurrentState | null | undefined,
): CommercialStatus | null {
  const status = currentProperty?.commercialStatus;
  return typeof status === 'string' ? status as CommercialStatus : null;
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
  const commercialStatus = normalizeCommercialStatus(currentProperty);
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
}: GuardedPropertyCreateInput): Promise<{ success: boolean; propertyId?: string; error?: string }> {
  assertPropertyMutationPolicy({
    intent: 'create',
    updates: propertyData,
  });

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

  return deletePropertyRecord(propertyId);
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

export async function assignMultiplePropertiesOwnerWithPolicy({
  propertyIds,
  contactId,
}: GuardedBulkAssignOwnerInput): Promise<{ success: boolean }> {
  if (!Array.isArray(propertyIds) || propertyIds.length === 0) {
    throw new PropertyMutationPolicyError('At least one property must be selected.');
  }

  if (isBlank(contactId)) {
    throw new PropertyMutationPolicyError('A contact must be selected before assigning ownership.');
  }

  const invalidPropertyId = propertyIds.find((propertyId) => !propertyId || propertyId === '__new__');
  if (invalidPropertyId) {
    throw new PropertyMutationPolicyError('Cannot assign ownership to an unsaved property.');
  }

  return updateMultiplePropertiesOwnerRecord([...propertyIds], contactId);
}
