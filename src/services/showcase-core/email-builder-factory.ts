/**
 * =============================================================================
 * SHOWCASE CORE — Email Builder Factory (ADR-321 Phase 1.2)
 * =============================================================================
 *
 * Config-driven generic lifted from `email-templates/property-showcase-email.
 * ts` (canonical baseline per ADR-321). Produces a branded Mailgun-ready
 * `{ subject, html, text }` for any showcase surface (property / project /
 * building / future) via a single orchestration.
 *
 * Composition order (matches the property baseline 1:1):
 *   intro → hero → photoGrid → specs → bodySections → cta
 *
 * `bodySections` defaults to a single "floorplans as media list" block when
 * omitted; it is fully owned by the caller when provided — property uses it
 * for propertyFloorFloorplans + systems + finishes + features + linkedSpaces
 * + linkedSpaceFloorplans + energy + views + floorplans-media-list, in that
 * exact order.
 *
 * Inline styles are REQUIRED by email clients (Outlook, Gmail, Apple Mail).
 * The CLAUDE.md N.3 ban does not apply here.
 *
 * @module services/showcase-core/email-builder-factory
 */

import 'server-only';

import {
  wrapInBrandedTemplate,
  type EmailSocialLink,
  type EmailSocialPlatform,
} from '@/services/email-templates/base-email-template';
import {
  BRAND,
  buildSharedTextFallback,
  escapeHtml,
  renderMediaList,
  renderPhotoGrid,
  renderShareCta,
  type ShowcaseEmailMedia,
} from '@/services/email-templates/showcase-email-shared';
import type { ShowcaseCompanyBranding } from '@/services/company/company-branding-resolver';
import type { EmailHeaderContactLabels } from '@/services/email-templates/base-email-template';

// =============================================================================
// Public contracts
// =============================================================================

export interface ShowcaseEmailEntityHeading {
  /** Main entity name — subject + text heading. */
  name: string;
  /** Pre-formatted code suffix (e.g. ` (BLD-001)` or `''`). Caller owns formatting. */
  codeSuffix: string;
  /** Long description — included in text fallback when present. */
  description?: string | null;
}

export interface ShowcaseEmailLabelAccessors<TLabels> {
  subjectPrefix: (l: TLabels) => string;
  introText: (l: TLabels) => string;
  ctaLabel: (l: TLabels) => string;
  headerSubtitle: (l: TLabels) => string;
  contactLabels: (l: TLabels) => EmailHeaderContactLabels;
  photosTitle: (l: TLabels) => string;
  floorplansTitle: (l: TLabels) => string;
}

export interface ShowcaseEmailRenderHookParams<TSnapshot, TLabels> {
  snapshot: TSnapshot;
  labels: TLabels;
}

export interface ShowcaseEmailBodyHookParams<TSnapshot, TLabels, TPhoto, TExtras>
  extends ShowcaseEmailRenderHookParams<TSnapshot, TLabels> {
  photos?: TPhoto[];
  floorplans?: TPhoto[];
  extras?: TExtras;
}

export interface ShowcaseEmailRenderHooks<TSnapshot, TLabels, TPhoto, TExtras> {
  /** Hero section — title + code + subtitle + description. */
  renderHero: (params: ShowcaseEmailRenderHookParams<TSnapshot, TLabels>) => string;
  /** Specs section — key/value table bound to entity-specific fields. */
  renderSpecs: (params: ShowcaseEmailRenderHookParams<TSnapshot, TLabels>) => string;
  /**
   * Optional body sections inserted between specs and CTA. When omitted, the
   * factory renders a single floorplans-as-media-list block.
   */
  renderBodySections?: (
    params: ShowcaseEmailBodyHookParams<TSnapshot, TLabels, TPhoto, TExtras>,
  ) => string[];
}

export interface ShowcaseEmailBuilderConfig<TSnapshot, TLabels, TPhoto, TExtras = void> {
  /** Extracts entity heading (name + codeSuffix + description). */
  getEntityHeading: (snapshot: TSnapshot) => ShowcaseEmailEntityHeading;
  /** Extracts company branding (all surfaces place it at `snapshot.company`). */
  getCompany: (snapshot: TSnapshot) => ShowcaseCompanyBranding;
  /** Label accessors — bridges surface-specific labels shape to the generic. */
  labels: ShowcaseEmailLabelAccessors<TLabels>;
  /** Section render hooks. */
  hooks: ShowcaseEmailRenderHooks<TSnapshot, TLabels, TPhoto, TExtras>;
}

export interface BuildShowcaseEmailParams<TSnapshot, TLabels, TPhoto, TExtras = void> {
  snapshot: TSnapshot;
  labels: TLabels;
  photos?: TPhoto[];
  floorplans?: TPhoto[];
  /** Public showcase URL (`<baseUrl>/shared/<token>`) — primary CTA. */
  shareUrl?: string;
  /**
   * Sender's personal message. When non-empty replaces the default intro text
   * in both html and text fallback; line breaks are preserved.
   */
  personalMessage?: string;
  /** Surface-specific extra data (e.g. property's linked-space floorplans). */
  extras?: TExtras;
}

export interface BuiltShowcaseEmail {
  subject: string;
  html: string;
  text: string;
}

export type ShowcaseEmailBuilder<TSnapshot, TLabels, TPhoto, TExtras = void> = (
  params: BuildShowcaseEmailParams<TSnapshot, TLabels, TPhoto, TExtras>,
) => BuiltShowcaseEmail;

// =============================================================================
// Internal helpers (pure, < 40 LOC each)
// =============================================================================

function renderIntroHtml(introText: string): string {
  const escaped = escapeHtml(introText).replace(/\n/g, '<br />');
  return `<p style="margin:0 0 16px;font-size:14px;color:${BRAND.navyDark};line-height:1.6;">${escaped}</p>`;
}

function resolveIntroText(fallback: string, personalMessage: string | undefined): string {
  const trimmed = personalMessage?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : fallback;
}

function mapSocials(company: ShowcaseCompanyBranding): EmailSocialLink[] {
  return (company.socialMedia ?? []).map((s) => ({
    platform: s.platform as EmailSocialPlatform,
    url: s.url,
    username: s.username,
    label: s.label,
  }));
}

interface WrapBrandedParams<TLabels> {
  contentHtml: string;
  company: ShowcaseCompanyBranding;
  labels: TLabels;
  accessors: ShowcaseEmailLabelAccessors<TLabels>;
}

function wrapInBranded<TLabels>(params: WrapBrandedParams<TLabels>): string {
  const { contentHtml, company, labels, accessors } = params;
  return wrapInBrandedTemplate({
    contentHtml,
    companyName: company.name,
    companyPhone: company.phone,
    companyEmail: company.email,
    companyWebsite: company.website,
    companyLogoUrl: company.logoUrl,
    headerSubtitle: accessors.headerSubtitle(labels),
    companyPhones: company.phones,
    companyEmails: company.emails,
    companyAddresses: company.addresses,
    companyWebsites: company.websites,
    companySocials: mapSocials(company),
    contactLabels: accessors.contactLabels(labels),
    enableContactProviderLinks: true,
  });
}

// =============================================================================
// Factory
// =============================================================================

export function createShowcaseEmailBuilder<
  TSnapshot,
  TLabels,
  TPhoto extends ShowcaseEmailMedia,
  TExtras = void,
>(
  config: ShowcaseEmailBuilderConfig<TSnapshot, TLabels, TPhoto, TExtras>,
): ShowcaseEmailBuilder<TSnapshot, TLabels, TPhoto, TExtras> {
  return function buildShowcaseEmail(
    params: BuildShowcaseEmailParams<TSnapshot, TLabels, TPhoto, TExtras>,
  ): BuiltShowcaseEmail {
    const { snapshot, labels, photos, floorplans, shareUrl, personalMessage, extras } = params;

    const heading = config.getEntityHeading(snapshot);
    const company = config.getCompany(snapshot);

    const subject = `${config.labels.subjectPrefix(labels)} — ${heading.name}${heading.codeSuffix}`;
    const introText = resolveIntroText(config.labels.introText(labels), personalMessage);

    const intro = renderIntroHtml(introText);
    const hero = config.hooks.renderHero({ snapshot, labels });
    const photoGrid = renderPhotoGrid(photos, config.labels.photosTitle(labels));
    const specs = config.hooks.renderSpecs({ snapshot, labels });
    const body = config.hooks.renderBodySections
      ? config.hooks.renderBodySections({ snapshot, labels, photos, floorplans, extras })
      : [renderMediaList(floorplans, config.labels.floorplansTitle(labels))];
    const cta = shareUrl ? renderShareCta(shareUrl, config.labels.ctaLabel(labels)) : '';

    const sections = [intro, hero, photoGrid, specs, ...body, cta].filter(
      (s) => s && s.length > 0,
    );

    const html = wrapInBranded({
      contentHtml: sections.join('\n'),
      company,
      labels,
      accessors: config.labels,
    });

    const text = buildSharedTextFallback({
      subject,
      heading: heading.name + heading.codeSuffix,
      intro: introText,
      description: heading.description,
      shareUrl,
    });

    return { subject, html, text };
  };
}
