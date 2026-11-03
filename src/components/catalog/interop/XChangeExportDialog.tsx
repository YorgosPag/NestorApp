'use client';

/**
 * @fileoverview **«Εξαγωγή ETIM xChange»** — ο προμηθευτής διαλέγει **ρητά** το κοινό των τιμών και κατεβάζει τον κατάλογό του
 *   ως έγγραφο xChange 2.0, με την αναφορά εξαγωγής δίπλα (ADR-923 §5.14 · κενό α · αποφάσεις Ε1 + Ε2 · Ζ5).
 * @related components/catalog/interop/use-xchange-export.ts (η πράξη) · server/catalog/xchange-export.server.ts (ο αναγνώστης)
 * @module components/catalog/interop/XChangeExportDialog
 *
 * 🔑 **Ένα κοινό ανά αρχείο**: προεπιλογή η δημόσια τιμή καταλόγου· εναλλακτικά **μία** λίστα πώλησης που προσφέρεται σε κοινό.
 *    Οι τιμές λύνονται **μόνο** στον διακομιστή: εδώ στέλνεται μόνο το id της λίστας.
 * 🔑 Οι λίστες φορτώνουν **μόνο** όταν ανοίξει το παράθυρο (το component μοντάρεται τότε).
 */

import React, { useMemo, useState } from 'react';
import { FileJson } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePriceListsView } from '@/hooks/catalog/usePriceListViews';
import { resolveHumanLanguage } from '@/i18n/languages';
import type { PriceListWire } from '@/subapps/catalog/types/pricing-views';
import { useIssueMessage } from '../shared/CatalogIssues';
import { CatalogField } from '../shared/CatalogFormFields';
import { useCatalogText } from '../shared/catalog-ui-hooks';
import { useXChangeExport } from './use-xchange-export';
import { XChangeExportReport } from './XChangeExportReport';

/** Η τιμή της επιλογής «δημόσια τιμή». Τα ids λίστας έχουν πρόθεμα, άρα δεν συγκρούονται. */
const PUBLIC_CHOICE = 'public';
const NO_LISTS: readonly PriceListWire[] = [];

function AudienceSelect({ value, disabled, onChange }: { readonly value: string; readonly disabled: boolean; readonly onChange: (value: string) => void }) {
  const { t, text } = useCatalogText();
  const lists = usePriceListsView().current;
  const offered = useMemo(
    () => (lists.state === 'ready' ? lists.view.lists : NO_LISTS).filter((list) => list.kind === 'sales' && list.audience !== null),
    [lists],
  );
  return (
    <CatalogField label={t('xchangeExport.audience')}>
      {({ id }) => (
        <Select value={value} disabled={disabled} onValueChange={onChange}>
          <SelectTrigger id={id}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={PUBLIC_CHOICE}>{t('xchangeExport.public')}</SelectItem>
            {offered.map((list) => <SelectItem key={list.id} value={list.id}>{text(list.labels, list.code)}</SelectItem>)}
          </SelectContent>
        </Select>
      )}
    </CatalogField>
  );
}

function XChangeExportDialog({ onOpenChange }: { readonly onOpenChange: (open: boolean) => void }) {
  const { t, language } = useCatalogText();
  const message = useIssueMessage();
  const [choice, setChoice] = useState(PUBLIC_CHOICE);
  const { state, run, reset } = useXChangeExport();
  const exporting = state.kind === 'exporting';
  const close = () => { reset(); onOpenChange(false); };
  const choose = (next: string) => { reset(); setChoice(next); };
  return (
    <Dialog open onOpenChange={(open) => { if (!open) close(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('xchangeExport.title')}</DialogTitle>
          <DialogDescription>{t('xchangeExport.lead')}</DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={(event) => { event.preventDefault(); void run(choice === PUBLIC_CHOICE ? null : choice, resolveHumanLanguage(language)); }}>
          <AudienceSelect value={choice} disabled={exporting} onChange={choose} />
          {state.kind === 'refused' ? (
            <ul className="m-0 flex list-none flex-col gap-0.5 p-0 text-sm text-destructive" role="alert">
              {state.issues.map((issue, index) => <li key={`${issue.code}-${index}`}>{message(issue)}</li>)}
            </ul>
          ) : null}
          {state.kind === 'done' ? <XChangeExportReport summary={state.summary} /> : null}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={close}>{t('xchangeExport.close')}</Button>
            <Button type="submit" disabled={exporting}>{exporting ? t('xchangeExport.exporting') : t('xchangeExport.export')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Το κουμπί της σελίδας· το παράθυρο υπάρχει μόνο όσο είναι ανοιχτό. */
export function XChangeExportButton() {
  const { t } = useCatalogText();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)}><FileJson className="mr-1 h-4 w-4" aria-hidden />{t('xchangeExport.open')}</Button>
      {open ? <XChangeExportDialog onOpenChange={setOpen} /> : null}
    </>
  );
}
