'use client';

/**
 * @fileoverview **Η ετικέτα ενός πεδίου πρότασης** (ADR-923 §5.5) — τιμή, κωδικός, ιδιότητα — από **ένα** σημείο. Τη ζητούν η
 *   γραμμή του πίνακα (`ProposalFieldRow`) και το πλαίσιο πάνω στο PDF (`ImportReviewOverlay`, §5.5.2 Β8): ο αναγνώστης οθόνης
 *   ακούει στο PDF **την ίδια λέξη** που βλέπει ο άνθρωπος στη λίστα.
 * @module components/catalog/imports/import-target-label
 */

import { useCallback } from 'react';

import { useCatalogCollection } from '@/hooks/catalog/useCatalogCollection';
import type { ImportProposalField } from '@/subapps/catalog/types/catalog-import';
import { PRICE_FIELD_KEYS, TRADE_FIELD_KEYS, useImportText } from './import-text';

type TargetLabeler = (field: ImportProposalField) => string;

export function useTargetLabeler(): TargetLabeler {
  const { t } = useImportText();
  const attributes = useCatalogCollection('CATALOG_ATTRIBUTES');
  return useCallback((field: ImportProposalField) => {
    const { target } = field;
    if (target.kind === 'price') return t(PRICE_FIELD_KEYS[target.field]);
    if (target.kind === 'modelCode') return t('mapping.modelCode');
    if (target.kind === 'skuIdentifier') return t('mapping.skuIdentifier');
    if (target.kind === 'tradeIdentity') return t(TRADE_FIELD_KEYS[target.field]);
    const attribute = attributes.items.find((item) => item.id === target.attributeId);
    return attribute?.labels.el ?? attribute?.code ?? target.attributeId;
  }, [t, attributes.items]);
}
