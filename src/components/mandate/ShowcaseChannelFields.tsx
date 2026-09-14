'use client';

/**
 * @fileoverview **ΤΗΛΕΦΩΝΑ ΚΑΙ EMAIL ΕΝΟΣ ΚΑΤΑΣΤΗΜΑΤΟΣ** — με ανάδραση **πριν** την υποβολή (ADR-841 §7 Α21.16).
 * @related lib/contact/channel-phone.ts · lib/validation/email-validation.ts (οι ίδιοι κριτές με τον διακομιστή)
 * @module components/mandate/ShowcaseChannelFields
 */

import React from 'react';
import { Plus, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { normalisePhone } from '@/lib/contact/channel-phone';
import { isValidEmail } from '@/lib/validation/email-validation';
import type { PhoneDraft } from '@/lib/agency/showcase-card-draft';
import { MAX_EMAILS_PER_LOCATION, MAX_PHONES_PER_LOCATION } from '@/types/showcase-card';
import {
  SHOWCASE_CARD_KEYS,
  SHOWCASE_NS,
  SHOWCASE_REJECTION_KEYS,
} from '@/components/mandate/agency-showcase-labels';

/** Άκυρο **μόνο** όταν γράφτηκε κάτι — η κενή γραμμή είναι «δεν δηλώνω», όχι λάθος. */
const phoneLooksInvalid = (number: string) => number.trim() !== '' && !normalisePhone(number).ok;
const emailLooksInvalid = (email: string) => email.trim() !== '' && !isValidEmail(email);

export function ShowcasePhoneFields({
  phones,
  onChange,
}: {
  readonly phones: readonly PhoneDraft[];
  readonly onChange: (phones: readonly PhoneDraft[]) => void;
}): React.ReactElement {
  const { t } = useTranslation([SHOWCASE_NS]);
  const edit = (index: number, patch: Partial<PhoneDraft>) =>
    onChange(phones.map((phone, at) => (at === index ? { ...phone, ...patch } : phone)));

  return (
    <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
      <legend className="text-sm font-medium text-foreground">{t(SHOWCASE_CARD_KEYS.phonesLabel)}</legend>
      {phones.map((phone, index) => (
        <span key={index} className="flex flex-wrap items-center gap-2">
          <Input type="tel" inputMode="tel" autoComplete="tel" className="w-48" placeholder={t(SHOWCASE_CARD_KEYS.phonePlaceholder)} aria-label={t(SHOWCASE_CARD_KEYS.phonesLabel)} aria-invalid={phoneLooksInvalid(phone.number)} value={phone.number} onChange={(event) => edit(index, { number: event.target.value })} />
          <Input className="w-20" placeholder={t(SHOWCASE_CARD_KEYS.extensionPlaceholder)} aria-label={t(SHOWCASE_CARD_KEYS.extensionPlaceholder)} value={phone.extension} onChange={(event) => edit(index, { extension: event.target.value })} />
          <Button type="button" variant="ghost" size="icon" aria-label={t(SHOWCASE_CARD_KEYS.removePhone)} onClick={() => onChange(phones.filter((_, at) => at !== index))}>
            <X aria-hidden="true" />
          </Button>
          {phoneLooksInvalid(phone.number) ? (
            <span className="w-full text-sm text-destructive">{t(SHOWCASE_REJECTION_KEYS['agency-profile-card-phone-invalid'])}</span>
          ) : null}
        </span>
      ))}
      {phones.length < MAX_PHONES_PER_LOCATION ? (
        <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => onChange([...phones, { number: '', extension: '' }])}>
          <Plus aria-hidden="true" /> {t(SHOWCASE_CARD_KEYS.addPhone)}
        </Button>
      ) : null}
    </fieldset>
  );
}

export function ShowcaseEmailFields({
  emails,
  onChange,
}: {
  readonly emails: readonly string[];
  readonly onChange: (emails: readonly string[]) => void;
}): React.ReactElement {
  const { t } = useTranslation([SHOWCASE_NS]);

  return (
    <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
      <legend className="text-sm font-medium text-foreground">{t(SHOWCASE_CARD_KEYS.emailsLabel)}</legend>
      {emails.map((email, index) => (
        <span key={index} className="flex flex-wrap items-center gap-2">
          <Input type="email" autoComplete="email" className="w-72" placeholder={t(SHOWCASE_CARD_KEYS.emailPlaceholder)} aria-label={t(SHOWCASE_CARD_KEYS.emailsLabel)} aria-invalid={emailLooksInvalid(email)} value={email} onChange={(event) => onChange(emails.map((value, at) => (at === index ? event.target.value : value)))} />
          <Button type="button" variant="ghost" size="icon" aria-label={t(SHOWCASE_CARD_KEYS.removeEmail)} onClick={() => onChange(emails.filter((_, at) => at !== index))}>
            <X aria-hidden="true" />
          </Button>
          {emailLooksInvalid(email) ? (
            <span className="w-full text-sm text-destructive">{t(SHOWCASE_REJECTION_KEYS['agency-profile-card-email-invalid'])}</span>
          ) : null}
        </span>
      ))}
      {emails.length < MAX_EMAILS_PER_LOCATION ? (
        <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => onChange([...emails, ''])}>
          <Plus aria-hidden="true" /> {t(SHOWCASE_CARD_KEYS.addEmail)}
        </Button>
      ) : null}
    </fieldset>
  );
}
