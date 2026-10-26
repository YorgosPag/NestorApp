/**
 * Σημασιολογική επικύρωση ρυθμίσεων καταλόγου και ορισμού μέσου (ADR-923 §5.10 Δ6 · Δ9):
 * κάθε κανάλι κρίνεται σε **τουλάχιστον μία** γλώσσα (κανάλι χωρίς γλώσσα θα ήταν «πάντα πλήρες»
 * — ψέμα), χωρίς διπλότυπα· ο ρόλος ενός μέσου δέχεται το είδος του (φύλλο δεδομένων ≠ βίντεο).
 * Τα δικαιώματα (`MediaRights`) τα κρίνει ο κοινός μηχανισμός τους στη Φάση 2γ.
 * @module subapps/catalog/schema/validate-catalog-settings
 */

import type { CatalogAssetDefinition } from '../types/asset';
import type { CatalogSettingsDefinition } from '../types/catalog-settings';
import { isKindAllowedForRole } from '../vocabulary/asset-roles';
import { CATALOG_CHANNELS } from '../vocabulary/channels';
import { isCatalogCode } from '../vocabulary/catalog-limits';
import { IssueCollector, reportDuplicates, type CatalogIssue } from './catalog-issues';

export function validateCatalogSettings(settings: CatalogSettingsDefinition): readonly CatalogIssue[] {
  const collector = new IssueCollector();
  for (const channel of CATALOG_CHANNELS) {
    const locales = settings.channelLocales[channel];
    const path = `channelLocales.${channel}`;
    if (locales.length === 0) collector.add('channelLocalesRequired', path, { channel });
    reportDuplicates(collector, locales, (index) => `${path}[${index}]`);
  }
  return collector.issues;
}

export function validateCatalogAsset(asset: CatalogAssetDefinition): readonly CatalogIssue[] {
  const collector = new IssueCollector();
  if (!isCatalogCode(asset.code)) collector.add('invalidCode', 'code');
  if (!isKindAllowedForRole(asset.role, asset.kind)) {
    collector.add('assetRoleKindMismatch', 'kind', { role: asset.role, kind: asset.kind });
  }
  // Ίδιο κριτήριο με το `NonBlankText` του σχήματος δικαιωμάτων — εδώ ως εύρημα στο πεδίο, όχι ως 400 χωρίς διαδρομή.
  if (asset.rights.creator.name.trim().length === 0) collector.add('rightsCreatorRequired', 'rights.creator.name');
  return collector.issues;
}
