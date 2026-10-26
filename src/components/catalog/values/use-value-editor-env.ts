'use client';
/**
 * **Το περιβάλλον των επεξεργαστών τιμών** — ένα σημείο για επεξεργαστή μοντέλου και πλέγμα παραλλαγών (ADR-923 §5.10.4).
 *
 * Ο κωδικοποιητής κειμένου (μητρώο μονάδων · γλώσσα · κωδικοί μέσων · ναι/όχι), η βιβλιοθήκη μέσων και οι αναφορές
 * (άλμα σε κωδικό σε όλο τον κατάλογο) — ό,τι διαβάζουν και οι δύο οθόνες με **την ίδια** σημασία.
 *
 * @module components/catalog/values/use-value-editor-env
 */

import { useMemo } from 'react';

import { useCompanyId } from '@/hooks/useCompanyId';
import { firestoreQueryService } from '@/services/firestore/firestore-query.service';
import type { CatalogReferenceTarget } from '@/subapps/catalog/types/product';

import { useCatalogText } from '../shared/catalog-ui-hooks';
import { resolveCatalogCode, type CodeJumpReader } from '../products/catalog-code-jump';
import type { ProductCatalogContext } from '../products/use-product-catalog-context';
import type { ValueEditorEnv } from './value-editor-types';

const read: CodeJumpReader = (collection, id) => firestoreQueryService.getById<Record<string, unknown>>(collection, id);

export function useValueEditorEnv(ctx: ProductCatalogContext, describe: (target: CatalogReferenceTarget) => string): ValueEditorEnv {
  const { t, text, language } = useCatalogText();
  const companyId = useCompanyId()?.companyId ?? null;
  return useMemo((): ValueEditorEnv => {
    const uniqueAttributes = ctx.library.attributes.filter((attribute) => attribute.unique).map((attribute) => ({ id: attribute.id, type: attribute.type }));
    return {
      codec: {
        registry: ctx.library.registry,
        language,
        assetIdByCode: new Map(ctx.assets.map((asset) => [asset.code.toLowerCase(), asset.id])),
        assetCodeById: new Map(ctx.assets.map((asset) => [asset.id, asset.code])),
        yes: t('values.yes'),
        no: t('values.no'),
      },
      assets: ctx.assets,
      assetById: ctx.assetById,
      files: ctx.files.byId,
      text,
      references: {
        resolve: async (code) => (companyId ? resolveCatalogCode(companyId, code, uniqueAttributes, read) : null),
        describe,
      },
    };
  }, [ctx.library.attributes, ctx.library.registry, ctx.assets, ctx.assetById, ctx.files.byId, language, t, text, companyId, describe]);
}
