'use client';

/**
 * @fileoverview ADR-915 §28 Η-Β7 — **πρόχειρο → προεπισκόπηση → ένα πάτημα**: η φόρμα του διαλόγου «Αποστολή για έγκριση» /
 *   «Αποστολή στον επαγγελματία». Φορτώνεται με `next/dynamic` **μόνο όταν ανοίξει ο διάλογος** (όριο CHECK 3.34).
 * @related RegistryIssuanceDialogs.tsx (το κέλυφος) · hooks/document-registry/useIssuanceSend.ts (η λογική)
 * @module components/document-registry/RegistryIssuanceSendForm
 *
 * 🔑 **Ό,τι βλέπεις είναι ό,τι φεύγει**: η προεπισκόπηση έρχεται από τον **ίδιο** συνθέτη του διακομιστή, και το κουμπί
 *    ενεργοποιείται μόνο όταν είναι για το **τρέχον** πρόχειρο.
 * 🔑 **Ποτέ αυτόματα**: κανένα μήνυμα δεν φεύγει χωρίς το πάτημα — και το λέει.
 * 🔑 §29 — «Ζήτα κωδικό πρόσβασης», ενεργό από προεπιλογή· μετά την αποστολή ο κωδικός φαίνεται **μία** φορά.
 */

import React, { useId } from 'react';

import { Checkbox } from '@/components/ui/checkbox';
import { DialogDescription } from '@/components/ui/dialog';
import { DialogActionFooter } from '@/components/ui/dialog-action-footer';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { ISSUANCE_NOTE_MAX } from '@/lib/document-validity/issuance-assignment';
import type { IssuanceAudience } from '@/lib/document-validity/issuance-request';
import type { IssuancePreview } from '@/types/issuance-invitation';
import { useIssuanceAssignmentActions } from '@/components/document-registry/issuance-assignment-context';
import type { RegistryIssuanceView } from '@/components/document-registry/registry-issuance';
import { ISSUER_KEYS, REGISTRY_NS } from '@/components/document-registry/document-registry-labels';
import { PROPOSE_KEYS, SEND_ERROR_KEYS, SEND_KEYS } from '@/components/document-registry/issuance-labels';
import { useIssuanceSend, type IssuanceSendApi } from '@/hooks/document-registry/useIssuanceSend';
import { AccessCodeToggle, IssuedAccessCode, RemindersToggle } from '@/components/document-registry/RegistryIssuanceAccessCode';

function CoOwnerChoices({ preview, api }: { readonly preview: IssuancePreview; readonly api: IssuanceSendApi }): React.ReactElement | null {
  const { t } = useTranslation([REGISTRY_NS]);
  const legendId = useId();
  if (preview.coOwners.length === 0) return null;
  return (
    <fieldset className="m-0 flex flex-col gap-2 border-0 p-0" aria-labelledby={legendId}>
      <legend id={legendId} className="mb-1 text-sm font-medium text-foreground">{t(SEND_KEYS.coOwnersLegend)}</legend>
      {preview.coOwners.map((person) => (
        <Label key={person.contactId} className="flex items-center gap-2 text-sm font-normal">
          <Checkbox
            checked={person.reachable && api.informed.has(person.contactId)}
            disabled={!person.reachable}
            onCheckedChange={() => api.toggleInformed(person.contactId)}
          />
          <span>{person.name ?? t(ISSUER_KEYS.obligorUnnamed)}</span>
          {person.reachable ? null : <span className="text-xs text-muted-foreground">{t(SEND_KEYS.noEmail)}</span>}
        </Label>
      ))}
    </fieldset>
  );
}

function MessagePreview({ preview }: { readonly preview: IssuancePreview }): React.ReactElement {
  const { t } = useTranslation([REGISTRY_NS]);
  return (
    <section aria-label={t(SEND_KEYS.previewHeading)} className="flex flex-col gap-1 rounded-md border border-border p-3">
      <h3 className="m-0 text-sm font-medium text-foreground">{t(SEND_KEYS.previewHeading)}</h3>
      <p className="m-0 text-xs text-muted-foreground">{t(SEND_KEYS.to, { name: preview.recipient.name ?? preview.recipient.email, email: preview.recipient.email })}</p>
      <p className="m-0 text-sm font-medium text-foreground">{preview.subject}</p>
      <pre className="m-0 max-h-60 overflow-y-auto whitespace-pre-wrap break-words font-sans text-xs text-foreground">{preview.text}</pre>
      {preview.coOwnerMessage === null ? null : (
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer">{t(SEND_KEYS.coOwnerPreview)}</summary>
          <p className="m-0 mt-1 font-medium text-foreground">{preview.coOwnerMessage.subject}</p>
          <pre className="m-0 whitespace-pre-wrap break-words font-sans text-foreground">{preview.coOwnerMessage.text}</pre>
        </details>
      )}
    </section>
  );
}

export interface SendFormProps {
  readonly view: RegistryIssuanceView;
  readonly audience: IssuanceAudience;
  readonly leadId: string | null;
  readonly recipientName: string;
  readonly close: () => void;
}

/** Η περιγραφή του διαλόγου — ζει **εδώ** (όριο `next/dynamic`): φαίνεται μόνο όταν ανοίξει ο διάλογος. */
function SendDescription({ audience, recipientName }: { readonly audience: IssuanceAudience; readonly recipientName: string }): React.ReactElement {
  const { t } = useTranslation([REGISTRY_NS]);
  const text = audience === 'owner'
    ? t(SEND_KEYS.ownerDescription, { name: recipientName })
    : t(SEND_KEYS.professionalDescription, { name: recipientName });
  return <DialogDescription>{text}</DialogDescription>;
}

export function SendForm({ view, audience, leadId, recipientName, close }: SendFormProps): React.ReactElement {
  const { t } = useTranslation([REGISTRY_NS]);
  const actions = useIssuanceAssignmentActions();
  const api = useIssuanceSend({ view, audience, leadId, revalidate: actions?.revalidate ?? (async () => undefined), onSent: close });
  const noteId = useId();
  const { preview } = api;
  if (api.issuedCode !== null) return <IssuedAccessCode code={api.issuedCode} recipientName={recipientName} onDone={api.finish} />;
  return (
    <>
      <SendDescription audience={audience} recipientName={recipientName} />
      <Label htmlFor={noteId} className="text-sm font-medium">{t(SEND_KEYS.noteLabel)}</Label>
      <Textarea id={noteId} value={api.note} maxLength={ISSUANCE_NOTE_MAX} onChange={(event) => api.setNote(event.target.value)} />
      <AccessCodeToggle checked={api.requireAccessCode} onChange={api.setRequireAccessCode} />
      <RemindersToggle checked={api.sendReminders} onChange={api.setSendReminders} />
      {preview.phase === 'ready' ? <CoOwnerChoices preview={preview.preview} api={api} /> : null}
      {preview.phase === 'loading' ? <p role="status" className="m-0 text-xs text-muted-foreground">{t(SEND_KEYS.loading)}</p> : null}
      {preview.phase === 'failed' ? <p role="alert" className="m-0 text-sm text-destructive">{t(SEND_ERROR_KEYS[preview.errorRow])}</p> : null}
      {preview.phase === 'ready' ? <MessagePreview preview={preview.preview} /> : null}
      <p className="m-0 text-xs text-muted-foreground">{t(SEND_KEYS.never)}</p>
      <DialogActionFooter
        cancelLabel={t(PROPOSE_KEYS.cancel)} confirmLabel={t(SEND_KEYS.submit)} busyLabel={t(SEND_KEYS.sending)}
        onCancel={close} onConfirm={() => { void api.send(); }} isSubmitting={api.sending}
        canSubmit={preview.phase === 'ready' && preview.current && !api.sending}
      />
    </>
  );
}
