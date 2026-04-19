/**
 * @fileoverview Property Showcase HTML email — section renderers (ADR-312 Phase 8).
 * @description Pure string-templating helpers. One function per showcase section
 *              so the email replicates the `/shared/<token>` web view. Inline
 *              styles are REQUIRED by email clients (Outlook, Gmail, Apple Mail)
 *              — the CLAUDE.md N.3 ban does not apply here.
 * @note SSoT palette is imported from `base-email-template` to stay aligned
 *       with the Pagonis identity used across the other 4 templates.
 */

import 'server-only';

import type {
  PropertyShowcaseSnapshot,
  ShowcaseLinkedSpace,
} from '@/services/property-showcase/snapshot-builder';
import type {
  PropertyShowcasePDFLabels,
  ShowcaseLinkedSpacesLabels,
} from '@/services/property-showcase/labels';
import type {
  ShowcaseMedia,
  ShowcaseLinkedSpaceFloorplans,
  ShowcasePropertyFloorFloorplans,
} from '@/components/property-showcase/types';
import { BRAND, escapeHtml } from './base-email-template';

type SnapshotProperty = PropertyShowcaseSnapshot['property'];

interface RowsParam {
  label: string;
  value: string | number | undefined | null;
  unit?: string;
}

function renderKeyValueTable(rows: RowsParam[]): string {
  const visible = rows.filter((r) => r.value !== undefined && r.value !== null && r.value !== '');
  if (visible.length === 0) return '';
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
    ${visible
      .map((r) => `<tr>
        <td style="padding:6px 0;border-bottom:1px solid ${BRAND.border};font-size:13px;color:${BRAND.grayLight};width:50%;">${escapeHtml(r.label)}</td>
        <td style="padding:6px 0;border-bottom:1px solid ${BRAND.border};font-size:13px;color:${BRAND.navyDark};text-align:right;font-weight:600;">${escapeHtml(String(r.value))}${r.unit ? `&nbsp;${escapeHtml(r.unit)}` : ''}</td>
      </tr>`)
      .join('')}
  </table>`;
}

function renderSectionTitle(text: string): string {
  return `<h2 style="margin:24px 0 12px;padding:0;font-size:16px;color:${BRAND.navyDark};border-left:3px solid ${BRAND.navy};padding-left:10px;">${escapeHtml(text)}</h2>`;
}

export function renderPropertyHero(p: SnapshotProperty, labels: PropertyShowcasePDFLabels): string {
  const code = p.code ? `<p style="margin:4px 0 0;font-size:12px;color:${BRAND.grayLight};">${escapeHtml(labels.specs.code)}: ${escapeHtml(p.code)}</p>` : '';
  const desc = p.description
    ? `<p style="margin:12px 0 0;font-size:14px;color:${BRAND.navyDark};line-height:1.6;white-space:pre-line;">${escapeHtml(p.description)}</p>`
    : '';
  return `<section>
    <h1 style="margin:0;padding:0;font-size:22px;color:${BRAND.navyDark};">${escapeHtml(p.name)}</h1>
    ${code}
    ${desc}
  </section>`;
}

export function renderPhotoGrid(photos: ShowcaseMedia[], labels: PropertyShowcasePDFLabels): string {
  if (!photos || photos.length === 0) return '';
  const cells = photos.slice(0, 12).map((photo) =>
    `<td style="padding:4px;width:50%;vertical-align:top;">
      <img src="${escapeHtml(photo.url)}" alt="${escapeHtml(photo.displayName ?? labels.chrome.photosTitle)}" width="260" height="180" style="display:block;width:100%;max-width:260px;height:180px;object-fit:cover;border-radius:6px;border:1px solid ${BRAND.border};" />
    </td>`,
  );
  const rows: string[] = [];
  for (let i = 0; i < cells.length; i += 2) {
    rows.push(`<tr>${cells[i]}${cells[i + 1] ?? '<td style="width:50%;"></td>'}</tr>`);
  }
  return `${renderSectionTitle(labels.chrome.photosTitle)}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${rows.join('')}</table>`;
}

export function renderSpecs(p: SnapshotProperty, labels: PropertyShowcasePDFLabels): string {
  const rows: RowsParam[] = [
    { label: labels.specs.type, value: p.typeLabel ?? p.type },
    { label: labels.specs.building, value: p.building },
    { label: labels.specs.floor, value: p.floor },
    { label: labels.specs.grossArea, value: p.areas?.gross, unit: labels.specs.areaUnit },
    { label: labels.specs.netArea, value: p.areas?.net, unit: labels.specs.areaUnit },
    { label: labels.specs.balcony, value: p.areas?.balcony, unit: labels.specs.areaUnit },
    { label: labels.specs.terrace, value: p.areas?.terrace, unit: labels.specs.areaUnit },
    { label: labels.specs.garden, value: p.areas?.garden, unit: labels.specs.areaUnit },
    { label: labels.specs.millesimalShares, value: p.areas?.millesimalShares },
    { label: labels.specs.bedrooms, value: p.layout?.bedrooms },
    { label: labels.specs.bathrooms, value: p.layout?.bathrooms },
    { label: labels.specs.wc, value: p.layout?.wc },
    { label: labels.specs.totalRooms, value: p.layout?.totalRooms },
    { label: labels.specs.balconies, value: p.layout?.balconies },
    { label: labels.specs.orientation, value: (p.orientationLabels ?? p.orientations ?? []).join(', ') || undefined },
  ];
  const table = renderKeyValueTable(rows);
  if (!table) return '';
  return `${renderSectionTitle(labels.specs.title)}${table}`;
}

export function renderEnergy(p: SnapshotProperty, labels: PropertyShowcasePDFLabels): string {
  if (!p.energy) return '';
  const rows: RowsParam[] = [
    { label: labels.energy.energyClass, value: p.energy.class },
    { label: labels.energy.certificateId, value: p.energy.certificateId },
    { label: labels.energy.certificateDate, value: p.energy.certificateDate },
    { label: labels.energy.validUntil, value: p.energy.validUntil },
  ];
  const table = renderKeyValueTable(rows);
  if (!table) return '';
  return `${renderSectionTitle(labels.energy.sectionTitle)}${table}`;
}

export function renderViews(p: SnapshotProperty, labels: PropertyShowcasePDFLabels): string {
  if (!p.views || p.views.length === 0) return '';
  const items = p.views.map((v) =>
    `<li style="margin:4px 0;font-size:13px;color:${BRAND.navyDark};">${escapeHtml(v.type)}${v.quality ? ` — ${escapeHtml(v.quality)}` : ''}</li>`,
  ).join('');
  return `${renderSectionTitle(labels.chrome.viewsTitle)}<ul style="margin:0;padding:0 0 0 18px;">${items}</ul>`;
}

export function renderMediaList(
  media: ShowcaseMedia[] | undefined,
  title: string,
  emptyLabel?: string,
): string {
  if (!media || media.length === 0) {
    return emptyLabel ? `${renderSectionTitle(title)}<p style="margin:0;font-size:13px;color:${BRAND.grayLight};">${escapeHtml(emptyLabel)}</p>` : '';
  }
  const imgs = media.map((m) => {
    const src = m.previewUrl ?? m.url;
    return `<div style="margin:6px 0;">
      <img src="${escapeHtml(src)}" alt="${escapeHtml(m.displayName ?? title)}" width="520" style="display:block;width:100%;max-width:520px;height:auto;border-radius:6px;border:1px solid ${BRAND.border};" />
    </div>`;
  }).join('');
  return `${renderSectionTitle(title)}${imgs}`;
}

export function renderPropertyFloorFloorplans(
  data: ShowcasePropertyFloorFloorplans | undefined,
  labels: PropertyShowcasePDFLabels,
): string {
  if (!data || data.media.length === 0) return '';
  const title = data.floorLabel
    ? `${labels.floorplans.floorSubtitle} — ${data.floorLabel}`
    : labels.floorplans.floorSubtitle;
  return renderMediaList(data.media, title);
}

export function renderSystems(p: SnapshotProperty, labels: PropertyShowcasePDFLabels): string {
  if (!p.systems) return '';
  const rows: RowsParam[] = [
    { label: labels.systems.heating, value: p.systems.heatingLabel ?? p.systems.heatingType },
    { label: labels.systems.heatingFuel, value: p.systems.heatingFuel },
    { label: labels.systems.cooling, value: p.systems.coolingLabel ?? p.systems.coolingType },
    { label: labels.systems.waterHeating, value: p.systems.waterHeating },
  ];
  const table = renderKeyValueTable(rows);
  if (!table) return '';
  return `${renderSectionTitle(labels.systems.sectionTitle)}${table}`;
}

export function renderFinishes(p: SnapshotProperty, labels: PropertyShowcasePDFLabels): string {
  if (!p.finishes) return '';
  const rows: RowsParam[] = [
    { label: labels.finishes.flooring, value: (p.finishes.flooringLabels ?? p.finishes.flooring ?? []).join(', ') || undefined },
    { label: labels.finishes.frames, value: p.finishes.windowFramesLabel ?? p.finishes.windowFrames },
    { label: labels.finishes.glazing, value: p.finishes.glazingLabel ?? p.finishes.glazing },
  ];
  const table = renderKeyValueTable(rows);
  if (!table) return '';
  return `${renderSectionTitle(labels.finishes.sectionTitle)}${table}`;
}

export function renderFeatures(p: SnapshotProperty, labels: PropertyShowcasePDFLabels): string {
  if (!p.features) return '';
  const rows: RowsParam[] = [
    { label: labels.features.interior, value: (p.features.interiorLabels ?? p.features.interior ?? []).join(', ') || undefined },
    { label: labels.features.security, value: (p.features.securityLabels ?? p.features.security ?? []).join(', ') || undefined },
    { label: labels.features.amenities, value: (p.features.amenities ?? []).join(', ') || undefined },
  ];
  const table = renderKeyValueTable(rows);
  if (!table) return '';
  return `${renderSectionTitle(labels.features.sectionTitle)}${table}`;
}

function renderLinkedSpaceItem(space: ShowcaseLinkedSpace, labels: ShowcaseLinkedSpacesLabels): string {
  const kindLabel = space.spaceType === 'parking' ? labels.parking : labels.storage;
  const bits = [
    space.allocationCode ? `<strong>${escapeHtml(space.allocationCode)}</strong>` : undefined,
    space.area ? `${space.area} τ.μ.` : undefined,
    space.floor ? `${escapeHtml(labels.floor)}: ${escapeHtml(space.floor)}` : undefined,
    space.inclusion ? `${escapeHtml(labels.inclusion)}: ${escapeHtml(labels.inclusions[space.inclusion as keyof typeof labels.inclusions] ?? space.inclusion)}` : undefined,
    typeof space.quantity === 'number' ? `${escapeHtml(labels.quantity)}: ${space.quantity}` : undefined,
  ].filter(Boolean);
  const body = bits.length > 0
    ? `<p style="margin:4px 0;font-size:13px;color:${BRAND.navyDark};">${bits.join(' · ')}</p>`
    : '';
  const desc = space.description
    ? `<p style="margin:4px 0;font-size:12px;color:${BRAND.grayLight};line-height:1.5;">${escapeHtml(space.description)}</p>`
    : '';
  return `<div style="padding:10px 0;border-bottom:1px solid ${BRAND.border};">
    <p style="margin:0;font-size:12px;color:${BRAND.grayLight};text-transform:uppercase;letter-spacing:0.05em;">${escapeHtml(kindLabel)}</p>
    ${body}${desc}
  </div>`;
}

export function renderLinkedSpaces(p: SnapshotProperty, labels: PropertyShowcasePDFLabels): string {
  if (!p.linkedSpaces || p.linkedSpaces.length === 0) return '';
  const items = p.linkedSpaces.map((s) => renderLinkedSpaceItem(s, labels.linkedSpaces)).join('');
  return `${renderSectionTitle(labels.linkedSpaces.sectionTitle)}<div>${items}</div>`;
}

export function renderLinkedSpaceFloorplans(
  data: ShowcaseLinkedSpaceFloorplans | undefined,
  labels: PropertyShowcasePDFLabels,
): string {
  if (!data) return '';
  const groups = [
    { list: data.parking, column: labels.linkedSpacesFloorplans.parkingColumn, empty: labels.linkedSpacesFloorplans.emptyParking },
    { list: data.storage, column: labels.linkedSpacesFloorplans.storageColumn, empty: labels.linkedSpacesFloorplans.emptyStorage },
  ];
  const blocks: string[] = [];
  for (const g of groups) {
    if (!g.list || g.list.length === 0) continue;
    const items = g.list.map((group) => {
      const code = group.allocationCode ?? labels.linkedSpacesFloorplans.unnamedSpace;
      const floorLabel = group.floorLabel ? ` — ${group.floorLabel}` : '';
      const media = [...(group.media ?? []), ...(group.floorFloorplans ?? [])];
      return renderMediaList(media, `${code}${floorLabel}`, '');
    }).join('');
    blocks.push(`<h3 style="margin:16px 0 8px;font-size:13px;color:${BRAND.grayLight};text-transform:uppercase;letter-spacing:0.05em;">${escapeHtml(g.column)}</h3>${items}`);
  }
  if (blocks.length === 0) return '';
  return `${renderSectionTitle(labels.linkedSpacesFloorplans.sectionTitle)}${blocks.join('')}`;
}

export function renderShareCta(shareUrl: string, ctaLabel: string): string {
  return `<div style="margin:28px 0 8px;text-align:center;">
    <a href="${escapeHtml(shareUrl)}" style="display:inline-block;background-color:${BRAND.navy};color:${BRAND.white};padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px;">${escapeHtml(ctaLabel)}</a>
  </div>`;
}
