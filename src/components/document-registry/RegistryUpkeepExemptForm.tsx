'use client';

/**
 * @fileoverview ADR-915 §35 — **«Δεν ισχύει»: η εξαίρεση από μόνιμη υποχρέωση, ΠΑΝΤΑ με λόγο.**
 * @related RegistryUpkeepDecision.tsx (το φορτώνει με `React.lazy` + μετάβαση) · hooks/document-registry/useUpkeepDeclaration.ts
 * @module components/document-registry/RegistryUpkeepExemptForm
 *
 * 🔑 Arthur: «mark as completed» χωρίς τίποτα. Εδώ radio σε `<fieldset>/<legend>` (δόγμα §26 Ζ10), όλοι οι λόγοι ορατοί,
 *    **κανένας προεπιλεγμένος** — μια προεπιλογή θα γινόταν ο λόγος όποιου βιάζεται.
 * 🔑 **Όριο κλειστότητας** (CHECK 3.34, ιδίωμα §33 Δ10): η φόρμα φαίνεται **μόνο** μετά το πάτημα «Δεν ισχύει», άρα οι
 *    λέξεις της δεν ανήκουν στο πρώτο καρέ της σελίδας.
 */

import React, { useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useFocusFirstOnMount } from '@/lib/a11y/use-focus-first-on-mount';
import { UPKEEP_EXEMPTION_REASONS, type UpkeepExemptionReason, type UpkeepItem } from '@/lib/document-validity/property-upkeep';
import type { UpkeepDeclarationBody } from '@/lib/document-validity/upkeep-declaration-request';
import { CONVEYANCE_NS, LEGALITY_NS, REGISTRY_NS } from '@/components/document-registry/document-registry-labels';
import { UPKEEP_EXEMPTION_KEYS, UPKEEP_KEYS } from '@/components/document-registry/upkeep-labels';

export interface UpkeepExemptFormProps {
  readonly item: UpkeepItem;
  readonly busy: boolean;
  readonly onSubmit: (body: UpkeepDeclarationBody) => Promise<boolean>;
  readonly onCancel: () => void;
}

const isExemptionReason = (value: string): value is UpkeepExemptionReason =>
  (UPKEEP_EXEMPTION_REASONS as readonly string[]).includes(value);

export function UpkeepExemptForm({ item, busy, onSubmit, onCancel }: UpkeepExemptFormProps): React.ReactElement {
  const { t } = useTranslation([REGISTRY_NS, CONVEYANCE_NS, LEGALITY_NS]);
  const [reason, setReason] = useState<UpkeepExemptionReason | null>(null);
  const legendId = React.useId();
  const fieldsetRef = useRef<HTMLFieldSetElement>(null);
  // ♿ Το «Δεν ισχύει» που πατήθηκε έφυγε στο ΙΔΙΟ commit: η εστίαση πάει στον πρώτο λόγο, ποτέ στο `<body>` (§37.6/§37.7).
  useFocusFirstOnMount(fieldsetRef);
  const save = async (): Promise<void> => {
    if (reason === null || busy) return;
    const saved = await onSubmit({ propertyId: item.propertyId, documentKind: item.documentKind, decision: 'not-required', exemptionReason: reason });
    if (saved) onCancel();
  };
  return (
    <fieldset ref={fieldsetRef} className="m-0 flex flex-col gap-2 border-0 p-0" aria-labelledby={legendId}>
      <legend id={legendId} className="mb-1 text-sm font-medium text-foreground">{t(UPKEEP_KEYS.exemptLegend)}</legend>
      <RadioGroup value={reason ?? ''} onValueChange={(next) => setReason(isExemptionReason(next) ? next : null)}>
        {UPKEEP_EXEMPTION_REASONS.map((value) => (
          <Label key={value} className="flex items-center gap-2 text-sm font-normal">
            <RadioGroupItem value={value} />
            {t(UPKEEP_EXEMPTION_KEYS[value])}
          </Label>
        ))}
      </RadioGroup>
      <nav className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={save} disabled={reason === null} aria-disabled={busy}>
          {t(busy ? UPKEEP_KEYS.saving : UPKEEP_KEYS.saveExempt)}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => !busy && onCancel()} aria-disabled={busy}>
          {t(UPKEEP_KEYS.cancel)}
        </Button>
      </nav>
    </fieldset>
  );
}
