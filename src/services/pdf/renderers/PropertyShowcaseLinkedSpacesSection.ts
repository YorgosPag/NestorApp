/**
 * 🏢 Property Showcase — Linked spaces section (ADR-312 Phase 7.6)
 *
 * Estratta da PropertyShowcaseSections.ts per rispettare il budget 500-LOC
 * (CLAUDE.md N.7.1) dopo l'aggiunta del blocco description free-form per
 * ogni parking/storage linked (alimentato dalla SSoT DescriptionNotesCard
 * — ADR-194 Phase 2). La description è un campo del doc Firestore
 * `parking_spots.description` / `storage_units.description` esposto nello
 * snapshot come `ShowcaseLinkedSpace.description`.
 */

import { FONT_SIZES } from '../layout';
import type { PropertyShowcaseSnapshot } from '@/services/property-showcase/snapshot-builder';
import { drawKeyValueGrid, type SectionContext, type SpecRow } from './PropertyShowcaseSections';

export function drawLinkedSpacesSection(ctx: SectionContext, yStart: number): number {
  const spaces = ctx.snapshot.property.linkedSpaces;
  if (!spaces || spaces.length === 0) return yStart;
  let y = ctx.ensureSpace(yStart, 20);
  y = ctx.drawSectionTitle(y, ctx.labels.linkedSpaces.sectionTitle);
  y += 2;
  for (const s of spaces) {
    const typeLabel =
      s.spaceType === 'parking'
        ? ctx.labels.linkedSpaces.parking
        : ctx.labels.linkedSpaces.storage;
    const value = buildLinkedSpaceValue(ctx, s);
    const row: SpecRow = [typeLabel, value];
    y = drawKeyValueGrid(ctx, y, [row]);
    if (s.description) {
      y = ctx.textRenderer.addWrappedText({
        doc: ctx.doc,
        text: s.description,
        y,
        fontSize: FONT_SIZES.BODY,
        maxWidth: ctx.contentWidth,
        margins: ctx.margins,
        onPageBreak: () => ctx.margins.top,
      });
      y += 1;
    }
  }
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
