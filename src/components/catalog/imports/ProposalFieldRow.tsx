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
import type { ImportProposalField } from '@/subapps/catalog/types/catalog-import';
import { useImportIssueMessage } from './import-issue-messages';
import { FIELD_STATUS_KEYS, PRICE_FIELD_KEYS, useImportText } from './import-text';
import { useImportValueText } from './import-value-text';

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
  const message = useImportIssueMessage(field.issues.length > 0);
  const describe = useImportValueText();
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <td className="p-2">
      {draft === null ? (
        <button type="button" className="text-left" disabled={readOnly} onClick={() => setDraft(field.sourceText)}>{describe(field.incoming) || field.sourceText}</button>
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
      <Corroboration field={field} />
    </td>
  );
}

/** Ε7: η ίδια ποσότητα σε άλλη μονάδα συμφώνησε. Πληροφορία, όχι εύρημα: δεν ζητά απόφαση. */
function Corroboration({ field }: { readonly field: ImportProposalField }) {
  const { t } = useImportText();
  const others = field.corroboratedBy ?? [];
  if (others.length === 0) return null;
  return <p className="m-0 mt-1 text-xs text-muted-foreground">{t('review.corroboratedBy', { values: others.join(' · ') })}</p>;
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
  const describe = useImportValueText();
  const percent = Math.round(field.confidence * 100);
  const verified = field.anchor?.kind === 'page' ? field.anchor.verified : true;
  /** Ε8: `null` = η σελίδα δεν είχε κείμενο να ελεγχθεί η τιμή · `false` = είχε, και δεν την επιβεβαίωσε. */
  const unverifiedNote = verified === null ? t('review.uncheckable') : verified === false ? t('review.unverified') : null;
  return (
    <tr className={active ? 'bg-accent' : 'border-b border-border'}>
      <th scope="row" className="p-2 text-left font-normal">
        <button type="button" className="text-left underline-offset-2 hover:underline" onClick={onFocus}>{label}</button>
      </th>
      <td className="p-2 text-muted-foreground">{describe(field.live)}</td>
      <IncomingCell field={field} label={label} readOnly={readOnly} onEdit={onEdit} />
      <td className="p-2"><Badge variant={STATUS_VARIANT[field.status]}>{t(FIELD_STATUS_KEYS[field.status])}</Badge></td>
      <td className="p-2 text-xs text-muted-foreground">
        {percent}%{unverifiedNote ? ` · ${unverifiedNote}` : ''}
      </td>
      <DecisionCell field={field} readOnly={readOnly} onDecide={onDecide} />
    </tr>
  );
}
