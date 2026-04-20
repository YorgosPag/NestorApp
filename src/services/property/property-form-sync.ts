/**
 * =============================================================================
 * Property Form Sync — ADR-287 Batch 23 (Server↔Form Per-Field Reconciliation)
 * =============================================================================
 *
 * Pure SSoT helpers that build a flat `PropertyFieldsFormData` snapshot from a
 * `Property` document and diff two snapshots to produce a minimal patch of
 * server-changed fields. Used by `usePropertyFormSync` to prevent local edits
 * from being overwritten when Firestore re-emits the same document after an
 * auto-save (e.g. type change → auto-save {type,name} → subscribe fires →
 * naive full reset would clobber unsaved area / layout / orientation edits).
 *
 * Contract: fields that did NOT change server-side stay untouched in form
 * state; fields that did change server-side propagate as patch. Array/object
 * fields compared by structural equality (JSON digest) since Firestore
 * onSnapshot hands back fresh references even when content is identical.
 *
 * @module services/property/property-form-sync
 * @since ADR-287 Batch 23
 */

import type { Property } from '@/types/property-viewer';
import type { CommercialStatus, OperationalStatus, LevelData } from '@/types/property';
import type { PropertyFieldsFormData } from '@/features/property-details/components/property-fields-form-types';

/** Server-side snapshot of the fields mirrored into `PropertyFieldsFormData`. */
export type PropertyServerSnapshot = PropertyFieldsFormData;

const COMPLEX_KEYS: ReadonlySet<keyof PropertyFieldsFormData> = new Set<keyof PropertyFieldsFormData>([
  'orientations',
  'flooring',
  'interiorFeatures',
  'securityFeatures',
  'levels',
  'levelData',
]);

/**
 * Build a flat form-shaped snapshot from the Property document.
 * Used both for (a) initial form state, (b) server-snapshot tracking.
 */
export function buildFormDataFromProperty(property: Property): PropertyFieldsFormData {
  const extra = property as unknown as Record<string, unknown>;
  return {
    name: property.name ?? '',
    code: property.code ?? '',
    type: property.type ?? '',
    projectId: (extra.projectId as string | undefined) ?? '',
    buildingId: property.buildingId ?? '',
    floorId: property.floorId ?? '',
    operationalStatus: (extra.operationalStatus as OperationalStatus | undefined) ?? 'draft',
    commercialStatus: (property.commercialStatus ?? 'unavailable') as CommercialStatus,
    description: property.description ?? '',
    floor: property.floor ?? 0,
    bedrooms: property.layout?.bedrooms ?? 0,
    bathrooms: property.layout?.bathrooms ?? 0,
    wc: property.layout?.wc ?? 0,
    areaGross: property.areas?.gross ?? 0,
    areaNet: property.areas?.net ?? 0,
    areaBalcony: property.areas?.balcony ?? 0,
    areaTerrace: property.areas?.terrace ?? 0,
    areaGarden: property.areas?.garden ?? 0,
    orientations: property.orientations ?? [],
    condition: property.condition ?? '',
    energyClass: property.energy?.class ?? '',
    heatingType: property.systemsOverride?.heatingType ?? '',
    coolingType: property.systemsOverride?.coolingType ?? '',
    flooring: property.finishes?.flooring ?? [],
    windowFrames: property.finishes?.windowFrames ?? '',
    glazing: property.finishes?.glazing ?? '',
    interiorFeatures: property.interiorFeatures ?? [],
    securityFeatures: property.securityFeatures ?? [],
    levelData: (property.levelData ?? {}) as Record<string, LevelData>,
    levels: property.levels ?? [],
    askingPrice: property.commercial?.askingPrice?.toString() ?? '',
    rentPrice: property.commercial?.rentPrice?.toString() ?? '',
  };
}

/**
 * Diff two server snapshots. Returns only fields whose server value changed
 * between `prev` and `next`. Primitives use `Object.is`; arrays/objects use
 * structural (JSON) equality to tolerate fresh references from Firestore.
 */
export function diffServerSnapshot(
  prev: PropertyServerSnapshot,
  next: PropertyServerSnapshot,
): Partial<PropertyFieldsFormData> {
  const patch: Partial<PropertyFieldsFormData> = {};
  const target = patch as Record<string, unknown>;
  for (const key of Object.keys(next) as Array<keyof PropertyFieldsFormData>) {
    const a = prev[key];
    const b = next[key];
    const changed = COMPLEX_KEYS.has(key)
      ? JSON.stringify(a) !== JSON.stringify(b)
      : !Object.is(a, b);
    if (changed) target[key as string] = b;
  }
  return patch;
}
