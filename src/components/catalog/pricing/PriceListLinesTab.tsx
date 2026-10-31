'use client';

/**
 * @fileoverview **Η καρτέλα «Γραμμές»** — επιλογή έκδοσης + το πλέγμα της (ADR-923 §5.11 «3δ» Τμήμα 1).
 * @related PriceLinesPanel.tsx (το πλέγμα) · price-list-summary.ts (ποια έκδοση προτείνεται)
 * @module components/catalog/pricing/PriceListLinesTab
 *
 * 🔑 Προεπιλογή = η νεότερη **πρόχειρη** (εκεί δουλεύει κανείς), αλλιώς η **τρέχουσα** (αυτό ρωτά κανείς), αλλιώς η
 *    νεότερη δημοσιευμένη. Το πλέγμα ξαναστήνεται ανά έκδοση (`key`) — πρόχειρο μιας έκδοσης δεν «περνά» σε άλλη.
 */

import React from 'react';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { DiscountGroupWire, PriceListVersionWire, PriceListWire } from '@/subapps/catalog/types/pricing-views';
import { CatalogField } from '../shared/CatalogFormFields';
import { useCatalogText } from '../shared/catalog-ui-hooks';
import { phaseOfVersion, type PriceListSummary } from './price-list-summary';
import { PriceLinesPanel } from './PriceLinesPanel';
import { TIMELINE_PHASE_KEYS, VERSION_STATUS_KEYS } from './pricing-labels';

export interface PriceListLinesTabProps {
  readonly list: PriceListWire;
  readonly summary: PriceListSummary;
  readonly versionId: string | null;
  readonly onVersion: (versionId: string) => void;
  readonly discountGroups: readonly DiscountGroupWire[];
  readonly canManage: boolean;
  readonly canPublish: boolean;
  readonly reportDirty: (dirty: boolean) => void;
  readonly onPublish: (version: PriceListVersionWire) => void;
}

/** Οι εκδόσεις που έχουν γραμμές να δεις: πρόχειρες + δημοσιευμένες (νεότερη πρώτη) — όχι απορριφθείσες. */
export function selectableVersions(summary: PriceListSummary): readonly PriceListVersionWire[] {
  return [...summary.drafts, ...[...summary.bands].reverse().map((band) => band.entry.version)];
}

/** Η έκδοση που προτείνεται όταν ο άνθρωπος δεν διάλεξε: πρόχειρη → τρέχουσα → νεότερη δημοσιευμένη. */
export function defaultVersionId(summary: PriceListSummary): string | null {
  return summary.drafts[0]?.id ?? summary.current?.id ?? selectableVersions(summary)[0]?.id ?? null;
}

export function PriceListLinesTab(props: PriceListLinesTabProps) {
  const { t } = useCatalogText();
  const options = selectableVersions(props.summary);
  /** Η ίδια λέξη με την καρτέλα «Εκδόσεις»: δημοσιευμένη = φάση στη χρονογραμμή, αλλιώς η κατάσταση. */
  const standingOf = (option: PriceListVersionWire): string => {
    const phase = phaseOfVersion(props.summary, option.id);
    return phase === null ? t(VERSION_STATUS_KEYS[option.status]) : t(TIMELINE_PHASE_KEYS[phase]);
  };
  const version = options.find((candidate) => candidate.id === props.versionId) ?? null;
  if (version === null) return <p className="m-0 p-4 text-sm text-muted-foreground">{t('pricing.lines.noVersion')}</p>;
  return (
    <section className="flex flex-col">
      <section className="px-4 pt-4 sm:max-w-sm">
        <CatalogField label={t('pricing.lines.versionLabel')}>
          {({ id }) => (
            <Select value={version.id} onValueChange={props.onVersion}>
              <SelectTrigger id={id}><SelectValue /></SelectTrigger>
              <SelectContent>
                {options.map((option) => (
                  <SelectItem key={option.id} value={option.id}>{`${t('pricing.versions.number', { number: option.number })} · ${standingOf(option)}`}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </CatalogField>
      </section>
      <PriceLinesPanel key={version.id} list={props.list} version={version} discountGroups={props.discountGroups} canManage={props.canManage}
        canPublish={props.canPublish && version.status === 'draft'} reportDirty={props.reportDirty} onPublish={() => props.onPublish(version)} />
    </section>
  );
}
