/**
 * Project Showcase PDF Renderer (ADR-316).
 *
 * Pages:
 *   1. Cover  — branded navy header + project name/code
 *   2. Specs  — 2-column grid (type, status, progress, area, value, dates, location, client)
 *   3. Description (if present)
 *   4. Photos grid
 *   5. Floorplans grid
 *   Footer on every page.
 *
 * Reuses: `drawShowcaseBrandHeader`, `drawMediaGridPage`, `TextRenderer`,
 *          layout constants — zero duplication (SSOT ADR-316).
 */

import type { IPDFDoc, Margins } from '../contracts';
import { TextRenderer } from './TextRenderer';
import { COLORS, FONT_SIZES, FONTS } from '../layout';
import { drawMediaGridPage, PHOTO_GRID_CONFIG, FLOORPLAN_GRID_CONFIG } from './PropertyShowcaseMediaGrid';
import { drawShowcaseBrandHeader } from './PropertyShowcaseBrandHeader';
import type { BrandHeaderLogoAsset } from './PropertyShowcaseBrandHeader';
import type { ProjectShowcaseSnapshot } from '@/types/project-showcase';
import type { ProjectShowcasePDFLabels } from '@/services/project-showcase/labels';

const GRAY_LIGHT: [number, number, number] = [240, 240, 240];

export interface ShowcasePhotoAsset {
  id: string;
  bytes: Uint8Array;
  format: 'JPEG' | 'PNG';
  displayName?: string;
}

export interface ProjectShowcasePDFData {
  snapshot: ProjectShowcaseSnapshot;
  photos?: ShowcasePhotoAsset[];
  floorplans?: ShowcasePhotoAsset[];
  companyLogo?: BrandHeaderLogoAsset;
  nestorAppLogo?: ShowcasePhotoAsset;
  generatedAt: Date;
  labels: ProjectShowcasePDFLabels;
  locale: 'el' | 'en';
}

function safe(v: string | number | undefined | null): string {
  if (v === undefined || v === null) return '-';
  const s = String(v).trim();
  return s.length > 0 ? s : '-';
}

function formatPdfDate(iso: string | null | undefined, locale: 'el' | 'en'): string {
  if (!iso) return '-';
  const parts = iso.slice(0, 10).split('-');
  if (parts.length !== 3) return iso;
  const [y, m, d] = parts;
  return locale === 'el' ? `${d}/${m}/${y}` : `${y}-${m}-${d}`;
}

function formatValue(v: number | null | undefined, locale: 'el' | 'en'): string {
  if (v === null || v === undefined) return '-';
  return new Intl.NumberFormat(locale === 'el' ? 'el-GR' : 'en-US', {
    style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
  }).format(v);
}

export class ProjectShowcaseRenderer {
  private readonly textRenderer = new TextRenderer({ font: FONTS.UNICODE });

  render(doc: IPDFDoc, margins: Margins, data: ProjectShowcasePDFData): void {
    const pageWidth = doc.pageSize.width;
    const contentWidth = pageWidth - margins.left - margins.right;

    this.drawCoverPage(doc, margins, pageWidth, contentWidth, data);
    this.drawSpecsPage(doc, margins, pageWidth, contentWidth, data);
    if (data.snapshot.project.description) {
      this.drawDescriptionPage(doc, margins, pageWidth, contentWidth, data);
    }
    drawMediaGridPage({
      doc, margins, pageWidth, contentWidth,
      assets: data.photos ?? [],
      sectionTitle: data.labels.chrome.photosTitle,
      drawSectionTitle: (d, y, m, pw, cw, t) => this.drawSectionTitle(d, y, m, pw, cw, t),
      config: PHOTO_GRID_CONFIG,
    });
    drawMediaGridPage({
      doc, margins, pageWidth, contentWidth,
      assets: data.floorplans ?? [],
      sectionTitle: data.labels.chrome.floorplansTitle,
      drawSectionTitle: (d, y, m, pw, cw, t) => this.drawSectionTitle(d, y, m, pw, cw, t),
      config: FLOORPLAN_GRID_CONFIG,
    });
    this.drawFooter(doc, margins, pageWidth, data);
  }

  private drawCoverPage(
    doc: IPDFDoc,
    margins: Margins,
    pageWidth: number,
    contentWidth: number,
    data: ProjectShowcasePDFData,
  ): void {
    const { project, company } = data.snapshot;
    let y = margins.top;
    y = drawShowcaseBrandHeader({
      doc, y, margins, contentWidth,
      company,
      chromeTitle: data.labels.chrome.title,
      headerLabels: data.labels.header,
      companyLogo: data.companyLogo,
    });
    y += 8;
    y = this.textRenderer.addText({
      doc, text: safe(project.name),
      y, align: 'center', fontSize: FONT_SIZES.H2, bold: true, margins, pageWidth,
    });
    if (project.projectCode) {
      this.textRenderer.addText({
        doc, text: `${data.labels.specs.code}: ${project.projectCode}`,
        y: y + 2, align: 'center', fontSize: FONT_SIZES.BODY, margins, pageWidth,
      });
    }
  }

  private drawSpecsPage(
    doc: IPDFDoc,
    margins: Margins,
    pageWidth: number,
    contentWidth: number,
    data: ProjectShowcasePDFData,
  ): void {
    doc.addPage();
    const { project } = data.snapshot;
    const { specs, chrome } = data.labels;
    const locale = data.locale;
    let y = margins.top;
    y = this.drawSectionTitle(doc, y, margins, pageWidth, contentWidth, chrome.title);

    const rows: [string, string, string, string][] = [
      [specs.type,           safe(project.typeLabel),
       specs.status,         safe(project.statusLabel)],
      [specs.progress,       project.progress > 0 ? `${project.progress}%` : '-',
       specs.totalArea,      project.totalArea != null ? `${project.totalArea} ${specs.areaUnit}` : '-'],
      [specs.totalValue,     formatValue(project.totalValue, locale),
       specs.startDate,      formatPdfDate(project.startDate, locale)],
      [specs.completionDate, formatPdfDate(project.completionDate, locale),
       specs.location,       safe(project.location ?? project.city)],
      [specs.client,         safe(project.client ?? project.linkedCompanyName),
       '',                   ''],
    ];

    const halfW = contentWidth / 2 - 2;
    const rowH = 7;

    for (const [l1, v1, l2, v2] of rows) {
      doc.setFillColor(...GRAY_LIGHT);
      doc.rect(margins.left, y - 4, halfW, rowH, 'F');
      this.textRenderer.addText({ doc, text: l1, y, align: 'left', fontSize: FONT_SIZES.SMALL, bold: true, margins, pageWidth });
      this.textRenderer.addText({ doc, text: v1, y, align: 'left', fontSize: FONT_SIZES.SMALL, margins: { ...margins, left: margins.left + halfW / 2 }, pageWidth });
      if (l2) {
        const rightX = margins.left + halfW + 4;
        doc.setFillColor(...GRAY_LIGHT);
        doc.rect(rightX, y - 4, halfW, rowH, 'F');
        this.textRenderer.addText({ doc, text: l2, y, align: 'left', fontSize: FONT_SIZES.SMALL, bold: true, margins: { ...margins, left: rightX }, pageWidth });
        this.textRenderer.addText({ doc, text: v2, y, align: 'left', fontSize: FONT_SIZES.SMALL, margins: { ...margins, left: rightX + halfW / 2 }, pageWidth });
      }
      y += rowH + 2;
    }
  }

  private drawDescriptionPage(
    doc: IPDFDoc,
    margins: Margins,
    pageWidth: number,
    contentWidth: number,
    data: ProjectShowcasePDFData,
  ): void {
    doc.addPage();
    const desc = data.snapshot.project.description;
    if (!desc) return;
    let y = margins.top;
    y = this.drawSectionTitle(doc, y, margins, pageWidth, contentWidth, data.labels.chrome.descriptionSection);
    this.textRenderer.addWrappedText({
      doc, text: desc, y, fontSize: FONT_SIZES.BODY, maxWidth: contentWidth,
      margins, onPageBreak: () => margins.top,
    });
  }

  private drawFooter(
    doc: IPDFDoc,
    margins: Margins,
    pageWidth: number,
    data: ProjectShowcasePDFData,
  ): void {
    const pageHeight = doc.pageSize.height;
    const footerY = pageHeight - margins.bottom;
    const brand = data.snapshot.company;
    const contact = [brand.phone, brand.email, brand.website]
      .filter((v): v is string => Boolean(v))
      .join(' · ');
    const dateStr = formatPdfDate(data.generatedAt.toISOString(), data.locale);
    const footerLine = `${data.labels.chrome.footerNote} · ${data.labels.chrome.generatedOn} ${dateStr}`;
    const totalPages = doc.getNumberOfPages();

    for (let n = 1; n <= totalPages; n++) {
      doc.setPage(n);
      if (data.nestorAppLogo) {
        try {
          doc.addImage(data.nestorAppLogo.bytes, data.nestorAppLogo.format,
            pageWidth / 2 - 14, footerY - 16, 4, 4, data.nestorAppLogo.id, 'FAST');
        } catch { /* non-blocking */ }
      }
      if (data.labels.chrome.poweredBy) {
        this.textRenderer.addText({ doc, text: data.labels.chrome.poweredBy, y: footerY - 13, align: 'center', fontSize: FONT_SIZES.SMALL, margins, pageWidth });
      }
      if (contact) {
        this.textRenderer.addText({ doc, text: contact, y: footerY - 8, align: 'center', fontSize: FONT_SIZES.SMALL, margins, pageWidth });
      }
      this.textRenderer.addText({ doc, text: footerLine, y: footerY - 3, align: 'center', fontSize: FONT_SIZES.SMALL, margins, pageWidth });
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
      doc, text, y, align: 'left', fontSize: FONT_SIZES.SMALL, bold: true, margins, pageWidth,
    }) + 1;
  }
}
