'use client';

/**
 * @fileoverview **ΤΟ ΚΕΛΥΦΟΣ ΜΙΑΣ ΦΟΡΜΑΣ ΠΡΟΣΧΕΔΙΟΥ** — κεφαλίδα, ζωντανή λίστα, δύο κουμπιά.
 * @related ADR-777 §7 (Α9 · Α14 §17.2) · lib/forms/draft-validation.ts · CLAUDE.md N.18
 * @module components/shared/forms/DraftFormShell
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΕΞΗΧΘΗ: **ΤΟ CHECK 3.28 ΤΟ ΖΗΤΗΣΕ, ΜΕΣΑ ΣΤΟ ΙΔΙΟ COMMIT**
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Οι δύο φόρμες του ADR-777 (**ζήτηση** Α9 · **προσφορά** Α14) είχαν **τρεις**
 * ταυτόσημες περιοχές — υπογραφή props, σκελετός υποβολής, κεφαλίδα και κουμπιά
 * (52 + 83 + 108 σύμβολα). Είναι το ίδιο μάθημα που η Α9 πλήρωσε **δύο φορές** με το
 * `ToggleOption` και το `DemandOptionsField`: *ο κλώνος δεν είναι το σώμα — είναι η
 * **υπογραφή και το boilerplate**.*
 *
 * 🔑 **Και η εξαγωγή κερδίζει κάτι πέρα από γραμμές**: το «τι κάνει μια φόρμα
 * προσχεδίου» αποφασίζεται **εδώ, μία φορά** — ζωντανή λίστα ελλείψεων, κουμπί που
 * απενεργοποιείται **με τον λόγο γραμμένο από πάνω**, ρητή αποτυχία. Με δύο
 * αντίγραφα, η επόμενη βελτίωση προσβασιμότητας θα έμπαινε στο ένα.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΟΛΕΣ ΟΙ ΕΛΛΕΙΨΕΙΣ, ΣΥΝΕΧΩΣ — ΠΟΤΕ ΜΙΑ ΤΗ ΦΟΡΑ (Α14 §17.2)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η επικύρωση τρέχει **σε κάθε αλλαγή** (ο καλών την υπολογίζει πάνω σε `watch()`),
 * και η λίστα είναι ορατή **πριν** πατηθεί κουμπί: *«η φόρμα μικραίνει όσο δίνεις»*,
 * και ο άνθρωπος δεν μπορεί να ξέρει **πόσο κοντά είναι** αν του λέμε ένα σφάλμα τη
 * φορά.
 *
 * ⚠️ **Το κουμπί απενεργοποιείται, αλλά ο λόγος είναι ΠΑΝΤΑ γραμμένος από πάνω**
 * ({@link FormIssues}). Ένα ανενεργό κουμπί χωρίς εξήγηση είναι ο ορισμός του
 * αδιεξόδου.
 */

import React from 'react';
import { FormProvider, type FieldValues, type UseFormReturn } from 'react-hook-form';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { DraftFormValidation } from '@/lib/forms/draft-validation';

import { FormIssues } from './FormIssues';

const NS = 'property-market';

/**
 * Οι τρεις καταστάσεις υποβολής. **Ποτέ** `boolean` + `string`.
 *
 * 🔑 Το `failed` είναι ξεχωριστό από «άκυρη φόρμα»: το πρώτο σημαίνει *«δεν φτάσαμε»*
 * — ο άνθρωπος **ξαναδοκιμάζει το ίδιο**· το δεύτερο *«λείπει κάτι»* — **αλλάζει**
 * κάτι. Ένα κοινό μήνυμα θα τον έστελνε να πειράξει κείμενο που ήταν σωστό.
 */
export type DraftSubmitState = 'idle' | 'saving' | 'failed';

/**
 * Τα props που **κάθε** φόρμα προσχεδίου δέχεται.
 *
 * ⚠️ Δηλωμένα εδώ ώστε οι δύο (και οι επόμενες) να μη γράψουν την **ίδια υπογραφή**
 * ξανά — ήταν το ένα από τα τρία ευρήματα του CHECK 3.28.
 */
export interface DraftFormProps<TValues> {
  /** Οι αρχικές τιμές — κενή φόρμα, ή οι τιμές υπάρχουσας οντότητας. */
  readonly initialValues?: TValues;
  /** `null` = δημιουργία· διαφορετικά η ταυτότητα που ενημερώνεται. */
  readonly editingId?: string | null;
}

export function DraftFormShell<
  TValues extends FieldValues,
  TDraft,
  TBlocker extends string,
  TViolation extends string,
>({
  keyBase,
  form,
  editing,
  validation,
  submitState,
  onSubmit,
  onCancel,
  children,
}: {
  /**
   * Η ρίζα του λεξιλογίου, π.χ. `demand` ή `offer`.
   *
   * 🔑 **ΕΝΑ όρισμα για όλα τα κείμενα** (τίτλος · εισαγωγή · κουμπιά · αποτυχία ·
   * λίστα ελλείψεων): με οκτώ συμβολοσειρές, η κλήση θα ήταν πάλι δίδυμο — δηλαδή ο
   * κλώνος θα μετακινούνταν από το σώμα στην **υπογραφή**.
   */
  keyBase: string;
  form: UseFormReturn<TValues>;
  /** `true` όταν επεξεργαζόμαστε υπάρχουσα οντότητα — αλλάζει τίτλο και ετικέτα. */
  editing: boolean;
  validation: DraftFormValidation<TDraft, TBlocker, TViolation>;
  submitState: DraftSubmitState;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
  /** Τα πεδία **αυτής** της φόρμας — το μόνο που πραγματικά διαφέρει. */
  children: React.ReactNode;
}): React.ReactElement {
  const { t } = useTranslation([NS]);
  const K = `${NS}:${keyBase}.form`;

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <header className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold text-foreground">
            {t(editing ? `${K}.editTitle` : `${K}.title`)}
          </h1>
          <p className="text-sm text-muted-foreground">{t(`${K}.lead`)}</p>
        </header>

        {children}

        <FormIssues validation={validation} keyBase={keyBase} />

        {submitState === 'failed' && (
          <p aria-live="polite" className="text-sm text-foreground">
            {t(`${K}.failed`)}
          </p>
        )}

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={validation.kind !== 'ready' || submitState === 'saving'}
            className="rounded-md border border-border bg-card px-4 py-2 font-medium text-foreground disabled:opacity-50"
          >
            {submitState === 'saving'
              ? t(`${K}.saving`)
              : t(editing ? `${K}.save` : `${K}.submit`)}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-border px-4 py-2 font-medium text-foreground"
          >
            {t(`${K}.cancel`)}
          </button>
        </div>
      </form>
    </FormProvider>
  );
}
