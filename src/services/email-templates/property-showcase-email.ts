/**
 * @fileoverview Property Showcase HTML email — thin config on top of the
 * showcase-core email builder factory (ADR-312 + ADR-321 Phase 4).
 *
 * Surface-specific concerns:
 *   - Property hero (code + description)
 *   - Specs key/value table wired to the property snapshot shape
 *   - 8 body sections: energy, views, floorplans list, propertyFloor,
 *     systems, finishes, features, linkedSpaces, linkedSpaceFloorplans
 *
 * Everything else (subject, intro, photo grid, CTA, branded wrap, text
 * fallback) lives in `createShowcaseEmailBuilder`.
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
  createShowcaseEmailBuilder,
  type BuildShowcaseEmailParams as CoreBuildShowcaseEmailParams,
  type BuiltShowcaseEmail as CoreBuiltShowcaseEmail,
} from '@/services/showcase-core';
import { renderMediaList } from './showcase-email-shared';
import {
  renderPropertyHero,
  renderSpecs,
  renderEnergy,
  renderViews,
  renderPropertyFloorFloorplans,
  renderSystems,
  renderFinishes,
  renderFeatures,
  renderLinkedSpaces,
  renderLinkedSpaceFloorplans,
} from './property-showcase-email-sections';

export interface PropertyShowcaseEmailExtras {
  propertyFloorFloorplans?: ShowcasePropertyFloorFloorplans;
  linkedSpaceFloorplans?: ShowcaseLinkedSpaceFloorplans;
}

export type BuildShowcaseEmailParams = CoreBuildShowcaseEmailParams<
  PropertyShowcaseSnapshot,
  PropertyShowcasePDFLabels,
  ShowcaseMedia,
  PropertyShowcaseEmailExtras
>;

export type BuiltShowcaseEmail = CoreBuiltShowcaseEmail;

export const buildShowcaseEmail = createShowcaseEmailBuilder<
  PropertyShowcaseSnapshot,
  PropertyShowcasePDFLabels,
  ShowcaseMedia,
  PropertyShowcaseEmailExtras
>({
  getEntityHeading: (snapshot) => {
    const p = snapshot.property;
    return {
      name: p.name,
      codeSuffix: p.code ? ` (${p.code})` : '',
      description: p.description,
    };
  },
  getCompany: (snapshot) => snapshot.company,
  labels: {
    subjectPrefix:   (l) => l.email.subjectPrefix,
    introText:       (l) => l.email.introText,
    ctaLabel:        (l) => l.email.ctaLabel,
    headerSubtitle:  (l) => l.header.subtitle,
    contactLabels:   (l) => l.header.contacts,
    photosTitle:     (l) => l.chrome.photosTitle,
    floorplansTitle: (l) => l.floorplans.title,
  },
  hooks: {
    renderHero:  ({ snapshot, labels }) => renderPropertyHero(snapshot.property, labels),
    renderSpecs: ({ snapshot, labels }) => renderSpecs(snapshot.property, labels),
    renderBodySections: ({ snapshot, labels, floorplans, extras }) => {
      const p = snapshot.property;
      return [
        renderEnergy(p, labels),
        renderViews(p, labels),
        renderMediaList(floorplans, labels.floorplans.title),
        renderPropertyFloorFloorplans(extras?.propertyFloorFloorplans, labels),
        renderSystems(p, labels),
        renderFinishes(p, labels),
        renderFeatures(p, labels),
        renderLinkedSpaces(p, labels),
        renderLinkedSpaceFloorplans(extras?.linkedSpaceFloorplans, labels),
      ];
    },
  },
});
