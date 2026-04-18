/**
 * =============================================================================
 * 🏢 PROPERTY SHOWCASE — Snapshot Field Builders (ADR-312 Phase 4)
 * =============================================================================
 *
 * SRP split from snapshot-builder.ts: pure per-field mapping helpers that the
 * top-level `buildPropertyShowcaseSnapshot` composes. No I/O, no side effects;
 * each builder takes a raw Firestore record + locale and returns the
 * wire-format fragment for one section of the showcase snapshot.
 *
 * @module services/property-showcase/snapshot-field-builders
 */

import {
  translatePropertyCondition,
  translateCommercialStatus,
  translateOperationalStatus,
  translateHeatingType,
  translateCoolingType,
  translateFlooring,
  translateWindowFrames,
  translateGlazing,
  translateInteriorFeatures,
  translateSecurityFeatures,
  type EnumLocale,
} from '@/services/property-enum-labels/property-enum-labels.service';
import type { ProjectAddress } from '@/types/project/addresses';
import {
  getPrimaryAddress,
  formatFullAddressLine,
  migrateLegacyAddress,
} from '@/types/project/address-helpers';
import type {
  ShowcaseAreas,
  ShowcaseCommercialInfo,
  ShowcaseConditionInfo,
  ShowcaseEnergyInfo,
  ShowcaseFeaturesInfo,
  ShowcaseFinishesInfo,
  ShowcaseLayout,
  ShowcaseLinkedSpace,
  ShowcaseProjectInfo,
  ShowcaseSystemsInfo,
  ShowcaseViewInfo,
} from './snapshot-builder';

// =============================================================================
// Primitive pickers
// =============================================================================

export function pickString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function pickNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export function normalizeDate(value: unknown): string | undefined {
  if (!value) return undefined;
  // Firestore Timestamp or ISO string — both tolerated.
  if (typeof value === 'string') return value.slice(0, 10);
  if (typeof value === 'object' && value !== null) {
    const ts = value as { toDate?: () => Date; seconds?: number };
    if (typeof ts.toDate === 'function') {
      return ts.toDate().toISOString().slice(0, 10);
    }
    if (typeof ts.seconds === 'number') {
      return new Date(ts.seconds * 1000).toISOString().slice(0, 10);
    }
  }
  return undefined;
}

export function hasValues<T extends object>(obj: T): boolean {
  for (const value of Object.values(obj)) {
    if (value !== undefined && value !== null && value !== '') {
      if (Array.isArray(value) && value.length === 0) continue;
      return true;
    }
  }
  return false;
}

// =============================================================================
// Section builders
// =============================================================================

export function buildProject(project: Record<string, unknown> | undefined): ShowcaseProjectInfo | undefined {
  if (!project) return undefined;

  // 🏢 SSoT: resolve primary address via address-helpers (ProjectAddress schema)
  // — handles isPrimary lookup + fallback to first address consistently across the app.
  const addresses = Array.isArray(project.addresses)
    ? (project.addresses as ProjectAddress[])
    : undefined;

  let primary = getPrimaryAddress(addresses);

  // Legacy fallback: lazy migration from flat { address, city } fields (ADR-167)
  if (!primary) {
    const legacy = migrateLegacyAddress({
      address: pickString(project.address),
      city: pickString(project.city),
    });
    primary = getPrimaryAddress(legacy);
  }

  const addressLine = primary ? formatFullAddressLine(primary) : '';

  return {
    name: pickString(project.title) || pickString(project.name),
    address: addressLine.length > 0 ? addressLine : undefined,
  };
}

export function buildCommercial(p: Record<string, unknown>, locale: EnumLocale): ShowcaseCommercialInfo | undefined {
  const status = pickString(p.commercialStatus);
  const operational = pickString(p.operationalStatus);
  const commercial = (p.commercial as Record<string, unknown>) || {};
  const askingPrice = pickNumber(commercial.askingPrice);

  if (!status && !operational && askingPrice === undefined) return undefined;

  return {
    status,
    statusLabel: translateCommercialStatus(status, locale),
    operationalStatus: operational,
    operationalStatusLabel: translateOperationalStatus(operational, locale),
    askingPrice,
  };
}

export function buildAreas(p: Record<string, unknown>): ShowcaseAreas | undefined {
  const areas = (p.areas as Record<string, unknown>) || {};
  const result: ShowcaseAreas = {
    gross: pickNumber(areas.gross),
    net: pickNumber(areas.net),
    balcony: pickNumber(areas.balcony),
    terrace: pickNumber(areas.terrace),
    garden: pickNumber(areas.garden),
    millesimalShares: pickNumber(p.millesimalShares),
  };
  return hasValues(result) ? result : undefined;
}

export function buildLayout(p: Record<string, unknown>): ShowcaseLayout | undefined {
  const layout = (p.layout as Record<string, unknown>) || {};
  const result: ShowcaseLayout = {
    bedrooms: pickNumber(layout.bedrooms),
    bathrooms: pickNumber(layout.bathrooms),
    wc: pickNumber(layout.wc),
    totalRooms: pickNumber(layout.totalRooms),
    balconies: pickNumber(layout.balconies),
  };
  return hasValues(result) ? result : undefined;
}

export function buildViews(p: Record<string, unknown>): ShowcaseViewInfo[] | undefined {
  if (!Array.isArray(p.views)) return undefined;
  const views: ShowcaseViewInfo[] = [];
  for (const v of p.views as Array<Record<string, unknown>>) {
    const type = pickString(v?.type);
    if (!type) continue;
    views.push({ type, quality: pickString(v?.quality) });
  }
  return views.length > 0 ? views : undefined;
}

export function buildCondition(p: Record<string, unknown>, locale: EnumLocale): ShowcaseConditionInfo | undefined {
  const condition = pickString(p.condition);
  const renovationYear = pickNumber(p.renovationYear);
  const deliveryDate = normalizeDate(p.deliveryDate);
  if (!condition && renovationYear === undefined && !deliveryDate) return undefined;
  return {
    condition,
    conditionLabel: translatePropertyCondition(condition, locale),
    renovationYear,
    deliveryDate,
  };
}

export function buildEnergy(p: Record<string, unknown>): ShowcaseEnergyInfo | undefined {
  const energy = (p.energy as Record<string, unknown>) || {};
  const result: ShowcaseEnergyInfo = {
    class: pickString(energy.class),
    certificateId: pickString(energy.certificateId),
    certificateDate: normalizeDate(energy.certificateDate),
    validUntil: normalizeDate(energy.validUntil),
  };
  return hasValues(result) ? result : undefined;
}

export function buildSystems(p: Record<string, unknown>, locale: EnumLocale): ShowcaseSystemsInfo | undefined {
  const overrides = (p.systemsOverride as Record<string, unknown>) || {};
  const heating = pickString(overrides.heatingType);
  const cooling = pickString(overrides.coolingType);
  const fuel = pickString(overrides.heatingFuel);
  const water = pickString(overrides.waterHeating);
  if (!heating && !cooling && !fuel && !water) return undefined;
  return {
    heatingType: heating,
    heatingLabel: translateHeatingType(heating, locale),
    heatingFuel: fuel,
    coolingType: cooling,
    coolingLabel: translateCoolingType(cooling, locale),
    waterHeating: water,
  };
}

export function buildFinishes(p: Record<string, unknown>, locale: EnumLocale): ShowcaseFinishesInfo | undefined {
  const finishes = (p.finishes as Record<string, unknown>) || {};
  const flooring = Array.isArray(finishes.flooring)
    ? (finishes.flooring as string[]).filter((f): f is string => typeof f === 'string')
    : undefined;
  const windowFrames = pickString(finishes.windowFrames);
  const glazing = pickString(finishes.glazing);
  if ((!flooring || flooring.length === 0) && !windowFrames && !glazing) return undefined;
  return {
    flooring,
    flooringLabels: translateFlooring(flooring, locale),
    windowFrames,
    windowFramesLabel: translateWindowFrames(windowFrames, locale),
    glazing,
    glazingLabel: translateGlazing(glazing, locale),
  };
}

export function buildFeatures(p: Record<string, unknown>, locale: EnumLocale): ShowcaseFeaturesInfo | undefined {
  const interior = Array.isArray(p.interiorFeatures)
    ? (p.interiorFeatures as string[]).filter((f): f is string => typeof f === 'string')
    : undefined;
  const security = Array.isArray(p.securityFeatures)
    ? (p.securityFeatures as string[]).filter((f): f is string => typeof f === 'string')
    : undefined;
  const amenities = Array.isArray(p.propertyAmenities)
    ? (p.propertyAmenities as string[]).filter((f): f is string => typeof f === 'string')
    : undefined;
  const hasInterior = !!interior && interior.length > 0;
  const hasSecurity = !!security && security.length > 0;
  const hasAmenities = !!amenities && amenities.length > 0;
  if (!hasInterior && !hasSecurity && !hasAmenities) return undefined;
  return {
    interior,
    interiorLabels: translateInteriorFeatures(interior, locale),
    security,
    securityLabels: translateSecurityFeatures(security, locale),
    amenities,
  };
}

export function buildLinkedSpaces(
  p: Record<string, unknown>,
  storages: Map<string, Record<string, unknown>>,
  parkingSpots: Map<string, Record<string, unknown>>,
): ShowcaseLinkedSpace[] | undefined {
  if (!Array.isArray(p.linkedSpaces) || p.linkedSpaces.length === 0) return undefined;
  const spaces: ShowcaseLinkedSpace[] = [];
  for (const ls of p.linkedSpaces as Array<Record<string, unknown>>) {
    const spaceType = ls.spaceType;
    if (spaceType !== 'parking' && spaceType !== 'storage') continue;
    const spaceId = typeof ls.spaceId === 'string' ? ls.spaceId : undefined;
    const doc = spaceId
      ? spaceType === 'storage'
        ? storages.get(spaceId)
        : parkingSpots.get(spaceId)
      : undefined;
    spaces.push({
      spaceType,
      allocationCode:
        pickString(ls.allocationCode) ||
        pickString(doc?.name) ||
        pickString(doc?.number) ||
        pickString(doc?.code),
      area: pickNumber(doc?.area),
      floor: pickString(doc?.floor),
      type: pickString(doc?.type),
      inclusion: pickString(ls.inclusion),
      quantity: pickNumber(ls.quantity),
      description: pickString(doc?.description),
    });
  }
  return spaces.length > 0 ? spaces : undefined;
}
