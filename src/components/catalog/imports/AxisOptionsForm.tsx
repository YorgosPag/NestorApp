'use client';

/**
 * @fileoverview **Η φόρμα των νέων τιμών άξονα** (ADR-923 §5.5.2 Β7): οι προτεινόμενες τιμές (επεξεργάσιμες) και, για κάθε παραλλαγή,
 *   τι θα διαβάσει ο αγωγός με αυτές. Η πρόταση και η απόδειξη είναι οι καθαρές συναρτήσεις του `axis-options-from-review`· εδώ μόνο
 *   εμφάνιση και πρόχειρο.
 * @module components/catalog/imports/AxisOptionsForm
 */

import React, { useMemo, useState } from 'react';
import { Check } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { DEFAULT_LANGUAGE } from '@/i18n/languages';
import type { AttributeRecord } from '@/services/catalog/catalog-api.client';
import {
  allResolved,
  axisRowTexts,
  proveAxisTexts,
  rowsNeedingAxis,
  suggestAxisOptions,
  withAxisOptions,
  type AxisDraftIssue,
  type AxisRowText,
  type AxisTextVerdict,
} from '@/subapps/catalog/import/axis-options-from-review';
import type { CatalogAttributeDefinition } from '@/subapps/catalog/types/attribute';
import type { ImportAxisOptionDraft, ImportProposalWire } from '@/subapps/catalog/types/catalog-import-requests';
import { useImportText } from './import-text';

const DRAFT_ISSUE_KEYS: Readonly<Record<AxisDraftIssue, string>> = {
  codeInvalid: 'review.axis.issueCodeInvalid',
  codeTaken: 'review.axis.issueCodeTaken',
  codeRepeated: 'review.axis.issueCodeRepeated',
  labelMissing: 'review.axis.issueLabelMissing',
  labelRepeated: 'review.axis.issueLabelRepeated',
};

interface AxisOptionsFormProps {
  readonly proposal: ImportProposalWire;
  readonly attribute: AttributeRecord;
  readonly attributeById: ReadonlyMap<string, AttributeRecord>;
  readonly saving: boolean;
  readonly onCancel: () => void;
  readonly onSave: (options: readonly ImportAxisOptionDraft[]) => void;
}

function optionLabel(attribute: CatalogAttributeDefinition, code: string): string {
  const option = attribute.type === 'select' ? attribute.config.options.find((entry) => entry.code === code) : undefined;
  return option?.labels[DEFAULT_LANGUAGE] ?? code;
}

interface DraftsProps {
  readonly drafts: readonly ImportAxisOptionDraft[];
  readonly issues: ReadonlyMap<number, AxisDraftIssue>;
  readonly onDrafts: (drafts: readonly ImportAxisOptionDraft[]) => void;
}

function DraftsTable({ drafts, issues, onDrafts }: DraftsProps) {
  const { t } = useImportText();
  const edit = (index: number, change: Partial<ImportAxisOptionDraft>) => onDrafts(drafts.map((draft, at) => (at === index ? { ...draft, ...change } : draft)));
  if (drafts.length === 0) return <p className="m-0 text-sm text-muted-foreground" role="status">{t('review.axis.nothingNew')}</p>;
  return (
    <table className="w-full border-collapse text-sm">
      <caption className="pb-1 text-left text-xs font-medium text-muted-foreground">{t('review.axis.newValues')}</caption>
      <thead>
        <tr className="border-b border-border text-left text-xs text-muted-foreground">
          <th className="p-1 font-medium">{t('review.axis.label')}</th>
          <th className="p-1 font-medium">{t('review.axis.code')}</th>
        </tr>
      </thead>
      <tbody>
        {drafts.map((draft, index) => {
          const issue = issues.get(index);
          return (
            <tr key={index} className="border-b border-border align-top">
              <td className="p-1"><Input aria-label={t('review.axis.label')} value={draft.label} onChange={(event) => edit(index, { label: event.target.value })} /></td>
              <td className="p-1">
                <Input aria-label={t('review.axis.code')} value={draft.code} onChange={(event) => edit(index, { code: event.target.value })} />
                {issue !== undefined ? <span className="text-xs text-destructive" role="alert">{t(DRAFT_ISSUE_KEYS[issue])}</span> : null}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function VerdictText({ verdict, next }: { readonly verdict: AxisTextVerdict; readonly next: CatalogAttributeDefinition }) {
  const { t } = useImportText();
  if (verdict.kind === 'resolved') {
    return (
      <span>
        <Check className="mr-1 inline h-3 w-3" aria-hidden />{optionLabel(next, verdict.optionCode)}
        {verdict.prefixOf ? <span className="block text-xs text-destructive">{t('review.axis.prefixOf', { option: optionLabel(next, verdict.optionCode) })}</span> : null}
      </span>
    );
  }
  if (verdict.kind === 'unmatched') return <span className="text-destructive">{t('review.axis.unmatched')}</span>;
  return <span className="text-destructive">{t('review.axis.ambiguous', { candidates: verdict.candidates.map((code) => optionLabel(next, code)).join(' · ') })}</span>;
}

function VerdictsTable({ rows, verdicts, next }: { readonly rows: readonly AxisRowText[]; readonly verdicts: readonly AxisTextVerdict[]; readonly next: CatalogAttributeDefinition }) {
  const { t } = useImportText();
  return (
    <table className="w-full border-collapse text-sm">
      <caption className="pb-1 text-left text-xs font-medium text-muted-foreground">{t('review.axis.proof')}</caption>
      <thead>
        <tr className="border-b border-border text-left text-xs text-muted-foreground">
          <th className="p-1 font-medium">{t('review.axis.printed')}</th>
          <th className="p-1 font-medium">{t('review.axis.reads')}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={row.rowKey} className="border-b border-border align-top">
            <td className="p-1">{row.printed}</td>
            <td className="p-1">
              <VerdictText verdict={verdicts[index]} next={next} />
              {row.corrected !== null ? <span className="block text-xs text-muted-foreground">{t('review.axis.corrected', { corrected: row.corrected })}</span> : null}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function AxisOptionsForm({ proposal, attribute, attributeById, saving, onCancel, onSave }: AxisOptionsFormProps) {
  const { t } = useImportText();
  const rows = useMemo(() => axisRowTexts(rowsNeedingAxis(proposal.rows, attribute.id), proposal.edits ?? [], (id) => attributeById.get(id)?.unique === true),
    [attribute.id, attributeById, proposal.edits, proposal.rows]);
  const [drafts, setDrafts] = useState<readonly ImportAxisOptionDraft[]>(() =>
    suggestAxisOptions(attribute, rows.flatMap((row) => (row.corrected === null ? [row.printed] : [row.printed, row.corrected]))));
  const plan = useMemo(() => withAxisOptions(attribute, drafts), [attribute, drafts]);
  const verdicts = useMemo(() => proveAxisTexts(plan.next, rows.map((row) => row.printed), attribute), [attribute, plan.next, rows]);
  const savable = !saving && plan.issues.size === 0 && allResolved(verdicts);
  return (
    <>
      <DraftsTable drafts={drafts} issues={plan.issues} onDrafts={setDrafts} />
      <VerdictsTable rows={rows} verdicts={verdicts} next={plan.next} />
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>{t('review.lines.cancel')}</Button>
        <Button type="button" disabled={!savable} onClick={() => onSave(drafts)}>{saving ? t('review.saving') : t('review.axis.save')}</Button>
      </DialogFooter>
    </>
  );
}
