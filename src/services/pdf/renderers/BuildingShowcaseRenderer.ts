/**
 * Building Showcase PDF Renderer — config factory (ADR-320 + ADR-321 Phase 2).
 *
 * Builds a `BaseShowcaseRenderer<BuildingShowcasePDFData>` by wiring the
 * building-specific spec-row builder + data accessors into the shared core.
 * All chrome / cover / footer / description / photos / floorplans pages are
 * rendered by the core — only the 2-column specs grid is surface-specific.
 *
 * @module services/pdf/renderers/BuildingShowcaseRenderer
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
import type { BuildingShowcaseSnapshot } from '@/types/building-showcase';
import type { BuildingShowcasePDFLabels } from '@/services/building-showcase/labels';

export type { BrandHeaderLogoAsset, ShowcasePhotoAsset };

export interface BuildingShowcasePDFData {
  snapshot: BuildingShowcaseSnapshot;
  photos?: ShowcasePhotoAsset[];
  floorplans?: ShowcasePhotoAsset[];
  companyLogo?: BrandHeaderLogoAsset;
  nestorAppLogo?: ShowcasePhotoAsset;
  generatedAt: Date;
  labels: BuildingShowcasePDFLabels;
  locale: 'el' | 'en';
}

function composeLocation(b: BuildingShowcaseSnapshot['building']): string {
  const parts = [b.address, b.city, b.location].filter(Boolean) as string[];
  return parts.length > 0 ? parts.join(', ') : '-';
}

function buildBuildingSpecRows(data: BuildingShowcasePDFData): ShowcaseSpecsRow[] {
  const { building } = data.snapshot;
  const { specs } = data.labels;
  const locale = data.locale;

  return [
    [specs.type,             safeShowcaseValue(building.typeLabel),
     specs.status,           safeShowcaseValue(building.statusLabel)],
    [specs.progress,         building.progress > 0 ? `${building.progress}%` : '-',
     specs.totalArea,        formatShowcasePdfArea(building.totalArea, specs.areaUnit)],
    [specs.builtArea,        formatShowcasePdfArea(building.builtArea, specs.areaUnit),
     specs.floors,           safeShowcaseValue(building.floors)],
    [specs.units,            safeShowcaseValue(building.units),
     specs.totalValue,       formatShowcasePdfEuro(building.totalValue, locale)],
    [specs.energyClass,      safeShowcaseValue(building.energyClassLabel),
     specs.renovation,       safeShowcaseValue(building.renovationLabel)],
    [specs.constructionYear, safeShowcaseValue(building.constructionYear),
     specs.startDate,        formatShowcasePdfDate(building.startDate, locale)],
    [specs.completionDate,   formatShowcasePdfDate(building.completionDate, locale),
     specs.location,         composeLocation(building)],
    [specs.project,          safeShowcaseValue(building.projectName),
     specs.linkedCompany,    safeShowcaseValue(building.linkedCompanyName)],
  ];
}

export function createBuildingShowcaseRenderer(): BaseShowcaseRenderer<BuildingShowcasePDFData> {
  const config: BaseShowcaseRendererConfig<BuildingShowcasePDFData> = {
    getCompany:       (d) => d.snapshot.company,
    getChromeLabels:  (d) => d.labels.chrome,
    getHeaderLabels:  (d) => d.labels.header,
    getCodeLabel:     (d) => d.labels.specs.code,
    getCoverTitle:    (d) => d.snapshot.building.name,
    getCoverCode:     (d) => d.snapshot.building.code,
    getDescription:   (d) => d.snapshot.building.description,
    getPhotos:        (d) => d.photos,
    getFloorplans:    (d) => d.floorplans,
    getCompanyLogo:   (d) => d.companyLogo,
    getNestorAppLogo: (d) => d.nestorAppLogo,
    getGeneratedAt:   (d) => d.generatedAt,
    getLocale:        (d) => d.locale,
    renderSpecsRows:  buildBuildingSpecRows,
  };
  return new BaseShowcaseRenderer(config);
}
