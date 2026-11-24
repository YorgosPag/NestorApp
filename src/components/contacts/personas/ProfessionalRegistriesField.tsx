'use client';

/**
 * @fileoverview **ΜΗΤΡΩΑ ΕΠΑΓΓΕΛΜΑΤΟΣ** στην καρτέλα «Επαγγελματικά» — ο αρ. μητρώου ανά αρχή (ADR-950 §9).
 * @module components/contacts/personas/ProfessionalRegistriesField
 *
 * 🔴 Γιατί υπάρχει: το ADR-282 Φάση 4 αφαίρεσε τις ενότητες των επαγγελματικών persona ⇒ τα πεδία `teeRegistryNumber` ·
 *    `oeeNumber` · `barAssociationNumber` · `notaryRegistryNumber` ζούσαν στο config και στη βάση αλλά **δεν αποδίδονταν
 *    πουθενά**. Εδώ ξαναφαίνονται — **ανάλογα με το επάγγελμα**, όχι ως chips ιδιοτήτων.
 *
 * 🔑 **Καμία νέα γνώση**: ποια μητρώα φαίνονται το λέει το `visibleCredentialTargets` (επάγγελμα ISCO → αρχή → persona,
 *    και κάθε ήδη ενεργή persona)· ετικέτες/placeholders είναι του `persona-config` (τα ίδια κλειδιά i18n με πριν).
 * 🔑 **Γράφεις αριθμό ⇒ η persona ενεργοποιείται** (`writeFormCredentialPart`) — καμία ξεχωριστή «ενεργοποίηση ιδιότητας».
 * 🔑 «Προσθήκη μητρώου»: για ό,τι το επάγγελμα δεν λύνει μόνο του (π.χ. συμβολαιογράφος — ISCO 2619, δηλωμένα ανοιχτό).
 */

import React from 'react';
import { Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { PersonaAdoptionTarget } from '@/config/declared-credential-adoption';
import { getPersonaFields } from '@/config/persona-config';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  activatePersonaInForm,
  addableCredentialTargets,
  formCredentialPart,
  visibleCredentialTargets,
  writeFormCredentialPart,
  type CredentialPart,
} from '@/lib/contacts/persona-credential-form';
import type { ContactFormData } from '@/types/ContactFormTypes';

interface ProfessionalRegistriesFieldProps {
  /** Το `id` του πεδίου της φόρμας — η ετικέτα «Μητρώα επαγγέλματος» δείχνει εδώ. */
  readonly id: string;
  readonly formData: ContactFormData;
  readonly onChange?: (next: ContactFormData) => void;
  readonly disabled: boolean;
}

const PARTS: readonly CredentialPart[] = ['number', 'chapter'];

/** Η δήλωση του πεδίου στο `persona-config` (ετικέτα · placeholder) — `null` όταν η αρχή δεν έχει αυτό το μέρος. */
function fieldConfigOf(target: PersonaAdoptionTarget, part: CredentialPart) {
  const fieldId = part === 'number' ? target.numberField : target.chapterField;
  return fieldId === null ? null : getPersonaFields(target.persona).find((field) => field.id === fieldId) ?? null;
}

function CredentialInputs({ target, formData, onChange, disabled }: Omit<ProfessionalRegistriesFieldProps, 'id'> & {
  readonly target: PersonaAdoptionTarget;
}) {
  const { t } = useTranslation('contacts');
  return (
    <li className="grid gap-3 sm:grid-cols-2">
      {PARTS.map((part) => {
        const config = fieldConfigOf(target, part);
        if (config === null) return null;
        const inputId = `professional-registry-${target.persona}-${config.id}`;
        return (
          <span key={part} className="flex flex-col gap-1">
            <Label htmlFor={inputId}>{t(config.label)}</Label>
            <Input
              id={inputId}
              name={config.id}
              value={formCredentialPart(formData, target, part)}
              placeholder={config.placeholder ? t(config.placeholder) : undefined}
              disabled={disabled || onChange === undefined}
              onChange={(event) => onChange?.(writeFormCredentialPart(formData, target, part, event.target.value))}
            />
          </span>
        );
      })}
    </li>
  );
}

function AddRegistryMenu({ formData, onChange }: Pick<ProfessionalRegistriesFieldProps, 'formData'> & {
  readonly onChange: (next: ContactFormData) => void;
}) {
  const { t } = useTranslation('contacts');
  const iconSizes = useIconSizes();
  const addable = addableCredentialTargets(formData);
  if (addable.length === 0) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="self-start">
          <Plus className={iconSizes.xs} aria-hidden="true" />
          {t('persona.registries.add')}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {addable.map((target) => {
          const config = fieldConfigOf(target, 'number');
          return (
            <DropdownMenuItem key={target.persona} onSelect={() => onChange({ ...formData, ...activatePersonaInForm(formData, target.persona) })}>
              {config === null ? target.persona : t(config.label)}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ProfessionalRegistriesField({ id, formData, onChange, disabled }: ProfessionalRegistriesFieldProps) {
  const { t } = useTranslation('contacts');
  const targets = visibleCredentialTargets(formData);
  const canEdit = !disabled && onChange !== undefined;
  return (
    <section id={id} className="flex w-full flex-col gap-3">
      {targets.length === 0 ? (
        <p className="m-0 text-sm text-muted-foreground">{t('persona.registries.empty')}</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {targets.map((target) => (
            <CredentialInputs key={target.persona} target={target} formData={formData} onChange={onChange} disabled={disabled} />
          ))}
        </ul>
      )}
      {canEdit && <AddRegistryMenu formData={formData} onChange={onChange} />}
    </section>
  );
}
