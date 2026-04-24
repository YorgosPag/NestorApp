/**
 * =============================================================================
 * SHOWCASE CORE — PDF Renderer Base (ADR-321 Phase 1.3b)
 * =============================================================================
 *
 * Config-driven generic renderer extracted from the project + building
 * showcase renderers (95 %-identical orchestration) and aligned with the
 * property-showcase baseline (canonical SSoT per ADR-321). Produces a
 * branded multi-page PDF via a single class:
 *
 *   1. Cover     — brand header + title + code
 *   2. Specs     — 2-column grid rendered from `renderSpecsRows(data)`
 *   3. Extras    — optional hook (`renderExtraSections`) for surface-specific
 *                  pages (property uses it for project/commercial/systems/
 *                  finishes/features/linkedSpaces/etc.)
 *   4. Description (if present)
 *   5. Photos grid
 *   6. Floorplans grid
 *   Footer on every page
 *
 * Property-specific page ordering (overview before description, energy+views
 * before floorplans) is planned to land in Phase 4 via additional hooks; for
 * now the base matches the project/building default order and exposes enough
 * extensibility to migrate them without call-site change.
 *
 * Inline styles / colour tuples are PDF-native (jsPDF) — the CLAUDE.md N.3 ban
 * does not apply here.
 *
 * @module services/showcase-core/pdf-renderer-base
 */

import type { IPDFDoc, Margins } from '@/services/pdf/contracts';
import { TextRenderer } from '@/services/pdf/renderers/TextRenderer';
import { COLORS, FONT_SIZES, FONTS } from '@/services/pdf/layout';
import {
  drawMediaGridPage,
  PHOTO_GRID_CONFIG,
  FLOORPLAN_GRID_CONFIG,
} from '@/services/pdf/renderers/PropertyShowcaseMediaGrid';
import {
  drawShowcaseBrandHeader,
  type BrandHeaderLogoAsset,
} from '@/services/pdf/renderers/PropertyShowcaseBrandHeader';
import type { ShowcaseCompanyBranding } from '@/services/company/company-branding-resolver';

// =============================================================================
// Public types — re-exported for downstream consumers
// =============================================================================

export type { BrandHeaderLogoAsset };

export interface ShowcasePhotoAsset {
  id: string;
  bytes: Uint8Array;
  format: 'JPEG' | 'PNG';
  displayName?: string;
}

const GRAY_LIGHT: [number, number, number] = [240, 240, 240];

/**
 * Minimal chrome-label slice consumed by the base renderer. Every showcase
 * surface's PDF labels module already exposes these fields under
 * `labels.chrome`; this type is structural so surfaces can pass their own
 * fuller chrome objects directly.
 */
export interface ShowcasePdfChromeSlice {
  title: string;
  photosTitle: string;
  floorplansTitle: string;
  descriptionSection: string;
  footerNote: string;
  generatedOn: string;
  poweredBy: string;
}

/**
 * Minimal header-label slice consumed by the base renderer (forwarded to
 * `drawShowcaseBrandHeader`). Structural — every surface's `labels.header`
 * already matches.
 */
export interface ShowcasePdfHeaderSlice {
  subtitle: string;
  contacts: {
    addressLabel: string;
    phoneLabel: string;
    emailLabel: string;
    websiteLabel: string;
    socialLabel: string;
  };
}

/** 4-tuple specs grid row: `[labelLeft, valueLeft, labelRight, valueRight]`. */
export type ShowcaseSpecsRow = [string, string, string, string];

/** Supported PDF locales — matches the three existing renderers. */
export type ShowcasePdfLocale = 'el' | 'en';

/**
 * Context handed to `renderExtraSections`. Surfaces can draw any number of
 * additional pages using the provided PDF doc + text renderer + shared
 * section-title helper. Page-break management is the hook's responsibility.
 */
export interface ShowcaseExtraSectionsContext<TData> {
  doc: IPDFDoc;
  margins: Margins;
  pageWidth: number;
  contentWidth: number;
  data: TData;
  textRenderer: TextRenderer;
  drawSectionTitle: (y: number, text: string) => number;
  locale: ShowcasePdfLocale;
}

export interface BaseShowcaseRendererConfig<TData> {
  /** Entity company branding (always `snapshot.company` at call-sites today). */
  getCompany: (data: TData) => ShowcaseCompanyBranding;
  /** PDF chrome labels (title, photosTitle, footerNote, …). */
  getChromeLabels: (data: TData) => ShowcasePdfChromeSlice;
  /** Header brand labels (subtitle + contact labels). */
  getHeaderLabels: (data: TData) => ShowcasePdfHeaderSlice;
  /** Label used as prefix before the entity code on the cover page. */
  getCodeLabel: (data: TData) => string;
  /** Cover title — entity name. */
  getCoverTitle: (data: TData) => string;
  /** Entity code — rendered under the cover title when non-empty. */
  getCoverCode: (data: TData) => string | null | undefined;
  /** Long description — when non-empty produces a description page. */
  getDescription: (data: TData) => string | null | undefined;
  getPhotos: (data: TData) => ShowcasePhotoAsset[] | undefined;
  getFloorplans: (data: TData) => ShowcasePhotoAsset[] | undefined;
  getCompanyLogo: (data: TData) => BrandHeaderLogoAsset | undefined;
  getNestorAppLogo: (data: TData) => ShowcasePhotoAsset | undefined;
  getGeneratedAt: (data: TData) => Date;
  getLocale: (data: TData) => ShowcasePdfLocale;
  /**
   * 2-column specs grid. Each row is a 4-tuple; a row with empty right-side
   * labels (`['', '']`) renders single-column. All values must already be
   * formatted — the base renderer does no transformation.
   */
  renderSpecsRows: (data: TData) => ShowcaseSpecsRow[];
  /** Optional extra sections inserted after specs and before description. */
  renderExtraSections?: (ctx: ShowcaseExtraSectionsContext<TData>) => void;
}

// =============================================================================
// Shared formatters — exported so surface-specific spec builders can reuse
// =============================================================================

export function safeShowcaseValue(v: string | number | undefined | null): string {
  if (v === undefined || v === null) return '-';
  const s = String(v).trim();
  return s.length > 0 ? s : '-';
}

export function formatShowcasePdfDate(
  iso: string | null | undefined,
  locale: ShowcasePdfLocale,
): string {
  if (!iso) return '-';
  const parts = iso.slice(0, 10).split('-');
  if (parts.length !== 3) return iso;
  const [y, m, d] = parts;
  return locale === 'el' ? `${d}/${m}/${y}` : `${y}-${m}-${d}`;
}

export function formatShowcasePdfEuro(
  v: number | null | undefined,
  locale: ShowcasePdfLocale,
): string {
  if (v === null || v === undefined) return '-';
  return new Intl.NumberFormat(locale === 'el' ? 'el-GR' : 'en-US', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(v);
}

export function formatShowcasePdfArea(
  v: number | null | undefined,
  unit: string,
): string {
  if (v === null || v === undefined) return '-';
  return `${v} ${unit}`;
}

// =============================================================================
// Base renderer
// =============================================================================

export class BaseShowcaseRenderer<TData> {
  private readonly textRenderer = new TextRenderer({ font: FONTS.UNICODE });

  constructor(private readonly config: BaseShowcaseRendererConfig<TData>) {}

  render(doc: IPDFDoc, margins: Margins, data: TData): void {
    const pageWidth = doc.pageSize.width;
    const contentWidth = pageWidth - margins.left - margins.right;

    this.drawCoverPage(doc, margins, pageWidth, contentWidth, data);
    this.drawSpecsPage(doc, margins, pageWidth, contentWidth, data);

    if (this.config.renderExtraSections) {
      this.config.renderExtraSections({
        doc, margins, pageWidth, contentWidth, data,
        textRenderer: this.textRenderer,
        drawSectionTitle: (y, text) =>
          this.drawSectionTitle(doc, y, margins, pageWidth, contentWidth, text),
        locale: this.config.getLocale(data),
      });
    }

    if (this.hasDescription(data)) {
      this.drawDescriptionPage(doc, margins, pageWidth, contentWidth, data);
    }
    this.drawPhotosPage(doc, margins, pageWidth, contentWidth, data);
    this.drawFloorplansPage(doc, margins, pageWidth, contentWidth, data);
    this.drawFooter(doc, margins, pageWidth, data);
  }

  private hasDescription(data: TData): boolean {
    const d = this.config.getDescription(data);
    return typeof d === 'string' && d.trim().length > 0;
  }

  private drawCoverPage(
    doc: IPDFDoc,
    margins: Margins,
    pageWidth: number,
    contentWidth: number,
    data: TData,
  ): void {
    const company = this.config.getCompany(data);
    const chrome = this.config.getChromeLabels(data);
    const header = this.config.getHeaderLabels(data);
    let y = margins.top;
    y = drawShowcaseBrandHeader({
      doc, y, margins, contentWidth,
      company,
      chromeTitle: chrome.title,
      headerLabels: header,
      companyLogo: this.config.getCompanyLogo(data),
    });
    y += 8;
    y = this.textRenderer.addText({
      doc,
      text: safeShowcaseValue(this.config.getCoverTitle(data)),
      y, align: 'center', fontSize: FONT_SIZES.H2, bold: true, margins, pageWidth,
    });
    const code = this.config.getCoverCode(data);
    if (code) {
      this.textRenderer.addText({
        doc,
        text: `${this.config.getCodeLabel(data)}: ${code}`,
        y: y + 2, align: 'center', fontSize: FONT_SIZES.BODY, margins, pageWidth,
      });
    }
  }

  private drawSpecsPage(
    doc: IPDFDoc,
    margins: Margins,
    pageWidth: number,
    contentWidth: number,
    data: TData,
  ): void {
    doc.addPage();
    const chrome = this.config.getChromeLabels(data);
    let y = margins.top;
    y = this.drawSectionTitle(doc, y, margins, pageWidth, contentWidth, chrome.title);

    const rows = this.config.renderSpecsRows(data);
    const halfW = contentWidth / 2 - 2;
    const rowH = 7;
    const fs = FONT_SIZES.SMALL;

    for (const [l1, v1, l2, v2] of rows) {
      doc.setFillColor(...GRAY_LIGHT);
      doc.rect(margins.left, y - 4, halfW, rowH, 'F');
      this.textRenderer.addText({ doc, text: l1, y, align: 'left', fontSize: fs, bold: true, margins, pageWidth });
      this.textRenderer.addText({ doc, text: v1, y, align: 'left', fontSize: fs, margins: { ...margins, left: margins.left + halfW / 2 }, pageWidth });
      if (l2) {
        const rightX = margins.left + halfW + 4;
        doc.setFillColor(...GRAY_LIGHT);
        doc.rect(rightX, y - 4, halfW, rowH, 'F');
        this.textRenderer.addText({ doc, text: l2, y, align: 'left', fontSize: fs, bold: true, margins: { ...margins, left: rightX }, pageWidth });
        this.textRenderer.addText({ doc, text: v2, y, align: 'left', fontSize: fs, margins: { ...margins, left: rightX + halfW / 2 }, pageWidth });
      }
      y += rowH + 2;
    }
  }

  private drawDescriptionPage(
    doc: IPDFDoc,
    margins: Margins,
    pageWidth: number,
    contentWidth: number,
    data: TData,
  ): void {
    doc.addPage();
    const desc = this.config.getDescription(data);
    if (!desc) return;
    const chrome = this.config.getChromeLabels(data);
    let y = margins.top;
    y = this.drawSectionTitle(doc, y, margins, pageWidth, contentWidth, chrome.descriptionSection);
    this.textRenderer.addWrappedText({
      doc, text: desc, y, fontSize: FONT_SIZES.BODY, maxWidth: contentWidth,
      margins, onPageBreak: () => margins.top,
    });
  }

  private drawPhotosPage(
    doc: IPDFDoc,
    margins: Margins,
    pageWidth: number,
    contentWidth: number,
    data: TData,
  ): void {
    const chrome = this.config.getChromeLabels(data);
    drawMediaGridPage({
      doc, margins, pageWidth, contentWidth,
      assets: this.config.getPhotos(data) ?? [],
      sectionTitle: chrome.photosTitle,
      drawSectionTitle: (d, y, m, pw, cw, t) =>
        this.drawSectionTitle(d, y, m, pw, cw, t),
      config: PHOTO_GRID_CONFIG,
    });
  }

  private drawFloorplansPage(
    doc: IPDFDoc,
    margins: Margins,
    pageWidth: number,
    contentWidth: number,
    data: TData,
  ): void {
    const chrome = this.config.getChromeLabels(data);
    drawMediaGridPage({
      doc, margins, pageWidth, contentWidth,
      assets: this.config.getFloorplans(data) ?? [],
      sectionTitle: chrome.floorplansTitle,
      drawSectionTitle: (d, y, m, pw, cw, t) =>
        this.drawSectionTitle(d, y, m, pw, cw, t),
      config: FLOORPLAN_GRID_CONFIG,
    });
  }

  private drawFooter(
    doc: IPDFDoc,
    margins: Margins,
    pageWidth: number,
    data: TData,
  ): void {
    const pageHeight = doc.pageSize.height;
    const footerY = pageHeight - margins.bottom;
    const brand = this.config.getCompany(data);
    const chrome = this.config.getChromeLabels(data);
    const locale = this.config.getLocale(data);
    const contact = [brand.phone, brand.email, brand.website]
      .filter((v): v is string => Boolean(v))
      .join(' · ');
    const dateStr = formatShowcasePdfDate(
      this.config.getGeneratedAt(data).toISOString(),
      locale,
    );
    const footerLine = `${chrome.footerNote} · ${chrome.generatedOn} ${dateStr}`;
    const appLogo = this.config.getNestorAppLogo(data);
    const totalPages = doc.getNumberOfPages();

    for (let n = 1; n <= totalPages; n++) {
      doc.setPage(n);
      if (appLogo) {
        try {
          doc.addImage(
            appLogo.bytes, appLogo.format,
            pageWidth / 2 - 14, footerY - 16, 4, 4, appLogo.id, 'FAST',
          );
        } catch {
          /* non-blocking — logo is decorative */
        }
      }
      if (chrome.poweredBy) {
        this.textRenderer.addText({
          doc, text: chrome.poweredBy, y: footerY - 13, align: 'center',
          fontSize: FONT_SIZES.SMALL, margins, pageWidth,
        });
      }
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
      doc, text, y, align: 'left', fontSize: FONT_SIZES.SMALL, bold: true, margins, pageWidth,
    }) + 1;
  }
}
