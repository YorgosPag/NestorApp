/**
 * Property Showcase PDF Service — factory delegating to ShowcasePDFService
 * (ADR-312 + ADR-321 Phase 4).
 *
 * Thin surface factory: composes the generic `ShowcasePDFService` with the
 * property-specific `PropertyShowcaseRenderer`. The renderer implements
 * `ShowcaseRendererLike<PropertyShowcasePDFData>` and owns the property-specific
 * multi-page ordering (cover → overview → description → photos →
 * specs+orientation → energy+views → floorplans → systems → linked spaces).
 *
 * @module services/pdf/PropertyShowcasePDFService
 */

import { ShowcasePDFService } from '@/services/showcase-core';
import { PropertyShowcaseRenderer } from './renderers/PropertyShowcaseRenderer';
import type { PropertyShowcasePDFData } from './renderers/PropertyShowcaseRenderer';

export type { PropertyShowcasePDFData };

export function createPropertyShowcasePdfService(): ShowcasePDFService<PropertyShowcasePDFData> {
  return new ShowcasePDFService(new PropertyShowcaseRenderer());
}
