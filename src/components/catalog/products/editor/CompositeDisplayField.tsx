'use client';
/**
 * **Σύνθετη ένδειξη στον επεξεργαστή προϊόντος** — μόνο-ανάγνωσης, ζωντανή όσο γράφεις (ADR-923 §21.6).
 *
 * Όπως το «Electrical Data» του Revit: υπολογίζεται από τα πεδία της ομάδας και δεν επεξεργάζεται εδώ. **Πέρα από το Revit**
 * (που δείχνει απλώς κενό): το μέρος που λείπει **ονομάζει** την ιδιότητα — και τον λόγο, αν δηλώθηκε «δεν εφαρμόζεται /
 * άγνωστο» — και είναι **κουμπί** που πηγαίνει στο πεδίο της. Ίδια κομμάτια με πίνακα και εκτύπωση (`composeDisplayPieces`).
 *
 * @module components/catalog/products/editor/CompositeDisplayField
 */

import React, { useId } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { AttributeRecord } from '@/services/catalog/catalog-api.client';
import type { CompositeDisplay } from '@/subapps/catalog/types/family';
import { composeDisplayPieces, type ComposedPiece } from '@/subapps/catalog/values/composite-display';
import type { ResolvedValues } from '@/subapps/catalog/values/resolve-inherited';
import { readSlot } from '@/subapps/catalog/values/value-shape';

import { NO_VALUE_REASON_KEYS } from '../../shared/catalog-labels';
import { useCatalogText } from '../../shared/catalog-ui-hooks';
import type { ValueEditorEnv } from '../../values/value-editor-types';
import type { ListScope } from '../ProductListToolbar';

interface CompositeDisplayFieldProps {
  readonly composite: CompositeDisplay;
  readonly attributeById: ReadonlyMap<string, AttributeRecord>;
  readonly resolved: ResolvedValues;
  readonly scope: ListScope;
  readonly env: ValueEditorEnv;
  /** Πήγαινε στο πεδίο της ιδιότητας (καρτέλα + εστίαση). */
  readonly onJump: (attributeId: string) => void;
}

function MissingPart({ attributeId, props }: { readonly attributeId: string; readonly props: CompositeDisplayFieldProps }) {
  const { t, text } = useCatalogText();
  const attribute = props.attributeById.get(attributeId);
  const label = attribute ? text(attribute.labels, attribute.code) : attributeId;
  const reason = props.resolved.noValueReasons.get(attributeId)?.reason;
  const state = reason ? t(NO_VALUE_REASON_KEYS[reason]) : t('values.composite.missingState');
  return (
    <Button type="button" variant="link" size="sm" className="h-auto p-0 align-baseline text-destructive"
      aria-label={t('values.composite.goToField', { label })} onClick={() => props.onJump(attributeId)}>
      {t('values.composite.missing', { label, state })}
    </Button>
  );
}

function Pieces({ pieces, separator, props }: { readonly pieces: readonly ComposedPiece[]; readonly separator: string; readonly props: CompositeDisplayFieldProps }) {
  return (
    <>
      {pieces.map((piece, index) => (
        <React.Fragment key={index}>
          {index > 0 ? <span>{separator}</span> : null}
          {piece.kind === 'value' ? <span>{piece.text}</span> : <MissingPart attributeId={piece.attributeId} props={props} />}
        </React.Fragment>
      ))}
    </>
  );
}

export function CompositeDisplayField(props: CompositeDisplayFieldProps) {
  const { t, text } = useCatalogText();
  const labelId = useId();
  const { composite, attributeById, resolved, scope, env } = props;
  const valueOf = (attributeId: string) => {
    const attribute = attributeById.get(attributeId);
    return attribute ? readSlot(resolved.values.get(attributeId)?.slots, attribute, scope.channel, scope.locale) : undefined;
  };
  const { pieces } = composeDisplayPieces(composite, { attributeById, valueOf, codec: env.codec });
  return (
    <section className="grid gap-1 rounded-md border border-dashed p-3" aria-labelledby={labelId}>
      <h4 id={labelId} className="m-0 flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
        {text(composite.labels, composite.id)}
        <Badge variant="outline">{t('values.composite.readOnly')}</Badge>
      </h4>
      <output aria-labelledby={labelId} aria-live="polite" className="whitespace-pre-wrap text-sm">
        {pieces.length === 0 ? <span className="text-muted-foreground">{t('values.empty')}</span> : <Pieces pieces={pieces} separator={composite.separator} props={props} />}
      </output>
      <p className="m-0 text-xs text-muted-foreground">{t('values.composite.hint')}</p>
    </section>
  );
}
