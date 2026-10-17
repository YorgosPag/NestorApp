'use client';

/**
 * @fileoverview ADR-915 §29 — **ο κωδικός πρόσβασης από την πλευρά του γραφείου**: ο διακόπτης «Ζήτα κωδικό» στο πρόχειρο,
 *   και η **μία** εμφάνιση του κωδικού μετά την αποστολή, για να τον πει ο άνθρωπος τηλεφωνικά (DocuSign «Access Code»).
 * @related RegistryIssuanceSendForm.tsx (ο καλών, `next/dynamic`) · hooks/document-registry/useIssuanceSend.ts (η κατάσταση)
 * @module components/document-registry/RegistryIssuanceAccessCode
 *
 * 🔒 Ο κωδικός **δεν** ξαναεμφανίζεται ποτέ (ο διακομιστής κρατά μόνο HMAC): χαμένος κωδικός ⇒ νέα αποστολή, όπου ο παλιός
 *    σύνδεσμος πεθαίνει από κατασκευή (§28 Η-Β1). Γι' αυτό ο διάλογος **δεν** κλείνει μόνος του.
 * 🔑 Ψηφία σε ομάδες των τριών («123 456») — έτσι υπαγορεύεται στο τηλέφωνο· η σελίδα του αποδέκτη δέχεται και τα κενά.
 */

import React, { useId } from 'react';

import { Button } from '@/components/ui/button';
import { DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { COLOR_BRIDGE } from '@/design-system/color-bridge';
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { REGISTRY_NS } from '@/components/document-registry/document-registry-labels';
import { SEND_KEYS } from '@/components/document-registry/issuance-labels';

/** «123456» → «123 456»: η μορφή της υπαγόρευσης. */
function groupedCode(code: string): string {
  return code.replace(/(\d{3})(?=\d)/g, '$1 ');
}

export function AccessCodeToggle({ checked, onChange }: { readonly checked: boolean; readonly onChange: (value: boolean) => void }): React.ReactElement {
  const { t } = useTranslation([REGISTRY_NS]);
  const switchId = useId();
  const hintId = useId();
  return (
    <section className="flex items-start gap-3">
      <Switch id={switchId} checked={checked} onCheckedChange={onChange} aria-describedby={hintId} />
      <span className="flex flex-col gap-1">
        <Label htmlFor={switchId} className="text-sm font-medium">{t(SEND_KEYS.accessCodeLabel)}</Label>
        <span id={hintId} className="text-xs text-muted-foreground">{t(SEND_KEYS.accessCodeHint)}</span>
      </span>
    </section>
  );
}

export function IssuedAccessCode({ code, recipientName, onDone }: { readonly code: string; readonly recipientName: string; readonly onDone: () => void }): React.ReactElement {
  const { t } = useTranslation([REGISTRY_NS]);
  const { copy, copied } = useCopyToClipboard();
  return (
    <section className="flex flex-col gap-3" aria-live="polite">
      <h3 className="m-0 text-base font-semibold text-foreground">{t(SEND_KEYS.codeHeading, { name: recipientName })}</h3>
      <output className="rounded-md border border-border p-4 text-center font-mono text-3xl font-semibold tracking-widest text-foreground">
        {groupedCode(code)}
      </output>
      <DialogDescription>{t(SEND_KEYS.codeBody)}</DialogDescription>
      <footer className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => { void copy(code); }}>
          {copied ? t(SEND_KEYS.codeCopied) : t(SEND_KEYS.codeCopy)}
        </Button>
        <Button type="button" className={COLOR_BRIDGE.action.primary} onClick={onDone}>{t(SEND_KEYS.codeDone)}</Button>
      </footer>
    </section>
  );
}
