'use client';

/**
 * Η ενότητα «Ταυτότητα» του επεξεργαστή (ADR-928 §5.4 · §5.5 · §5.2.2 · Φ3γ): τίτλος (ελληνικά + η δεύτερη γλώσσα αν
 * υπάρχει), τρόπος έκδοσης Α/Β, ισχύς προσφοράς, δεύτερη γλώσσα εγγράφου.
 *
 * 🔑 Δεύτερη γλώσσα = μόνο όσες έχουν **κείμενα εγγράφου** (`DOCUMENT_LANGUAGES` χωρίς τα ελληνικά — δηλωμένο όριο Φ3β)·
 *    το όνομα γλώσσας από το CLDR (`Intl.DisplayNames`), όχι γραμμένο στο χέρι.
 */

import { DatePickerField } from '@/components/ui/date-picker-field';
import { EnumSelect } from '@/components/ui/enum-select';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { resolveHumanLanguage } from '@/i18n/languages';
import { dateKeyOfPicker, pickerDateOfKey } from '@/lib/calendar/date-key';
import { issuesAt } from '@/subapps/procurement/subcontracts/agreements/issue-paths';
import { DOCUMENT_LANGUAGES } from '@/subapps/procurement/subcontracts/document/document-locale';
import { CLAUSE_AUTHORITATIVE_LANGUAGE } from '@/subapps/procurement/subcontracts/types/clause';
import { AGREEMENT_DOCUMENT_MODES } from '@/subapps/procurement/subcontracts/types/trade-template';
import { LocalizedTextFields } from '../sections/LocalizedTextFields';
import { EditorField } from './EditorField';
import type { AgreementEditor } from './useAgreementEditor';

/** Η τιμή «χωρίς δεύτερη γλώσσα» στο Select — όχι κενό (CHECK 3.48: το Radix δεσμεύει το `''`). */
const NO_SECONDARY = 'none';
const SECONDARY_CHOICES = DOCUMENT_LANGUAGES.filter((language) => language !== CLAUSE_AUTHORITATIVE_LANGUAGE);

interface SectionProps {
  readonly editor: AgreementEditor;
}

function TitleFields({ editor }: SectionProps) {
  const { t, i18n } = useTranslation('procurement');
  const { draft, update } = editor;
  return (
    <LocalizedTextFields
      id="editor-title-el" label={t('subcontracts.editor.identity.title')} value={draft.title} onChange={(title) => update({ ...draft, title })}
      path="title" issues={editor.issues} language={resolveHumanLanguage(i18n.language)} secondaryLanguage={draft.languages.secondary}
    />
  );
}

function ModeField({ editor }: SectionProps) {
  const { t } = useTranslation('procurement');
  const { draft, update } = editor;
  return (
    <EditorField id="editor-mode" label={t('subcontracts.editor.identity.mode')} issues={issuesAt(editor.issues, 'documentMode')}>
      <EnumSelect id="editor-mode" value={draft.documentMode} values={AGREEMENT_DOCUMENT_MODES} getLabel={(mode) => t(`subcontracts.editor.identity.modes.${mode}`)} onValueChange={(documentMode) => update({ ...draft, documentMode })} />
    </EditorField>
  );
}

function SecondaryLanguageField({ editor }: SectionProps) {
  const { t, i18n } = useTranslation('procurement');
  const { draft, update } = editor;
  const names = new Intl.DisplayNames([resolveHumanLanguage(i18n.language)], { type: 'language' });
  return (
    <EditorField id="editor-secondary" label={t('subcontracts.editor.identity.secondaryLanguage')} issues={issuesAt(editor.issues, 'languages.secondary')}>
      <Select value={draft.languages.secondary ?? NO_SECONDARY} onValueChange={(language) => update({ ...draft, languages: { secondary: language === NO_SECONDARY ? null : language } })}>
        <SelectTrigger id="editor-secondary"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value={NO_SECONDARY}>{t('subcontracts.editor.identity.noSecondary')}</SelectItem>
          {SECONDARY_CHOICES.map((language) => <SelectItem key={language} value={language}>{names.of(language) ?? language}</SelectItem>)}
        </SelectContent>
      </Select>
    </EditorField>
  );
}

export function IdentitySection({ editor }: SectionProps) {
  const { t } = useTranslation('procurement');
  const { draft, update } = editor;
  return (
    <section aria-labelledby="editor-identity" className="space-y-3">
      <h3 id="editor-identity" className="text-base font-semibold">{t('subcontracts.editor.sections.identity')}</h3>
      <fieldset className="grid gap-3 md:grid-cols-2">
        <TitleFields editor={editor} />
        <ModeField editor={editor} />
        <SecondaryLanguageField editor={editor} />
        <EditorField id="editor-valid-until" label={t('subcontracts.editor.identity.validUntil')} issues={issuesAt(editor.issues, 'validUntil')}>
          <DatePickerField id="editor-valid-until" value={pickerDateOfKey(draft.validUntil)} onSelect={(date) => update({ ...draft, validUntil: dateKeyOfPicker(date) })} placeholder={t('subcontracts.editor.identity.noValidity')} />
        </EditorField>
      </fieldset>
    </section>
  );
}
