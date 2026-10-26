'use client';
/**
 * **Ο πίνακας του μοντέλου με πραγματικές τιμές** — ο ίδιος builder/renderer με την προεπισκόπηση της οικογένειας
 * (ADR-923 §5.10.4 Β6). Ζει κάτω από το πλέγμα παραλλαγών και διαβάζει το **ίδιο** επεξεργασμένο σύνολο: ό,τι
 * επικολλάς φαίνεται αμέσως όπως θα τυπωθεί.
 *
 * @module components/catalog/products/variants/ModelTablePreview
 */

import { useMemo } from 'react';

import { PreviewTable } from '@/components/catalog/families/FamilyTablePreview';
import { buildTablePreview } from '@/components/catalog/families/family-table-preview';
import type { AttributeRecord } from '@/services/catalog/catalog-api.client';
import type { CatalogAggregate } from '@/subapps/catalog/aggregate/aggregate-model';
import type { CatalogSchemaSnapshot } from '@/subapps/catalog/derived/chain-derived';
import type { MeasurementRegistry } from '@/subapps/catalog/measurement/measurement-registry';

import { useCatalogText } from '../../shared/catalog-ui-hooks';
import type { ValueEditorEnv } from '../../values/value-editor-types';
import type { ListScope } from '../ProductListToolbar';
import { modelTableColumns } from './model-table-data';

export interface ModelTablePreviewProps {
  readonly aggregate: CatalogAggregate;
  readonly order: readonly string[];
  readonly schema: CatalogSchemaSnapshot;
  readonly attributeById: ReadonlyMap<string, AttributeRecord>;
  readonly registry: MeasurementRegistry;
  readonly scope: ListScope;
  readonly env: ValueEditorEnv;
}

export function ModelTablePreview(props: ModelTablePreviewProps) {
  const { t, text } = useCatalogText();
  const preview = useMemo(() => {
    const real = modelTableColumns({ aggregate: props.aggregate, order: props.order, schema: props.schema, attributeById: props.attributeById, scope: props.scope, codec: props.env.codec });
    return buildTablePreview(props.schema.family, props.attributeById, props.registry, { text, yes: t('common.yes'), no: t('common.no'), sample: t('families.table.sample') }, real);
  }, [props.aggregate, props.order, props.schema, props.attributeById, props.registry, props.scope, props.env.codec, text, t]);
  if (!preview) return <p className="m-0 text-sm text-muted-foreground">{t('variants.table.noSpec')}</p>;
  return <PreviewTable preview={preview} title={t('variants.table.title')} id="model-table-title" />;
}
