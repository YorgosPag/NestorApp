'use client';

/**
 * Η ενότητα «Ταυτότητα» του επεξεργαστή (ADR-928 §5.4 · §5.5 · §5.2.2 · Φ3γ): τίτλος (ελληνικά + η δεύτερη γλώσσα αν
 * υπάρχει), τρόπος έκδοσης Α/Β, ισχύς προσφοράς, δεύτερη γλώσσα εγγράφου.
 *
 * 🔑 Δεύτερη γλώσσα = μόνο όσες έχουν **κείμενα εγγράφου** (`DOCUMENT_LANGUAGES` χωρίς τα ελληνικά — δηλωμένο όριο Φ3β)·
 *    το όνομα γλώσσας από το CLDR (`Intl.DisplayNames`), όχι γραμμένο στο χέρι.
 */

import { DatePickerField } from '@/components/ui/date-picker-field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { resolveHumanLanguage } from '@/i18n/languages';
import { dateKeyOfPicker, pickerDateOfKey } from '@/lib/calendar/date-key';
import { issuesAt } from '@/subapps/procurement/subcontracts/agreements/issue-paths';
import { DOCUMENT_LANGUAGES } from '@/subapps/procurement/subcontracts/document/document-locale';
import { CLAUSE_AUTHORITATIVE_LANGUAGE } from '@/subapps/procurement/subcontracts/types/clause';
import { AGREEMENT_DOCUMENT_MODES } from '@/subapps/procurement/subcontracts/types/trade-template';
import { EditorField, issuesIdOf } from './EditorField';
import type { AgreementEditor } from './useAgreementEditor';

/** Η τιμή «χωρίς δεύτερη γλώσσα» στο Select — όχι κενό (CHECK 3.48: το Radix δεσμεύει το `''`). */
const NO_SECONDARY = 'none';
const SECONDARY_CHOICES = DOCUMENT_LANGUAGES.filter((language) => language !== CLAUSE_AUTHORITATIVE_LANGUAGE);

interface SectionProps {
  readonly editor: AgreementEditor;
}

function TitleFields({ editor }: SectionProps) {
  const { t } = useTranslation('procurement');
  const { draft, update } = editor;
  const secondary = draft.languages.secondary;
  const setTitle = (language: string, text: string) => update({ ...draft, title: { ...draft.title, [language]: text } });
  return (
    <>
      <EditorField id="editor-title-el" label={t('subcontracts.editor.identity.title')} issues={issuesAt(editor.issues, 'title')}>
        <Input id="editor-title-el" value={draft.title[CLAUSE_AUTHORITATIVE_LANGUAGE] ?? ''} onChange={(event) => setTitle(CLAUSE_AUTHORITATIVE_LANGUAGE, event.target.value)} aria-describedby={issuesIdOf('editor-title-el')} />
      </EditorField>
      {secondary && (
        <EditorField id="editor-title-secondary" label={t('subcontracts.editor.identity.titleSecondary')}>
          <Input id="editor-title-secondary" value={draft.title[secondary] ?? ''} onChange={(event) => setTitle(secondary, event.target.value)} />
        </EditorField>
      )}
    </>
  );
}

function ModeField({ editor }: SectionProps) {
  const { t } = useTranslation('procurement');
  const { draft, update } = editor;
  const choose = (mode: string) => {
    const next = AGREEMENT_DOCUMENT_MODES.find((candidate) => candidate === mode);
    if (next) update({ ...draft, documentMode: next });
  };
  return (
    <EditorField id="editor-mode" label={t('subcontracts.editor.identity.mode')} issues={issuesAt(editor.issues, 'documentMode')}>
      <Select value={draft.documentMode} onValueChange={choose}>
        <SelectTrigger id="editor-mode"><SelectValue /></SelectTrigger>
        <SelectContent>{AGREEMENT_DOCUMENT_MODES.map((mode) => <SelectItem key={mode} value={mode}>{t(`subcontracts.editor.identity.modes.${mode}`)}</SelectItem>)}</SelectContent>
      </Select>
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
