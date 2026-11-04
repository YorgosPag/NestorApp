'use client';

/**
 * Οι λίστες των εμπορικών όρων (ADR-928 §5.4): επιμερισμός κόστους · απαιτούμενα έγγραφα · ελάχιστη απόδοση.
 *
 * 🔑 Ετικέτες από τη **λέξη του εγγράφου** (`documentLocaleOf`: μέρη, είδη εγγράφων), όχι δεύτερη μετάφραση.
 * 🔑 Η ελάχιστη απόδοση διαλέγει γραμμή **του ίδιου εγγράφου**. Γραμμή που αφαιρέθηκε μένει επιλεγμένη και ο κριτής τη λέει
 *    ορφανή (`terms.minimumOutputs.N.lineId`), αντί να αλλάξει σιωπηλά σε άλλη.
 */

import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EnumSelect } from '@/components/ui/enum-select';
import { MilliQuantityField, NumericField } from '@/components/ui/numeric-field';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { removeAt, replaceAt } from '@/lib/array-utils';
import { issuesAt } from '@/subapps/procurement/subcontracts/agreements/issue-paths';
import { joinPath } from '@/subapps/procurement/subcontracts/clauses/clause-issues';
import { documentLocaleOf } from '@/subapps/procurement/subcontracts/document/document-locale';
import { localizedIn } from '@/subapps/procurement/subcontracts/document/render-parameter-value';
import { newCostSharingItem, newMinimumOutput, newRequiredDocument } from '@/subapps/procurement/subcontracts/terms/term-edits';
import { CLAUSE_PARTIES } from '@/subapps/procurement/subcontracts/types/clause-parameter';
import { REQUIRED_DOCUMENT_KINDS, type CostSharingItem, type MinimumOutput, type RequiredDocument } from '@/subapps/procurement/subcontracts/types/commercial-terms';
import { EditorField } from '../../editor/EditorField';
import { FieldIssues } from '../../editor/FieldIssues';
import { LocalizedTextFields } from '../LocalizedTextFields';
import { SharesEditor } from '../SharesEditor';
import type { TermsSectionProps } from './TermsSection';

function RemoveButton({ label, onClick }: { readonly label: string; readonly onClick: () => void }) {
  return <Button type="button" variant="ghost" size="icon" aria-label={label} onClick={onClick}><Trash2 className="h-4 w-4" aria-hidden /></Button>;
}

function AddButton({ label, onClick, disabled }: { readonly label: string; readonly onClick: () => void; readonly disabled?: boolean }) {
  return <Button type="button" variant="outline" size="sm" onClick={onClick} disabled={disabled}><Plus className="mr-1 h-4 w-4" aria-hidden />{label}</Button>;
}

function CostSharingRow({ item, index, props, update }: { readonly item: CostSharingItem; readonly index: number; readonly props: TermsSectionProps; readonly update: (item: CostSharingItem) => void }) {
  const { t } = useTranslation('procurement');
  const at = joinPath(props.path, 'costSharing', index);
  const locale = documentLocaleOf(props.language);
  return (
    <>
      <LocalizedTextFields id={`cost-${index}-description`} label={t('subcontracts.sections.terms.costDescription')} value={item.description}
        onChange={(description) => update({ ...item, description })} path={joinPath(at, 'description')} issues={props.issues} language={props.language} secondaryLanguage={props.secondaryLanguage} />
      <SharesEditor id={`cost-${index}-shares`} legend={t('subcontracts.sections.terms.costShares')} items={item.shares} onChange={(shares) => update({ ...item, shares })}
        shareOf={(share) => share.share} withShare={(share, next) => ({ ...share, share: next })} newItem={() => ({ party: 'shared', share: 0 })}
        addLabel={t('subcontracts.sections.terms.addParty')} path={joinPath(at, 'shares')} issues={props.issues} language={props.language}
        renderFields={(share, set, shareIndex) => (
          <EnumSelect id={`cost-${index}-party-${shareIndex}`} ariaLabel={t('subcontracts.sections.terms.party')} value={share.party} values={CLAUSE_PARTIES}
            getLabel={(party) => locale.phrase(`parameter.party.${party}`)} onValueChange={(party) => set({ ...share, party })} />
        )} />
    </>
  );
}

export function CostSharingFields(props: TermsSectionProps) {
  const { t } = useTranslation('procurement');
  const { value, onChange } = props;
  const set = (costSharing: readonly CostSharingItem[]) => onChange({ ...value, costSharing });
  return (
    <fieldset className="space-y-2">
      <legend className="mb-2 text-sm font-medium">{t('subcontracts.sections.terms.costSharing')}</legend>
      <ul className="space-y-3">
        {value.costSharing.map((item, index) => (
          <li key={`cost-${index}`} className="space-y-2 rounded-md border p-2">
            <CostSharingRow item={item} index={index} props={props} update={(next) => set(replaceAt(value.costSharing, index, next))} />
            <RemoveButton label={t('subcontracts.sections.terms.removeCost', { position: index + 1 })} onClick={() => set(removeAt(value.costSharing, index))} />
          </li>
        ))}
      </ul>
      <AddButton label={t('subcontracts.sections.terms.addCost')} onClick={() => set([...value.costSharing, newCostSharingItem()])} />
    </fieldset>
  );
}

const WHEN_KINDS = ['before_each_payment', 'days_before_start'] as const;

interface DocumentRowProps {
  readonly document: RequiredDocument;
  readonly index: number;
  readonly language: TermsSectionProps['language'];
  readonly update: (document: RequiredDocument) => void;
}

function DocumentRow({ document, index, language, update }: DocumentRowProps) {
  const { t } = useTranslation('procurement');
  const locale = documentLocaleOf(language);
  const id = `document-${index}`;
  return (
    <span className="flex flex-wrap items-end gap-2">
      <EnumSelect id={`${id}-kind`} ariaLabel={t('subcontracts.sections.terms.documentKind')} value={document.kind} values={REQUIRED_DOCUMENT_KINDS}
        getLabel={(kind) => locale.phrase(`terms.documentKind.${kind}`)} onValueChange={(kind) => update({ ...document, kind })} />
      <EnumSelect id={`${id}-when`} ariaLabel={t('subcontracts.sections.terms.documentWhen')} value={document.when.kind} values={WHEN_KINDS}
        getLabel={(kind) => t(`subcontracts.sections.terms.when.${kind}`)}
        onValueChange={(kind) => update({ ...document, when: kind === 'days_before_start' ? { kind, days: 5 } : { kind } })} />
      {document.when.kind === 'days_before_start' && (
        <span className="w-24"><NumericField id={`${id}-days`} aria-label={t('subcontracts.sections.terms.documentDays')} value={document.when.days} min={0} step={1}
          onValueChange={(days) => update({ ...document, when: { kind: 'days_before_start', days } })} /></span>
      )}
    </span>
  );
}

export function RequiredDocumentsFields(props: TermsSectionProps) {
  const { t } = useTranslation('procurement');
  const { value, onChange, path, issues } = props;
  const set = (requiredDocuments: readonly RequiredDocument[]) => onChange({ ...value, requiredDocuments });
  const next = newRequiredDocument(value.requiredDocuments);
  return (
    <fieldset className="space-y-2">
      <legend className="mb-2 text-sm font-medium">{t('subcontracts.sections.terms.requiredDocuments')}</legend>
      <ul className="space-y-2">
        {value.requiredDocuments.map((document, index) => (
          <li key={`document-${index}`} className="flex flex-wrap items-end gap-2">
            <DocumentRow document={document} index={index} language={props.language} update={(changed) => set(replaceAt(value.requiredDocuments, index, changed))} />
            <RemoveButton label={t('subcontracts.sections.terms.removeDocument', { position: index + 1 })} onClick={() => set(removeAt(value.requiredDocuments, index))} />
            <FieldIssues issues={issuesAt(issues, joinPath(path, 'requiredDocuments', index))} />
          </li>
        ))}
      </ul>
      <AddButton label={t('subcontracts.sections.terms.addDocument')} disabled={next === null} onClick={() => next && set([...value.requiredDocuments, next])} />
    </fieldset>
  );
}

function OutputRow({ output, index, props, update }: { readonly output: MinimumOutput; readonly index: number; readonly props: TermsSectionProps; readonly update: (output: MinimumOutput) => void }) {
  const { t } = useTranslation('procurement');
  const { lines, language, issues, path } = props;
  const lineIds = lines.map((line) => line.id);
  const choices = lineIds.includes(output.lineId) ? lineIds : [output.lineId, ...lineIds];
  const labelOf = (lineId: string) => {
    const position = lineIds.indexOf(lineId);
    if (position < 0) return t('subcontracts.sections.terms.removedLine');
    return `${t('subcontracts.sections.lines.position', { position: position + 1 })} · ${localizedIn(lines[position].description, language)}`;
  };
  const at = joinPath(path, 'minimumOutputs', index);
  return (
    <span className="flex flex-wrap items-end gap-2">
      <EditorField id={`output-${index}-line`} label={t('subcontracts.sections.terms.outputLine')} issues={issuesAt(issues, joinPath(at, 'lineId'))}>
        <EnumSelect id={`output-${index}-line`} value={output.lineId} values={choices} getLabel={labelOf} onValueChange={(lineId) => update({ ...output, lineId })} />
      </EditorField>
      <EditorField id={`output-${index}-quantity`} label={t('subcontracts.sections.terms.outputPerDay')} issues={issuesAt(issues, at)}>
        <MilliQuantityField id={`output-${index}-quantity`} value={output.milliUnitsPerDay} onValueChange={(milliUnitsPerDay) => update({ ...output, milliUnitsPerDay })} />
      </EditorField>
    </span>
  );
}

export function MinimumOutputsFields(props: TermsSectionProps) {
  const { t } = useTranslation('procurement');
  const { value, onChange, lines } = props;
  const set = (minimumOutputs: readonly MinimumOutput[]) => onChange({ ...value, minimumOutputs });
  const next = newMinimumOutput(lines, value.minimumOutputs);
  return (
    <fieldset className="space-y-2">
      <legend className="mb-2 text-sm font-medium">{t('subcontracts.sections.terms.minimumOutputs')}</legend>
      <ul className="space-y-2">
        {value.minimumOutputs.map((output, index) => (
          <li key={`output-${index}`} className="flex flex-wrap items-end gap-2">
            <OutputRow output={output} index={index} props={props} update={(changed) => set(replaceAt(value.minimumOutputs, index, changed))} />
            <RemoveButton label={t('subcontracts.sections.terms.removeOutput', { position: index + 1 })} onClick={() => set(removeAt(value.minimumOutputs, index))} />
          </li>
        ))}
      </ul>
      <AddButton label={t('subcontracts.sections.terms.addOutput')} disabled={next === null} onClick={() => next && set([...value.minimumOutputs, next])} />
    </fieldset>
  );
}
