'use client';

/**
 * =============================================================================
 * useImpactDecision — ο ΕΝΑΣ πυρήνας «preview → απόφαση → πράξη → ΕΚΒΑΣΗ»
 * =============================================================================
 *
 * Κάθε φύλακας επιπτώσεων (ακίνητα · έργα/ιδιοκτησία · επαφές) μοιράζεται την ίδια μηχανή:
 *   preview → allow ? πράξη : διάλογος → συνέχεια ? πράξη : ακύρωση
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΕΛΑΤΤΩΜΑ ΠΟΥ ΔΙΟΡΘΩΝΕΙ (ζωντανή δοκιμή 2026-09-15, ADR-777 §8.69.11 #3)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Πωλήσεις → «Αλλαγή Τιμής» → «Έλεγχος επιπτώσεων» → «Συνέχεια» ⇒ `PATCH 200`, **αλλά** ο
 * διάλογος έμενε ανοιχτός χωρίς μήνυμα. Η μηχανή ήταν γραμμένη **τρεις φορές** (ADR-664 έβγαλε
 * τις δύο εκτός) και σε όλες έκανε το ίδιο: σε `warn` επέστρεφε `false` **πριν** ο άνθρωπος
 * αποφασίσει, και μετά την επιβεβαίωση έτρεχε την πράξη **fire-and-forget**. Ο καλών δεν μάθαινε
 * **ποτέ** τι έγινε — και ένας (`usePropertiesSidebar`) έδειχνε «επιτυχία» και σε μπλοκάρισμα.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🏆 Η ΛΥΣΗ — ΥΠΟΣΧΕΣΗ ΠΟΥ ΛΥΝΕΤΑΙ ΜΕΤΑ ΤΗΝ ΠΡΑΞΗ, ΜΕ ΟΝΟΜΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Promise-based επιβεβαίωση (Radix discussion #1328 · react-confirm): ο καλών `await` **και**
 * την απόφαση **και** την ολοκλήρωση. Η έκβαση είναι **ονομασμένη**, ποτέ boolean:
 *
 * | Έκβαση | Πότε | Τι κάνει ο καλών |
 * |---|---|---|
 * | `completed` | η πράξη **τελείωσε** | κλείνει, μήνυμα επιτυχίας |
 * | `failed` | η πράξη **έσκασε** (κουβαλά το σφάλμα) | μήνυμα σφάλματος |
 * | `cancelled` | ο άνθρωπος είπε όχι σε `warn` / νεότερη κλήση / unmount | σιωπή |
 * | `blocked` | `block`, ή το preview δεν ήταν διαθέσιμο | σιωπή — ο διάλογος εξήγησε |
 *
 * ⚠️ **Το κέρδος INP μένει**: ο διάλογος κλείνει **πρώτα**, η πράξη τρέχει στο επόμενο task
 * (~380ms → <100ms). Αλλάζει μόνο ότι η υπόσχεση λύνεται **μετά** την πράξη.
 *
 * 🔑 **Σειρά γεγονότων Radix**: το `AlertDialogAction` τρέχει πρώτα το `onClick` (= `confirm`) και
 * μετά το κλείσιμο (`onOpenChange(false)`). Το `confirm` **παίρνει** την εκκρεμή απόφαση, άρα το
 * κλείσιμο που ακολουθεί βρίσκει κενό και **δεν** την ακυρώνει.
 *
 * @enterprise ADR-664 (impact-guard SSoT) · ADR-777 §8.69.13
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ApiClientError } from '@/lib/api/enterprise-api-client';
import { createModuleLogger } from '@/lib/telemetry';

import {
  GUARD_BLOCKED,
  GUARD_CANCELLED,
  runGuardedAction,
  type GuardResult,
} from './guard-result';

type ModuleLogger = ReturnType<typeof createModuleLogger>;

/** Ό,τι χρειάζεται ο πυρήνας από ένα preview: μόνο τη λειτουργία του. */
export interface ImpactPreviewShape {
  readonly mode: 'allow' | 'warn' | 'block';
}

/** Τα props που δέχεται **κάθε** διάλογος επιπτώσεων της οικογένειας. */
export interface ImpactDialogProps<TPreview> {
  readonly open: boolean;
  readonly preview: TPreview | null;
  readonly onOpenChange: (open: boolean) => void;
  readonly onConfirm: () => void;
}

export interface ImpactGuardRequest<TPreview> {
  readonly fetchPreview: () => Promise<TPreview>;
  /** Το preview όταν το endpoint αποτυγχάνει — πάντα αντιμετωπίζεται ως `block`. */
  readonly unavailablePreview: () => TPreview | null;
  readonly action: () => Promise<void>;
}

export interface ImpactDecisionOptions {
  /** Καλείται όταν κλείνει διάλογος `block` (όχι σε warn/allow). */
  readonly onBlockDismiss?: () => void;
}

export interface ImpactDecision<TPreview> {
  /** `true` όσο τρέχει το αίτημα preview. */
  readonly checking: boolean;
  readonly guard: (request: ImpactGuardRequest<TPreview>) => Promise<GuardResult>;
  /** Κλείνει τον διάλογο· εκκρεμής απόφαση ⇒ `cancelled` (ή `blocked` σε block). */
  readonly reset: () => void;
  readonly dialogProps: ImpactDialogProps<TPreview>;
}

interface PendingDecision {
  readonly action: () => Promise<void>;
  readonly blocking: boolean;
  readonly resolve: (result: GuardResult) => void;
}

function logPreviewFailure(logger: ModuleLogger, error: unknown): void {
  if (ApiClientError.isApiClientError(error)) {
    logger.error(`Preview failed (${error.statusCode}): ${error.message}`);
  } else {
    logger.error('Preview failed', { error });
  }
}

export function useImpactDecision<TPreview extends ImpactPreviewShape>(
  scope: string,
  options: ImpactDecisionOptions = {},
): ImpactDecision<TPreview> {
  const [checking, setChecking] = useState(false);
  const [preview, setPreview] = useState<TPreview | null>(null);
  const [open, setOpen] = useState(false);
  const pendingRef = useRef<PendingDecision | null>(null);
  const logger = useMemo(() => createModuleLogger(scope), [scope]);

  // Μέσω ref: ένα inline `{ onBlockDismiss }` δεν ξαναφτιάχνει το `reset` σε κάθε render.
  const onBlockDismissRef = useRef(options.onBlockDismiss);
  onBlockDismissRef.current = options.onBlockDismiss;

  const takePending = useCallback((): PendingDecision | null => {
    const pending = pendingRef.current;
    pendingRef.current = null;
    return pending;
  }, []);

  const dismiss = useCallback(() => {
    setOpen(false);
    setPreview(null);
    const pending = takePending();
    if (!pending) return;
    if (pending.blocking) onBlockDismissRef.current?.();
    pending.resolve(pending.blocking ? GUARD_BLOCKED : GUARD_CANCELLED);
  }, [takePending]);

  const confirm = useCallback(() => {
    if (!pendingRef.current || pendingRef.current.blocking) {
      dismiss();
      return;
    }
    const pending = takePending();
    setOpen(false);
    setPreview(null);
    // 🏢 INP: κλείσε πρώτα, άφησε τον browser να ζωγραφίσει, τρέξε την πράξη στο επόμενο task.
    setTimeout(() => {
      if (pending) void runGuardedAction(pending.action).then(pending.resolve);
    }, 0);
  }, [dismiss, takePending]);

  const present = useCallback(
    (next: TPreview | null, action: () => Promise<void>, blocking: boolean) =>
      new Promise<GuardResult>((resolve) => {
        // Δεύτερη κλήση ενώ εκκρεμεί: η νεότερη πρόθεση νικά, η παλιά λύνεται — ποτέ κρεμασμένη.
        takePending()?.resolve(GUARD_CANCELLED);
        pendingRef.current = { action, blocking, resolve };
        setPreview(next);
        setOpen(true);
      }),
    [takePending],
  );

  const guard = useCallback(
    async ({ fetchPreview, unavailablePreview, action }: ImpactGuardRequest<TPreview>): Promise<GuardResult> => {
      setChecking(true);
      let next: TPreview;
      try {
        next = await fetchPreview();
      } catch (error) {
        logPreviewFailure(logger, error);
        setChecking(false);
        return present(unavailablePreview(), action, true);
      }
      setChecking(false);
      if (next.mode === 'allow') return runGuardedAction(action);
      return present(next, action, next.mode === 'block');
    },
    [logger, present],
  );

  // Unmount με εκκρεμή απόφαση ⇒ `cancelled`, ποτέ υπόσχεση που δεν λύνεται.
  useEffect(() => () => takePending()?.resolve(GUARD_CANCELLED), [takePending]);

  const dialogProps = useMemo<ImpactDialogProps<TPreview>>(
    () => ({
      open,
      preview,
      onOpenChange: (nextOpen: boolean) => {
        if (!nextOpen) dismiss();
      },
      onConfirm: confirm,
    }),
    [confirm, dismiss, open, preview],
  );

  return { checking, guard, reset: dismiss, dialogProps };
}
