/**
 * @related ADR-759 §4.2 / ADR-745 §8 — a name the document states, plus who we think it is
 *
 * Section Ι records a notary. The drawing gives a **name**; whether the app knows
 * that person is a separate question, and ADR-745 §8 is explicit that reading is not
 * identification. So the row keeps both: `notaryName` verbatim, and
 * `notaryContactId` only once a human links one. Neither implies the other.
 *
 * 🔑 NO SECOND AUTOCOMPLETE. This is the same shape the app already solves for
 * employers — free text that may or may not be bound to a contact — and the shared
 * picker SSoT (`LinkedSinglePickerView`, ADR-601) already does search, debounce,
 * keyboard handling, the listbox and the clear affordance. This component owns only
 * its data source and its value shape, exactly as `EmployerPicker` does.
 *
 * ⚠️ Labels come from the `surveyRecord` namespace, NOT from
 * `useContactPickerTranslation()`. That hook loads six contact namespaces, which
 * this tab has no other reason to pull in — and unused namespaces on a project tab
 * are how i18n payloads quietly triple (CHECK 3.34).
 */
'use client';

import { useCallback, useRef } from 'react';
import { Stamp } from 'lucide-react';
import { createModuleLogger } from '@/lib/telemetry';
import { LinkedSinglePickerView } from '@/components/shared/pickers';
import { Label } from '@/components/ui/label';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { ContactsService } from '@/services/contacts.service';
import { getContactDisplayName } from '@/types/contacts';
import type { LinkedContactField } from '@/config/survey-list-config';
import { userSourced, type SurveyRecord } from '@/types/project-survey-record';
import { surveyFieldDomId } from './SourcedFieldRow';

const logger = createModuleLogger('SurveyLinkedContactField');

/** Matches `EmployerPicker`: contacts are fetched once and filtered client-side. */
const FETCH_LIMIT = 500;
const MAX_RESULTS = 10;

interface ContactOption {
  readonly id: string;
  readonly label: string;
}

/** What the picker hands back — the pair, always together. */
interface LinkedNameValue {
  readonly name: string;
  readonly contactId: string | null;
}

interface SurveyLinkedContactFieldProps {
  readonly record: SurveyRecord;
  readonly field: LinkedContactField;
  readonly index: number;
  readonly scope: string;
  readonly isEditing: boolean;
  readonly onChange: (next: SurveyRecord) => void;
}

export function SurveyLinkedContactField({
  record,
  field,
  index,
  scope,
  isEditing,
  onChange,
}: SurveyLinkedContactFieldProps) {
  const { t } = useTranslation('surveyRecord');
  const cacheRef = useRef<readonly ContactOption[] | null>(null);
  const inFlightRef = useRef(false);

  const name = field.readName(record, index);
  const linkedId = field.readLinkedId(record, index);
  const inputId = surveyFieldDomId(field.labelKey, scope);

  const loadContacts = useCallback(async (): Promise<readonly ContactOption[]> => {
    if (cacheRef.current) return cacheRef.current;
    if (inFlightRef.current) return [];
    inFlightRef.current = true;
    try {
      // Tenant scope is enforced inside the query service (`companyId` is its first
      // constraint) — this call must not add or relax a filter of its own.
      const { contacts } = await ContactsService.getAllContacts({ limitCount: FETCH_LIMIT });
      const options = contacts
        .map((contact) => ({ id: contact.id ?? '', label: getContactDisplayName(contact) }))
        .filter((option) => option.id !== '' && option.label.trim() !== '');
      cacheRef.current = options;
      return options;
    } catch (error) {
      logger.warn('Failed to load contacts for the notary picker', { error });
      return [];
    } finally {
      inFlightRef.current = false;
    }
  }, []);

  const search = useCallback(
    async (query: string): Promise<ContactOption[]> => {
      const options = await loadContacts();
      const term = query.toLowerCase().trim();
      return options
        .filter((option) => option.label.toLowerCase().includes(term))
        .slice(0, MAX_RESULTS);
    },
    [loadContacts]
  );

  const commit = (next: LinkedNameValue) => {
    onChange(
      field.write(
        record,
        index,
        userSourced<string>(next.name === '' ? null : next.name),
        next.contactId
      )
    );
  };

  if (!isEditing) {
    return (
      <div className="space-y-1.5 py-2">
        <Label className="text-sm font-medium">{t(field.labelKey)}</Label>
        {name.value === null ? (
          <p className="text-sm text-muted-foreground italic">{t('provenance.empty')}</p>
        ) : (
          <p className="text-sm">{name.value}</p>
        )}
        <p className="text-xs text-muted-foreground">
          {linkedId === null ? t(field.noLinkKey) : t(field.linkedBadgeKey)}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5 py-2">
      <Label htmlFor={inputId} className="text-sm font-medium">
        {t(field.labelKey)}
      </Label>
      <LinkedSinglePickerView<ContactOption, LinkedNameValue>
        value={name.value ?? ''}
        linkedId={linkedId ?? undefined}
        search={search}
        getResultLabel={(result) => result.label}
        buildSelected={(result, label) => ({ name: label, contactId: result.id })}
        // 🔴 Typing over a linked name UNLINKS it. The alternative — keeping the id
        // while the text changes — leaves a row that names one person and points at
        // another, which is the exact failure ADR-745 §8 exists to prevent.
        buildFreeText={(text) => ({ name: text, contactId: null })}
        onChange={commit}
        clearLabel={t('actions.clear')}
        selectedInputPadding="pr-20"
        leftIcon={
          <Stamp
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none text-muted-foreground"
            aria-hidden
          />
        }
        badge={
          <span className="absolute right-10 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">
            {t(field.linkedBadgeKey)}
          </span>
        }
        getKey={(result) => result.id}
        renderItemContent={(result) => (
          <span className="text-sm font-medium">{result.label}</span>
        )}
        labels={{
          searchResults: t('picker.searchResults'),
          noResults: t('picker.noResults'),
          useFreeText: t('picker.useFreeText'),
        }}
      />
      {linkedId === null ? (
        <p className="text-xs text-muted-foreground">{t(field.noLinkKey)}</p>
      ) : null}
    </div>
  );
}
