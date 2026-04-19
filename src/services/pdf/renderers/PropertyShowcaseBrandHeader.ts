/**
 * 🏢 ENTERPRISE: Property Showcase — brand header builder + renderer (ADR-312 Phase 9)
 *
 * Extracted from `PropertyShowcaseRenderer` so the main renderer file stays
 * within the Google 500-LOC budget. The brand header is a self-contained
 * view model + jsPDF ops; keeping it here leaves the renderer free to
 * orchestrate the section ordering.
 */

import type { IPDFDoc, Margins } from '../contracts';
import { COLORS, FONT_SIZES, FONTS } from '../layout';
import type { PropertyShowcaseSnapshot } from '@/services/property-showcase/snapshot-builder';
import type { ShowcaseHeaderLabels } from '@/services/property-showcase/labels';

/** Brand navy — aligned with email template `BRAND.navy` #1E3A5F (ADR-312 Phase 8). */
const BRAND_NAVY: [number, number, number] = [30, 58, 95];

export interface BrandHeaderLogoAsset {
  id: string;
  bytes: Uint8Array;
  format: 'JPEG' | 'PNG';
}

export interface DrawBrandHeaderParams {
  doc: IPDFDoc;
  y: number;
  margins: Margins;
  contentWidth: number;
  company: PropertyShowcaseSnapshot['company'];
  chromeTitle: string;
  headerLabels: ShowcaseHeaderLabels;
  companyLogo?: BrandHeaderLogoAsset;
}

function safe(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return '-';
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : '-';
}

export function buildBrandHeaderContactRows(
  company: PropertyShowcaseSnapshot['company'],
  headerLabels: ShowcaseHeaderLabels,
): string[] {
  const contactLabels = headerLabels.contacts;
  const rows: string[] = [];

  const addresses = company.addresses ?? [];
  if (addresses.length > 0) {
    rows.push(`${contactLabels.addressLabel}: ${addresses.join(' / ')}`);
  }

  const phones = company.phones ?? (company.phone ? [{ value: company.phone }] : []);
  if (phones.length > 0) {
    rows.push(`${contactLabels.phoneLabel}: ${phones.map((p) => p.value).join(' · ')}`);
  }

  const emails = company.emails ?? (company.email ? [{ value: company.email }] : []);
  if (emails.length > 0) {
    rows.push(`${contactLabels.emailLabel}: ${emails.map((e) => e.value).join(', ')}`);
  }

  const websites = company.websites ?? (company.website ? [{ url: company.website }] : []);
  if (websites.length > 0) {
    rows.push(`${contactLabels.websiteLabel}: ${websites.map((w) => w.url).join(' · ')}`);
  }

  const socials = company.socialMedia ?? [];
  if (socials.length > 0) {
    const socialText = socials
      .map((s) => {
        const handle = s.username ? `@${s.username}` : s.url.replace(/^https?:\/\//, '');
        return `${s.platform}: ${handle}`;
      })
      .join(' · ');
    rows.push(`${contactLabels.socialLabel}: ${socialText}`);
  }

  return rows;
}

/**
 * Draw the branded navy banner at the top of the cover page. Returns the
 * Y-coordinate where the next section can safely start.
 */
export function drawShowcaseBrandHeader(params: DrawBrandHeaderParams): number {
  const { doc, y, margins, contentWidth, company, chromeTitle, headerLabels, companyLogo } = params;
  const contactRows = buildBrandHeaderContactRows(company, headerLabels);

  const bannerTop = y - 5;
  const logoSize = 18;
  const logoX = margins.left + 4;
  const logoY = bannerTop + 4;
  const textLeft = logoX + logoSize + 6;
  const textWidth = contentWidth - (textLeft - margins.left) - 4;

  doc.setFont(FONTS.UNICODE, 'normal');
  doc.setFontSize(FONT_SIZES.SMALL);
  const wrappedContacts: string[] = [];
  for (const row of contactRows) {
    const lines = doc.splitTextToSize(row, textWidth) as string[];
    wrappedContacts.push(...lines);
  }

  const nameHeight = 7;
  const subtitleHeight = 4;
  const contactLineHeight = 4;
  const contactsBlockHeight = wrappedContacts.length * contactLineHeight;
  const textBlockHeight = nameHeight + subtitleHeight + contactsBlockHeight + 8;
  const bannerHeight = Math.max(textBlockHeight, logoSize + 8, 34);

  doc.setFillColor(...BRAND_NAVY);
  doc.rect(margins.left, bannerTop, contentWidth, bannerHeight, 'F');

  if (companyLogo) {
    try {
      doc.addImage(
        companyLogo.bytes, companyLogo.format,
        logoX, logoY, logoSize, logoSize,
        companyLogo.id, 'FAST',
      );
    } catch (err) {
      console.error('[PropertyShowcaseBrandHeader] company logo addImage failed', err);
    }
  }

  let cursorY = bannerTop + 7;

  doc.setFont(FONTS.UNICODE, 'bold');
  doc.setFontSize(FONT_SIZES.H3);
  doc.setTextColor(...COLORS.WHITE);
  doc.text(safe(company.name), textLeft, cursorY, { align: 'left' });
  cursorY += nameHeight;

  doc.setFont(FONTS.UNICODE, 'normal');
  doc.setFontSize(FONT_SIZES.SMALL);
  doc.text(chromeTitle, textLeft, cursorY, { align: 'left' });
  cursorY += subtitleHeight + 1;

  for (const line of wrappedContacts) {
    doc.text(line, textLeft, cursorY, { align: 'left' });
    cursorY += contactLineHeight;
  }

  doc.setTextColor(...COLORS.BLACK);

  return Math.max(cursorY + 4, bannerTop + bannerHeight + 2);
}
