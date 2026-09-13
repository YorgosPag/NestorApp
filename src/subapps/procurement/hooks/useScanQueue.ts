'use client';

/**
 * useScanQueue — client-side scan placeholder + toast state manager.
 * Wraps POST /api/quotes/scan + polls until extractedData is populated.
 * State is ephemeral (browser refresh clears it per §5.H.5).
 * @see ADR-328 §5.H
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useTranslation } from '@/i18n/hooks/useTranslation';

export interface ScanQueueItem {
  clientId: string;
  fileName: string;
  stage: 1 | 2 | 3 | null;
  status: 'pending' | 'success' | 'error';
  resultQuoteId?: string;
  errorMessage?: string;
}

export interface UseScanQueueOptions {
  rfqId?: string;
  projectId?: string;
  onSuccess?: (quoteId: string) => void;
}

export interface UseScanQueueResult {
  items: ScanQueueItem[];
  enqueue: (file: File) => Promise<void>;
  retry: (clientId: string) => void;
  remove: (clientId: string) => void;
  inFlightCount: number;
}

const SCAN_TOAST_ID = 'scan-queue';
const POLL_MS = 3000;
const MAX_POLLS = 20;

/**
 * **Τα δεδομένα του φακέλου απάντησης — ή `null` αν το σώμα δεν είναι φάκελος.**
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΣΦΑΛΜΑ ΠΟΥ ΘΕΡΑΠΕΥΕΙ: ΣΩΣΤΟ ΟΝΟΜΑ, ΛΑΘΟΣ ΒΑΘΟΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Και οι δύο διαδρομές αυτού του hook απαντούν με φάκελο `{ success, data }`
 * *(`quotes/scan/route.ts:247` · `quotes/[id]/route.ts:79`)*, αλλά ο κώδικας
 * διάβαζε στη **ρίζα**:
 *
 * ```ts
 * const { quoteId } = await res.json() as { quoteId: string };   // ⇒ undefined
 * ```
 *
 * ⚠️ **Το `as` ήταν η αιτία που κανένας τύπος δεν το έπιασε**: υποσχόταν σχήμα
 * που κανείς δεν επαλήθευσε. Το `undefined` ταξίδεψε αθόρυβα στο επόμενο
 * αίτημα ⇒ `GET /api/quotes/undefined` **20 φορές × 3s**, και ο άνθρωπος
 * περίμενε **60 δευτερόλεπτα** για να δει «timeout» — ενώ η σάρωση **είχε
 * πετύχει**. Ο `onSuccess` δεν καλούνταν ποτέ, άρα ούτε η λίστα ανανεωνόταν.
 *
 * 🔑 **Ρωτά, δεν υπόσχεται.** Ίδιο ιδίωμα με τον αδελφό κριτή του σώματος
 * άρνησης (`apiErrorBodyOf`, ADR-834 §6.5.ε): επίτηδες **στενός** — σώμα που
 * δεν δηλώνει ρητά `success: true` **με** αντικείμενο `data` επιστρέφει `null`
 * και ο καλών αποφασίζει. Δεν μαντεύει «μήπως τα δεδομένα είναι στη ρίζα;»·
 * αυτή ακριβώς η μαντεψιά ήταν το ελάττωμα.
 *
 * ⚠️ **Τοπικός, ΟΧΙ κοινό module — και είναι απόφαση.** Μοναδικοί καταναλωτές
 * είναι τα δύο σημεία αυτού του αρχείου· αφαίρεση με έναν χρήστη είναι
 * *speculative generality* (Rule of Three). Όταν το hook μεταναστεύσει στον
 * `apiClient` (ADR-787 Φάση Β), **ο ίδιος ο μεταφορέας** ξετυλίγει τον φάκελο
 * και αυτή η συνάρτηση **φεύγει** — είναι σκαλωσιά, όχι έπιπλο.
 */
function envelopeData(body: unknown): Record<string, unknown> | null {
  if (body === null || typeof body !== 'object') return null;

  const record = body as Record<string, unknown>;
  if (record.success !== true) return null;

  const { data } = record;
  if (data === null || typeof data !== 'object' || Array.isArray(data)) return null;

  return data as Record<string, unknown>;
}

export function useScanQueue({ rfqId, projectId, onSuccess }: UseScanQueueOptions = {}): UseScanQueueResult {
  const { t } = useTranslation('quotes');
  const [items, setItems] = useState<ScanQueueItem[]>([]);
  const mountedRef = useRef(true);

  useEffect(() => () => { mountedRef.current = false; }, []);

  const patch = useCallback((clientId: string, update: Partial<ScanQueueItem>) => {
    setItems((prev) => prev.map((i) => (i.clientId === clientId ? { ...i, ...update } : i)));
  }, []);

  const pollUntilComplete = useCallback(async (clientId: string, quoteId: string) => {
    const t2 = setTimeout(() => { if (mountedRef.current) patch(clientId, { stage: 2 }); }, 4000);
    const t3 = setTimeout(() => { if (mountedRef.current) patch(clientId, { stage: 3 }); }, 10000);
    let found = false;
    for (let i = 0; i < MAX_POLLS && !found && mountedRef.current; i++) {
      await new Promise<void>((r) => setTimeout(r, POLL_MS));
      try {
        const res = await fetch(`/api/quotes/${quoteId}`);
        if (!res.ok) continue;
        // ⚠️ Το σκέλος `status !== 'draft'` που ζούσε εδώ ήταν **δομικά νεκρό**, όχι
        //    απλώς σε λάθος βάθος: το `createQuote` γράφει `'draft'`
        //    (`quote-service.ts:106`) και το `processScanAsync` **δεν αγγίζει ποτέ το
        //    status** — στην επιτυχία γράφει `extractedData`, και στις **δύο** αποτυχίες
        //    μόνο `notes`. Το `'processing'` της απάντησης του `scan` δεν είναι καν
        //    έγκυρο `QuoteStatus`· ζει μόνο στον φάκελο. Άρα η συνθήκη δεν ενεργοποιούνταν
        //    ποτέ — και η αφαίρεσή της είναι **ισοδύναμη**, όχι αλλαγή συμπεριφοράς.
        //    Μοναδικό έγκυρο σήμα ολοκλήρωσης: `extractedData`.
        const quote = envelopeData(await res.json());
        if (quote?.extractedData) {
          found = true;
          if (mountedRef.current) {
            patch(clientId, { status: 'success', resultQuoteId: quoteId, stage: null });
            onSuccess?.(quoteId);
          }
        }
      } catch { /* network error — retry next poll */ }
    }
    clearTimeout(t2);
    clearTimeout(t3);
    if (!found && mountedRef.current) patch(clientId, { status: 'error', errorMessage: 'timeout' });
  }, [patch, onSuccess]);

  const enqueue = useCallback(async (file: File) => {
    const clientId = `sc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    setItems((prev) => [...prev, { clientId, fileName: file.name, stage: 1, status: 'pending' }]);
    const form = new FormData();
    form.append('file', file);
    if (rfqId) form.append('rfqId', rfqId);
    if (projectId) form.append('projectId', projectId);
    try {
      const res = await fetch('/api/quotes/scan', { method: 'POST', body: form });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const accepted = envelopeData(await res.json());
      const quoteId = typeof accepted?.quoteId === 'string' ? accepted.quoteId : null;
      // 🔑 **Σταμάτα εδώ, μη ρωτήσεις με κενό αναγνωριστικό.** Το προηγούμενο `as`
      //    άφηνε το `undefined` να ταξιδέψει· η ζημιά δεν φαινόταν στο σημείο που
      //    γεννήθηκε αλλά 60 δευτερόλεπτα αργότερα, ως ψεύτικο «timeout».
      if (!quoteId) throw new Error('scan-accepted-without-quote-id');
      await pollUntilComplete(clientId, quoteId);
    } catch (err) {
      if (mountedRef.current) patch(clientId, { status: 'error', errorMessage: String(err) });
    }
  }, [rfqId, projectId, patch, pollUntilComplete]);

  const retry = useCallback((clientId: string) => {
    patch(clientId, { status: 'pending', stage: 1, errorMessage: undefined });
  }, [patch]);

  const remove = useCallback((clientId: string) => {
    setItems((prev) => prev.filter((i) => i.clientId !== clientId));
  }, []);

  const inFlightCount = items.filter((i) => i.status === 'pending').length;

  // Grouped persistent toast §5.H.2
  useEffect(() => {
    const pending = items.filter((i) => i.status === 'pending');
    if (pending.length === 0) { toast.dismiss(SCAN_TOAST_ID); return; }
    const done = items.filter((i) => i.status === 'success').length;
    const label = pending.length === 1
      ? t('rfqs.scan.toast.processingSingle')
      : t('rfqs.scan.toast.processingMultiple', { count: pending.length + done, done });
    toast.loading(label, { id: SCAN_TOAST_ID, duration: Infinity });
  }, [items, t]);

  return { items, enqueue, retry, remove, inFlightCount };
}
