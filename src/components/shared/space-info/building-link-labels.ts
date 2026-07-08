/**
 * building-link-labels — SSoT for the "link to building" EntityLinkCard labels
 *
 * Both the Parking and the Storage general tabs pass a byte-identical
 * `entityLinks.building.*` label block to `useEntityLink`. This helper is the
 * single source for that block.
 *
 * @module components/shared/space-info/building-link-labels
 * @see ADR-200 — useEntityLink hook
 * @see ADR-588 — Space tab de-duplication sweep
 */

import type { EntityLinkLabels } from '@/components/shared/EntityLinkCard';

/** Resolve the standard building-link labels from a translate function. */
export function buildBuildingLinkLabels(
  t: (key: string) => string,
): EntityLinkLabels {
  return {
    title: t('entityLinks.building.title'),
    label: t('entityLinks.building.label'),
    placeholder: t('entityLinks.building.placeholder'),
    noSelection: t('entityLinks.building.noSelection'),
    loading: t('entityLinks.building.loading'),
    save: t('entityLinks.building.save'),
    saving: t('entityLinks.building.saving'),
    success: t('entityLinks.building.success'),
    error: t('entityLinks.building.error'),
    currentLabel: t('entityLinks.building.currentLabel'),
  };
}
