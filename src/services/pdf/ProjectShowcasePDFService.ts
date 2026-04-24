/**
 * Project Showcase PDF Service — factory delegating to ShowcasePDFService
 * (ADR-316 + ADR-321 Phase 3).
 *
 * Thin surface factory: composes the generic `ShowcasePDFService` with the
 * project-specific renderer produced by `createProjectShowcaseRenderer`.
 * Caller-owned singleton — instantiate once at module load in the route file.
 *
 * @module services/pdf/ProjectShowcasePDFService
 */

import { ShowcasePDFService } from '@/services/showcase-core';
import {
  createProjectShowcaseRenderer,
  type ProjectShowcasePDFData,
} from './renderers/ProjectShowcaseRenderer';

export type { ProjectShowcasePDFData };

export function createProjectShowcasePdfService(): ShowcasePDFService<ProjectShowcasePDFData> {
  return new ShowcasePDFService(createProjectShowcaseRenderer());
}
