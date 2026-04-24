/**
 * =============================================================================
 * SHOWCASE CORE — Shared labels helpers (ADR-321)
 * =============================================================================
 *
 * Eliminates the fallback-string duplication across the three legacy labels
 * loaders (property / project / building). Each of those files used to
 * hard-code identical fallback tuples (EL/EN) for chrome, email, header, and
 * header-contacts sections. This module centralises those fallbacks so
 * labels loaders only own the entity-specific specs interface shapes.
 *
 * Canonical baseline per ADR-321 — extracted from
 * `property-showcase/labels.ts` chrome/email/header defaults and verified
 * byte-identical against project + building counterparts.
 *
 * @module services/showcase-core/labels-shared
 */

import type { EnumLocale } from '@/services/property-enum-labels/property-enum-labels.service';

// =============================================================================
// Public label types (stable contract across every showcase surface)
// =============================================================================

export interface ShowcaseHeaderContactLabels {
  addressLabel: string;
  phoneLabel: string;
  emailLabel: string;
  websiteLabel: string;
  socialLabel: string;
}

export interface ShowcaseHeaderLabels {
  subtitle: string;
  contacts: ShowcaseHeaderContactLabels;
}

export interface ShowcasePdfChromeLabels {
  title: string;
  generatedOn: string;
  descriptionSection: string;
  footerNote: string;
  photosTitle: string;
  floorplansTitle: string;
  poweredBy: string;
  /** Only present on the property showcase (which has a view section). */
  viewsTitle?: string;
}

export interface ShowcaseEmailLabels {
  subjectPrefix: string;
  introText: string;
  ctaLabel: string;
}

// =============================================================================
// Defaults
// =============================================================================

export function showcasePoweredByDefault(locale: EnumLocale): string {
  return locale === 'el' ? 'Υλοποίηση από Nestor App' : 'Powered by Nestor App';
}

export function showcaseCtaLabelDefault(locale: EnumLocale): string {
  return locale === 'el' ? 'Δείτε online' : 'View online';
}

export function showcaseGeneratedOnDefault(locale: EnumLocale): string {
  return locale === 'el' ? 'Δημιουργήθηκε' : 'Generated on';
}

export function showcaseDescriptionSectionDefault(locale: EnumLocale): string {
  return locale === 'el' ? 'Περιγραφή' : 'Description';
}

export function showcasePhotosTitleDefault(locale: EnumLocale): string {
  return locale === 'el' ? 'Φωτογραφίες' : 'Photos';
}

export function showcaseFloorplansTitleDefault(locale: EnumLocale): string {
  return locale === 'el' ? 'Κατόψεις' : 'Floorplans';
}

/**
 * Resolve the five header-contact labels from the raw showcase.json `header.
 * contacts` block with locale-aware fallbacks. All three legacy labels
 * loaders used identical fallbacks — this is now the single definition.
 */
export function resolveHeaderContactLabels(
  raw: Record<string, unknown> | undefined,
  locale: EnumLocale,
): ShowcaseHeaderContactLabels {
  const src = (raw ?? {}) as Record<string, string | undefined>;
  const fb = (el: string, en: string): string => (locale === 'el' ? el : en);
  return {
    addressLabel: src.addressLabel ?? fb('Διεύθυνση', 'Address'),
    phoneLabel:   src.phoneLabel   ?? fb('Τηλέφωνο', 'Phone'),
    emailLabel:   src.emailLabel   ?? 'Email',
    websiteLabel: src.websiteLabel ?? fb('Ιστοσελίδα', 'Website'),
    socialLabel:
      src.socialLabel
      ?? fb('Μέσα κοινωνικής δικτύωσης', 'Social media'),
  };
}

/**
 * Locale-aware fallback helper — centralised so entity-specific loaders
 * don't reinvent the `(el, en) => locale === 'el' ? el : en` ternary.
 */
export function createLocaleFallback(
  locale: EnumLocale,
): (el: string, en: string) => string {
  return (el, en) => (locale === 'el' ? el : en);
}
