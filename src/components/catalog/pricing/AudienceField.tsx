'use client';

/**
 * @fileoverview **Το κοινό μιας λίστας ή συνθήκης** — ανώνυμοι · συνδεδεμένοι · ομάδα πελατών · συνεργάτης (ADR-923 §12 ·
 *   §5.11 «3δ»). Κοινό για τιμοκαταλόγους και συνθήκες έκπτωσης (Τμήμα 2): **μία** φόρμα κοινού, ένα λεξιλόγιο.
 * @related subapps/catalog/vocabulary/pricing.ts (`AUDIENCE_KINDS` — η ρίζα) · PricingPartyPicker.tsx
 * @module components/catalog/pricing/AudienceField
 *
 * 🔑 Η αλλαγή είδους χτίζει **πλήρες** κοινό του είδους (ποτέ μισό αντικείμενο): ομάδα/συνεργάτης χωρίς επιλογή μένουν
 *    `customerGroupId: ''` / συμβαλλόμενος κενός ⇒ η **ίδια** επικύρωση με τον γραφέα τα λέει «άγνωστη αναφορά».
 * ⚠️ «Κανένα κοινό» = τιμή `none` στο Select: το Radix **δεσμεύει** το `''` (CHECK 3.48)· καμία ρίζα δεν λέγεται `none`.
 */

import React from 'react';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { CatalogIssue } from '@/subapps/catalog/schema/catalog-issues';
import type { PriceAudience } from '@/subapps/catalog/types/price-list';
import type { CustomerGroupWire } from '@/subapps/catalog/types/pricing-views';
import { AUDIENCE_KINDS, type AudienceKind } from '@/subapps/catalog/vocabulary/pricing';
import { CatalogField } from '../shared/CatalogFormFields';
import { useCatalogText } from '../shared/catalog-ui-hooks';
import { AUDIENCE_KIND_ICONS, AUDIENCE_KIND_KEYS } from './pricing-labels';
import { PricingPartyPicker } from './PricingPartyPicker';

const NO_AUDIENCE = 'none';

/** Ένα πλήρες κοινό του είδους `kind` — κρατά ό,τι ταιριάζει από το προηγούμενο. */
function audienceOfKind(kind: AudienceKind, previous: PriceAudience | null): PriceAudience {
  if (previous?.kind === kind) return previous;
  switch (kind) {
    case 'anonymous': return { kind };
    case 'signedIn': return { kind };
    case 'customerGroup': return { kind, customerGroupId: '' };
    case 'partner': return { kind, party: { kind: 'contact', contactId: '' } };
  }
}

const isAudienceKind = (value: string): value is AudienceKind => (AUDIENCE_KINDS as readonly string[]).includes(value);

interface AudienceFieldProps {
  readonly value: PriceAudience | null;
  readonly onChange: (audience: PriceAudience | null) => void;
  /** Λίστα: «κανένα κοινό» επιτρέπεται· συνθήκη: πάντα κοινό. */
  readonly allowNone: boolean;
  readonly customerGroups: readonly CustomerGroupWire[];
  readonly disabled: boolean;
  readonly issues: readonly CatalogIssue[];
  readonly hint?: string;
}

function CustomerGroupSelect({ value, onChange, groups, disabled, issues }: {
  readonly value: string;
  readonly onChange: (customerGroupId: string) => void;
  readonly groups: readonly CustomerGroupWire[];
  readonly disabled: boolean;
  readonly issues: readonly CatalogIssue[];
}) {
  const { t, text } = useCatalogText();
  const known = groups.some((group) => group.id === value);
  return (
    <CatalogField label={t('pricing.audience.customerGroup')} issues={issues} path="audience.customerGroupId"
      hint={groups.length === 0 ? t('pricing.audience.noCustomerGroups') : undefined}>
      {({ id, describedBy }) => (
        <Select value={known ? value : undefined} disabled={disabled || groups.length === 0} onValueChange={onChange}>
          <SelectTrigger id={id} aria-describedby={describedBy}><SelectValue placeholder={t('pricing.audience.customerGroupPick')} /></SelectTrigger>
          <SelectContent>
            {groups.map((group) => <SelectItem key={group.id} value={group.id}>{text(group.labels, group.code)}</SelectItem>)}
          </SelectContent>
        </Select>
      )}
    </CatalogField>
  );
}

function AudienceKindSelect({ value, onChange, allowNone, disabled, issues, hint }: Omit<AudienceFieldProps, 'customerGroups'>) {
  const { t } = useCatalogText();
  const choose = (next: string) => onChange(isAudienceKind(next) ? audienceOfKind(next, value) : null);
  return (
    <CatalogField label={t('pricing.audience.label')} hint={hint} issues={issues} path="audience">
      {({ id, describedBy }) => (
        <Select value={value?.kind ?? NO_AUDIENCE} disabled={disabled} onValueChange={choose}>
          <SelectTrigger id={id} aria-describedby={describedBy}><SelectValue /></SelectTrigger>
          <SelectContent>
            {allowNone ? <SelectItem value={NO_AUDIENCE}>{t('pricing.audience.none')}</SelectItem> : null}
            {AUDIENCE_KINDS.map((kind) => {
              const Icon = AUDIENCE_KIND_ICONS[kind];
              return (
                <SelectItem key={kind} value={kind}>
                  <span className="flex items-center gap-2"><Icon className="h-4 w-4" aria-hidden />{t(AUDIENCE_KIND_KEYS[kind])}</span>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      )}
    </CatalogField>
  );
}

export function AudienceField(props: AudienceFieldProps) {
  const { value, onChange, customerGroups, disabled, issues } = props;
  return (
    <section className="flex flex-col gap-3">
      <AudienceKindSelect {...props} />
      {value?.kind === 'customerGroup' ? (
        <CustomerGroupSelect value={value.customerGroupId} groups={customerGroups} disabled={disabled} issues={issues}
          onChange={(customerGroupId) => onChange({ kind: 'customerGroup', customerGroupId })} />
      ) : null}
      {value?.kind === 'partner' ? (
        <PricingPartyPicker value={value.party} disabled={disabled} issues={issues} path="audience.party"
          onChange={(party) => onChange({ kind: 'partner', party: party ?? { kind: 'contact', contactId: '' } })} />
      ) : null}
    </section>
  );
}
