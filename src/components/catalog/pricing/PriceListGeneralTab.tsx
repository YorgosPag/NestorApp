'use client';

/**
 * @fileoverview **Καρτέλα «Γενικά» του τιμοκαταλόγου** — ετικέτες · κωδικός · είδος · τύπος τιμής · κοινό · φράχτης
 *   δημοσίευσης (ADR-923 §5.11 «3δ» Τμήμα 1). Μόνο πεδία· το πρόχειρο και η αποθήκευση ζουν στο `PriceListEditor`.
 * @module components/catalog/pricing/PriceListGeneralTab
 *
 * 🔑 **Το κλείδωμα λέει γιατί**: είδος και τύπος τιμής κλειδώνουν όταν υπάρχει έκδοση — η υπόδειξη το εξηγεί στο σημείο
 *    της απόφασης, όχι ένα γκρι πεδίο χωρίς λόγο.
 * 🔑 **Φράχτης σε ποσοστό** (ο άνθρωπος δεν σκέφτεται σε μονάδες βάσης)· η μετατροπή με το `basisPointsFromPercent`, που
 *    **αρνείται** τρίτο δεκαδικό — ποτέ σιωπηλή στρογγύλευση ορίου.
 */

import React from 'react';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DEFAULT_LANGUAGE } from '@/i18n/languages';
import { basisPointsFromPercent, effectivePercent } from '@/lib/pricing/discount-rule';
import type { CatalogIssue } from '@/subapps/catalog/schema/catalog-issues';
import type { PriceListDefinition } from '@/subapps/catalog/types/price-list';
import type { CustomerGroupWire } from '@/subapps/catalog/types/pricing-views';
import {
  PRICE_CHANGE_FENCE_BP,
  PRICE_CHANGE_FENCE_MIN_BP,
  PRICE_LIST_KINDS,
  PRICE_TYPES,
  isPriceListKind,
  isPriceType,
} from '@/subapps/catalog/vocabulary/pricing';
import { CatalogCodeField, CatalogField, OptionalNumberField } from '../shared/CatalogFormFields';
import { FieldIssues } from '../shared/CatalogIssues';
import { useCatalogText } from '../shared/catalog-ui-hooks';
import { LocalizedTextField } from '../shared/LocalizedTextField';
import { AudienceField } from './AudienceField';
import { withPriceListKind } from './price-list-draft';
import { PRICE_LIST_KIND_HINT_KEYS, PRICE_LIST_KIND_KEYS, PRICE_TYPE_HINT_KEYS, PRICE_TYPE_KEYS } from './pricing-labels';

interface PriceListGeneralTabProps {
  readonly draft: PriceListDefinition;
  readonly update: (draft: PriceListDefinition) => void;
  readonly issues: readonly CatalogIssue[];
  readonly isNew: boolean;
  /** Υπάρχει έκδοση ⇒ είδος και τύπος τιμής κλειδώνουν. */
  readonly meaningLocked: boolean;
  readonly customerGroups: readonly CustomerGroupWire[];
  readonly disabled: boolean;
}

/** Ποσοστό → μονάδες βάσης· τιμή που δεν μετατρέπεται ακριβώς μένει **άκυρη** (το λέει η επικύρωση, δεν στρογγυλεύεται). */
const fenceBpOf = (percent: number | null) => (percent === null ? null : basisPointsFromPercent(percent) ?? Number.NaN);

function MeaningFields({ draft, update, issues, meaningLocked, disabled }: PriceListGeneralTabProps) {
  const { t } = useCatalogText();
  const locked = disabled || meaningLocked;
  const lockHint = meaningLocked ? t('pricing.general.lockedHint') : undefined;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <CatalogField label={t('pricing.general.kind')} hint={lockHint ?? t(PRICE_LIST_KIND_HINT_KEYS[draft.kind])} issues={issues} path="kind">
        {({ id, describedBy }) => (
          <Select value={draft.kind} disabled={locked} onValueChange={(kind) => { if (isPriceListKind(kind)) update(withPriceListKind(draft, kind)); }}>
            <SelectTrigger id={id} aria-describedby={describedBy}><SelectValue /></SelectTrigger>
            <SelectContent>
              {PRICE_LIST_KINDS.map((kind) => <SelectItem key={kind} value={kind}>{t(PRICE_LIST_KIND_KEYS[kind])}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </CatalogField>
      <CatalogField label={t('pricing.general.priceType')} hint={lockHint ?? t(PRICE_TYPE_HINT_KEYS[draft.priceType])} issues={issues} path="priceType">
        {({ id, describedBy }) => (
          <Select value={draft.priceType} disabled={locked} onValueChange={(priceType) => { if (isPriceType(priceType)) update({ ...draft, priceType }); }}>
            <SelectTrigger id={id} aria-describedby={describedBy}><SelectValue /></SelectTrigger>
            <SelectContent>
              {PRICE_TYPES.map((type) => <SelectItem key={type} value={type}>{t(PRICE_TYPE_KEYS[type])}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </CatalogField>
    </div>
  );
}

function FenceField({ draft, update, issues, disabled }: PriceListGeneralTabProps) {
  const { t } = useCatalogText();
  const percent = draft.changeFenceBp === null || Number.isNaN(draft.changeFenceBp) ? null : effectivePercent([draft.changeFenceBp]);
  const platform = effectivePercent([PRICE_CHANGE_FENCE_BP]);
  return (
    <section className="flex flex-col gap-1">
      <OptionalNumberField
        label={t('pricing.general.fence')}
        value={percent}
        initial={platform}
        min={effectivePercent([PRICE_CHANGE_FENCE_MIN_BP])}
        step={1}
        disabled={disabled}
        onChange={(next) => update({ ...draft, changeFenceBp: fenceBpOf(next) })}
      />
      <p className="m-0 text-xs text-muted-foreground">{t('pricing.general.fenceHint', { percent: platform })}</p>
      <FieldIssues issues={issues} path="changeFenceBp" exact />
    </section>
  );
}

export function PriceListGeneralTab(props: PriceListGeneralTabProps) {
  const { draft, update, issues, isNew, customerGroups, disabled } = props;
  const { t } = useCatalogText();
  return (
    <section className="flex flex-col gap-4 p-4">
      <LocalizedTextField label={t('common.labels')} value={draft.labels} disabled={disabled} issues={issues} path="labels" onChange={(labels) => update({ ...draft, labels })} />
      <CatalogCodeField value={draft.code} locked={!isNew} disabled={disabled} suggestFrom={draft.labels[DEFAULT_LANGUAGE] ?? ''} issues={issues} onChange={(code) => update({ ...draft, code })} />
      <MeaningFields {...props} />
      {draft.kind === 'sales' ? (
        <AudienceField value={draft.audience} onChange={(audience) => update({ ...draft, audience })} allowNone
          customerGroups={customerGroups} disabled={disabled} issues={issues} hint={t('pricing.audience.hint')} />
      ) : null}
      <FenceField {...props} />
    </section>
  );
}
