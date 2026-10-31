'use client';

/**
 * @fileoverview **Καρτέλα «Γενικά» της οικογένειας** — ετικέτα, κωδικός, περιγραφή, ιδιότητα ονόματος και κύριας
 *   εικόνας (Akeneo attribute_as_label / attribute_as_image) (ADR-923 §5.2 · Φάση 1γ).
 * @module components/catalog/families/FamilyGeneralTab
 */

import React from 'react';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DEFAULT_LANGUAGE } from '@/i18n/languages';
import { listingKindOf } from '@/subapps/catalog/types/family';
import { CATALOG_LISTING_KINDS } from '@/subapps/catalog/vocabulary/listing-kinds';
import { LISTING_KIND_KEYS } from '../shared/catalog-labels';
import { useCatalogText } from '../shared/catalog-ui-hooks';
import { CatalogCodeField, CatalogField } from '../shared/CatalogFormFields';
import { LocalizedTextField } from '../shared/LocalizedTextField';
import { AttributePicker, type FamilyTabProps } from './AttributePicker';
import { imageAttributes, referenceAttributes, textAttributes, withListingKind } from './family-draft';

interface FamilyGeneralTabProps extends FamilyTabProps {
  readonly codeLocked: boolean;
}

export function FamilyGeneralTab({ draft, update, issues, disabled, inFamily, codeLocked }: FamilyGeneralTabProps) {
  const { t } = useCatalogText();
  return (
    <section className="flex flex-col gap-4">
      <LocalizedTextField label={t('common.labels')} value={draft.labels} disabled={disabled} issues={issues} path="labels" onChange={(labels) => update({ ...draft, labels })} />
      <CatalogCodeField value={draft.code} locked={codeLocked} disabled={disabled} suggestFrom={draft.labels[DEFAULT_LANGUAGE] ?? ''} issues={issues} onChange={(code) => update({ ...draft, code })} />
      <LocalizedTextField label={t('common.description')} multiline value={draft.description} disabled={disabled} onChange={(description) => update({ ...draft, description })} />
      <div className="grid gap-3 sm:grid-cols-2">
        <CatalogField label={t('families.general.listingKind')} hint={t('families.general.listingKindHint')} issues={issues} path="listingKind">
          {({ id, describedBy }) => (
            <Select value={listingKindOf(draft)} disabled={disabled}
              onValueChange={(value) => { const kind = CATALOG_LISTING_KINDS.find((candidate) => candidate === value); if (kind) update(withListingKind(draft, kind)); }}>
              <SelectTrigger id={id} aria-describedby={describedBy}><SelectValue /></SelectTrigger>
              <SelectContent>{CATALOG_LISTING_KINDS.map((kind) => <SelectItem key={kind} value={kind}>{t(LISTING_KIND_KEYS[kind])}</SelectItem>)}</SelectContent>
            </Select>
          )}
        </CatalogField>
        {listingKindOf(draft) === 'productWithInstallation' ? (
          <CatalogField label={t('families.general.installationAttribute')} hint={t('families.general.installationAttributeHint')} issues={issues} path="installationAttributeId">
            {({ id, describedBy }) => (
              <AttributePicker id={id} describedBy={describedBy} disabled={disabled} value={draft.installationAttributeId ?? null} options={referenceAttributes(inFamily)}
                placeholder={t('common.none')} onChange={(installationAttributeId) => update({ ...draft, installationAttributeId })}
                onClear={() => update({ ...draft, installationAttributeId: null })} />
            )}
          </CatalogField>
        ) : null}
        <CatalogField label={t('families.general.labelAttribute')} hint={t('families.general.labelAttributeHint')} issues={issues} path="labelAttributeId">
          {({ id, describedBy }) => (
            <AttributePicker id={id} describedBy={describedBy} disabled={disabled} value={draft.labelAttributeId} options={textAttributes(inFamily)}
              placeholder={t('common.none')} onChange={(labelAttributeId) => update({ ...draft, labelAttributeId })}
              onClear={() => update({ ...draft, labelAttributeId: null })} />
          )}
        </CatalogField>
        <CatalogField label={t('families.general.imageAttribute')} hint={t('families.general.imageAttributeHint')} issues={issues} path="imageAttributeId">
          {({ id, describedBy }) => (
            <AttributePicker id={id} describedBy={describedBy} disabled={disabled} value={draft.imageAttributeId} options={imageAttributes(inFamily)}
              placeholder={t('common.none')} onChange={(imageAttributeId) => update({ ...draft, imageAttributeId })}
              onClear={() => update({ ...draft, imageAttributeId: null })} />
          )}
        </CatalogField>
      </div>
    </section>
  );
}
