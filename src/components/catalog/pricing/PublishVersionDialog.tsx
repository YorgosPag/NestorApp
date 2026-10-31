'use client';

/**
 * @fileoverview **Η δημοσίευση μιας πρόχειρης έκδοσης** — «ισχύει από» → προεπισκόπηση διαφοράς → ρητή επιβεβαίωση
 *   (αν φράχτης) → δημοσίευση (ADR-923 §5.11 «3δ» Τμήμα 1).
 * @related publish-flow.ts (η μηχανή — όλη η κρίση) · use-publish-flow.ts (ο οδηγός) · PublishDiffList.tsx (η διαφορά)
 * @module components/catalog/pricing/PublishVersionDialog
 *
 * 🔑 Ανοίγει **μόνο** για όποιον έχει `pricingPublish` (ο γονέας το ελέγχει· ο γραφέας ξανακρίνει στον διακομιστή).
 * 🔑 Κάθε επιστροφή σε προηγούμενο βήμα **λέει γιατί** (`PublishNotice`): «άλλαξε ο φράχτης», «άλλαξε από άλλον».
 */

import React from 'react';
import { CheckCircle2, Info } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DatePickerField } from '@/components/ui/date-picker-field';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { formatPercentage } from '@/lib/intl-formatting';
import { BP_PER_WHOLE } from '@/lib/pricing/discount-rule';
import type { DiscountGroupWire, PriceListVersionWire } from '@/subapps/catalog/types/pricing-views';
import { FAILURE_KEYS } from '../shared/catalog-labels';
import { CatalogField } from '../shared/CatalogFormFields';
import { useIssueMessage } from '../shared/CatalogIssues';
import { useCatalogText } from '../shared/catalog-ui-hooks';
import { PublishDiffList } from './PublishDiffList';
import { canPublish, isChangedMeanwhile, needsConfirmation, type PublishFlow, type PublishNotice } from './publish-flow';
import { usePublishFlow } from './use-publish-flow';

export interface PublishVersionDialogProps {
  readonly version: PriceListVersionWire;
  readonly versions: readonly PriceListVersionWire[];
  readonly discountGroups: readonly DiscountGroupWire[];
  readonly onChanged: () => void;
  readonly onClose: () => void;
}

const NOTICE_KEYS: Readonly<Record<PublishNotice, string>> = {
  fenceChanged: 'pricing.publish.notice.fenceChanged',
  changedMeanwhile: 'pricing.publish.notice.changedMeanwhile',
};

type Driver = ReturnType<typeof usePublishFlow>;

function NoticeLine({ notice }: { readonly notice: PublishNotice | null }) {
  const { t } = useCatalogText();
  if (notice === null) return null;
  return <p className="m-0 flex items-center gap-2 rounded-md border p-2 text-sm" role="status"><Info className="h-4 w-4" aria-hidden />{t(NOTICE_KEYS[notice])}</p>;
}

function ScheduleStep({ driver, flow }: { readonly driver: Driver; readonly flow: Extract<PublishFlow, { step: 'schedule' }> }) {
  const { t } = useCatalogText();
  const message = useIssueMessage();
  const value = driver.validFrom ? new Date(driver.validFrom) : undefined;
  return (
    <section className="flex flex-col gap-3">
      <NoticeLine notice={flow.notice} />
      <CatalogField label={t('pricing.versions.validFrom')} hint={t('pricing.publish.validFromHint')}>
        {({ id }) => <DatePickerField id={id} value={value} placeholder={t('pricing.versions.validFromNone')} onSelect={(date) => driver.setValidFrom(date ? date.toISOString() : null)} />}
      </CatalogField>
      {driver.issue ? <p className="m-0 text-sm text-destructive" role="alert">{message({ code: driver.issue, path: 'validFrom' })}</p> : null}
    </section>
  );
}

interface ReviewStepProps {
  readonly driver: Driver;
  readonly flow: Extract<PublishFlow, { step: 'review' }>;
  readonly discountGroups: readonly DiscountGroupWire[];
}

function ReviewStep({ driver, flow, discountGroups }: ReviewStepProps) {
  const { t } = useCatalogText();
  const { preview } = flow;
  const fence = formatPercentage((preview.fenceBp / BP_PER_WHOLE) * 100, { maximumFractionDigits: 2 });
  return (
    <section className="flex flex-col gap-3">
      <NoticeLine notice={flow.notice} />
      <PublishDiffList preview={preview} discountGroups={discountGroups} />
      {needsConfirmation(preview) ? (
        <section className="flex items-start gap-2 rounded-md border p-3">
          <Checkbox id="publish-confirm" checked={flow.confirmed} onCheckedChange={(on) => driver.dispatch({ type: 'confirm', confirmed: on === true })} />
          <Label htmlFor="publish-confirm" className="text-sm leading-snug">{t('pricing.publish.confirm', { count: preview.diff.fenced, fence })}</Label>
        </section>
      ) : null}
    </section>
  );
}

function StepBody({ driver, discountGroups }: { readonly driver: Driver; readonly discountGroups: readonly DiscountGroupWire[] }) {
  const { t } = useCatalogText();
  const { flow } = driver;
  switch (flow.step) {
    case 'schedule': return <ScheduleStep driver={driver} flow={flow} />;
    case 'review': return <ReviewStep driver={driver} flow={flow} discountGroups={discountGroups} />;
    case 'published': return <p className="m-0 flex items-center gap-2 text-sm" role="status"><CheckCircle2 className="h-4 w-4" aria-hidden />{t('pricing.publish.done')}</p>;
    case 'failed': return <p className="m-0 text-sm text-destructive" role="alert">{t(FAILURE_KEYS[flow.failure.kind])}</p>;
    default: return <p className="m-0 text-sm text-muted-foreground" role="status" aria-live="polite">{t(flow.step === 'publishing' ? 'pricing.publish.publishing' : 'pricing.publish.loading')}</p>;
  }
}

function StepActions({ driver, onClose }: { readonly driver: Driver; readonly onClose: () => void }) {
  const { t } = useCatalogText();
  const { flow } = driver;
  if (flow.step === 'published') return <Button type="button" onClick={onClose}>{t('pricing.publish.close')}</Button>;
  const primary = (() => {
    if (flow.step === 'schedule') return <Button type="button" onClick={driver.schedule}>{t('pricing.publish.preview')}</Button>;
    if (flow.step === 'failed') return <Button type="button" onClick={() => driver.restart(isChangedMeanwhile(flow) ? 'changedMeanwhile' : null)}>{t('pricing.publish.retry')}</Button>;
    return <Button type="button" disabled={!canPublish(flow)} onClick={() => driver.dispatch({ type: 'submit' })}>{t('pricing.publish.submit')}</Button>;
  })();
  return (
    <>
      <Button type="button" variant="ghost" disabled={flow.step === 'publishing'} onClick={onClose}>{t('common.cancel')}</Button>
      {primary}
    </>
  );
}

export function PublishVersionDialog({ version, versions, discountGroups, onChanged, onClose }: PublishVersionDialogProps) {
  const { t } = useCatalogText();
  const driver = usePublishFlow({ version, versions, onChanged });
  const busy = driver.flow.step === 'publishing' || driver.flow.step === 'saving';
  return (
    <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{t('pricing.publish.title', { number: version.number })}</DialogTitle>
          <DialogDescription>{t('pricing.publish.lead')}</DialogDescription>
        </DialogHeader>
        <StepBody driver={driver} discountGroups={discountGroups} />
        <DialogFooter><StepActions driver={driver} onClose={onClose} /></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
