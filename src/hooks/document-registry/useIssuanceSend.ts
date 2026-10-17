'use client';

/**
 * @fileoverview ADR-915 §28 Η-Β7 — **πρόχειρο → προεπισκόπηση → ένα πάτημα**, από την οθόνη του γραφείου.
 * @related services/document-registry/document-registry.client.ts (`previewIssuanceMessage` · `sendIssuanceMessage`) ·
 *   components/document-registry/RegistryIssuanceSendForm.tsx (ο καταναλωτής)
 * @module hooks/document-registry/useIssuanceSend
 *
 * 🔑 **Η προεπισκόπηση είναι του διακομιστή** (ο ίδιος συνθέτης με την αποστολή): κάθε αλλαγή στη σημείωση ή στους
 *    συνιδιοκτήτες ξαναρωτά, με καθυστέρηση· μόνο η **τελευταία** απάντηση γίνεται δεκτή (αγώνας απαντήσεων).
 * 🔑 **Η αποστολή ΔΕΝ είναι αισιόδοξη**: ένα email δεν «παίρνεται πίσω». Το κουμπί λέει «Αποστέλλεται…», και η οθόνη
 *    λέει **τι απέγινε** (`accepted` ≠ «παραδόθηκε») μόλις απαντήσει ο διακομιστής.
 * 🔑 **Συνιδιοκτήτες: προεπιλογή ναι**, μόνο όσοι έχουν email — ο άνθρωπος μπορεί να τους αφαιρέσει πριν στείλει.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ISSUANCE_SEND_REFUSAL_CODES, SEND_ERROR_KEYS, SEND_KEYS } from '@/components/document-registry/issuance-labels';
import { REGISTRY_NS } from '@/components/document-registry/document-registry-labels';
import { issuanceTargetOf, type RegistryIssuanceView } from '@/components/document-registry/registry-issuance';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { IssuanceAudience, IssuanceSendBody } from '@/lib/document-validity/issuance-request';
import { isOneOf } from '@/lib/type-guards';
import { useNotifications } from '@/providers/NotificationProvider';
import { previewIssuanceMessage, sendIssuanceMessage } from '@/services/document-registry/document-registry.client';
import type { IssuancePreview } from '@/types/issuance-invitation';

/** Πόσο περιμένει η προεπισκόπηση μετά την τελευταία πληκτρολόγηση — αρκετά για να μη ρωτά ανά γράμμα. */
const PREVIEW_DEBOUNCE_MS = 400;

export type PreviewState =
  | { readonly phase: 'loading' }
  /** `current: false` = ο άνθρωπος άλλαξε το πρόχειρο και η νέα προεπισκόπηση δεν ήρθε ακόμη ⇒ καμία αποστολή. */
  | { readonly phase: 'ready'; readonly preview: IssuancePreview; readonly current: boolean }
  | { readonly phase: 'failed'; readonly errorRow: IssuanceErrorRow };

/** Κωδικός άρνησης → **γραμμή** του πίνακα μηνυμάτων (ποτέ κλειδί — CHECK 3.34 λύνει μόνο `t(ΠΙΝΑΚΑΣ[…])`). */
export type IssuanceErrorRow = keyof typeof SEND_ERROR_KEYS;

function errorRowOf(code: string | null): IssuanceErrorRow {
  return isOneOf(ISSUANCE_SEND_REFUSAL_CODES, code) ? code : 'failed';
}

export interface IssuanceSendApi {
  readonly note: string;
  readonly setNote: (note: string) => void;
  /** Οι συνιδιοκτήτες που θα ενημερωθούν — η προεπιλογή (όσοι έχουν email) μπαίνει με την πρώτη προεπισκόπηση. */
  readonly informed: ReadonlySet<string>;
  readonly toggleInformed: (contactId: string) => void;
  readonly preview: PreviewState;
  readonly sending: boolean;
  readonly send: () => Promise<void>;
  /** §29 — ο σύνδεσμος ζητά και κωδικό (DocuSign «Access Code»)· ενεργό από προεπιλογή. */
  readonly requireAccessCode: boolean;
  readonly setRequireAccessCode: (value: boolean) => void;
  /**
   * §29 — ο κωδικός που μόλις εκδόθηκε, για να τον πει ο άνθρωπος τηλεφωνικά. Ζει **μόνο** εδώ, στη μνήμη του διαλόγου·
   * ο διάλογος δεν κλείνει μέχρι το `finish()`, γιατί δεν θα ξαναεμφανιστεί.
   */
  readonly issuedCode: string | null;
  readonly finish: () => void;
}

interface SendTarget {
  readonly view: RegistryIssuanceView;
  readonly audience: IssuanceAudience;
  /** Ο υπεύθυνος που **βλέπει** ο άνθρωπος (μόνο για έγκριση) — ο διακομιστής τον ξανακρίνει. */
  readonly leadId: string | null;
  readonly revalidate: () => Promise<void>;
  readonly onSent: () => void;
}

type Answered = { readonly phase: 'loading' } | { readonly phase: 'failed'; readonly errorRow: IssuanceErrorRow } | {
  readonly phase: 'ready'; readonly preview: IssuancePreview; readonly body: IssuanceSendBody;
};

/** 🔑 «Ό,τι είδες είναι ό,τι φεύγει»: η προεπισκόπηση θυμάται **για ποιο** πρόχειρο φτιάχτηκε. */
function usePreview(body: IssuanceSendBody, onFirst: (preview: IssuancePreview) => void): PreviewState {
  const [state, setState] = useState<Answered>({ phase: 'loading' });
  const serial = useRef(0);
  useEffect(() => {
    const mine = ++serial.current;
    const timer = setTimeout(async () => {
      const result = await previewIssuanceMessage(body);
      if (mine !== serial.current) return;
      if (result.kind === 'failed') { setState({ phase: 'failed', errorRow: errorRowOf(result.code) }); return; }
      onFirst(result.data.preview);
      setState({ phase: 'ready', preview: result.data.preview, body });
    }, PREVIEW_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [body, onFirst]);
  return state.phase === 'ready' ? { phase: 'ready', preview: state.preview, current: state.body === body } : state;
}

export function useIssuanceSend({ view, audience, leadId, revalidate, onSent }: SendTarget): IssuanceSendApi {
  const { t } = useTranslation([REGISTRY_NS]);
  const notifications = useNotifications();
  const [note, setNote] = useState('');
  const [informed, setInformed] = useState<ReadonlySet<string> | null>(null);
  const [sending, setSending] = useState(false);
  const [requireAccessCode, setRequireAccessCode] = useState(true);
  const [issuedCode, setIssuedCode] = useState<string | null>(null);
  const body = useMemo<IssuanceSendBody>(() => ({
    ...issuanceTargetOf(view), audience, note: note.trim() || null, expectedOwnerContactId: leadId, informContactIds: [...(informed ?? [])],
    requireAccessCode,
  }), [view, audience, note, leadId, informed, requireAccessCode]);
  const adoptDefaults = useCallback((preview: IssuancePreview) => {
    setInformed((current) => current ?? new Set(preview.coOwners.filter((person) => person.reachable).map((person) => person.contactId)));
  }, []);
  const preview = usePreview(body, adoptDefaults);
  const toggleInformed = useCallback((contactId: string) => setInformed((current) => {
    const next = new Set(current ?? []);
    if (!next.delete(contactId)) next.add(contactId);
    return next;
  }), []);
  const send = useCallback(async () => {
    setSending(true);
    const result = await sendIssuanceMessage(body);
    setSending(false);
    if (result.kind === 'failed') { notifications.error(t(SEND_ERROR_KEYS[errorRowOf(result.code)])); await revalidate(); return; }
    const delivered = result.data.delivery.recipient === 'accepted';
    if (delivered) notifications.success(t(SEND_KEYS.sent));
    else notifications.warning(t(SEND_KEYS.notDelivered));
    // Με κωδικό, ο διάλογος μένει ανοιχτός για να τον δει ο άνθρωπος — μία φορά· χωρίς, κλείνει όπως πριν. `typeof`, όχι
    // `!== null`: απάντηση παλαιότερου διακομιστή (χωρίς πεδίο) δεν πρέπει να δείξει «κωδικό» `undefined`.
    const issued = result.data.accessCode;
    if (typeof issued === 'string') setIssuedCode(issued);
    else onSent();
    await revalidate();
  }, [body, notifications, onSent, revalidate, t]);
  const finish = useCallback(() => { setIssuedCode(null); onSent(); }, [onSent]);
  return {
    note, setNote, informed: informed ?? new Set(), toggleInformed, preview, sending, send,
    requireAccessCode, setRequireAccessCode, issuedCode, finish,
  };
}
