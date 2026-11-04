'use client';

/**
 * Πολύγλωσσο κείμενο του **εγγράφου** (ADR-928 §5.2.2 · Φ3γ-2): τα ελληνικά, που είναι η αυθεντία, και η δεύτερη γλώσσα του
 * εγγράφου αν υπάρχει. Ένα στοιχείο για τίτλο, περιγραφή γραμμής, σχόλιο, ρόλο συνεργείου κ.λπ.
 *
 * 🔑 Όχι το `LocalizedTextField` του καταλόγου: εκείνο δείχνει **όλες** τις ανθρώπινες γλώσσες και ευρήματα καταλόγου.
 *    Εδώ μετρούν μόνο οι γλώσσες που θα **τυπωθούν** (`languages.secondary`).
 * 🔑 Το όνομα γλώσσας από το CLDR (`Intl.DisplayNames`), όχι γραμμένο στο χέρι.
 */

import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { HumanLanguage } from '@/i18n/languages';
import { issuesAt } from '@/subapps/procurement/subcontracts/agreements/issue-paths';
import { CLAUSE_AUTHORITATIVE_LANGUAGE } from '@/subapps/procurement/subcontracts/types/clause';
import type { LocalizedText } from '@/subapps/procurement/subcontracts/types/clause-parameter';
import { EditorField, issuesIdOf } from '../editor/EditorField';
import type { FieldProps } from './section-types';

interface LocalizedTextFieldsProps extends FieldProps<LocalizedText> {
  readonly label: string;
  readonly language: HumanLanguage;
  readonly secondaryLanguage: string | null;
  readonly multiline?: boolean;
}

function languageName(screen: HumanLanguage, language: string): string {
  return new Intl.DisplayNames([screen], { type: 'language' }).of(language) ?? language;
}

export function LocalizedTextFields({ id, label, value, onChange, path, issues, language, secondaryLanguage, multiline = false }: LocalizedTextFieldsProps) {
  const control = (controlId: string, of: string, describedBy?: string) => {
    const shared = { id: controlId, value: value[of] ?? '', 'aria-describedby': describedBy };
    const set = (text: string) => onChange({ ...value, [of]: text });
    return multiline
      ? <Textarea {...shared} rows={2} onChange={(event) => set(event.target.value)} />
      : <Input {...shared} onChange={(event) => set(event.target.value)} />;
  };
  return (
    <>
      <EditorField id={id} label={label} issues={issuesAt(issues, path)}>
        {control(id, CLAUSE_AUTHORITATIVE_LANGUAGE, issuesIdOf(id))}
      </EditorField>
      {secondaryLanguage && (
        <EditorField id={`${id}-${secondaryLanguage}`} label={`${label} (${languageName(language, secondaryLanguage)})`}>
          {control(`${id}-${secondaryLanguage}`, secondaryLanguage)}
        </EditorField>
      )}
    </>
  );
}
