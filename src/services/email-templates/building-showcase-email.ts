/**
 * @fileoverview Building Showcase HTML email — orchestrator (ADR-320 Phase 2).
 * @description Composes the building showcase view (hero, photos, specs,
 *              description, floorplans) into a branded Mailgun-ready email,
 *              using the SSoT wrapper from `base-email-template.ts` and the
 *              shared section helpers from `showcase-email-shared.ts`.
 *
 *              Mirror of `project-showcase-email.ts` but adapted to the
 *              building snapshot shape (builtArea, floors, units, energy
 *              class, renovation status, construction year, project, linked
 *              company) — no linked spaces, no per-property sections.
 */

import 'server-only';

import type { BuildingShowcaseSnapshot } from '@/types/building-showcase';
import type { BuildingShowcasePDFLabels } from '@/services/building-showcase/labels';
import {
  wrapInBrandedTemplate,
  type EmailSocialLink,
  type EmailSocialPlatform,
} from './base-email-template';
import {
  BRAND,
  escapeHtml,
  buildSharedTextFallback,
  renderKeyValueTable,
  renderMediaList,
  renderPhotoGrid,
  renderSectionTitle,
  renderShareCta,
  type ShowcaseEmailMedia,
  type ShowcaseKeyValueRow,
} from './showcase-email-shared';

export interface BuildBuildingShowcaseEmailParams {
  snapshot: BuildingShowcaseSnapshot;
  labels: BuildingShowcasePDFLabels;
  photos?: ShowcaseEmailMedia[];
  floorplans?: ShowcaseEmailMedia[];
  /** Public showcase URL (`<baseUrl>/shared/<token>`). Rendered as primary CTA. */
  shareUrl?: string;
  /**
   * Personal message typed by the sender. When provided and non-empty,
   * replaces the default `labels.email.introText` in both html intro and
   * text fallback. Preserves sender line breaks.
   */
  personalMessage?: string;
}

export interface BuiltBuildingShowcaseEmail {
  subject: string;
  html: string;
  text: string;
}

type SnapshotBuilding = BuildingShowcaseSnapshot['building'];

function renderBuildingHero(b: SnapshotBuilding, labels: BuildingShowcasePDFLabels): string {
  const code = b.code
    ? `<p style="margin:4px 0 0;font-size:12px;color:${BRAND.grayLight};">${escapeHtml(labels.specs.code)}: ${escapeHtml(b.code)}</p>`
    : '';
  const subtitleBits = [b.typeLabel, b.statusLabel].filter(Boolean).join(' · ');
  const subtitle = subtitleBits
    ? `<p style="margin:6px 0 0;font-size:13px;color:${BRAND.grayLight};">${escapeHtml(subtitleBits)}</p>`
    : '';
  const desc = b.description
    ? `<p style="margin:12px 0 0;font-size:14px;color:${BRAND.navyDark};line-height:1.6;white-space:pre-line;">${escapeHtml(b.description)}</p>`
    : '';
  return `<section>
    <h1 style="margin:0;padding:0;font-size:22px;color:${BRAND.navyDark};">${escapeHtml(b.name)}</h1>
    ${code}${subtitle}${desc}
  </section>`;
}

function formatProgress(value: number | null | undefined): string | undefined {
  if (typeof value !== 'number' || Number.isNaN(value)) return undefined;
  return `${Math.round(value)}%`;
}

function formatMoneyAmount(value: number | null | undefined): string | undefined {
  if (typeof value !== 'number' || Number.isNaN(value)) return undefined;
  return new Intl.NumberFormat('el-GR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value);
}

function composeLocation(b: SnapshotBuilding): string | undefined {
  const parts = [b.address, b.city, b.location].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : undefined;
}

function renderBuildingSpecs(b: SnapshotBuilding, labels: BuildingShowcasePDFLabels): string {
  const rows: ShowcaseKeyValueRow[] = [
    { label: labels.specs.type,             value: b.typeLabel },
    { label: labels.specs.status,           value: b.statusLabel },
    { label: labels.specs.progress,         value: formatProgress(b.progress) },
    { label: labels.specs.totalArea,        value: b.totalArea,  unit: labels.specs.areaUnit },
    { label: labels.specs.builtArea,        value: b.builtArea,  unit: labels.specs.areaUnit },
    { label: labels.specs.floors,           value: b.floors },
    { label: labels.specs.units,            value: b.units },
    { label: labels.specs.energyClass,      value: b.energyClassLabel },
    { label: labels.specs.renovation,       value: b.renovationLabel },
    { label: labels.specs.constructionYear, value: b.constructionYear },
    { label: labels.specs.totalValue,       value: formatMoneyAmount(b.totalValue) },
    { label: labels.specs.startDate,        value: b.startDate },
    { label: labels.specs.completionDate,   value: b.completionDate },
    { label: labels.specs.location,         value: composeLocation(b) },
    { label: labels.specs.project,          value: b.projectName },
    { label: labels.specs.linkedCompany,    value: b.linkedCompanyName },
  ];
  const table = renderKeyValueTable(rows);
  if (!table) return '';
  return `${renderSectionTitle(labels.specs.title)}${table}`;
}

export function buildBuildingShowcaseEmail(
  params: BuildBuildingShowcaseEmailParams,
): BuiltBuildingShowcaseEmail {
  const { snapshot, labels, photos, floorplans, shareUrl, personalMessage } = params;
  const building = snapshot.building;
  const company = snapshot.company;

  const codeSuffix = building.code ? ` (${building.code})` : '';
  const subject = `${labels.email.subjectPrefix} — ${building.name}${codeSuffix}`;

  const introText = personalMessage?.trim() ? personalMessage.trim() : labels.email.introText;
  const introHtml = escapeHtml(introText).replace(/\n/g, '<br />');
  const intro = `<p style="margin:0 0 16px;font-size:14px;color:${BRAND.navyDark};line-height:1.6;">${introHtml}</p>`;
  const hero = renderBuildingHero(building, labels);
  const cta = shareUrl ? renderShareCta(shareUrl, labels.email.ctaLabel) : '';

  const sections = [
    intro,
    hero,
    renderPhotoGrid(photos, labels.photos.title),
    renderBuildingSpecs(building, labels),
    renderMediaList(floorplans, labels.floorplans.title),
    cta,
  ].filter((s) => s && s.length > 0);

  const socials: EmailSocialLink[] = (company.socialMedia ?? []).map((s) => ({
    platform: s.platform as EmailSocialPlatform,
    url: s.url,
    username: s.username,
    label: s.label,
  }));

  const html = wrapInBrandedTemplate({
    contentHtml: sections.join('\n'),
    companyName: company.name,
    companyPhone: company.phone,
    companyEmail: company.email,
    companyWebsite: company.website,
    companyLogoUrl: company.logoUrl,
    headerSubtitle: labels.header.subtitle,
    companyPhones: company.phones,
    companyEmails: company.emails,
    companyAddresses: company.addresses,
    companyWebsites: company.websites,
    companySocials: socials,
    contactLabels: labels.header.contacts,
    enableContactProviderLinks: true,
  });

  const text = buildSharedTextFallback({
    subject,
    heading: building.name + codeSuffix,
    intro: introText,
    description: building.description,
    shareUrl,
  });

  return { subject, html, text };
}
