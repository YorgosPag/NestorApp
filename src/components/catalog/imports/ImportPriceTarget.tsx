'use client';

/**
 * @fileoverview **Ο τιμοκατάλογος μιας παρτίδας PDF** (ADR-923 §5.5.2 Β4 Δ1): η πρόχειρη έκδοση όπου πάει η τιμή της ίδιας ανάγνωσης.
 *   Αλλάζει **χωρίς** νέα ανάγνωση: οι εκκρεμείς προτάσεις τιμών ξανασχεδιάζονται στον διακομιστή.
 * @module components/catalog/imports/ImportPriceTarget
 *
 * 🔑 Μόνο για όποιον έχει δικαίωμα τιμολόγησης (ξένο ≡ ανύπαρκτο): ο άλλος δεν βλέπει ούτε το πεδίο.
 * ⚠️ «Χωρίς τιμοκατάλογο» = δηλωμένη τιμή `none`, ποτέ `''` (Radix Select, CHECK 3.48).
 */

import React from 'react';

import type { ImportBatchWire } from '@/subapps/catalog/types/catalog-import-requests';
import { useCatalogAccess } from '../shared/catalog-neutral-hooks';
import { useImportText } from './import-text';
import { ChoiceField } from './NewImportFields';
import { usePriceVersions } from './use-import-target';

const NO_TARGET = 'none';

interface ImportPriceTargetProps {
  readonly batch: ImportBatchWire;
  readonly disabled: boolean;
  readonly onChange: (priceListVersionId: string | null) => void;
}

export function ImportPriceTarget({ batch, disabled, onChange }: ImportPriceTargetProps) {
  const { t } = useImportText();
  const canPrice = useCatalogAccess('pricing') === 'granted';
  const { target } = batch;
  const eligible = canPrice && batch.sourceKind === 'pdf' && target.purpose === 'attributes';
  const versions = usePriceVersions(eligible);
  if (!eligible || target.purpose !== 'attributes') return null;
  const current = target.priceListVersionId ?? NO_TARGET;
  // Έκδοση που δεν είναι πια πρόχειρη μένει ορατή ως επιλογή, ποτέ σιωπηλό κενό.
  const known = current === NO_TARGET || versions.some((version) => version.value === current);
  const choices = [{ value: NO_TARGET, label: t('batch.priceTargetNone') }, ...versions, ...(known ? [] : [{ value: current, label: current }])];
  return (
    <section className="flex flex-col gap-1" aria-label={t('batch.priceTarget')}>
      <fieldset className="m-0 border-0 p-0" disabled={disabled}>
        <ChoiceField id={`price-target-${batch.id}`} label={t('batch.priceTarget')} value={current} choices={choices}
          onChange={(value) => { if (value !== current) onChange(value === NO_TARGET ? null : value); }} />
      </fieldset>
      <p className="m-0 text-xs text-muted-foreground">{t('batch.priceTargetHint')}</p>
    </section>
  );
}
