'use client';

/**
 * @fileoverview Ο **στόχος** μιας νέας εισαγωγής (ADR-923 §5.5): σκοπός, οικογένεια ή πρόχειρη έκδοση, και οι ιδιότητες που
 *   προσφέρονται στην αντιστοίχιση.
 * @module components/catalog/imports/use-import-target
 */

import { useEffect, useMemo, useState } from 'react';

import { useCatalogCollection } from '@/hooks/catalog/useCatalogCollection';
import { fetchPriceListsView } from '@/services/catalog/catalog-pricing-api.client';
import type { ImportBatchTarget } from '@/subapps/catalog/types/catalog-import';
import type { PriceListsView } from '@/subapps/catalog/types/pricing-views';
import { useCatalogText } from '../shared/catalog-ui-hooks';
import type { AttributeChoice } from './import-source-file';
import type { ImportChoice } from './NewImportFields';

function usePriceVersions(enabled: boolean): readonly ImportChoice[] {
  const [view, setView] = useState<PriceListsView | null>(null);
  const { text } = useCatalogText();
  useEffect(() => {
    if (enabled) void fetchPriceListsView().then(setView).catch(() => setView(null));
  }, [enabled]);
  return useMemo(() => {
    const labels = new Map((view?.lists ?? []).map((list) => [list.id, text(list.labels)]));
    return (view?.versions ?? []).filter((version) => version.status === 'draft').map((version) => ({ value: version.id, label: `${labels.get(version.priceListId) ?? ''} · ${version.number}` }));
  }, [text, view]);
}

export type ImportPurposeChoice = ImportBatchTarget['purpose'];

export function useImportTarget() {
  const { text } = useCatalogText();
  const families = useCatalogCollection('CATALOG_FAMILIES');
  const attributes = useCatalogCollection('CATALOG_ATTRIBUTES');
  const [purpose, setPurpose] = useState<ImportPurposeChoice>('attributes');
  const [familyId, setFamilyId] = useState('');
  const family = families.items.find((item) => item.id === familyId) ?? null;
  const familyAttributes = useMemo<AttributeChoice[]>(() => {
    const ids = new Set(family?.attributes.map((binding) => binding.attributeId) ?? []);
    return attributes.items.filter((attribute) => family === null || ids.has(attribute.id)).map((attribute) => ({ id: attribute.id, label: text(attribute.labels) || attribute.code }));
  }, [attributes.items, family, text]);
  const familyChoices = families.items.map((item) => ({ value: item.id, label: text(item.labels) || item.code }));
  const firstIdentifier = attributes.items.find((attribute) => attribute.unique)?.id ?? '';
  const targetOfFamily = (id: string): ImportBatchTarget => {
    setFamilyId(id);
    return { purpose: 'attributes', familyId: id, variantSchemeCode: families.items.find((item) => item.id === id)?.variantSchemes[0]?.code ?? null, categoryIds: [] };
  };
  const targetOfVersion = (priceListVersionId: string): ImportBatchTarget => ({ purpose: 'priceLines', priceListVersionId, identifierAttributeId: firstIdentifier });
  return { purpose, setPurpose, familyId, familyChoices, familyAttributes, versions: usePriceVersions(purpose === 'priceLines'), targetOfFamily, targetOfVersion };
}
