'use client';

/**
 * @fileoverview **Μία πρόχειρη έκδοση** — «ισχύει από», πρόοδος σποράς, γραμμές, δημοσίευση, απόρριψη
 *   (ADR-923 §5.11 «3δ» Τμήμα 1).
 * @related VersionTimeline.tsx (ο γονέας) · use-price-version-actions.ts (οι πράξεις)
 * @module components/catalog/pricing/DraftVersionRow
 *
 * 🔑 Σπορά σε εξέλιξη ⇒ **δεν** δημοσιεύεται (ο γραφέας αρνείται `versionSeeding`) και το λέμε πριν πατηθεί: «N αντιγράφηκαν»
 *    + «Συνέχιση» — ο δρομέας ζει στον διακομιστή, άρα η συνέχιση ξεκινά ακριβώς από εκεί που σταμάτησε.
 * 🔑 Το «ισχύει από» αποθηκεύεται **αμέσως** (CAS στην αναθεώρηση της έκδοσης) — όπως τα πεδία του Google Docs, χωρίς κουμπί.
 */

import React from 'react';
import { Loader2, Rows3, Send, Trash2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DatePickerField } from '@/components/ui/date-picker-field';
import type { PriceListVersionWire } from '@/subapps/catalog/types/pricing-views';
import { CatalogField } from '../shared/CatalogFormFields';
import { useCatalogText } from '../shared/catalog-ui-hooks';
import { VERSION_STATUS_ICONS, VERSION_STATUS_KEYS } from './pricing-labels';

export interface DraftVersionRowProps {
  readonly version: PriceListVersionWire;
  /** Γραμμές που αντιγράφηκαν σε αυτή τη συνεδρία (νεότερο από την όψη όσο τρέχει η σπορά). */
  readonly seededCopied: number | undefined;
  readonly busy: boolean;
  readonly canManage: boolean;
  readonly canPublish: boolean;
  readonly onValidFrom: (validFrom: string | null) => void;
  readonly onOpenLines: () => void;
  readonly onPublish: () => void;
  readonly onDiscard: () => void;
  readonly onContinueSeed: () => void;
}

function SeedProgress({ version, seededCopied, busy, canManage, onContinueSeed }: DraftVersionRowProps) {
  const { t } = useCatalogText();
  const seed = version.derived.seed;
  if (seed === null || seed.done) return null;
  const copied = Math.max(seededCopied ?? 0, seed.copied);
  return (
    <p className="m-0 flex flex-wrap items-center gap-2 text-sm text-muted-foreground" role="status" aria-live="polite">
      {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
      {t('pricing.versions.seeding', { count: copied })}
      {!busy && canManage ? <Button type="button" size="sm" variant="outline" onClick={onContinueSeed}>{t('pricing.versions.continueSeed')}</Button> : null}
    </p>
  );
}

function DraftActions(props: DraftVersionRowProps) {
  const { t } = useCatalogText();
  const seeding = props.version.derived.seed !== null && !props.version.derived.seed.done;
  return (
    <section className="flex flex-wrap items-center gap-2" aria-label={t('common.actions')}>
      <Button type="button" size="sm" variant="outline" onClick={props.onOpenLines}><Rows3 className="mr-1 h-4 w-4" aria-hidden />{t('pricing.versions.openLines')}</Button>
      {props.canPublish ? (
        <Button type="button" size="sm" disabled={props.busy || seeding} onClick={props.onPublish}><Send className="mr-1 h-4 w-4" aria-hidden />{t('pricing.publish.open')}</Button>
      ) : null}
      {props.canManage ? (
        <Button type="button" size="sm" variant="ghost" disabled={props.busy} onClick={props.onDiscard}><Trash2 className="mr-1 h-4 w-4" aria-hidden />{t('pricing.versions.discard')}</Button>
      ) : null}
    </section>
  );
}

export function DraftVersionRow(props: DraftVersionRowProps) {
  const { t } = useCatalogText();
  const { version } = props;
  const StatusIcon = VERSION_STATUS_ICONS[version.status];
  const validFrom = version.validFrom ? new Date(version.validFrom) : undefined;
  return (
    <li className="flex flex-col gap-2 rounded-md border p-3">
      <header className="flex flex-wrap items-center gap-2">
        <h4 className="m-0 text-sm font-semibold">{t('pricing.versions.number', { number: version.number })}</h4>
        <Badge variant="secondary" className="gap-1"><StatusIcon className="h-3 w-3" aria-hidden />{t(VERSION_STATUS_KEYS[version.status])}</Badge>
      </header>
      <section className="sm:max-w-xs">
        <CatalogField label={t('pricing.versions.validFrom')} hint={t('pricing.versions.validFromHint')}>
          {({ id }) => (
            <DatePickerField id={id} value={validFrom} disabled={!props.canManage || props.busy} placeholder={t('pricing.versions.validFromNone')}
              onSelect={(date) => props.onValidFrom(date ? date.toISOString() : null)} />
          )}
        </CatalogField>
      </section>
      <SeedProgress {...props} />
      <DraftActions {...props} />
    </li>
  );
}
