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
  type ShowcaseHeaderContactLabels,
  type ShowcaseHeaderLabels,
} from '@/services/showcase-core/labels-shared';
import {
  createEnumLabelTranslator,
  readShowcaseCatalogSections,
  resolveShowcaseChromeLabels,
  resolveShowcaseDescriptionLabels,
  resolveShowcaseEmailLabels,
  resolveShowcaseHeaderLabels,
  resolveShowcaseMediaTitles,
  resolveShowcaseSpecLabels,
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


/** Spec rows this surface renders, in display order (ADR-700). */
const PROJECT_SPEC_ROWS = [
  'code',
  'type',
  'status',
  'progress',
  'totalArea',
  'totalValue',
  'startDate',
  'completionDate',
  'location',
  'client',
] as const;

export type ProjectShowcaseSpecLabels = Record<
  (typeof PROJECT_SPEC_ROWS)[number] | 'title' | 'areaUnit',
  string
>;

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
  const fb = createLocaleFallback(locale);

  return {
    specs: resolveShowcaseSpecLabels(sections, locale, {
      title: fb('Στοιχεία Έργου', 'Project Details'),
      keys: PROJECT_SPEC_ROWS,
    }),
    description: resolveShowcaseDescriptionLabels(sections, locale),
    ...resolveShowcaseMediaTitles(sections, locale),
    chrome: resolveShowcaseChromeLabels(sections, locale, {
      title: fb('Παρουσίαση Έργου', 'Project Showcase'),
      footerNote: fb('Παρουσίαση έργου', 'Project showcase'),
    }),
    email: resolveShowcaseEmailLabels(sections, locale, {
      subjectPrefix: fb('Παρουσίαση Έργου', 'Project Showcase'),
      introText: fb(
        'Σας προωθούμε την αναλυτική παρουσίαση του έργου.',
        'We are sharing the detailed presentation of the project.',
      ),
    }),
    header: resolveShowcaseHeaderLabels(
      sections,
      locale,
      fb('Παρουσίαση έργου', 'Project showcase'),
    ),
  };
}
