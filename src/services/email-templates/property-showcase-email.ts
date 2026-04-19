/**
 * @fileoverview Property Showcase HTML email — orchestrator (ADR-312 Phase 8).
 * @description Composes the full showcase view (hero, photos, specs, energy,
 *              views, floorplans, systems, finishes, features, linked spaces,
 *              linked-space floorplans) into a branded Mailgun-ready email,
 *              using the SSoT wrapper from `base-email-template.ts`.
 *
 *              The caller is responsible for loading `snapshot` + media +
 *              labels via the server-side property-showcase helpers, so that
 *              web, PDF and email render the identical dataset.
 */

import 'server-only';

import type { PropertyShowcaseSnapshot } from '@/services/property-showcase/snapshot-builder';
import type { PropertyShowcasePDFLabels } from '@/services/property-showcase/labels';
import type {
  ShowcaseMedia,
  ShowcaseLinkedSpaceFloorplans,
  ShowcasePropertyFloorFloorplans,
} from '@/components/property-showcase/types';
import {
  wrapInBrandedTemplate,
  BRAND,
  escapeHtml,
  type EmailSocialLink,
  type EmailSocialPlatform,
} from './base-email-template';
import {
  renderEnergy,
  renderFeatures,
  renderFinishes,
  renderLinkedSpaceFloorplans,
  renderLinkedSpaces,
  renderMediaList,
  renderPhotoGrid,
  renderPropertyFloorFloorplans,
  renderPropertyHero,
  renderShareCta,
  renderSpecs,
  renderSystems,
  renderViews,
} from './property-showcase-email-sections';

export interface BuildShowcaseEmailParams {
  snapshot: PropertyShowcaseSnapshot;
  labels: PropertyShowcasePDFLabels;
  photos?: ShowcaseMedia[];
  floorplans?: ShowcaseMedia[];
  propertyFloorFloorplans?: ShowcasePropertyFloorFloorplans;
  linkedSpaceFloorplans?: ShowcaseLinkedSpaceFloorplans;
  /** Public showcase URL (`<baseUrl>/shared/<token>`). Rendered as primary CTA. */
  shareUrl?: string;
}

export interface BuiltShowcaseEmail {
  subject: string;
  html: string;
  text: string;
}

/**
 * Build the full-parity showcase email (subject + html + text).
 *
 * The html body is wrapped by `wrapInBrandedTemplate()` so the company header
 * (with logo) and the Nestor App footer are guaranteed regardless of the
 * section set. The `text` fallback is a plain summary for clients that do not
 * render HTML.
 */
export function buildShowcaseEmail(params: BuildShowcaseEmailParams): BuiltShowcaseEmail {
  const {
    snapshot,
    labels,
    photos,
    floorplans,
    propertyFloorFloorplans,
    linkedSpaceFloorplans,
    shareUrl,
  } = params;
  const property = snapshot.property;
  const company = snapshot.company;

  const subject = `${labels.email.subjectPrefix} — ${property.name}${property.code ? ` (${property.code})` : ''}`;

  const intro = `<p style="margin:0 0 16px;font-size:14px;color:${BRAND.navyDark};line-height:1.6;">${escapeHtml(labels.email.introText)}</p>`;
  const hero = renderPropertyHero(property, labels);
  const cta = shareUrl ? renderShareCta(shareUrl, labels.email.ctaLabel) : '';

  const sections = [
    intro,
    hero,
    renderPhotoGrid(photos ?? [], labels),
    renderSpecs(property, labels),
    renderEnergy(property, labels),
    renderViews(property, labels),
    renderMediaList(floorplans ?? [], labels.floorplans.title),
    renderPropertyFloorFloorplans(propertyFloorFloorplans, labels),
    renderSystems(property, labels),
    renderFinishes(property, labels),
    renderFeatures(property, labels),
    renderLinkedSpaces(property, labels),
    renderLinkedSpaceFloorplans(linkedSpaceFloorplans, labels),
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
  });

  const text = buildTextFallback({ subject, property, shareUrl, intro: labels.email.introText });

  return { subject, html, text };
}

interface TextFallbackParams {
  subject: string;
  property: PropertyShowcaseSnapshot['property'];
  shareUrl?: string;
  intro: string;
}

function buildTextFallback(params: TextFallbackParams): string {
  const { subject, property, shareUrl, intro } = params;
  const lines = [
    subject,
    '',
    intro,
    '',
    property.name + (property.code ? ` (${property.code})` : ''),
  ];
  if (property.description) {
    lines.push('', property.description);
  }
  if (shareUrl) {
    lines.push('', shareUrl);
  }
  return lines.join('\n');
}
