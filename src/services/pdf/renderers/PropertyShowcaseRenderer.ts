/**
 * 🏢 ENTERPRISE: Property Showcase PDF Renderer (ADR-312)
 *
 * Renders a branded single-page PDF for a property showcase. Draws:
 * - Branded header (company name, generation date)
 * - Title (property name + code)
 * - Specs table (type, location, areas, layout, energy, condition)
 * - Features list (comma-separated)
 * - Short description
 * - Showcase URL (rich web page with photos/floorplans/video)
 * - Footer (contact + share token note)
 *
 * Delegates primitives to TextRenderer. No image embedding — the rich page
 * shows photos/floorplans/video. PDF is the printable summary.
 */

import type { IPDFDoc, Margins } from '../contracts';
import { TextRenderer } from './TextRenderer';
import { COLORS, FONT_SIZES, FONTS, LINE_SPACING } from '../layout';
import {
  drawMediaGridPage,
  PHOTO_GRID_CONFIG,
  FLOORPLAN_GRID_CONFIG,
} from './PropertyShowcaseMediaGrid';

export interface ShowcasePhotoAsset {
  id: string;
  bytes: Uint8Array;
  format: 'JPEG' | 'PNG';
  displayName?: string;
}

export interface PropertyShowcasePDFData {
  property: {
    id: string;
    code?: string;
    name: string;
    type?: string;
    typeLabel?: string;
    building?: string;
    floor?: number;
    description?: string;
    layout?: {
      bedrooms?: number;
      bathrooms?: number;
      wc?: number;
    };
    areas?: {
      gross?: number;
      net?: number;
      balcony?: number;
      terrace?: number;
    };
    orientations?: string[];
    energyClass?: string;
    condition?: string;
    features?: string[];
  };
  company: {
    name: string;
    phone?: string;
    email?: string;
    website?: string;
  };
  showcaseUrl: string;
  videoUrl?: string;
  photoCount?: number;
  floorplanCount?: number;
  photos?: ShowcasePhotoAsset[];
  floorplans?: ShowcasePhotoAsset[];
  generatedAt: Date;
  labels: PropertyShowcasePDFLabels;
}

export interface PropertyShowcasePDFLabels {
  headerTitle: string;
  generatedOn: string;
  specsSection: string;
  featuresSection: string;
  descriptionSection: string;
  photosSection: string;
  floorplansSection: string;
  fieldType: string;
  fieldBuilding: string;
  fieldFloor: string;
  fieldCode: string;
  fieldGrossArea: string;
  fieldNetArea: string;
  fieldBalcony: string;
  fieldTerrace: string;
  fieldBedrooms: string;
  fieldBathrooms: string;
  fieldWc: string;
  fieldOrientation: string;
  fieldEnergyClass: string;
  fieldCondition: string;
  areaUnit: string;
  footerNote: string;
}

const VIOLET: [number, number, number] = [124, 58, 237];

const safe = (value: string | number | undefined | null): string => {
  if (value === undefined || value === null) return '-';
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : '-';
};

const formatDate = (date: Date, locale: 'el' | 'en' = 'el'): string => {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return locale === 'el' ? `${day}/${month}/${year}` : `${year}-${month}-${day}`;
};

export class PropertyShowcaseRenderer {
  // Showcase PDFs must render Greek labels + user content, so the renderer
  // is pinned to the Unicode font (Roboto Identity-H) registered by
  // `PropertyShowcasePDFService` via `registerGreekFont()`. Without this,
  // `TextRenderer` falls back to Helvetica (no Greek glyphs) and every
  // label turns into gibberish (incident 2026-04-17).
  private textRenderer = new TextRenderer({ font: FONTS.UNICODE });

  render(
    doc: IPDFDoc,
    margins: Margins,
    data: PropertyShowcasePDFData
  ): void {
    const pageWidth = doc.pageSize.width;
    const contentWidth = pageWidth - margins.left - margins.right;
    let y = margins.top;

    // Section order mirrors the public showcase web page
    // (src/components/property-showcase/ShowcaseClient.tsx): brand header →
    // name + description → photos → specs → floorplans. Phase 3.3 (ADR-312).
    y = this.drawBrandHeader(doc, y, margins, pageWidth, contentWidth, data);
    y += 8;
    y = this.drawTitle(doc, y, margins, pageWidth, data);
    y += 6;
    this.drawDescription(doc, y, margins, pageWidth, contentWidth, data);
    this.drawPhotoGrid(doc, margins, pageWidth, contentWidth, data);
    this.drawSpecsPage(doc, margins, pageWidth, contentWidth, data);
    this.drawFloorplanGrid(doc, margins, pageWidth, contentWidth, data);
    this.drawFooter(doc, margins, pageWidth, data);
  }

  private drawBrandHeader(
    doc: IPDFDoc,
    y: number,
    margins: Margins,
    pageWidth: number,
    contentWidth: number,
    data: PropertyShowcasePDFData
  ): number {
    doc.setFillColor(...VIOLET);
    doc.rect(margins.left, y - 5, contentWidth, 18, 'F');

    let current = this.textRenderer.addText({
      doc,
      text: safe(data.company.name),
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
      text: data.labels.headerTitle,
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
    data: PropertyShowcasePDFData
  ): number {
    let current = this.textRenderer.addText({
      doc,
      text: safe(data.property.name),
      y,
      align: 'center',
      fontSize: FONT_SIZES.H2,
      bold: true,
      margins,
      pageWidth,
    });

    if (data.property.code) {
      current = this.textRenderer.addText({
        doc,
        text: `${data.labels.fieldCode}: ${data.property.code}`,
        y: current + 1,
        align: 'center',
        fontSize: FONT_SIZES.BODY,
        margins,
        pageWidth,
      });
    }
    return current;
  }

  private drawSpecs(
    doc: IPDFDoc,
    yStart: number,
    margins: Margins,
    pageWidth: number,
    contentWidth: number,
    data: PropertyShowcasePDFData
  ): number {
    let y = this.drawSectionTitle(doc, yStart, margins, pageWidth, contentWidth, data.labels.specsSection);
    const p = data.property;
    const unit = data.labels.areaUnit;

    const rows: Array<[string, string]> = [
      [data.labels.fieldType, safe(p.typeLabel || p.type)],
      [data.labels.fieldBuilding, safe(p.building)],
      [data.labels.fieldFloor, p.floor !== undefined ? String(p.floor) : '-'],
      [data.labels.fieldGrossArea, p.areas?.gross ? `${p.areas.gross} ${unit}` : '-'],
      [data.labels.fieldNetArea, p.areas?.net ? `${p.areas.net} ${unit}` : '-'],
      [data.labels.fieldBalcony, p.areas?.balcony ? `${p.areas.balcony} ${unit}` : '-'],
      [data.labels.fieldTerrace, p.areas?.terrace ? `${p.areas.terrace} ${unit}` : '-'],
      [data.labels.fieldBedrooms, p.layout?.bedrooms !== undefined ? String(p.layout.bedrooms) : '-'],
      [data.labels.fieldBathrooms, p.layout?.bathrooms !== undefined ? String(p.layout.bathrooms) : '-'],
      [data.labels.fieldWc, p.layout?.wc !== undefined ? String(p.layout.wc) : '-'],
      [data.labels.fieldOrientation, p.orientations?.length ? p.orientations.join(', ') : '-'],
      [data.labels.fieldEnergyClass, safe(p.energyClass)],
      [data.labels.fieldCondition, safe(p.condition)],
    ];

    for (const [label, value] of rows) {
      y = this.drawField(doc, y, margins, pageWidth, contentWidth, label, value);
    }
    return y;
  }

  private drawFeatures(
    doc: IPDFDoc,
    yStart: number,
    margins: Margins,
    pageWidth: number,
    contentWidth: number,
    data: PropertyShowcasePDFData
  ): number {
    if (!data.property.features || data.property.features.length === 0) {
      return yStart;
    }
    let y = this.drawSectionTitle(doc, yStart, margins, pageWidth, contentWidth, data.labels.featuresSection);
    y = this.textRenderer.addWrappedText({
      doc,
      text: data.property.features.join(' • '),
      y,
      fontSize: FONT_SIZES.BODY,
      maxWidth: contentWidth,
      margins,
      onPageBreak: () => margins.top,
    });
    return y;
  }

  private drawDescription(
    doc: IPDFDoc,
    yStart: number,
    margins: Margins,
    pageWidth: number,
    contentWidth: number,
    data: PropertyShowcasePDFData
  ): number {
    if (!data.property.description) return yStart;
    let y = this.drawSectionTitle(doc, yStart, margins, pageWidth, contentWidth, data.labels.descriptionSection);
    y = this.textRenderer.addWrappedText({
      doc,
      text: data.property.description,
      y,
      fontSize: FONT_SIZES.BODY,
      maxWidth: contentWidth,
      margins,
      onPageBreak: () => margins.top,
    });
    return y;
  }

  private drawSpecsPage(
    doc: IPDFDoc,
    margins: Margins,
    pageWidth: number,
    contentWidth: number,
    data: PropertyShowcasePDFData
  ): void {
    doc.addPage();
    let y = margins.top;
    y = this.drawSpecs(doc, y, margins, pageWidth, contentWidth, data);
    y += 4;
    this.drawFeatures(doc, y, margins, pageWidth, contentWidth, data);
  }

  private drawPhotoGrid(
    doc: IPDFDoc,
    margins: Margins,
    pageWidth: number,
    contentWidth: number,
    data: PropertyShowcasePDFData
  ): void {
    drawMediaGridPage({
      doc, margins, pageWidth, contentWidth,
      assets: data.photos ?? [],
      sectionTitle: data.labels.photosSection,
      drawSectionTitle: (d, y, m, pw, cw, t) => this.drawSectionTitle(d, y, m, pw, cw, t),
      config: PHOTO_GRID_CONFIG,
    });
  }

  private drawFloorplanGrid(
    doc: IPDFDoc,
    margins: Margins,
    pageWidth: number,
    contentWidth: number,
    data: PropertyShowcasePDFData
  ): void {
    drawMediaGridPage({
      doc, margins, pageWidth, contentWidth,
      assets: data.floorplans ?? [],
      sectionTitle: data.labels.floorplansSection,
      drawSectionTitle: (d, y, m, pw, cw, t) => this.drawSectionTitle(d, y, m, pw, cw, t),
      config: FLOORPLAN_GRID_CONFIG,
    });
  }

  private drawFooter(
    doc: IPDFDoc,
    margins: Margins,
    pageWidth: number,
    data: PropertyShowcasePDFData
  ): void {
    const pageHeight = doc.pageSize.height;
    const footerY = pageHeight - margins.bottom;
    const contact = [data.company.phone, data.company.email, data.company.website]
      .filter((value): value is string => Boolean(value))
      .join(' · ');
    const footerLine = `${data.labels.footerNote} · ${data.labels.generatedOn} ${formatDate(data.generatedAt)}`;

    // Stamp contact + footerLine on EVERY page so the photo-grid page (added
    // by drawPhotoGrid()) also carries branding/expiry context. Without this
    // loop jsPDF only writes on the active page.
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
    text: string
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

  private drawField(
    doc: IPDFDoc,
    y: number,
    margins: Margins,
    pageWidth: number,
    contentWidth: number,
    label: string,
    value: string
  ): number {
    return this.textRenderer.addWrappedText({
      doc,
      text: `${label}: ${value || '-'}`,
      y,
      fontSize: FONT_SIZES.BODY,
      maxWidth: contentWidth,
      margins,
      onPageBreak: () => margins.top,
      lineStep: LINE_SPACING.BODY - 1,
    });
  }
}
