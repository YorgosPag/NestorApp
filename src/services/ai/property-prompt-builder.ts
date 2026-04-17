/**
 * =============================================================================
 * PROPERTY PROMPT BUILDER — serializes Property → Greek structured user prompt
 * =============================================================================
 *
 * Used by property-description-generator.service.ts to feed OpenAI with
 * structured, human-readable property data.
 *
 * Enum labels come from `properties-enums.json` (SSoT — same source used by UI
 * i18n), so changing a label in one place propagates everywhere.
 *
 * @module services/ai/property-prompt-builder
 * @enterprise SSoT: reuses i18n locales directly — no duplicate label maps
 */

import 'server-only';
import type { Property } from '@/types/property';
import enumsEl from '@/i18n/locales/el/properties-enums.json';
import enumsEn from '@/i18n/locales/en/properties-enums.json';

type EnumsFile = Record<string, unknown>;
type SupportedLocale = 'el' | 'en';

const LOCALE_FILES: Record<SupportedLocale, EnumsFile> = {
  el: enumsEl as EnumsFile,
  en: enumsEn as EnumsFile,
};

/**
 * Resolve a dotted key path against a locale JSON.
 * Returns the key itself if missing (safe fallback — prompt is still valid).
 */
function resolveLabel(locale: SupportedLocale, keyPath: string): string {
  const parts = keyPath.split('.');
  let cursor: unknown = LOCALE_FILES[locale];
  for (const part of parts) {
    if (typeof cursor !== 'object' || cursor === null) return keyPath;
    cursor = (cursor as Record<string, unknown>)[part];
  }
  return typeof cursor === 'string' ? cursor : keyPath;
}

function resolveList(locale: SupportedLocale, prefix: string, codes: readonly string[] | undefined): string[] {
  if (!codes || codes.length === 0) return [];
  return codes.map((code) => resolveLabel(locale, `${prefix}.${code}`));
}

function formatNumber(value: number | undefined, locale: SupportedLocale): string | null {
  if (value === undefined || value === null || Number.isNaN(value)) return null;
  return new Intl.NumberFormat(locale === 'el' ? 'el-GR' : 'en-US', {
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Serialize a Property into a structured text prompt (Greek labels when locale=el).
 *
 * Sections included (only when data is present — no empty lines):
 *  - Identity (type, code, name)
 *  - Dimensions (floor, areas)
 *  - Layout (bedrooms/bathrooms/wc/balconies/levels)
 *  - Condition & energy class
 *  - Orientations & views
 *  - Systems (heating, cooling, water)
 *  - Finishes (flooring, frames, glazing)
 *  - Interior features
 *  - Security features
 *  - Amenities
 *  - Linked spaces (parking/storage)
 *  - Commercial status
 *  - Operational status
 */
export function buildPropertyUserPrompt(property: Property, locale: SupportedLocale = 'el'): string {
  const lines: string[] = [];
  const labelHeader = locale === 'el' ? 'Δεδομένα μονάδας' : 'Unit data';
  lines.push(`${labelHeader}:`);

  // Identity
  const typeLabel = resolveLabel(locale, `types.${property.type}`);
  lines.push(`- ${locale === 'el' ? 'Τύπος' : 'Type'}: ${typeLabel}`);
  if (property.name) lines.push(`- ${locale === 'el' ? 'Όνομα' : 'Name'}: ${property.name}`);
  if (property.code) lines.push(`- ${locale === 'el' ? 'Κωδικός' : 'Code'}: ${property.code}`);

  // Floor
  if (property.floor !== undefined && property.floor !== null) {
    const floorLabel = locale === 'el' ? 'Όροφος' : 'Floor';
    lines.push(`- ${floorLabel}: ${property.floor}`);
  }

  // Areas
  const areaUnit = resolveLabel(locale, 'units.sqm');
  if (property.areas) {
    const a = property.areas;
    const areaParts: string[] = [];
    if (a.gross) areaParts.push(`${locale === 'el' ? 'μικτό' : 'gross'} ${formatNumber(a.gross, locale)} ${areaUnit}`);
    if (a.net) areaParts.push(`${locale === 'el' ? 'καθαρό' : 'net'} ${formatNumber(a.net, locale)} ${areaUnit}`);
    if (a.balcony) areaParts.push(`${locale === 'el' ? 'μπαλκόνι' : 'balcony'} ${formatNumber(a.balcony, locale)} ${areaUnit}`);
    if (a.terrace) areaParts.push(`${locale === 'el' ? 'βεράντα' : 'terrace'} ${formatNumber(a.terrace, locale)} ${areaUnit}`);
    if (a.garden) areaParts.push(`${locale === 'el' ? 'κήπος' : 'garden'} ${formatNumber(a.garden, locale)} ${areaUnit}`);
    if (areaParts.length > 0) {
      lines.push(`- ${locale === 'el' ? 'Εμβαδά' : 'Areas'}: ${areaParts.join(', ')}`);
    }
  } else if (property.area) {
    lines.push(`- ${locale === 'el' ? 'Εμβαδό' : 'Area'}: ${formatNumber(property.area, locale)} ${areaUnit}`);
  }

  // Layout
  if (property.layout) {
    const l = property.layout;
    const layoutParts: string[] = [];
    if (l.bedrooms) layoutParts.push(`${l.bedrooms} ${locale === 'el' ? 'υπνοδωμάτια' : 'bedrooms'}`);
    if (l.bathrooms) layoutParts.push(`${l.bathrooms} ${locale === 'el' ? 'μπάνια' : 'bathrooms'}`);
    if (l.wc) layoutParts.push(`${l.wc} WC`);
    if (l.balconies) layoutParts.push(`${l.balconies} ${locale === 'el' ? 'μπαλκόνια' : 'balconies'}`);
    if (l.levels && l.levels > 1) layoutParts.push(`${l.levels} ${locale === 'el' ? 'επίπεδα' : 'levels'}`);
    if (l.totalRooms) layoutParts.push(`${l.totalRooms} ${locale === 'el' ? 'συνολικά δωμάτια' : 'total rooms'}`);
    if (layoutParts.length > 0) {
      lines.push(`- ${locale === 'el' ? 'Διαρρύθμιση' : 'Layout'}: ${layoutParts.join(', ')}`);
    }
  }

  // Condition
  if (property.condition) {
    lines.push(`- ${locale === 'el' ? 'Κατάσταση' : 'Condition'}: ${resolveLabel(locale, `condition.${property.condition}`)}`);
  }
  if (property.renovationYear) {
    lines.push(`- ${locale === 'el' ? 'Έτος ανακαίνισης' : 'Renovation year'}: ${property.renovationYear}`);
  }

  // Energy
  if (property.energy?.class) {
    lines.push(`- ${locale === 'el' ? 'Ενεργειακή κλάση' : 'Energy class'}: ${property.energy.class}`);
  }

  // Orientations
  if (property.orientations && property.orientations.length > 0) {
    const orientationLabels = property.orientations.map((o) =>
      resolveLabel(locale, `units.orientation.${o}`)
    );
    lines.push(`- ${locale === 'el' ? 'Προσανατολισμός' : 'Orientation'}: ${orientationLabels.join(', ')}`);
  }

  // Views
  if (property.views && property.views.length > 0) {
    const viewLabels = property.views.map((v) => v.type).join(', ');
    lines.push(`- ${locale === 'el' ? 'Θέα' : 'Views'}: ${viewLabels}`);
  }

  // Systems
  if (property.systemsOverride) {
    const s = property.systemsOverride;
    const systemParts: string[] = [];
    if (s.heatingType) {
      const heatingLabel = resolveLabel(locale, `systems.heating.${s.heatingType}`);
      systemParts.push(`${locale === 'el' ? 'θέρμανση' : 'heating'}: ${heatingLabel}`);
    }
    if (s.heatingFuel) {
      systemParts.push(`${locale === 'el' ? 'καύσιμο' : 'fuel'}: ${s.heatingFuel}`);
    }
    if (s.coolingType) {
      const coolingLabel = resolveLabel(locale, `systems.cooling.${s.coolingType}`);
      systemParts.push(`${locale === 'el' ? 'ψύξη' : 'cooling'}: ${coolingLabel}`);
    }
    if (s.waterHeating) {
      systemParts.push(`${locale === 'el' ? 'ζεστό νερό' : 'water heating'}: ${s.waterHeating}`);
    }
    if (systemParts.length > 0) {
      lines.push(`- ${locale === 'el' ? 'Συστήματα' : 'Systems'}: ${systemParts.join(', ')}`);
    }
  }

  // Finishes
  if (property.finishes) {
    const f = property.finishes;
    const finishParts: string[] = [];
    if (f.flooring && f.flooring.length > 0) {
      const flooringLabels = resolveList(locale, 'finishes.flooring', f.flooring);
      finishParts.push(`${locale === 'el' ? 'δάπεδα' : 'flooring'}: ${flooringLabels.join(', ')}`);
    }
    if (f.windowFrames) {
      finishParts.push(`${locale === 'el' ? 'κουφώματα' : 'frames'}: ${resolveLabel(locale, `finishes.frames.${f.windowFrames}`)}`);
    }
    if (f.glazing) {
      finishParts.push(`${locale === 'el' ? 'υαλοπίνακες' : 'glazing'}: ${resolveLabel(locale, `finishes.glazing.${f.glazing}`)}`);
    }
    if (finishParts.length > 0) {
      lines.push(`- ${locale === 'el' ? 'Τελειώματα' : 'Finishes'}: ${finishParts.join(', ')}`);
    }
  }

  // Interior features
  if (property.interiorFeatures && property.interiorFeatures.length > 0) {
    const labels = resolveList(locale, 'features.interior', property.interiorFeatures);
    lines.push(`- ${locale === 'el' ? 'Εσωτερικά χαρακτηριστικά' : 'Interior features'}: ${labels.join(', ')}`);
  }

  // Security features
  if (property.securityFeatures && property.securityFeatures.length > 0) {
    const labels = resolveList(locale, 'features.security', property.securityFeatures);
    lines.push(`- ${locale === 'el' ? 'Ασφάλεια' : 'Security'}: ${labels.join(', ')}`);
  }

  // Amenities
  if (property.propertyAmenities && property.propertyAmenities.length > 0) {
    lines.push(`- ${locale === 'el' ? 'Παροχές' : 'Amenities'}: ${property.propertyAmenities.join(', ')}`);
  }

  // Linked spaces (parking/storage)
  if (property.linkedSpaces && property.linkedSpaces.length > 0) {
    const parkingCount = property.linkedSpaces
      .filter((s) => s.spaceType === 'parking')
      .reduce((sum, s) => sum + (s.quantity ?? 1), 0);
    const storageCount = property.linkedSpaces
      .filter((s) => s.spaceType === 'storage')
      .reduce((sum, s) => sum + (s.quantity ?? 1), 0);
    const parts: string[] = [];
    if (parkingCount > 0) parts.push(`${parkingCount} ${locale === 'el' ? 'θέση/εις στάθμευσης' : 'parking space(s)'}`);
    if (storageCount > 0) parts.push(`${storageCount} ${locale === 'el' ? 'αποθήκη/ες' : 'storage unit(s)'}`);
    if (parts.length > 0) {
      lines.push(`- ${locale === 'el' ? 'Συνδεδεμένοι χώροι' : 'Linked spaces'}: ${parts.join(', ')}`);
    }
  }

  // Commercial status (only the disposition, NOT the price — price is out of scope for marketing description)
  if (property.commercialStatus) {
    const statusLabel = resolveLabel(locale, `commercialStatus.${property.commercialStatus}`);
    lines.push(`- ${locale === 'el' ? 'Εμπορική κατάσταση' : 'Commercial status'}: ${statusLabel}`);
  }

  // Operational status
  if (property.operationalStatus) {
    const statusLabel = resolveLabel(locale, `operationalStatus.${property.operationalStatus}`);
    lines.push(`- ${locale === 'el' ? 'Λειτουργική κατάσταση' : 'Operational status'}: ${statusLabel}`);
  }

  // Use category
  if (property.useCategory) {
    lines.push(`- ${locale === 'el' ? 'Κατηγορία χρήσης' : 'Use category'}: ${property.useCategory}`);
  }

  // Multi-level note
  if (property.isMultiLevel) {
    lines.push(`- ${locale === 'el' ? 'Πολυεπίπεδη μονάδα' : 'Multi-level unit'}: ${locale === 'el' ? 'ναι' : 'yes'}`);
  }

  return lines.join('\n');
}
