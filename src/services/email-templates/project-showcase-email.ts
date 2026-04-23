/**
 * @fileoverview Project Showcase HTML email — orchestrator (ADR-316 Phase 2).
 * @description Composes the project showcase view (hero, photos, specs,
 *              description, floorplans) into a branded Mailgun-ready email,
 *              using the SSoT wrapper from `base-email-template.ts` and the
 *              shared section helpers from `showcase-email-shared.ts`.
 *
 *              Mirror of `property-showcase-email.ts` but adapted to the
 *              project snapshot shape (progress, totalValue, totalArea,
 *              startDate, completionDate, client) — no linked spaces, no
 *              per-property sections.
 */

import 'server-only';

import type { ProjectShowcaseSnapshot } from '@/types/project-showcase';
import type { ProjectShowcasePDFLabels } from '@/services/project-showcase/labels';
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

export interface BuildProjectShowcaseEmailParams {
  snapshot: ProjectShowcaseSnapshot;
  labels: ProjectShowcasePDFLabels;
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

export interface BuiltProjectShowcaseEmail {
  subject: string;
  html: string;
  text: string;
}

type SnapshotProject = ProjectShowcaseSnapshot['project'];

function renderProjectHero(p: SnapshotProject, labels: ProjectShowcasePDFLabels): string {
  const code = p.projectCode
    ? `<p style="margin:4px 0 0;font-size:12px;color:${BRAND.grayLight};">${escapeHtml(labels.specs.code)}: ${escapeHtml(p.projectCode)}</p>`
    : '';
  const subtitleBits = [p.typeLabel, p.statusLabel].filter(Boolean).join(' · ');
  const subtitle = subtitleBits
    ? `<p style="margin:6px 0 0;font-size:13px;color:${BRAND.grayLight};">${escapeHtml(subtitleBits)}</p>`
    : '';
  const desc = p.description
    ? `<p style="margin:12px 0 0;font-size:14px;color:${BRAND.navyDark};line-height:1.6;white-space:pre-line;">${escapeHtml(p.description)}</p>`
    : '';
  return `<section>
    <h1 style="margin:0;padding:0;font-size:22px;color:${BRAND.navyDark};">${escapeHtml(p.name)}</h1>
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

function composeLocation(p: SnapshotProject): string | undefined {
  const parts = [p.address, p.city, p.location].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : undefined;
}

function renderProjectSpecs(p: SnapshotProject, labels: ProjectShowcasePDFLabels): string {
  const rows: ShowcaseKeyValueRow[] = [
    { label: labels.specs.type,           value: p.typeLabel },
    { label: labels.specs.status,         value: p.statusLabel },
    { label: labels.specs.progress,       value: formatProgress(p.progress) },
    { label: labels.specs.totalArea,      value: p.totalArea,  unit: labels.specs.areaUnit },
    { label: labels.specs.totalValue,     value: formatMoneyAmount(p.totalValue) },
    { label: labels.specs.startDate,      value: p.startDate },
    { label: labels.specs.completionDate, value: p.completionDate },
    { label: labels.specs.location,       value: composeLocation(p) },
    { label: labels.specs.client,         value: p.linkedCompanyName ?? p.client },
  ];
  const table = renderKeyValueTable(rows);
  if (!table) return '';
  return `${renderSectionTitle(labels.specs.title)}${table}`;
}

export function buildProjectShowcaseEmail(
  params: BuildProjectShowcaseEmailParams,
): BuiltProjectShowcaseEmail {
  const { snapshot, labels, photos, floorplans, shareUrl, personalMessage } = params;
  const project = snapshot.project;
  const company = snapshot.company;

  const codeSuffix = project.projectCode ? ` (${project.projectCode})` : '';
  const subject = `${labels.email.subjectPrefix} — ${project.name}${codeSuffix}`;

  const introText = personalMessage?.trim() ? personalMessage.trim() : labels.email.introText;
  const introHtml = escapeHtml(introText).replace(/\n/g, '<br />');
  const intro = `<p style="margin:0 0 16px;font-size:14px;color:${BRAND.navyDark};line-height:1.6;">${introHtml}</p>`;
  const hero = renderProjectHero(project, labels);
  const cta = shareUrl ? renderShareCta(shareUrl, labels.email.ctaLabel) : '';

  const sections = [
    intro,
    hero,
    renderPhotoGrid(photos, labels.photos.title),
    renderProjectSpecs(project, labels),
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
    heading: project.name + codeSuffix,
    intro: introText,
    description: project.description,
    shareUrl,
  });

  return { subject, html, text };
}
