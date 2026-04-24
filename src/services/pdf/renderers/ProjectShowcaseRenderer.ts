/**
 * Project Showcase PDF Renderer — config factory (ADR-316 + ADR-321 Phase 3).
 *
 * Builds a `BaseShowcaseRenderer<ProjectShowcasePDFData>` by wiring the
 * project-specific spec-row builder + data accessors into the shared core.
 * All chrome / cover / footer / description / photos / floorplans pages are
 * rendered by the core — only the 2-column specs grid is surface-specific.
 *
 * @module services/pdf/renderers/ProjectShowcaseRenderer
 */

import {
  BaseShowcaseRenderer,
  formatShowcasePdfArea,
  formatShowcasePdfDate,
  formatShowcasePdfEuro,
  safeShowcaseValue,
  type BaseShowcaseRendererConfig,
  type BrandHeaderLogoAsset,
  type ShowcasePhotoAsset,
  type ShowcaseSpecsRow,
} from '@/services/showcase-core';
import type { ProjectShowcaseSnapshot } from '@/types/project-showcase';
import type { ProjectShowcasePDFLabels } from '@/services/project-showcase/labels';

export type { BrandHeaderLogoAsset, ShowcasePhotoAsset };

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

function buildProjectSpecRows(data: ProjectShowcasePDFData): ShowcaseSpecsRow[] {
  const { project } = data.snapshot;
  const { specs } = data.labels;
  const locale = data.locale;

  return [
    [specs.type,           safeShowcaseValue(project.typeLabel),
     specs.status,         safeShowcaseValue(project.statusLabel)],
    [specs.progress,       project.progress > 0 ? `${project.progress}%` : '-',
     specs.totalArea,      formatShowcasePdfArea(project.totalArea, specs.areaUnit)],
    [specs.totalValue,     formatShowcasePdfEuro(project.totalValue, locale),
     specs.startDate,      formatShowcasePdfDate(project.startDate, locale)],
    [specs.completionDate, formatShowcasePdfDate(project.completionDate, locale),
     specs.location,       safeShowcaseValue(project.location ?? project.city)],
    [specs.client,         safeShowcaseValue(project.client ?? project.linkedCompanyName),
     '',                   ''],
  ];
}

export function createProjectShowcaseRenderer(): BaseShowcaseRenderer<ProjectShowcasePDFData> {
  const config: BaseShowcaseRendererConfig<ProjectShowcasePDFData> = {
    getCompany:       (d) => d.snapshot.company,
    getChromeLabels:  (d) => d.labels.chrome,
    getHeaderLabels:  (d) => d.labels.header,
    getCodeLabel:     (d) => d.labels.specs.code,
    getCoverTitle:    (d) => d.snapshot.project.name,
    getCoverCode:     (d) => d.snapshot.project.projectCode,
    getDescription:   (d) => d.snapshot.project.description,
    getPhotos:        (d) => d.photos,
    getFloorplans:    (d) => d.floorplans,
    getCompanyLogo:   (d) => d.companyLogo,
    getNestorAppLogo: (d) => d.nestorAppLogo,
    getGeneratedAt:   (d) => d.generatedAt,
    getLocale:        (d) => d.locale,
    renderSpecsRows:  buildProjectSpecRows,
  };
  return new BaseShowcaseRenderer(config);
}
