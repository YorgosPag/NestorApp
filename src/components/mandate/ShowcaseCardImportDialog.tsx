'use client';

/**
 * @fileoverview 🏆 **ΣΥΓΚΡΙΣΗ ΑΝΑ ΠΕΔΙΟ — ΚΑΡΤΑ ⇄ ΣΤΟΙΧΕΙΑ ΕΤΑΙΡΕΙΑΣ** (ADR-841 §7 Α21.19).
 * @related lib/agency/showcase-card-import.ts (η κρίση) · components/mandate/ShowcaseCardImportControl.tsx
 * @module components/mandate/ShowcaseCardImportDialog
 *
 * 🔑 **Ερώτηση μόνο εκεί που υπάρχει πραγματική διαφορά** — το Salesforce Merge ζητά απόφαση σε **κάθε** γραμμή,
 * το HubSpot σε **καμία**. Εδώ: ό,τι λείπει προτείνεται (με κουτάκι), ό,τι είναι ίδιο **λέγεται** ίδιο, και μόνο το
 * διαφορετικό ρωτά — με προεπιλογή *«κράτα της κάρτας»*.
 *
 * ⚠️ **Πίνακας, όχι λίστα από `div`**: τέσσερις στήλες που συγκρίνονται γραμμή-γραμμή είναι πινακοειδή δεδομένα —
 * ο αναγνώστης οθόνης διαβάζει «Κάρτα: … · Εταιρεία: …» μόνο από `<th scope>`.
 */

import React from 'react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  defaultDecisions,
  type ImportComparison,
  type ImportDecisions,
  type ImportRow,
} from '@/lib/agency/showcase-card-import';
import { MAX_EMAILS_PER_LOCATION, MAX_PHONES_PER_LOCATION } from '@/types/showcase-card';
import {
  SHOWCASE_CARD_IMPORT_FIELD_KEYS,
  SHOWCASE_CARD_IMPORT_KEYS,
  SHOWCASE_CARD_IMPORT_STATUS_KEYS,
} from '@/components/mandate/agency-showcase-import-labels';
import { SHOWCASE_NS } from '@/components/mandate/agency-showcase-labels';
import { ShowcaseImportProvenance } from './ShowcaseImportProvenance';

const MAX_OF_FIELD = { phones: MAX_PHONES_PER_LOCATION, emails: MAX_EMAILS_PER_LOCATION } as const;

function RowDecision({
  row,
  take,
  onTake,
}: {
  readonly row: ImportRow;
  readonly take: boolean;
  readonly onTake: (take: boolean) => void;
}): React.ReactElement {
  const { t } = useTranslation([SHOWCASE_NS]);
  const id = React.useId();

  if (row.status === 'differs') {
    return (
      <RadioGroup value={take ? 'company' : 'card'} onValueChange={(next) => onTake(next === 'company')} className="gap-1">
        <span className="flex items-center gap-2">
          <RadioGroupItem value="card" id={`${id}-card`} />
          <Label htmlFor={`${id}-card`}>{t(SHOWCASE_CARD_IMPORT_KEYS.keepCard)}</Label>
        </span>
        <span className="flex items-center gap-2">
          <RadioGroupItem value="company" id={`${id}-company`} />
          <Label htmlFor={`${id}-company`}>{t(SHOWCASE_CARD_IMPORT_KEYS.takeCompany)}</Label>
        </span>
      </RadioGroup>
    );
  }
  if (row.status === 'fill') {
    return (
      <span className="flex items-center gap-2">
        <Checkbox id={id} checked={take} onCheckedChange={(checked) => onTake(checked === true)} />
        <Label htmlFor={id}>{t(SHOWCASE_CARD_IMPORT_STATUS_KEYS.fill)}</Label>
      </span>
    );
  }
  const max = row.field === 'phones' || row.field === 'emails' ? MAX_OF_FIELD[row.field] : 0;
  return <span className="text-muted-foreground">{t(SHOWCASE_CARD_IMPORT_STATUS_KEYS[row.status], { max })}</span>;
}

function ImportTable({
  comparison,
  onApply,
  onCancel,
}: {
  readonly comparison: ImportComparison;
  readonly onApply: (decisions: ImportDecisions) => void;
  readonly onCancel: () => void;
}): React.ReactElement {
  const { t } = useTranslation([SHOWCASE_NS]);
  const [decisions, setDecisions] = React.useState<ImportDecisions>(() => defaultDecisions(comparison));
  const decide = (key: string, take: boolean) =>
    setDecisions((current) => {
      const next = new Set(current);
      if (take) next.add(key);
      else next.delete(key);
      return next;
    });

  return (
    <>
      <section className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="text-xs text-muted-foreground">
            <tr>
              <th scope="col" className="py-2 pr-3 font-medium">{t(SHOWCASE_CARD_IMPORT_KEYS.colField)}</th>
              <th scope="col" className="py-2 pr-3 font-medium">{t(SHOWCASE_CARD_IMPORT_KEYS.colCard)}</th>
              <th scope="col" className="py-2 pr-3 font-medium">{t(SHOWCASE_CARD_IMPORT_KEYS.colCompany)}</th>
              <th scope="col" className="py-2 font-medium">{t(SHOWCASE_CARD_IMPORT_KEYS.colDecision)}</th>
            </tr>
          </thead>
          <tbody>
            {comparison.rows.map((row) => (
              <tr key={row.key} className="border-t border-border align-top">
                <th scope="row" className="py-2 pr-3 font-medium text-foreground">
                  <span className="flex flex-col">
                    {t(SHOWCASE_CARD_IMPORT_FIELD_KEYS[row.field])}
                    <ShowcaseImportProvenance origin={row.origin} checkedAt={row.checkedAt} />
                  </span>
                </th>
                <td className="py-2 pr-3 text-muted-foreground">{row.current}</td>
                <td className="py-2 pr-3 text-foreground">{row.candidate}</td>
                <td className="py-2">
                  <RowDecision row={row} take={decisions.has(row.key)} onTake={(take) => decide(row.key, take)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>{t(SHOWCASE_CARD_IMPORT_KEYS.cancel)}</Button>
        <Button type="button" disabled={decisions.size === 0} onClick={() => onApply(decisions)}>
          {t(SHOWCASE_CARD_IMPORT_KEYS.apply)}
        </Button>
      </DialogFooter>
    </>
  );
}

export function ShowcaseCardImportDialog({
  open,
  onOpenChange,
  comparison,
  onApply,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly comparison: ImportComparison;
  readonly onApply: (decisions: ImportDecisions) => void;
}): React.ReactElement {
  const { t } = useTranslation([SHOWCASE_NS]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t(SHOWCASE_CARD_IMPORT_KEYS.title)}</DialogTitle>
          <DialogDescription>{t(SHOWCASE_CARD_IMPORT_KEYS.lead)}</DialogDescription>
        </DialogHeader>
        {/* 🔑 Νέα απόφαση σε κάθε άνοιγμα: το προηγούμενο «κράτα/πάρε» αφορούσε άλλη κάρτα. */}
        {open ? <ImportTable comparison={comparison} onApply={onApply} onCancel={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}
