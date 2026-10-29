'use client';

/**
 * @fileoverview **Η αλυσίδα έκπτωσης** — «50 + 10» πληκτρολογημένο όπως το λέει ο έμπορος, chips των βημάτων και το
 *   **πραγματικό** σύνολο από κάτω (ADR-923 §5.11 «3δ» Τμήμα 2).
 * @related discount-chain-input.ts (κείμενο ↔ μονάδες βάσης) · lib/pricing/discount-rule.ts (`effectivePercent`)
 * @module components/catalog/pricing/DiscountChainField
 *
 * 🔑 **Κείμενο ↔ μοντέλο χωρισμένα** (ίδιο ιδίωμα με το `NumericField`, ADR-706): όσο ο άνθρωπος γράφει, το πεδίο κρατά
 *    **το δικό του** κείμενο· το μοντέλο ενημερώνεται σε κάθε πλήκτρο (ζωντανό παράδειγμα), και στο blur το κείμενο γίνεται
 *    η κανονική του μορφή — **μόνο** αν διαβάζεται· αλλιώς μένει όπως το έγραψε, με το εύρημα δίπλα.
 * 🔑 Εξωτερική αλλαγή (απόρριψη προχείρου) ⇒ το κείμενο ακολουθεί: η τιμή που ήρθε **δεν** είναι αυτή που στείλαμε.
 */

import React, { useRef, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { effectivePercent, type BasisPoints } from '@/lib/pricing/discount-rule';
import type { CatalogIssue } from '@/subapps/catalog/schema/catalog-issues';
import { CatalogField } from '../shared/CatalogFormFields';
import { useCatalogText } from '../shared/catalog-ui-hooks';
import { chainTextOf, isReadableChain, percentOfStep, stepsFromChainText } from './discount-chain-input';
import { formatDiscountPercent } from './use-discount-words';

interface DiscountChainFieldProps {
  readonly steps: readonly BasisPoints[];
  readonly onChange: (steps: BasisPoints[]) => void;
  readonly label: string;
  readonly hint?: string;
  readonly disabled: boolean;
  readonly issues: readonly CatalogIssue[];
  /** Η διαδρομή των βημάτων μέσα στον ορισμό (`rule.steps` · `rule.tiers[2].steps`). */
  readonly path: string;
}

/** Το κείμενο του ανθρώπου όσο γράφει — `null` ⇒ δείχνει την κανονική μορφή του μοντέλου. */
function useChainText(steps: readonly BasisPoints[], onChange: (steps: BasisPoints[]) => void) {
  const [draft, setDraft] = useState<string | null>(null);
  const emitted = useRef<readonly BasisPoints[] | null>(null);
  // Προσαρμογή κατά την απόδοση: τα βήματα ήρθαν απ' έξω (όχι αυτά που στείλαμε) ⇒ το κείμενο τα ακολουθεί.
  if (draft !== null && steps !== emitted.current) setDraft(null);
  const change = (text: string) => {
    const next = stepsFromChainText(text);
    emitted.current = next;
    setDraft(text);
    onChange(next);
  };
  const settle = () => { if (draft !== null && isReadableChain(stepsFromChainText(draft))) setDraft(null); };
  return { text: draft ?? chainTextOf(steps, formatDiscountPercent), change, settle };
}

function ChainReadout({ steps }: { readonly steps: readonly BasisPoints[] }) {
  const { t } = useCatalogText();
  if (!isReadableChain(steps)) return null;
  if (steps.length === 0) return <p className="m-0 text-xs text-muted-foreground">{t('pricing.discounts.rule.none')}</p>;
  return (
    <p className="m-0 flex flex-wrap items-center gap-1 text-xs" aria-live="polite">
      {steps.map((step, index) => (
        <Badge key={`${index}-${step}`} variant="secondary" className="tabular-nums">{t('pricing.discounts.rule.step', { percent: formatDiscountPercent(percentOfStep(step)) })}</Badge>
      ))}
      {steps.length > 1 ? (
        <span className="font-medium tabular-nums">{t('pricing.discounts.rule.total', { effective: formatDiscountPercent(effectivePercent(steps)) })}</span>
      ) : null}
    </p>
  );
}

export function DiscountChainField({ steps, onChange, label, hint, disabled, issues, path }: DiscountChainFieldProps) {
  const { t } = useCatalogText();
  const { text, change, settle } = useChainText(steps, onChange);
  return (
    <CatalogField label={label} hint={hint} issues={issues} path={path}>
      {({ id, describedBy }) => (
        <span className="flex flex-col gap-1.5">
          <Input id={id} aria-describedby={describedBy} value={text} disabled={disabled} inputMode="decimal" autoComplete="off" spellCheck={false}
            placeholder={t('pricing.discounts.rule.chainPlaceholder')} className="tabular-nums"
            onChange={(event) => change(event.target.value)} onBlur={settle} />
          <ChainReadout steps={steps} />
        </span>
      )}
    </CatalogField>
  );
}
