import type { TFunction } from 'i18next';

const VALUE_SEPARATOR = ' · ';
const LIST_SEPARATOR = ', ';

type Primitive = string | number | boolean | null;
type JsonRecord = Record<string, unknown>;

function parse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readNumber(source: JsonRecord, key: string): number | null {
  const value = source[key];
  return typeof value === 'number' ? value : null;
}

function readString(source: JsonRecord, key: string): string | null {
  const value = source[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function readStringArray(source: JsonRecord, key: string): string[] {
  const value = source[key];
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry): entry is string => typeof entry === 'string');
}

function formatAreas(t: TFunction, raw: string): string {
  const value = parse(raw);
  if (!isRecord(value)) {
    return raw;
  }
  const sqm = t('properties-enums:units.sqm');
  const segments: string[] = [];
  for (const key of ['gross', 'net', 'balcony', 'terrace', 'garden'] as const) {
    const amount = readNumber(value, key);
    if (amount !== null) {
      segments.push(`${t(`properties-detail:fields.areas.${key}`)} ${amount} ${sqm}`);
    }
  }
  return segments.length > 0 ? segments.join(VALUE_SEPARATOR) : raw;
}

function formatLayout(t: TFunction, raw: string): string {
  const value = parse(raw);
  if (!isRecord(value)) {
    return raw;
  }
  const segments: string[] = [];
  const bedrooms = readNumber(value, 'bedrooms');
  if (bedrooms !== null) {
    segments.push(`${t('properties-detail:fields.bedrooms')} ${bedrooms}`);
  }
  const bathrooms = readNumber(value, 'bathrooms');
  if (bathrooms !== null) {
    segments.push(`${t('properties-detail:fields.bathrooms')} ${bathrooms}`);
  }
  const wc = readNumber(value, 'wc');
  if (wc !== null) {
    segments.push(`${t('properties-detail:fields.layout.wc')} ${wc}`);
  }
  return segments.length > 0 ? segments.join(VALUE_SEPARATOR) : raw;
}

function formatOrientations(t: TFunction, raw: string): string {
  const value = parse(raw);
  if (!Array.isArray(value)) {
    return raw;
  }
  const labels = value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => t(`properties-enums:units.orientation.${entry}`, { defaultValue: entry }));
  return labels.length > 0 ? labels.join(LIST_SEPARATOR) : raw;
}

function formatCondition(t: TFunction, raw: string): string {
  return t(`properties-enums:condition.${raw}`, { defaultValue: raw });
}

function formatEnergy(t: TFunction, raw: string): string {
  const value = parse(raw);
  if (!isRecord(value)) {
    return raw;
  }
  const energyClass = readString(value, 'class');
  if (!energyClass) {
    return raw;
  }
  return `${t('properties-enums:energy.class')} ${energyClass}`;
}

function formatSystemsOverride(t: TFunction, raw: string): string {
  const value = parse(raw);
  if (!isRecord(value)) {
    return raw;
  }
  const segments: string[] = [];
  const heating = readString(value, 'heatingType');
  if (heating) {
    const label = t('properties-enums:systems.heating.label');
    const translated = t(`properties-enums:systems.heating.${heating}`, { defaultValue: heating });
    segments.push(`${label}: ${translated}`);
  }
  const cooling = readString(value, 'coolingType');
  if (cooling) {
    const label = t('properties-enums:systems.cooling.label');
    const translated = t(`properties-enums:systems.cooling.${cooling}`, { defaultValue: cooling });
    segments.push(`${label}: ${translated}`);
  }
  return segments.length > 0 ? segments.join(VALUE_SEPARATOR) : raw;
}

function formatFinishes(t: TFunction, raw: string): string {
  const value = parse(raw);
  if (!isRecord(value)) {
    return raw;
  }
  const segments: string[] = [];
  const flooring = readStringArray(value, 'flooring');
  if (flooring.length > 0) {
    const label = t('properties-enums:finishes.flooring.label');
    const translated = flooring.map(
      (entry) => t(`properties-enums:finishes.flooring.${entry}`, { defaultValue: entry }),
    );
    segments.push(`${label}: ${translated.join(LIST_SEPARATOR)}`);
  }
  const frames = readString(value, 'windowFrames');
  if (frames) {
    const label = t('properties-enums:finishes.frames.label');
    const translated = t(`properties-enums:finishes.frames.${frames}`, { defaultValue: frames });
    segments.push(`${label}: ${translated}`);
  }
  const glazing = readString(value, 'glazing');
  if (glazing) {
    const label = t('properties-enums:finishes.glazing.label');
    const translated = t(`properties-enums:finishes.glazing.${glazing}`, { defaultValue: glazing });
    segments.push(`${label}: ${translated}`);
  }
  return segments.length > 0 ? segments.join(VALUE_SEPARATOR) : raw;
}

function formatFeatureArray(t: TFunction, raw: string, bucket: 'interior' | 'security'): string {
  const value = parse(raw);
  if (!Array.isArray(value)) {
    return raw;
  }
  const labels = value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => t(`properties-enums:features.${bucket}.${entry}`, { defaultValue: entry }));
  return labels.length > 0 ? labels.join(LIST_SEPARATOR) : raw;
}

function formatCommercialStatus(t: TFunction, raw: string): string {
  return t(`properties-enums:commercialStatus.${raw}`, { defaultValue: raw });
}

function formatCommercialObject(t: TFunction, raw: string): string {
  const value = parse(raw);
  if (!isRecord(value)) {
    return raw;
  }

  const segments: string[] = [];

  const askingPrice = readNumber(value, 'askingPrice');
  if (askingPrice !== null) {
    segments.push(`${t('properties:impactGuard.commercial.askingPrice')}: ${askingPrice.toLocaleString('el-GR')} €`);
  }

  const finalPrice = readNumber(value, 'finalPrice');
  if (finalPrice !== null) {
    segments.push(`${t('properties:impactGuard.commercial.finalPrice')}: ${finalPrice.toLocaleString('el-GR')} €`);
  }

  const reservationDeposit = readNumber(value, 'reservationDeposit');
  if (reservationDeposit !== null) {
    segments.push(`${t('properties:impactGuard.commercial.reservationDeposit')}: ${reservationDeposit.toLocaleString('el-GR')} €`);
  }

  const owners = value['owners'];
  if (Array.isArray(owners) && owners.length > 0) {
    const ownerNames = owners
      .filter(isRecord)
      .map((owner) => {
        const name = readString(owner, 'name');
        const pct = readNumber(owner, 'ownershipPct');
        return name ? (pct !== null ? `${name} (${pct}%)` : name) : null;
      })
      .filter((n): n is string => n !== null);
    if (ownerNames.length > 0) {
      segments.push(`${t('properties:impactGuard.commercial.owners')}: ${ownerNames.join(LIST_SEPARATOR)}`);
    }
  }

  const reservationDate = readString(value, 'reservationDate');
  if (reservationDate) {
    const date = new Date(reservationDate);
    if (!isNaN(date.getTime())) {
      segments.push(`${t('properties:impactGuard.commercial.reservationDate')}: ${date.toLocaleDateString('el-GR')}`);
    }
  }

  const saleDate = readString(value, 'saleDate');
  if (saleDate) {
    const date = new Date(saleDate);
    if (!isNaN(date.getTime())) {
      segments.push(`${t('properties:impactGuard.commercial.saleDate')}: ${date.toLocaleDateString('el-GR')}`);
    }
  }

  return segments.length > 0 ? segments.join(VALUE_SEPARATOR) : raw;
}

function formatLinkedSpaces(t: TFunction, raw: string): string {
  const value = parse(raw);
  if (!Array.isArray(value)) {
    return raw;
  }
  const entries = value.filter(isRecord);
  if (entries.length === 0) {
    return t('properties:impactGuard.emptyValue');
  }

  const segments = entries.map((entry) => {
    const spaceType = readString(entry, 'spaceType');
    const inclusion = readString(entry, 'inclusion');
    const allocationCode = readString(entry, 'allocationCode');
    const quantity = readNumber(entry, 'quantity');

    const parts: string[] = [];

    if (spaceType) {
      parts.push(
        t(`common-shared:search.entityTypes.${spaceType}`, { defaultValue: spaceType }),
      );
    }

    if (quantity !== null && quantity > 1) {
      parts.push(`× ${quantity}`);
    }

    if (allocationCode) {
      parts.push(allocationCode);
    }

    if (inclusion) {
      parts.push(
        t(`properties:linkedSpaces.inclusion.${inclusion}`, { defaultValue: inclusion }),
      );
    }

    return parts.length > 0 ? parts.join(' · ') : JSON.stringify(entry);
  });

  return segments.join(LIST_SEPARATOR);
}

export function formatImpactValue(
  t: TFunction,
  field: string,
  raw: string | null,
): string {
  if (raw === null) {
    return t('properties:impactGuard.emptyValue');
  }

  switch (field) {
    case 'areas':
      return formatAreas(t, raw);
    case 'layout':
      return formatLayout(t, raw);
    case 'orientations':
      return formatOrientations(t, raw);
    case 'condition':
      return formatCondition(t, raw);
    case 'energy':
      return formatEnergy(t, raw);
    case 'systemsOverride':
      return formatSystemsOverride(t, raw);
    case 'finishes':
      return formatFinishes(t, raw);
    case 'interiorFeatures':
      return formatFeatureArray(t, raw, 'interior');
    case 'securityFeatures':
      return formatFeatureArray(t, raw, 'security');
    case 'commercial':
      return formatCommercialObject(t, raw);
    case 'commercialStatus':
      return formatCommercialStatus(t, raw);
    case 'linkedSpaces':
      return formatLinkedSpaces(t, raw);
    default:
      return raw;
  }
}

export const __testing__ = {
  parse,
  isRecord,
  formatAreas,
  formatLayout,
  formatOrientations,
  formatCondition,
  formatEnergy,
  formatSystemsOverride,
  formatFinishes,
  formatFeatureArray,
  formatCommercialStatus,
  formatCommercialObject,
  formatLinkedSpaces,
};
