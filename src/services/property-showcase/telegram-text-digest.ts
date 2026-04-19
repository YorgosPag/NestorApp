/**
 * =============================================================================
 * PROPERTY SHOWCASE — TELEGRAM TEXT DIGEST (ADR-312 Phase 9.18)
 * =============================================================================
 *
 * Pure formatter that converts a `PropertyShowcaseSnapshot` into a plain-text
 * digest suitable for Telegram (and any other channel whose renderer only
 * handles unformatted text — WhatsApp, Messenger, Instagram).
 *
 * Why plain text — Telegram caption (sendPhoto) is capped at 1024 chars and
 * `sendMessage` at 4096. An HTML digest works only for Telegram (`parse_mode:
 * 'HTML'`) and would diverge per channel; plain text is the lowest common
 * denominator and keeps the server side channel-agnostic.
 *
 * Chunking: the long digest is split into ≤4000-char chunks (small safety
 * margin below Telegram's 4096 sendMessage limit) at section boundaries, so
 * no section is cut mid-field.
 *
 * @module services/property-showcase/telegram-text-digest
 */

import type { PropertyShowcaseSnapshot } from './snapshot-builder';
import type { PropertyShowcasePDFLabels } from './labels';

const CHUNK_LIMIT = 4000;
const SECTION_SEP = '━━━';

export interface DigestInput {
  snapshot: PropertyShowcaseSnapshot;
  labels: PropertyShowcasePDFLabels;
  shareUrl?: string;
  locale?: 'el' | 'en';
}

// ============================================================================
// FORMAT HELPERS
// ============================================================================

function fmt(label: string, value: string | number | undefined | null): string | null {
  if (value === undefined || value === null || value === '') return null;
  const v = typeof value === 'number' ? String(value) : value.trim();
  if (!v) return null;
  return `${label}: ${v}`;
}

function fmtPrice(n: number | undefined, locale: 'el' | 'en'): string | undefined {
  if (typeof n !== 'number' || !Number.isFinite(n)) return undefined;
  try {
    return new Intl.NumberFormat(locale === 'el' ? 'el-GR' : 'en-US', {
      style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `${n} €`;
  }
}

function fmtArea(n: number | undefined): string | undefined {
  if (typeof n !== 'number' || !Number.isFinite(n)) return undefined;
  return `${n} m²`;
}

function compact(lines: Array<string | null | undefined>): string[] {
  return lines.filter((l): l is string => typeof l === 'string' && l.length > 0);
}

function section(title: string, body: string[]): string | null {
  if (body.length === 0) return null;
  return `${SECTION_SEP} ${title} ${SECTION_SEP}\n${body.join('\n')}`;
}

// ============================================================================
// SECTION BUILDERS
// ============================================================================

function buildHeaderBlock(snapshot: PropertyShowcaseSnapshot, labels: PropertyShowcasePDFLabels): string[] {
  const c = snapshot.company;
  const contacts = labels.header.contacts;
  return compact([
    c.name ? `📍 ${c.name}` : null,
    fmt(contacts.phoneLabel, c.phone),
    fmt(contacts.emailLabel, c.email),
    fmt(contacts.websiteLabel, c.website),
  ]);
}

function buildProjectSection(snapshot: PropertyShowcaseSnapshot, labels: PropertyShowcasePDFLabels): string | null {
  const p = snapshot.property.project;
  if (!p) return null;
  return section(labels.project.sectionTitle, compact([
    fmt(labels.project.name, p.name),
    fmt(labels.project.address, p.address),
  ]));
}

function buildCommercialSection(
  snapshot: PropertyShowcaseSnapshot,
  labels: PropertyShowcasePDFLabels,
  locale: 'el' | 'en',
): string | null {
  const c = snapshot.property.commercial;
  if (!c) return null;
  return section(labels.commercial.sectionTitle, compact([
    fmt(labels.commercial.availability, c.statusLabel ?? c.status),
    fmt(labels.commercial.operational, c.operationalStatusLabel ?? c.operationalStatus),
    fmt(labels.commercial.price, fmtPrice(c.askingPrice, locale)),
  ]));
}

function buildDescriptionSection(snapshot: PropertyShowcaseSnapshot, labels: PropertyShowcasePDFLabels): string | null {
  const p = snapshot.property;
  const body = compact([
    p.name ? `🏠 ${p.name}` : null,
    fmt(labels.specs.code, p.code),
    p.description ? `\n${p.description}` : null,
  ]);
  return section(labels.chrome.descriptionSection, body);
}

function buildSpecsSection(snapshot: PropertyShowcaseSnapshot, labels: PropertyShowcasePDFLabels): string | null {
  const p = snapshot.property;
  const s = labels.specs;
  const areas = p.areas ?? {};
  const layout = p.layout ?? {};
  const cond = p.condition ?? {};
  const body = compact([
    fmt(s.type, p.typeLabel ?? p.type),
    fmt(s.building, p.building),
    typeof p.floor === 'number' ? fmt(s.floor, String(p.floor)) : null,
    fmt(s.grossArea, fmtArea(areas.gross)),
    fmt(s.netArea, fmtArea(areas.net)),
    fmt(s.balconyArea, fmtArea(areas.balcony)),
    fmt(s.terraceArea, fmtArea(areas.terrace)),
    fmt(s.garden, fmtArea(areas.garden)),
    typeof areas.millesimalShares === 'number' ? fmt(s.millesimalShares, String(areas.millesimalShares)) : null,
    typeof layout.bedrooms === 'number' ? fmt(s.bedrooms, String(layout.bedrooms)) : null,
    typeof layout.bathrooms === 'number' ? fmt(s.bathrooms, String(layout.bathrooms)) : null,
    typeof layout.totalRooms === 'number' ? fmt(s.totalRooms, String(layout.totalRooms)) : null,
    typeof layout.balconies === 'number' ? fmt(s.balconies, String(layout.balconies)) : null,
    fmt(s.condition, cond.conditionLabel ?? cond.condition),
    typeof cond.renovationYear === 'number' ? fmt(s.renovationYear, String(cond.renovationYear)) : null,
    fmt(s.deliveryDate, cond.deliveryDate),
  ]);
  return section(labels.specs.sectionTitle, body);
}

function buildOrientationSection(snapshot: PropertyShowcaseSnapshot, labels: PropertyShowcasePDFLabels): string | null {
  const labelsList = snapshot.property.orientationLabels ?? snapshot.property.orientations ?? [];
  if (labelsList.length === 0) return null;
  return section(labels.orientation.sectionTitle, [labelsList.join(', ')]);
}

function buildEnergySection(snapshot: PropertyShowcaseSnapshot, labels: PropertyShowcasePDFLabels): string | null {
  const e = snapshot.property.energy;
  if (!e) return null;
  return section(labels.energy.sectionTitle, compact([
    fmt(labels.energy.energyClass, e.class),
    fmt(labels.energy.certificateId, e.certificateId),
    fmt(labels.energy.certificateDate, e.certificateDate),
    fmt(labels.energy.validUntil, e.validUntil),
  ]));
}

function buildViewsSection(snapshot: PropertyShowcaseSnapshot, labels: PropertyShowcasePDFLabels): string | null {
  const views = snapshot.property.views ?? [];
  if (views.length === 0) return null;
  const lines = views.map((v) => v.quality ? `• ${v.type} (${v.quality})` : `• ${v.type}`);
  return section(labels.chrome.viewsTitle, lines);
}

function buildSystemsSection(snapshot: PropertyShowcaseSnapshot, labels: PropertyShowcasePDFLabels): string | null {
  const s = snapshot.property.systems;
  if (!s) return null;
  return section(labels.systems.sectionTitle, compact([
    fmt(labels.systems.heating, s.heatingLabel ?? s.heatingType),
    fmt(labels.systems.heatingFuel, s.heatingFuel),
    fmt(labels.systems.cooling, s.coolingLabel ?? s.coolingType),
    fmt(labels.systems.waterHeating, s.waterHeating),
  ]));
}

function buildFinishesSection(snapshot: PropertyShowcaseSnapshot, labels: PropertyShowcasePDFLabels): string | null {
  const f = snapshot.property.finishes;
  if (!f) return null;
  const flooring = (f.flooringLabels ?? f.flooring ?? []).join(', ');
  return section(labels.finishes.sectionTitle, compact([
    flooring ? fmt(labels.finishes.flooring, flooring) : null,
    fmt(labels.finishes.frames, f.windowFramesLabel ?? f.windowFrames),
    fmt(labels.finishes.glazing, f.glazingLabel ?? f.glazing),
  ]));
}

function buildFeaturesSection(snapshot: PropertyShowcaseSnapshot, labels: PropertyShowcasePDFLabels): string | null {
  const f = snapshot.property.features;
  if (!f) return null;
  const interior = (f.interiorLabels ?? f.interior ?? []).join(', ');
  const security = (f.securityLabels ?? f.security ?? []).join(', ');
  const amenities = (f.amenities ?? []).join(', ');
  return section(labels.features.sectionTitle, compact([
    interior ? fmt(labels.features.interior, interior) : null,
    security ? fmt(labels.features.security, security) : null,
    amenities ? fmt(labels.features.amenities, amenities) : null,
  ]));
}

function buildLinkedSpacesSection(snapshot: PropertyShowcaseSnapshot, labels: PropertyShowcasePDFLabels): string | null {
  const spaces = snapshot.property.linkedSpaces ?? [];
  if (spaces.length === 0) return null;
  const l = labels.linkedSpaces;
  const lines = spaces.map((s) => {
    const type = s.spaceType === 'parking' ? l.parking : l.storage;
    const parts = compact([
      s.allocationCode,
      s.floor ? `${l.floor} ${s.floor}` : null,
      fmtArea(s.area),
      s.inclusion,
    ]);
    return `• ${type}${parts.length > 0 ? ` — ${parts.join(' · ')}` : ''}`;
  });
  return section(l.sectionTitle, lines);
}

// ============================================================================
// MAIN FORMATTER
// ============================================================================

export function buildTelegramTextDigest(input: DigestInput): string[] {
  const { snapshot, labels, shareUrl, locale = 'el' } = input;

  const header = buildHeaderBlock(snapshot, labels).join('\n');
  const sections = compact([
    buildProjectSection(snapshot, labels),
    buildCommercialSection(snapshot, labels, locale),
    buildDescriptionSection(snapshot, labels),
    buildSpecsSection(snapshot, labels),
    buildOrientationSection(snapshot, labels),
    buildEnergySection(snapshot, labels),
    buildViewsSection(snapshot, labels),
    buildSystemsSection(snapshot, labels),
    buildFinishesSection(snapshot, labels),
    buildFeaturesSection(snapshot, labels),
    buildLinkedSpacesSection(snapshot, labels),
  ]);

  const footer = shareUrl
    ? `\n${SECTION_SEP}\n🔗 ${shareUrl}`
    : '';

  return chunkDigest(header, sections, footer);
}

function chunkDigest(header: string, sections: string[], footer: string): string[] {
  const chunks: string[] = [];
  let current = header;
  for (const sec of sections) {
    const candidate = current ? `${current}\n\n${sec}` : sec;
    if (candidate.length <= CHUNK_LIMIT) {
      current = candidate;
    } else {
      if (current.length > 0) chunks.push(current);
      current = sec.length <= CHUNK_LIMIT ? sec : sec.slice(0, CHUNK_LIMIT);
    }
  }
  const withFooter = footer ? `${current}${footer}` : current;
  if (withFooter.length > CHUNK_LIMIT && footer) {
    chunks.push(current);
    chunks.push(footer.trim());
  } else if (withFooter.length > 0) {
    chunks.push(withFooter);
  }
  return chunks;
}
