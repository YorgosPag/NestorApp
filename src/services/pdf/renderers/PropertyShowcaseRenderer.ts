/**
 * 🏢 ENTERPRISE: Property Showcase PDF Renderer (ADR-312 Phase 4)
 *
 * Branded multi-page PDF for a property showcase:
 * - Cover page: brand header, title, description, photo grid
 * - Specs page: identity/areas/layout/orientation/condition/energy (SSoT SpecsRows)
 * - Detail page(s): project, commercial, systems, finishes, features, linked spaces,
 *   energy extras, views — full parity with the Πληροφορίες tab
 * - Floorplan page: embedded raster plans
 * - Footer on every page
 *
 * Section drawing lives in `PropertyShowcaseSections` (SRP split — keeps this
 * orchestrator under the Google 500-LOC budget). All labels come from the
 * server-side i18n SSoT `labels` module; enum data from `snapshot-builder`.
 */

import type { IPDFDoc, Margins } from '../contracts';
import { TextRenderer } from './TextRenderer';
import { COLORS, FONT_SIZES, FONTS } from '../layout';
import {
  drawMediaGridPage,
  PHOTO_GRID_CONFIG,
  FLOORPLAN_GRID_CONFIG,
} from './PropertyShowcaseMediaGrid';
import type { PropertyShowcaseSnapshot } from '@/services/property-showcase/snapshot-builder';
import type { PropertyShowcasePDFLabels } from '@/services/property-showcase/labels';
import {
  drawProjectSection,
  drawCommercialSection,
  drawSystemsSection,
  drawFinishesSection,
  drawFeaturesSection,
  drawEnergyExtrasSection,
  drawLinkedSpacesSection,
  drawLinkedSpacesFloorplansSection,
  drawViewsSection,
  drawSpecsSection,
  drawOrientationSection,
  type SectionContext,
  type LinkedSpaceFloorplansPdfData,
} from './PropertyShowcaseSections';

export interface ShowcasePhotoAsset {
  id: string;
  bytes: Uint8Array;
  format: 'JPEG' | 'PNG';
  displayName?: string;
}

export interface PropertyShowcasePDFData {
  snapshot: PropertyShowcaseSnapshot;
  showcaseUrl: string;
  videoUrl?: string;
  photoCount?: number;
  floorplanCount?: number;
  photos?: ShowcasePhotoAsset[];
  floorplans?: ShowcasePhotoAsset[];
  /** Κατόψεις of linked parking/storage (ADR-312 Phase 7). */
  linkedSpaceFloorplans?: LinkedSpaceFloorplansPdfData;
  generatedAt: Date;
  labels: PropertyShowcasePDFLabels;
  locale: 'el' | 'en';
}

// Re-export for downstream consumers that still import from this module.
export type { PropertyShowcasePDFLabels };

const VIOLET: [number, number, number] = [124, 58, 237];

function safe(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return '-';
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : '-';
}

function formatDate(iso: string, locale: 'el' | 'en' = 'el'): string {
  if (!iso) return '-';
  const parts = iso.slice(0, 10).split('-');
  if (parts.length !== 3) return iso;
  const [year, month, day] = parts;
  return locale === 'el' ? `${day}/${month}/${year}` : `${year}-${month}-${day}`;
}

function formatPrice(value: number, locale: 'el' | 'en' = 'el'): string {
  const formatter = new Intl.NumberFormat(locale === 'el' ? 'el-GR' : 'en-US', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  });
  return formatter.format(value);
}

export class PropertyShowcaseRenderer {
  // Showcase PDFs must render Greek labels + user content, so the renderer
  // is pinned to the Unicode font (Roboto Identity-H) registered by
  // `PropertyShowcasePDFService` via `registerGreekFont()`. Without this,
  // `TextRenderer` falls back to Helvetica (no Greek glyphs) and every
  // label turns into gibberish (incident 2026-04-17).
  private textRenderer = new TextRenderer({ font: FONTS.UNICODE });

  render(doc: IPDFDoc, margins: Margins, data: PropertyShowcasePDFData): void {
    const pageWidth = doc.pageSize.width;
    const contentWidth = pageWidth - margins.left - margins.right;
    const y = margins.top;

    // ── 1. Cover: brand header only ────────────────────────────────────────
    this.drawBrandHeader(doc, y, margins, pageWidth, contentWidth, data);

    // ── 2–3. Project + Commercial ──────────────────────────────────────────
    this.drawOverviewPage(doc, margins, pageWidth, contentWidth, data);

    // ── 4. Description ─────────────────────────────────────────────────────
    this.drawDescriptionPage(doc, margins, pageWidth, contentWidth, data);

    // ── 5. Photos ──────────────────────────────────────────────────────────
    drawMediaGridPage({
      doc, margins, pageWidth, contentWidth,
      assets: data.photos ?? [],
      sectionTitle: data.labels.chrome.photosTitle,
      drawSectionTitle: (d, yy, m, pw, cw, t) => this.drawSectionTitle(d, yy, m, pw, cw, t),
      config: PHOTO_GRID_CONFIG,
    });

    // ── 6. Video — not embeddable in PDF, skipped on purpose ───────────────

    // ── 7–9. Specs + Orientation + Linked spaces ───────────────────────────
    this.drawSpecsBlockPage(doc, margins, pageWidth, contentWidth, data);

    // ── 10. Linked-space Κατόψεις (parking + storage side-by-side) ─────────
    this.drawLinkedSpacesFloorplansPage(doc, margins, pageWidth, contentWidth, data);

    // ── 11–12. Energy + Views ──────────────────────────────────────────────
    this.drawEnergyAndViewsPage(doc, margins, pageWidth, contentWidth, data);

    // ── 13. Floorplans (property) ──────────────────────────────────────────
    drawMediaGridPage({
      doc, margins, pageWidth, contentWidth,
      assets: data.floorplans ?? [],
      sectionTitle: data.labels.chrome.floorplansTitle,
      drawSectionTitle: (d, yy, m, pw, cw, t) => this.drawSectionTitle(d, yy, m, pw, cw, t),
      config: FLOORPLAN_GRID_CONFIG,
    });

    // ── 12–14. Systems + Finishes + Features ───────────────────────────────
    this.drawSystemsBlockPage(doc, margins, pageWidth, contentWidth, data);

    this.drawFooter(doc, margins, pageWidth, data);
  }

  private buildSectionContext(
    doc: IPDFDoc,
    margins: Margins,
    pageWidth: number,
    contentWidth: number,
    data: PropertyShowcasePDFData,
  ): SectionContext {
    const pageHeight = doc.pageSize.height;
    const bottomGuard = pageHeight - margins.bottom - 12;
    const ensureSpace = (y: number, needed: number): number => {
      if (y + needed <= bottomGuard) return y;
      doc.addPage();
      return margins.top;
    };
    return {
      doc,
      margins,
      pageWidth,
      contentWidth,
      snapshot: data.snapshot,
      labels: data.labels,
      textRenderer: this.textRenderer,
      drawSectionTitle: (y, text) =>
        this.drawSectionTitle(doc, y, margins, pageWidth, contentWidth, text),
      ensureSpace,
      formatPrice: (v) => formatPrice(v, data.locale),
      formatDate: (iso) => formatDate(iso, data.locale),
    };
  }

  private drawDescriptionPage(
    doc: IPDFDoc,
    margins: Margins,
    pageWidth: number,
    contentWidth: number,
    data: PropertyShowcasePDFData,
  ): void {
    doc.addPage();
    let y = margins.top;
    y = this.drawTitle(doc, y, margins, pageWidth, data);
    y += 6;
    this.drawDescription(doc, y, margins, pageWidth, contentWidth, data);
  }

  private drawBrandHeader(
    doc: IPDFDoc,
    y: number,
    margins: Margins,
    pageWidth: number,
    contentWidth: number,
    data: PropertyShowcasePDFData,
  ): number {
    doc.setFillColor(...VIOLET);
    doc.rect(margins.left, y - 5, contentWidth, 18, 'F');

    let current = this.textRenderer.addText({
      doc,
      text: safe(data.snapshot.company.name),
      y: y + 1,
      align: 'center',
      fontSize: FONT_SIZES.H3,
      bold: true,
      color: COLORS.WHITE,
      margins,
      pageWidth,
    });

    current = this.textRenderer.addText({
      doc,
      text: data.labels.chrome.title,
      y: current + 1,
      align: 'center',
      fontSize: FONT_SIZES.SMALL,
      color: COLORS.WHITE,
      margins,
      pageWidth,
    });

    return current + 4;
  }

  private drawTitle(
    doc: IPDFDoc,
    y: number,
    margins: Margins,
    pageWidth: number,
    data: PropertyShowcasePDFData,
  ): number {
    const p = data.snapshot.property;
    let current = this.textRenderer.addText({
      doc,
      text: safe(p.name),
      y,
      align: 'center',
      fontSize: FONT_SIZES.H2,
      bold: true,
      margins,
      pageWidth,
    });

    if (p.code) {
      current = this.textRenderer.addText({
        doc,
        text: `${data.labels.specs.code}: ${p.code}`,
        y: current + 1,
        align: 'center',
        fontSize: FONT_SIZES.BODY,
        margins,
        pageWidth,
      });
    }
    return current;
  }

  private drawDescription(
    doc: IPDFDoc,
    yStart: number,
    margins: Margins,
    pageWidth: number,
    contentWidth: number,
    data: PropertyShowcasePDFData,
  ): number {
    const description = data.snapshot.property.description;
    if (!description) return yStart;
    let y = this.drawSectionTitle(
      doc, yStart, margins, pageWidth, contentWidth, data.labels.chrome.descriptionSection,
    );
    y = this.textRenderer.addWrappedText({
      doc,
      text: description,
      y,
      fontSize: FONT_SIZES.BODY,
      maxWidth: contentWidth,
      margins,
      onPageBreak: () => margins.top,
    });
    return y;
  }

  private drawOverviewPage(
    doc: IPDFDoc,
    margins: Margins,
    pageWidth: number,
    contentWidth: number,
    data: PropertyShowcasePDFData,
  ): void {
    doc.addPage();
    const ctx = this.buildSectionContext(doc, margins, pageWidth, contentWidth, data);
    let y = margins.top;
    y = drawProjectSection(ctx, y);
    drawCommercialSection(ctx, y);
  }

  private drawSpecsBlockPage(
    doc: IPDFDoc,
    margins: Margins,
    pageWidth: number,
    contentWidth: number,
    data: PropertyShowcasePDFData,
  ): void {
    doc.addPage();
    const ctx = this.buildSectionContext(doc, margins, pageWidth, contentWidth, data);
    let y = margins.top;
    y = drawSpecsSection(ctx, y);
    y = drawOrientationSection(ctx, y);
    drawLinkedSpacesSection(ctx, y);
  }

  private drawLinkedSpacesFloorplansPage(
    doc: IPDFDoc,
    margins: Margins,
    pageWidth: number,
    contentWidth: number,
    data: PropertyShowcasePDFData,
  ): void {
    const linked = data.linkedSpaceFloorplans;
    if (!linked || (linked.parking.length === 0 && linked.storage.length === 0)) return;
    const ctx = this.buildSectionContext(doc, margins, pageWidth, contentWidth, data);
    drawLinkedSpacesFloorplansSection(ctx, linked);
  }

  private drawEnergyAndViewsPage(
    doc: IPDFDoc,
    margins: Margins,
    pageWidth: number,
    contentWidth: number,
    data: PropertyShowcasePDFData,
  ): void {
    const hasEnergy = Boolean(data.snapshot.property.energy);
    const hasViews = (data.snapshot.property.views ?? []).length > 0;
    if (!hasEnergy && !hasViews) return;
    doc.addPage();
    const ctx = this.buildSectionContext(doc, margins, pageWidth, contentWidth, data);
    let y = margins.top;
    y = drawEnergyExtrasSection(ctx, y);
    drawViewsSection(ctx, y);
  }

  private drawSystemsBlockPage(
    doc: IPDFDoc,
    margins: Margins,
    pageWidth: number,
    contentWidth: number,
    data: PropertyShowcasePDFData,
  ): void {
    doc.addPage();
    const ctx = this.buildSectionContext(doc, margins, pageWidth, contentWidth, data);
    let y = margins.top;
    y = drawSystemsSection(ctx, y);
    y = drawFinishesSection(ctx, y);
    drawFeaturesSection(ctx, y);
  }

  private drawFooter(
    doc: IPDFDoc,
    margins: Margins,
    pageWidth: number,
    data: PropertyShowcasePDFData,
  ): void {
    const pageHeight = doc.pageSize.height;
    const footerY = pageHeight - margins.bottom;
    const brand = data.snapshot.company;
    const contact = [brand.phone, brand.email, brand.website]
      .filter((value): value is string => Boolean(value))
      .join(' · ');
    const footerLine = `${data.labels.chrome.footerNote} · ${data.labels.chrome.generatedOn} ${formatDate(
      data.generatedAt.toISOString(),
      data.locale,
    )}`;

    // Stamp contact + footerLine on EVERY page so the photo-grid page also
    // carries branding/expiry context. Without this loop jsPDF only writes
    // on the active page.
    const totalPages = doc.getNumberOfPages();
    for (let n = 1; n <= totalPages; n++) {
      doc.setPage(n);
      if (contact) {
        this.textRenderer.addText({
          doc, text: contact, y: footerY - 8, align: 'center',
          fontSize: FONT_SIZES.SMALL, margins, pageWidth,
        });
      }
      this.textRenderer.addText({
        doc, text: footerLine, y: footerY - 3, align: 'center',
        fontSize: FONT_SIZES.SMALL, margins, pageWidth,
      });
    }
  }

  private drawSectionTitle(
    doc: IPDFDoc,
    y: number,
    margins: Margins,
    pageWidth: number,
    contentWidth: number,
    text: string,
  ): number {
    doc.setFillColor(...COLORS.GRAY);
    doc.rect(margins.left, y - 4, contentWidth, 7, 'F');
    return this.textRenderer.addText({
      doc,
      text,
      y,
      align: 'left',
      fontSize: FONT_SIZES.SMALL,
      bold: true,
      margins,
      pageWidth,
    }) + 1;
  }
}
