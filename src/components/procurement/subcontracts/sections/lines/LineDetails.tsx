'use client';

/**
 * Οι λεπτομέρειες μιας γραμμής (ADR-928 §5.4 · Δ7 · Φ3γ-2 απόφαση 5): τιμή πελάτη, σχόλιο, κανόνας επιμέτρησης, στάδια,
 * όριο ενσήμων, υπέρβαση του σχεδίου πληρωμών.
 *
 * 🔑 Ό,τι είναι προαιρετικό στο μοντέλο (`null`) έχει **διακόπτη**, όχι μηδενική τιμή: «χωρίς όριο ενσήμων» δεν είναι
 *    «όριο 0».
 * 🔑 Κανόνας επιμέτρησης ως απλό κείμενο χωρίς απώλειες (`clause-blocks-text`). Αν ήρθε με παράμετρο από αλλού, μένει
 *    μόνο ανάγνωση με εξήγηση, και δεν «ισοπεδώνεται».
 */

import { useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { MilliQuantityField, MoneyField } from '@/components/ui/numeric-field';
import { UomSelect } from '@/components/shared/UomSelect';
import { PROCUREMENT_UNIT_OPTIONS } from '@/config/procurement-units';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { issuesAt, issuesUnder } from '@/subapps/procurement/subcontracts/agreements/issue-paths';
import { blocksOfText, textOfBlocks } from '@/subapps/procurement/subcontracts/clauses/clause-blocks-text';
import { joinPath } from '@/subapps/procurement/subcontracts/clauses/clause-issues';
import { newLineStage, optionalText } from '@/subapps/procurement/subcontracts/lines/line-edits';
import type { AgreementLine, AgreementLineStage } from '@/subapps/procurement/subcontracts/types/agreement-line';
import { EditorField } from '../../editor/EditorField';
import { LocalizedTextFields } from '../LocalizedTextFields';
import { SharesEditor } from '../SharesEditor';
import type { LineCardProps } from './LineCard';
import { LinePaymentOverride } from './LinePaymentOverride';

type DetailProps = Pick<LineCardProps, 'value' | 'onChange' | 'path' | 'issues' | 'language' | 'secondaryLanguage' | 'index'>;

function ClientPrice({ value, onChange, path, issues, index }: DetailProps) {
  const { t } = useTranslation('procurement');
  const id = `line-${index}-client`;
  return (
    <fieldset className="flex flex-wrap items-end gap-3">
      <EditorField id={id} label={t('subcontracts.sections.lines.clientPrice')} issues={issuesAt(issues, joinPath(path, 'clientUnitPrice'))}>
        <MoneyField id={id} nullable value={value.clientUnitPrice} placeholder={t('subcontracts.sections.lines.clientPriceNone')} onValueChange={(clientUnitPrice) => onChange({ ...value, clientUnitPrice, printClientPrice: clientUnitPrice !== null && value.printClientPrice })} />
      </EditorField>
      {value.clientUnitPrice !== null && (
        <label className="flex items-center gap-2 pb-2 text-sm">
          <Switch checked={value.printClientPrice} onCheckedChange={(printClientPrice) => onChange({ ...value, printClientPrice })} />
          {t('subcontracts.sections.lines.printClientPrice')}
        </label>
      )}
    </fieldset>
  );
}

/**
 * Το κείμενο που γράφεται **τώρα**. Τα μπλοκ είναι η αλήθεια, αλλά ξαναχτισμένο από αυτά σε κάθε πλήκτρο το πεδίο θα έτρωγε
 * την κενή γραμμή και το «- » πριν γραφτεί το στοιχείο λίστας. Το πρόχειρο ακολουθεί τα μπλοκ μόνο όταν αλλάξουν απ' έξω
 * (απόρριψη αλλαγών, νέα εκδοχή).
 */
function useBlocksText(text: string | null, commit: (next: string) => void) {
  const [draft, setDraft] = useState(text ?? '');
  const same = text !== null && textOfBlocks(blocksOfText(draft)) === text;
  if (text !== null && !same && draft !== text) setDraft(text);
  return { draft, change: (next: string) => { setDraft(next); commit(next); } };
}

function MeasurementRule({ value, onChange, path, issues, index }: DetailProps) {
  const { t } = useTranslation('procurement');
  const id = `line-${index}-measurement`;
  const text = value.measurementRule ? textOfBlocks(value.measurementRule.blocks) : '';
  const { draft, change: set } = useBlocksText(text, (next) => {
    const blocks = blocksOfText(next);
    onChange({ ...value, measurementRule: blocks.length > 0 ? { blocks } : null });
  });
  return (
    <EditorField id={id} label={t('subcontracts.sections.lines.measurementRule')} issues={issuesUnder(issues, joinPath(path, 'measurementRule'))}>
      {text === null
        ? <p className="text-sm text-muted-foreground">{t('subcontracts.sections.lines.measurementHasParameters')}</p>
        : <Textarea id={id} rows={4} value={draft} placeholder={t('subcontracts.sections.lines.measurementHint')} onChange={(event) => set(event.target.value)} />}
    </EditorField>
  );
}

function Stages({ value, onChange, path, issues, language, secondaryLanguage, index }: DetailProps) {
  const { t } = useTranslation('procurement');
  const stagesPath = joinPath(path, 'stages');
  return (
    <SharesEditor<AgreementLineStage>
      id={`line-${index}-stages`} legend={t('subcontracts.sections.lines.stages')} items={value.stages}
      onChange={(stages) => onChange({ ...value, stages })} shareOf={(stage) => stage.share} withShare={(stage, share) => ({ ...stage, share })}
      newItem={() => newLineStage(value.stages)} addLabel={t('subcontracts.sections.lines.addStage')} path={stagesPath} issues={issues} language={language}
      renderFields={(stage, update, stageIndex) => (
        <span className="grid min-w-48 flex-1 gap-1">
          <LocalizedTextFields id={`line-${index}-stage-${stageIndex}`} label={t('subcontracts.sections.lines.stageLabel')} value={stage.label}
            onChange={(label) => update({ ...stage, label })} path={joinPath(stagesPath, stageIndex, 'label')} issues={issues} language={language} secondaryLanguage={secondaryLanguage} />
        </span>
      )}
    />
  );
}

function InsuredDaysCap({ value, onChange, path, issues, index }: DetailProps) {
  const { t } = useTranslation('procurement');
  const cap = value.insuredDaysCap;
  const at = joinPath(path, 'insuredDaysCap');
  const id = `line-${index}-insured`;
  return (
    <fieldset className="flex flex-wrap items-end gap-3">
      <label className="flex items-center gap-2 pb-2 text-sm">
        <Switch checked={cap !== null} onCheckedChange={(on) => onChange({ ...value, insuredDaysCap: on ? { unit: value.unit, milliUnitsPerInsuredDay: 0 } : null })} />
        {t('subcontracts.sections.lines.insuredCap')}
      </label>
      {cap && (
        <>
          <EditorField id={`${id}-quantity`} label={t('subcontracts.sections.lines.insuredCapQuantity')} issues={issuesAt(issues, joinPath(at, 'milliUnitsPerInsuredDay'))}>
            <MilliQuantityField id={`${id}-quantity`} value={cap.milliUnitsPerInsuredDay} onValueChange={(milliUnitsPerInsuredDay) => onChange({ ...value, insuredDaysCap: { ...cap, milliUnitsPerInsuredDay } })} />
          </EditorField>
          <EditorField id={`${id}-unit`} label={t('subcontracts.sections.lines.unit')} issues={issuesAt(issues, joinPath(at, 'unit'))}>
            <UomSelect id={`${id}-unit`} value={cap.unit} units={PROCUREMENT_UNIT_OPTIONS} compact onValueChange={(unit) => onChange({ ...value, insuredDaysCap: { ...cap, unit } })} />
          </EditorField>
        </>
      )}
    </fieldset>
  );
}

export function LineDetails(props: DetailProps) {
  const { t } = useTranslation('procurement');
  const { value, onChange, path, issues, language, secondaryLanguage, index } = props;
  return (
    <section aria-label={t('subcontracts.sections.lines.details')} className="space-y-4">
      <ClientPrice {...props} />
      <LocalizedTextFields id={`line-${index}-comment`} label={t('subcontracts.sections.lines.comment')} value={value.comment ?? { el: '' }}
        onChange={(comment) => onChange({ ...value, comment: optionalText(comment) })} path={joinPath(path, 'comment')} issues={issues}
        language={language} secondaryLanguage={secondaryLanguage} multiline />
      <MeasurementRule {...props} />
      <Stages {...props} />
      <InsuredDaysCap {...props} />
      <LinePaymentOverride {...props} />
    </section>
  );
}
