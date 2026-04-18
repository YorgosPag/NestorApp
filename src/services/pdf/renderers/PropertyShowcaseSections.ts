/**
 * 🏢 Property Showcase — Section renderers (ADR-312 Phase 4)
 *
 * Pure PDF drawing primitives for every detail section surfaced by the
 * Πληροφορίες tab: project, commercial, systems, finishes, features,
 * linked spaces, views, energy extras, condition extras. The orchestrator
 * (`PropertyShowcaseRenderer`) composes these to keep each file under the
 * Google 500-LOC budget (CLAUDE.md N.7.1).
 *
 * Every draw function returns the next available `y` coordinate so the
 * orchestrator can chain sections without tracking layout internally.
 */

import type { IPDFDoc, Margins } from '../contracts';
import { TextRenderer } from './TextRenderer';
import { COLORS, FONT_SIZES, FONT_STYLES, FONTS } from '../layout';
import type { PropertyShowcaseSnapshot } from '@/services/property-showcase/snapshot-builder';
import type { PropertyShowcasePDFLabels } from '@/services/property-showcase/labels';
import type { ShowcasePhotoAsset } from './PropertyShowcaseRenderer';

export interface SectionContext {
  doc: IPDFDoc;
  margins: Margins;
  pageWidth: number;
  contentWidth: number;
  snapshot: PropertyShowcaseSnapshot;
  labels: PropertyShowcasePDFLabels;
  textRenderer: TextRenderer;
  /** Called when a section needs to start on a fresh page. */
  drawSectionTitle: (y: number, text: string) => number;
  /** Ensures `needed` mm is free on the current page; returns new y. */
  ensureSpace: (y: number, needed: number) => number;
  formatPrice: (value: number) => string;
  formatDate: (iso: string) => string;
}

type SpecRow = [label: string, value: string];

const LABEL_COLOR: [number, number, number] = [107, 114, 128];
const ROW_STEP = 6;

function drawKeyValueGrid(
  ctx: SectionContext,
  yStart: number,
  rows: SpecRow[],
): number {
  const { doc, margins, contentWidth } = ctx;
  if (rows.length === 0) return yStart;

  const columnGap = 8;
  const columnWidth = (contentWidth - columnGap) / 2;
  let y = yStart;

  doc.setFont(FONTS.UNICODE, FONT_STYLES.NORMAL);
  doc.setFontSize(FONT_SIZES.BODY);

  for (let i = 0; i < rows.length; i += 2) {
    y = ctx.ensureSpace(y, ROW_STEP);
    drawCell(doc, rows[i], margins.left, columnWidth, y);
    if (i + 1 < rows.length) {
      drawCell(doc, rows[i + 1], margins.left + columnWidth + columnGap, columnWidth, y);
    }
    y += ROW_STEP;
  }
  doc.setTextColor(...COLORS.BLACK);
  return y;
}

function drawCell(
  doc: IPDFDoc,
  [label, value]: SpecRow,
  x: number,
  width: number,
  y: number,
): void {
  doc.setTextColor(...LABEL_COLOR);
  doc.text(`${label}:`, x, y);
  doc.setTextColor(...COLORS.BLACK);
  doc.text(value || '-', x + width, y, { align: 'right' });
}

function drawTagList(
  ctx: SectionContext,
  yStart: number,
  labelText: string,
  items: readonly string[],
): number {
  const { textRenderer, doc, margins, pageWidth, contentWidth } = ctx;
  if (items.length === 0) return yStart;
  let y = ctx.ensureSpace(yStart, 8);
  y = textRenderer.addText({
    doc,
    text: `${labelText}:`,
    y,
    fontSize: FONT_SIZES.BODY,
    bold: true,
    color: LABEL_COLOR,
    margins,
    pageWidth,
  });
  y = textRenderer.addWrappedText({
    doc,
    text: items.join(' • '),
    y,
    fontSize: FONT_SIZES.BODY,
    maxWidth: contentWidth,
    margins,
    onPageBreak: () => margins.top,
  });
  return y + 2;
}

export function drawProjectSection(ctx: SectionContext, yStart: number): number {
  const project = ctx.snapshot.property.project;
  if (!project || (!project.name && !project.address)) return yStart;
  let y = ctx.ensureSpace(yStart, 20);
  y = ctx.drawSectionTitle(y, ctx.labels.project.sectionTitle);
  y += 2;
  const rows: SpecRow[] = [];
  if (project.name) rows.push([ctx.labels.project.name, project.name]);
  if (project.address) rows.push([ctx.labels.project.address, project.address]);
  y = drawKeyValueGrid(ctx, y, rows);
  return y + 2;
}

export function drawCommercialSection(ctx: SectionContext, yStart: number): number {
  const c = ctx.snapshot.property.commercial;
  if (!c) return yStart;
  let y = ctx.ensureSpace(yStart, 20);
  y = ctx.drawSectionTitle(y, ctx.labels.commercial.sectionTitle);
  y += 2;
  const rows: SpecRow[] = [];
  if (c.statusLabel || c.status) rows.push([ctx.labels.commercial.availability, c.statusLabel ?? c.status ?? '-']);
  if (c.operationalStatusLabel || c.operationalStatus)
    rows.push([ctx.labels.commercial.operational, c.operationalStatusLabel ?? c.operationalStatus ?? '-']);
  if (c.askingPrice !== undefined) rows.push([ctx.labels.commercial.price, ctx.formatPrice(c.askingPrice)]);
  y = drawKeyValueGrid(ctx, y, rows);
  return y + 2;
}

export function drawSystemsSection(ctx: SectionContext, yStart: number): number {
  const s = ctx.snapshot.property.systems;
  if (!s) return yStart;
  let y = ctx.ensureSpace(yStart, 20);
  y = ctx.drawSectionTitle(y, ctx.labels.systems.sectionTitle);
  y += 2;
  const rows: SpecRow[] = [];
  if (s.heatingLabel || s.heatingType)
    rows.push([ctx.labels.systems.heating, s.heatingLabel ?? s.heatingType ?? '-']);
  if (s.heatingFuel) rows.push([ctx.labels.systems.heatingFuel, s.heatingFuel]);
  if (s.coolingLabel || s.coolingType)
    rows.push([ctx.labels.systems.cooling, s.coolingLabel ?? s.coolingType ?? '-']);
  if (s.waterHeating) rows.push([ctx.labels.systems.waterHeating, s.waterHeating]);
  y = drawKeyValueGrid(ctx, y, rows);
  return y + 2;
}

export function drawFinishesSection(ctx: SectionContext, yStart: number): number {
  const f = ctx.snapshot.property.finishes;
  if (!f) return yStart;
  let y = ctx.ensureSpace(yStart, 20);
  y = ctx.drawSectionTitle(y, ctx.labels.finishes.sectionTitle);
  y += 2;
  const rows: SpecRow[] = [];
  const flooring = f.flooringLabels ?? f.flooring;
  if (flooring && flooring.length > 0)
    rows.push([ctx.labels.finishes.flooring, flooring.join(', ')]);
  if (f.windowFramesLabel || f.windowFrames)
    rows.push([ctx.labels.finishes.frames, f.windowFramesLabel ?? f.windowFrames ?? '-']);
  if (f.glazingLabel || f.glazing)
    rows.push([ctx.labels.finishes.glazing, f.glazingLabel ?? f.glazing ?? '-']);
  y = drawKeyValueGrid(ctx, y, rows);
  return y + 2;
}

export function drawFeaturesSection(ctx: SectionContext, yStart: number): number {
  const f = ctx.snapshot.property.features;
  if (!f) return yStart;
  let y = ctx.ensureSpace(yStart, 20);
  y = ctx.drawSectionTitle(y, ctx.labels.features.sectionTitle);
  y += 2;
  const interior = f.interiorLabels ?? f.interior ?? [];
  const security = f.securityLabels ?? f.security ?? [];
  const amenities = f.amenities ?? [];
  if (interior.length > 0) y = drawTagList(ctx, y, ctx.labels.features.interior, interior);
  if (security.length > 0) y = drawTagList(ctx, y, ctx.labels.features.security, security);
  if (amenities.length > 0) y = drawTagList(ctx, y, ctx.labels.features.amenities, amenities);
  return y + 2;
}

export function drawEnergyExtrasSection(ctx: SectionContext, yStart: number): number {
  const e = ctx.snapshot.property.energy;
  if (!e) return yStart;
  const hasAny = e.class || e.certificateId || e.certificateDate || e.validUntil;
  if (!hasAny) return yStart;
  let y = ctx.ensureSpace(yStart, 20);
  y = ctx.drawSectionTitle(y, ctx.labels.energy.sectionTitle);
  y += 2;
  const rows: SpecRow[] = [];
  if (e.class) rows.push([ctx.labels.energy.energyClass, e.class]);
  if (e.certificateId) rows.push([ctx.labels.energy.certificateId, e.certificateId]);
  if (e.certificateDate)
    rows.push([ctx.labels.energy.certificateDate, ctx.formatDate(e.certificateDate)]);
  if (e.validUntil) rows.push([ctx.labels.energy.validUntil, ctx.formatDate(e.validUntil)]);
  y = drawKeyValueGrid(ctx, y, rows);
  return y + 2;
}

export function drawLinkedSpacesSection(ctx: SectionContext, yStart: number): number {
  const spaces = ctx.snapshot.property.linkedSpaces;
  if (!spaces || spaces.length === 0) return yStart;
  let y = ctx.ensureSpace(yStart, 20);
  y = ctx.drawSectionTitle(y, ctx.labels.linkedSpaces.sectionTitle);
  y += 2;
  const rows: SpecRow[] = [];
  for (const s of spaces) {
    const typeLabel =
      s.spaceType === 'parking' ? ctx.labels.linkedSpaces.parking : ctx.labels.linkedSpaces.storage;
    const value = buildLinkedSpaceValue(ctx, s);
    rows.push([typeLabel, value]);
  }
  y = drawKeyValueGrid(ctx, y, rows);
  return y + 2;
}

function buildLinkedSpaceValue(
  ctx: SectionContext,
  s: NonNullable<PropertyShowcaseSnapshot['property']['linkedSpaces']>[number],
): string {
  const parts: string[] = [];
  if (s.allocationCode) parts.push(s.allocationCode);
  if (s.floor) parts.push(`${ctx.labels.linkedSpaces.floor}: ${s.floor}`);
  if (s.area !== undefined) parts.push(`${s.area} ${ctx.labels.specs.areaUnit}`);
  if (s.inclusion) {
    const inclusionLabel =
      ctx.labels.linkedSpaces.inclusions[
        s.inclusion as keyof typeof ctx.labels.linkedSpaces.inclusions
      ] ?? s.inclusion;
    parts.push(`(${inclusionLabel})`);
  }
  return parts.length > 0 ? parts.join(' · ') : '-';
}

export function drawOrientationSection(ctx: SectionContext, yStart: number): number {
  const p = ctx.snapshot.property;
  const items = p.orientationLabels && p.orientationLabels.length > 0
    ? p.orientationLabels
    : p.orientations;
  if (!items || items.length === 0) return yStart;
  let y = ctx.ensureSpace(yStart, 20);
  y = ctx.drawSectionTitle(y, ctx.labels.orientation.sectionTitle);
  y += 2;
  y = drawTagList(ctx, y, ctx.labels.orientation.sectionTitle, items);
  return y + 2;
}

export function drawViewsSection(ctx: SectionContext, yStart: number): number {
  const views = ctx.snapshot.property.views;
  if (!views || views.length === 0) return yStart;
  let y = ctx.ensureSpace(yStart, 20);
  y = ctx.drawSectionTitle(y, ctx.labels.chrome.viewsTitle);
  y += 2;
  const text = views
    .map((v) => (v.quality ? `${v.type} (${v.quality})` : v.type))
    .join(' • ');
  y = ctx.textRenderer.addWrappedText({
    doc: ctx.doc,
    text,
    y,
    fontSize: FONT_SIZES.BODY,
    maxWidth: ctx.contentWidth,
    margins: ctx.margins,
    onPageBreak: () => ctx.margins.top,
  });
  return y + 2;
}

export function buildSpecsRows(
  snapshot: PropertyShowcaseSnapshot,
  labels: PropertyShowcasePDFLabels,
  formatDate: (iso: string) => string,
): SpecRow[] {
  const p = snapshot.property;
  const unit = labels.specs.areaUnit;
  const rows: SpecRow[] = [];

  rows.push([labels.specs.type, p.typeLabel || p.type || '-']);
  rows.push([labels.specs.code, p.code || '-']);
  rows.push([labels.specs.building, p.building || '-']);
  rows.push([labels.specs.floor, p.floor !== undefined ? String(p.floor) : '-']);

  if (p.areas?.gross !== undefined) rows.push([labels.specs.grossArea, `${p.areas.gross} ${unit}`]);
  if (p.areas?.net !== undefined) rows.push([labels.specs.netArea, `${p.areas.net} ${unit}`]);
  if (p.areas?.balcony !== undefined) rows.push([labels.specs.balcony, `${p.areas.balcony} ${unit}`]);
  if (p.areas?.terrace !== undefined) rows.push([labels.specs.terrace, `${p.areas.terrace} ${unit}`]);
  if (p.areas?.garden !== undefined) rows.push([labels.specs.garden, `${p.areas.garden} ${unit}`]);
  if (p.areas?.millesimalShares !== undefined)
    rows.push([labels.specs.millesimalShares, `${p.areas.millesimalShares}‰`]);

  if (p.layout?.bedrooms !== undefined) rows.push([labels.specs.bedrooms, String(p.layout.bedrooms)]);
  if (p.layout?.bathrooms !== undefined)
    rows.push([labels.specs.bathrooms, String(p.layout.bathrooms)]);
  if (p.layout?.wc !== undefined) rows.push([labels.specs.wc, String(p.layout.wc)]);
  if (p.layout?.totalRooms !== undefined)
    rows.push([labels.specs.totalRooms, String(p.layout.totalRooms)]);
  if (p.layout?.balconies !== undefined)
    rows.push([labels.specs.balconies, String(p.layout.balconies)]);

  if (p.condition?.conditionLabel || p.condition?.condition)
    rows.push([
      labels.specs.condition,
      p.condition.conditionLabel ?? p.condition.condition ?? '-',
    ]);
  if (p.condition?.renovationYear !== undefined)
    rows.push([labels.specs.renovationYear, String(p.condition.renovationYear)]);
  if (p.condition?.deliveryDate)
    rows.push([labels.specs.deliveryDate, formatDate(p.condition.deliveryDate)]);

  return rows;
}

export function drawSpecsSection(ctx: SectionContext, yStart: number): number {
  let y = ctx.ensureSpace(yStart, 20);
  y = ctx.drawSectionTitle(y, ctx.labels.specs.title);
  y += 2;
  const rows = buildSpecsRows(ctx.snapshot, ctx.labels, ctx.formatDate);
  y = drawKeyValueGrid(ctx, y, rows);
  return y + 2;
}

// =============================================================================
// 🏢 LINKED-SPACES FLOORPLANS — two-column raster page (ADR-312 Phase 7)
// =============================================================================

export interface LinkedSpaceFloorplansGroup {
  allocationCode?: string;
  assets: ShowcasePhotoAsset[];
}

export interface LinkedSpaceFloorplansPdfData {
  parking: LinkedSpaceFloorplansGroup[];
  storage: LinkedSpaceFloorplansGroup[];
}

const LINKED_COLUMN_GAP = 6;
const LINKED_GROUP_HEADER_HEIGHT = 6;
const LINKED_GROUP_SPACING = 4;
const LINKED_TILE_ASPECT = 2 / 3;

/**
 * Render a standalone page with Κατόψεις for every linked parking spot and
 * storage unit. Two side-by-side columns (parking left, storage right). Each
 * group emits `allocationCode` as a sub-header followed by its rasterised
 * thumbnails stacked vertically inside the column.
 */
export function drawLinkedSpacesFloorplansSection(
  ctx: SectionContext,
  data: LinkedSpaceFloorplansPdfData,
): void {
  if (data.parking.length === 0 && data.storage.length === 0) return;

  ctx.doc.addPage();
  let y = ctx.margins.top;
  y = ctx.drawSectionTitle(y, ctx.labels.linkedSpacesFloorplans.sectionTitle);
  y += 4;

  const columnWidth = (ctx.contentWidth - LINKED_COLUMN_GAP) / 2;
  const leftX = ctx.margins.left;
  const rightX = ctx.margins.left + columnWidth + LINKED_COLUMN_GAP;

  drawColumnHeader(ctx, leftX, y, columnWidth, ctx.labels.linkedSpacesFloorplans.parkingColumn);
  drawColumnHeader(ctx, rightX, y, columnWidth, ctx.labels.linkedSpacesFloorplans.storageColumn);

  const columnTop = y + LINKED_GROUP_HEADER_HEIGHT + 2;
  const pageBottom = ctx.doc.pageSize.height - ctx.margins.bottom - 12;

  drawGroupColumn({
    ctx,
    x: leftX,
    yStart: columnTop,
    width: columnWidth,
    maxY: pageBottom,
    groups: data.parking,
    emptyLabel: ctx.labels.linkedSpacesFloorplans.emptyParking,
    unnamedLabel: ctx.labels.linkedSpacesFloorplans.unnamedSpace,
  });
  drawGroupColumn({
    ctx,
    x: rightX,
    yStart: columnTop,
    width: columnWidth,
    maxY: pageBottom,
    groups: data.storage,
    emptyLabel: ctx.labels.linkedSpacesFloorplans.emptyStorage,
    unnamedLabel: ctx.labels.linkedSpacesFloorplans.unnamedSpace,
  });
}

function drawColumnHeader(
  ctx: SectionContext,
  x: number,
  y: number,
  width: number,
  text: string,
): void {
  ctx.doc.setFillColor(...COLORS.GRAY);
  ctx.doc.rect(x, y - 4, width, LINKED_GROUP_HEADER_HEIGHT, 'F');
  ctx.doc.setFont(FONTS.UNICODE, FONT_STYLES.BOLD);
  ctx.doc.setFontSize(FONT_SIZES.SMALL);
  ctx.doc.setTextColor(...COLORS.BLACK);
  ctx.doc.text(text, x + 1, y);
}

interface DrawGroupColumnArgs {
  ctx: SectionContext;
  x: number;
  yStart: number;
  width: number;
  maxY: number;
  groups: LinkedSpaceFloorplansGroup[];
  emptyLabel: string;
  unnamedLabel: string;
}

function drawGroupColumn(args: DrawGroupColumnArgs): void {
  const { ctx, x, yStart, width, maxY, groups, emptyLabel, unnamedLabel } = args;
  if (groups.length === 0) {
    ctx.doc.setFont(FONTS.UNICODE, FONT_STYLES.NORMAL);
    ctx.doc.setFontSize(FONT_SIZES.BODY);
    ctx.doc.setTextColor(107, 114, 128);
    ctx.doc.text(emptyLabel, x, yStart + 4);
    ctx.doc.setTextColor(...COLORS.BLACK);
    return;
  }

  const tileHeight = width * LINKED_TILE_ASPECT;
  let y = yStart;

  for (const group of groups) {
    if (y + LINKED_GROUP_HEADER_HEIGHT + tileHeight > maxY) return;

    ctx.doc.setFont(FONTS.UNICODE, FONT_STYLES.BOLD);
    ctx.doc.setFontSize(FONT_SIZES.BODY);
    ctx.doc.setTextColor(...COLORS.BLACK);
    ctx.doc.text(group.allocationCode || unnamedLabel, x, y + 4);
    y += LINKED_GROUP_HEADER_HEIGHT;

    const asset = group.assets[0];
    if (asset) {
      try {
        ctx.doc.addImage(asset.bytes, asset.format, x, y, width, tileHeight, asset.id, 'FAST');
      } catch (err) {
        ctx.doc.setDrawColor(...COLORS.GRAY);
        ctx.doc.rect(x, y, width, tileHeight, 'S');
        console.error('[PropertyShowcaseRenderer] linked-space floorplan addImage failed', {
          assetId: asset.id,
          format: asset.format,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    } else {
      ctx.doc.setDrawColor(...COLORS.GRAY);
      ctx.doc.rect(x, y, width, tileHeight, 'S');
    }
    y += tileHeight + LINKED_GROUP_SPACING;
  }
}
