'use client';

/**
 * @fileoverview **«Νέα έκδοση»** — κενή ή «από την τρέχουσα», με προαιρετικό «ισχύει από» (ADR-923 §5.11 «3δ» Τμήμα 1).
 * @related use-price-version-actions.ts (η πράξη + η σπορά στο παρασκήνιο) · ui/form/FormDialog.tsx
 * @module components/catalog/pricing/NewVersionDialog
 *
 * 🔑 «Από την τρέχουσα» χωρίς δημοσιευμένη έκδοση δεν προσφέρεται καν (θα ήταν κενή με άλλο όνομα — SAP: «copy from»
 *    ζητά πηγή)· η προεπιλογή είναι «από την τρέχουσα» όταν υπάρχει, γιατί η συνήθης αλλαγή τιμών είναι διόρθωση, όχι λευκή
 *    σελίδα. Ο γραφέας αντιγράφει την **τελευταία δημοσιευμένη** (και μελλοντική), άρα το κριτήριο είναι «υπάρχει δημοσιευμένη».
 * 🔑 Το «ισχύει από» εδώ είναι **πρόθεση**: ελέγχεται πραγματικά στη δημοσίευση (`judgeVersionPublication`) — γι' αυτό
 *    έρχεται **συμπληρωμένο** με ημέρα που περνά τον ίδιο κανόνα (`publishableStart`), ποτέ κενό να το ψάχνει ο άνθρωπος.
 */

import React, { useState } from 'react';

import { FormDialog } from '@/components/ui/form/FormDialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFormSubmission } from '@/hooks/useFormSubmission';
import type { CreatePriceVersionRequest } from '@/subapps/catalog/types/price-list-requests';
import type { PublishableStart } from '@/subapps/catalog/pricing/version-timeline';
import type { PriceListVersionWire } from '@/subapps/catalog/types/pricing-views';
import { PRICE_VERSION_BASES, type PriceVersionBasis } from '@/subapps/catalog/vocabulary/pricing';
import { CatalogField } from '../shared/CatalogFormFields';
import { useCatalogText } from '../shared/catalog-ui-hooks';
import { VERSION_BASIS_KEYS } from './pricing-labels';
import { ValidFromField } from './ValidFromField';

export interface NewVersionDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  /** Πότε μπορεί να ξεκινά η νέα έκδοση· `after !== null` ⇔ υπάρχει δημοσιευμένη (ο γραφέας αντιγράφει την τελευταία). */
  readonly start: PublishableStart;
  readonly nowMs: number;
  readonly onCreate: (request: CreatePriceVersionRequest) => Promise<PriceListVersionWire | null>;
}

const isBasis = (value: string): value is PriceVersionBasis => (PRICE_VERSION_BASES as readonly string[]).includes(value);

/** Η φόρμα ξεκινά από την αρχή σε κάθε άνοιγμα (ο γονέας τη ξαναστήνει με `key`). */
function NewVersionForm({ onOpenChange, start, nowMs, onCreate, open }: NewVersionDialogProps) {
  const { t } = useCatalogText();
  const hasPublished = start.after !== null;
  const [basis, setBasis] = useState<PriceVersionBasis>(hasPublished ? 'latestPublished' : 'empty');
  const [validFrom, setValidFrom] = useState<string | null>(start.suggested);
  const submission = useFormSubmission({
    submit: () => onCreate({ basedOn: basis, validFrom }),
    canSubmit: true,
    onSuccess: (created) => { if (created) onOpenChange(false); },
    errorFallback: t('pricing.versions.createFailed'),
  });
  const bases = PRICE_VERSION_BASES.filter((option) => option !== 'latestPublished' || hasPublished);
  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={t('pricing.versions.newTitle')} description={t('pricing.versions.newLead')}
      submission={submission} submitLabel={t('pricing.versions.create')} cancelLabel={t('common.cancel')}>
      <CatalogField label={t('pricing.versions.basisLabel')} hint={t('pricing.versions.basisHint')}>
        {({ id, describedBy }) => (
          <Select value={basis} onValueChange={(next) => { if (isBasis(next)) setBasis(next); }}>
            <SelectTrigger id={id} aria-describedby={describedBy}><SelectValue /></SelectTrigger>
            <SelectContent>
              {bases.map((option) => <SelectItem key={option} value={option}>{t(VERSION_BASIS_KEYS[option])}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </CatalogField>
      <ValidFromField value={validFrom} onChange={setValidFrom} start={start} nowMs={nowMs} allowNone />
    </FormDialog>
  );
}

export function NewVersionDialog(props: NewVersionDialogProps) {
  // Κάθε άνοιγμα = νέα φόρμα (προσαρμογή κατάστασης κατά την απόδοση, React): ό,τι έμεινε από την προηγούμενη φορά δεν
  // ξαναεμφανίζεται, και η προεπιλεγμένη βάση ακολουθεί τη ΣΗΜΕΡΙΝΗ τρέχουσα έκδοση.
  const [lastOpen, setLastOpen] = useState(props.open);
  const [generation, setGeneration] = useState(0);
  if (props.open !== lastOpen) {
    setLastOpen(props.open);
    if (props.open) setGeneration((n) => n + 1);
  }
  return <NewVersionForm key={generation} {...props} />;
}
