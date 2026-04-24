/**
 * Building Showcase PDF Service — factory delegating to ShowcasePDFService
 * (ADR-320 + ADR-321 Phase 2).
 *
 * Thin surface factory: composes the generic `ShowcasePDFService` with the
 * building-specific renderer produced by `createBuildingShowcaseRenderer`.
 * Caller-owned singleton — instantiate once at module load in the route file.
 *
 * @module services/pdf/BuildingShowcasePDFService
 */

import { ShowcasePDFService } from '@/services/showcase-core';
import {
  createBuildingShowcaseRenderer,
  type BuildingShowcasePDFData,
} from './renderers/BuildingShowcaseRenderer';

export type { BuildingShowcasePDFData };

export function createBuildingShowcasePdfService(): ShowcasePDFService<BuildingShowcasePDFData> {
  return new ShowcasePDFService(createBuildingShowcaseRenderer());
}
