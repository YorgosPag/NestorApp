/**
 * Project Showcase PDF labels — server-side i18n SSoT (ADR-316 + ADR-321 Phase 3).
 *
 * Reads `src/i18n/locales/{el,en}/showcase.json` → `projectShowcase` namespace
 * so the PDF generator never duplicates localised strings.
 *
 * Also exports inline label maps for project type + status (no separate
 * constants file exists for these enum labels). Chrome / email / header
 * fallbacks are delegated to `showcase-core/labels-shared` so all three
 * showcases share a single source of truth.
 *
 * @module services/project-showcase/labels
 */

import type { EnumLocale } from '@/services/property-enum-labels/property-enum-labels.service';
import {
  createLocaleFallback,
  showcaseCtaLabelDefault,
  showcaseDescriptionSectionDefault,
  showcaseGeneratedOnDefault,
  showcasePoweredByDefault,
  type ShowcaseHeaderContactLabels,
  type ShowcaseHeaderLabels,
} from '@/services/showcase-core/labels-shared';
import {
  createEnumLabelTranslator,
  readShowcaseCatalogSections,
  resolveShowcaseHeaderLabels,
  resolveShowcaseMediaTitles,
} from '@/services/showcase-core/labels-catalog';

export type { ShowcaseHeaderContactLabels };

// ============================================================================
// ENUM LABEL MAPS (inline — no centralised label service for project types)
// ============================================================================

const PROJECT_TYPE_LABELS: Record<EnumLocale, Record<string, string>> = {
  el: {
    residential: 'Κατοικίες',
    commercial: 'Εμπορικό',
    mixed: 'Μικτό',
    industrial: 'Βιομηχανικό',
    office: 'Γραφεία',
    hotel: 'Ξενοδοχείο',
    infrastructure: 'Υποδομές',
    renovation: 'Ανακαίνιση',
    other: 'Άλλο',
  },
  en: {
    residential: 'Residential',
    commercial: 'Commercial',
    mixed: 'Mixed use',
    industrial: 'Industrial',
    office: 'Office',
    hotel: 'Hotel',
    infrastructure: 'Infrastructure',
    renovation: 'Renovation',
    other: 'Other',
  },
};

const PROJECT_STATUS_LABELS: Record<EnumLocale, Record<string, string>> = {
  el: {
    planning: 'Σχεδιασμός',
    in_progress: 'Σε εξέλιξη',
    completed: 'Ολοκληρωμένο',
    on_hold: 'Σε αναμονή',
    cancelled: 'Ακυρωμένο',
  },
  en: {
    planning: 'Planning',
    in_progress: 'In progress',
    completed: 'Completed',
    on_hold: 'On hold',
    cancelled: 'Cancelled',
  },
};

export const translateProjectType = createEnumLabelTranslator(PROJECT_TYPE_LABELS);
export const translateProjectStatus = createEnumLabelTranslator(PROJECT_STATUS_LABELS);

// ============================================================================
// PDF LABEL TYPES
// ============================================================================


export interface ProjectShowcaseSpecLabels {
  title: string;
  code: string;
  type: string;
  status: string;
  progress: string;
  totalArea: string;
  totalValue: string;
  startDate: string;
  completionDate: string;
  areaUnit: string;
  location: string;
  client: string;
}

export interface ProjectShowcaseDescriptionLabels {
  sectionTitle: string;
}

export interface ProjectShowcasePhotosLabels {
  title: string;
}

export interface ProjectShowcaseFloorplansLabels {
  title: string;
}

export interface ProjectShowcasePdfChrome {
  title: string;
  generatedOn: string;
  descriptionSection: string;
  footerNote: string;
  photosTitle: string;
  floorplansTitle: string;
  poweredBy: string;
}

export interface ProjectShowcaseEmailLabels {
  subjectPrefix: string;
  introText: string;
  ctaLabel: string;
}

export interface ProjectShowcasePDFLabels {
  specs: ProjectShowcaseSpecLabels;
  description: ProjectShowcaseDescriptionLabels;
  photos: ProjectShowcasePhotosLabels;
  floorplans: ProjectShowcaseFloorplansLabels;
  chrome: ProjectShowcasePdfChrome;
  email: ProjectShowcaseEmailLabels;
  header: ShowcaseHeaderLabels;
}

// ============================================================================
// LOADER
// ============================================================================

export function loadProjectShowcasePdfLabels(locale: EnumLocale = 'el'): ProjectShowcasePDFLabels {
  const sections = readShowcaseCatalogSections('projectShowcase', locale);
  const { specs, email, namespace } = sections;
  const description = (namespace.description ?? {}) as Record<string, string>;
  const pdf = (namespace.pdf ?? {}) as Record<string, string>;

  const fb = createLocaleFallback(locale);
  const media = resolveShowcaseMediaTitles(sections, locale);

  return {
    specs: {
      title:          specs.title          ?? fb('Στοιχεία Έργου', 'Project Details'),
      code:           specs.code           ?? fb('Κωδικός', 'Code'),
      type:           specs.type           ?? fb('Τύπος', 'Type'),
      status:         specs.status         ?? fb('Κατάσταση', 'Status'),
      progress:       specs.progress       ?? fb('Πρόοδος', 'Progress'),
      totalArea:      specs.totalArea      ?? fb('Συνολικό εμβαδόν', 'Total area'),
      totalValue:     specs.totalValue     ?? fb('Συνολική αξία', 'Total value'),
      startDate:      specs.startDate      ?? fb('Έναρξη', 'Start date'),
      completionDate: specs.completionDate ?? fb('Παράδοση', 'Completion date'),
      areaUnit:       specs.areaUnit       ?? 'm²',
      location:       specs.location       ?? fb('Τοποθεσία', 'Location'),
      client:         specs.client         ?? fb('Πελάτης', 'Client'),
    },
    description: {
      sectionTitle: description.sectionTitle ?? showcaseDescriptionSectionDefault(locale),
    },
    photos: media.photos,
    floorplans: media.floorplans,
    chrome: {
      title:              pdf.title              ?? fb('Παρουσίαση Έργου', 'Project Showcase'),
      generatedOn:        pdf.generatedOn        ?? showcaseGeneratedOnDefault(locale),
      descriptionSection: pdf.descriptionSection ?? showcaseDescriptionSectionDefault(locale),
      footerNote:         pdf.footerNote         ?? fb('Παρουσίαση έργου', 'Project showcase'),
      photosTitle:        media.photos.title,
      floorplansTitle:    media.floorplans.title,
      poweredBy:          showcasePoweredByDefault(locale),
    },
    email: {
      subjectPrefix: email.subjectPrefix ?? fb('Παρουσίαση Έργου', 'Project Showcase'),
      introText:     email.introText     ?? fb('Σας προωθούμε την αναλυτική παρουσίαση του έργου.', 'We are sharing the detailed presentation of the project.'),
      ctaLabel:      email.ctaLabel      ?? showcaseCtaLabelDefault(locale),
    },
    header: resolveShowcaseHeaderLabels(
      sections,
      locale,
      fb('Παρουσίαση έργου', 'Project showcase'),
    ),
  };
}
