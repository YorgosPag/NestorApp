'use client';

/**
 * Συνεργείο (ADR-928 §5.4, 2009: «τουλάχιστον 3 άτομα, 2 τεχνίτες προς 1 βοηθό, ημερομίσθιο ως προκαταβολή»): ελάχιστο
 * πλήθος και μέλη με ειδικότητα, μερίδιο αναλογίας και (προαιρετικά) συμφωνημένο ημερομίσθιο.
 *
 * 🔑 Ειδικότητα από το ΕΝΑ λεξιλόγιο `TRADE_CODES` με τις ετικέτες του `quotes:trades.*`. Η τιμή «καμία» δεν είναι κενό
 *    `SelectItem` (CHECK 3.48).
 */

import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EnumSelect } from '@/components/ui/enum-select';
import { MoneyField, NumericField } from '@/components/ui/numeric-field';
import { Switch } from '@/components/ui/switch';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { removeAt, replaceAt } from '@/lib/array-utils';
import { issuesAt } from '@/subapps/procurement/subcontracts/agreements/issue-paths';
import { joinPath } from '@/subapps/procurement/subcontracts/clauses/clause-issues';
import { NEW_CREW, newCrewMember } from '@/subapps/procurement/subcontracts/terms/term-edits';
import type { CrewMember, CrewTerms } from '@/subapps/procurement/subcontracts/types/commercial-terms';
import { TRADE_CODES } from '@/subapps/procurement/types/trade';
import { EditorField } from '../../editor/EditorField';
import { LocalizedTextFields } from '../LocalizedTextFields';
import type { TermsSectionProps } from './TermsSection';

const NO_TRADE = 'none';
const TRADE_CHOICES = [NO_TRADE, ...TRADE_CODES] as const;

interface MemberProps {
  readonly member: CrewMember;
  readonly index: number;
  readonly update: (member: CrewMember) => void;
  readonly remove: () => void;
  readonly at: string;
  readonly props: TermsSectionProps;
}

function MemberRow({ member, index, update, remove, at, props }: MemberProps) {
  const { t } = useTranslation(['procurement', 'quotes']);
  const id = `crew-${index}`;
  const { issues } = props;
  return (
    <li className="grid gap-2 rounded-md border p-2 sm:grid-cols-2">
      <LocalizedTextFields id={`${id}-role`} label={t('subcontracts.sections.terms.crewRole')} value={member.role} onChange={(role) => update({ ...member, role })}
        path={joinPath(at, 'role')} issues={issues} language={props.language} secondaryLanguage={props.secondaryLanguage} />
      <EditorField id={`${id}-trade`} label={t('subcontracts.sections.terms.crewTrade')}>
        <EnumSelect id={`${id}-trade`} value={member.trade ?? NO_TRADE} values={TRADE_CHOICES}
          getLabel={(trade) => (trade === NO_TRADE ? t('subcontracts.sections.terms.noTrade') : t(`quotes:trades.${trade}`))}
          onValueChange={(trade) => update({ ...member, trade: trade === NO_TRADE ? null : trade })} />
      </EditorField>
      <EditorField id={`${id}-ratio`} label={t('subcontracts.sections.terms.crewRatio')} issues={issuesAt(issues, joinPath(at, 'ratioParts'))}>
        <NumericField id={`${id}-ratio`} value={member.ratioParts} min={1} step={1} onValueChange={(ratioParts) => update({ ...member, ratioParts })} />
      </EditorField>
      <EditorField id={`${id}-wage`} label={t('subcontracts.sections.terms.crewWage')} issues={issuesAt(issues, joinPath(at, 'dailyWage'))}>
        <MoneyField id={`${id}-wage`} nullable value={member.dailyWage} placeholder={t('subcontracts.sections.terms.noWage')} onValueChange={(dailyWage) => update({ ...member, dailyWage })} />
      </EditorField>
      <Button type="button" variant="ghost" size="sm" className="justify-self-start" onClick={remove}>
        <Trash2 className="mr-1 h-4 w-4" aria-hidden />{t('subcontracts.sections.terms.removeMember', { position: index + 1 })}
      </Button>
    </li>
  );
}

function CrewBody({ crew, props }: { readonly crew: CrewTerms; readonly props: TermsSectionProps }) {
  const { t } = useTranslation('procurement');
  const { value, onChange, path, issues } = props;
  const at = joinPath(path, 'crew');
  const setCrew = (next: CrewTerms) => onChange({ ...value, crew: next });
  return (
    <>
      <EditorField id="crew-headcount" label={t('subcontracts.sections.terms.crewHeadcount')} issues={issuesAt(issues, joinPath(at, 'minimumHeadcount'))}>
        <NumericField id="crew-headcount" value={crew.minimumHeadcount} min={0} step={1} onValueChange={(minimumHeadcount) => setCrew({ ...crew, minimumHeadcount })} />
      </EditorField>
      <ul className="space-y-2">
        {crew.members.map((member, index) => (
          <MemberRow key={`crew-${index}`} member={member} index={index} props={props} at={joinPath(at, 'members', index)}
            update={(next) => setCrew({ ...crew, members: replaceAt(crew.members, index, next) })}
            remove={() => setCrew({ ...crew, members: removeAt(crew.members, index) })} />
        ))}
      </ul>
      <Button type="button" variant="outline" size="sm" onClick={() => setCrew({ ...crew, members: [...crew.members, newCrewMember()] })}>
        <Plus className="mr-1 h-4 w-4" aria-hidden />{t('subcontracts.sections.terms.addMember')}
      </Button>
    </>
  );
}

export function CrewFields(props: TermsSectionProps) {
  const { t } = useTranslation('procurement');
  const { value, onChange } = props;
  return (
    <fieldset className="space-y-2">
      <legend className="mb-2 flex items-center gap-2 text-sm font-medium">
        <Switch aria-label={t('subcontracts.sections.terms.crew')} checked={value.crew !== null} onCheckedChange={(on) => onChange({ ...value, crew: on ? NEW_CREW : null })} />
        {t('subcontracts.sections.terms.crew')}
      </legend>
      {value.crew && <CrewBody crew={value.crew} props={props} />}
    </fieldset>
  );
}
