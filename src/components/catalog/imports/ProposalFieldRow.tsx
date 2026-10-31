'use client';

/**
 * @fileoverview **Ένα πεδίο της πρότασης** (ADR-923 §5.5): ζωντανή τιμή → εισερχόμενη, κατάσταση, βεβαιότητα, ευρήματα,
 *   απόφαση. Το κλικ στην τιμή οδηγεί το PDF στο σημείο της.
 * @module components/catalog/imports/ProposalFieldRow
 */

import React, { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCatalogCollection } from '@/hooks/catalog/useCatalogCollection';
import { formatMinor } from '@/lib/money/money';
import type { ImportFieldValue, ImportProposalField } from '@/subapps/catalog/types/catalog-import';
import { FIELD_STATUS_KEYS, PRICE_FIELD_KEYS, useImportIssueMessage, useImportText } from './import-text';

/** Η εμφάνιση μιας τιμής: η εισαγωγή δεν ξαναμορφοποιεί, δείχνει ό,τι είδε (`sourceText`) και ό,τι βγήκε. */
function valueText(value: ImportFieldValue | null): string {
  if (value === null) return '';
  switch (value.type) {
    case 'text': return value.text;
    case 'richText': return value.html;
    case 'number': return value.amount;
    case 'measurement': return `${value.amount} ${value.unitCode}`;
    case 'boolean': return String(value.value);
    case 'select': return value.optionCode;
    case 'multiSelect': return value.optionCodes.join(', ');
    case 'date': return value.date;
    case 'money': return formatMinor(value.minor);
    case 'priceQuantity': return String(value.quantity);
    case 'unit': return value.unitCode;
    case 'discountGroup': return value.discountGroupId ?? '';
    default: return '';
  }
}

const STATUS_VARIANT = { new: 'default', changed: 'secondary', unchanged: 'outline', conflict: 'destructive' } as const;

function useTargetLabel(field: ImportProposalField): string {
  const { t } = useImportText();
  const attributes = useCatalogCollection('CATALOG_ATTRIBUTES');
  const { target } = field;
  if (target.kind === 'price') return t(PRICE_FIELD_KEYS[target.field]);
  if (target.kind === 'modelCode') return t('mapping.modelCode');
  if (target.kind === 'skuIdentifier') return t('mapping.skuIdentifier');
  const attribute = attributes.items.find((item) => item.id === target.attributeId);
  return attribute?.labels.el ?? attribute?.code ?? target.attributeId;
}

interface ProposalFieldRowProps {
  readonly field: ImportProposalField;
  readonly active: boolean;
  readonly readOnly: boolean;
  readonly onFocus: () => void;
  readonly onDecide: (decision: 'accept' | 'reject') => void;
  readonly onEdit: (text: string) => void;
}

/** Η εισερχόμενη τιμή: κλικ ⇒ διόρθωση της **πηγής**, και ο διακομιστής ξανακρίνει. */
function IncomingCell({ field, label, readOnly, onEdit }: Pick<ProposalFieldRowProps, 'field' | 'readOnly' | 'onEdit'> & { readonly label: string }) {
  const message = useImportIssueMessage();
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <td className="p-2">
      {draft === null ? (
        <button type="button" className="text-left" disabled={readOnly} onClick={() => setDraft(field.sourceText)}>{valueText(field.incoming) || field.sourceText}</button>
      ) : (
        <Input
          aria-label={label}
          autoFocus
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => { if (draft !== field.sourceText) onEdit(draft); setDraft(null); }}
        />
      )}
      {field.issues.length > 0 ? (
        <ul className="m-0 mt-1 list-none p-0 text-xs text-destructive" role="alert">
          {field.issues.map((issue, index) => <li key={`${issue.code}-${index}`}>{message(issue)}</li>)}
        </ul>
      ) : null}
    </td>
  );
}

function DecisionCell({ field, readOnly, onDecide }: Pick<ProposalFieldRowProps, 'field' | 'readOnly' | 'onDecide'>) {
  const { t } = useImportText();
  return (
    <td className="p-2">
      <span className="flex gap-1">
        <Button type="button" size="sm" variant={field.decision === 'accept' ? 'default' : 'outline'} disabled={readOnly || field.incoming === null} aria-pressed={field.decision === 'accept'} onClick={() => onDecide('accept')}>{t('review.accept')}</Button>
        <Button type="button" size="sm" variant={field.decision === 'reject' ? 'default' : 'outline'} disabled={readOnly} aria-pressed={field.decision === 'reject'} onClick={() => onDecide('reject')}>{t('review.reject')}</Button>
      </span>
    </td>
  );
}

export function ProposalFieldRow({ field, active, readOnly, onFocus, onDecide, onEdit }: ProposalFieldRowProps) {
  const { t } = useImportText();
  const label = useTargetLabel(field);
  const percent = Math.round(field.confidence * 100);
  const unverified = field.anchor?.kind === 'page' && field.anchor.verified !== true;
  return (
    <tr className={active ? 'bg-accent' : 'border-b border-border'}>
      <th scope="row" className="p-2 text-left font-normal">
        <button type="button" className="text-left underline-offset-2 hover:underline" onClick={onFocus}>{label}</button>
      </th>
      <td className="p-2 text-muted-foreground">{valueText(field.live)}</td>
      <IncomingCell field={field} label={label} readOnly={readOnly} onEdit={onEdit} />
      <td className="p-2"><Badge variant={STATUS_VARIANT[field.status]}>{t(FIELD_STATUS_KEYS[field.status])}</Badge></td>
      <td className="p-2 text-xs text-muted-foreground">
        {percent}%{unverified ? ` · ${t('review.unverified')}` : ''}
      </td>
      <DecisionCell field={field} readOnly={readOnly} onDecide={onDecide} />
    </tr>
  );
}
