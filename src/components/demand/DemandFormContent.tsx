'use client';

/**
 * **Η ΦΟΡΜΑ ΤΗΣ ΖΗΤΗΣΗΣ** — ανοιχτή εντολή σε αγορά, όχι φόρμα επικοινωνίας.
 *
 * @related ADR-777 §7 (Α9 · Α14 §17.2 · Α8) · SPEC-777B §12.2 · §12.6
 * @module components/demand/DemandFormContent
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΟΙ ΤΡΕΙΣ ΔΕΣΜΕΥΤΙΚΟΙ ΚΑΝΟΝΕΣ ΤΗΣ Α14 §17.2, ΚΑΙ ΠΟΥ ΤΗΡΕΙΤΑΙ Ο ΚΑΘΕΝΑΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * | Κανόνας | Πού τηρείται |
 * |---|---|
 * | ρωτάμε **μόνο** ό,τι χρειάζεται το ταίριασμα | τα πεδία είναι **ακριβώς** οι άξονες της {@link matchDemandAgainstListing}· κανένα «τηλέφωνο», κανένα «σχόλιο» |
 * | **ποτέ** ό,τι μπορούμε να υπολογίσουμε | το σημείο **λύνεται** από κείμενο (`DemandPlaceResolver`)· η ταυτότητα, ο κάτοχος και οι χρόνοι τα γεννά η **υπηρεσία** |
 * | η φόρμα **μικραίνει** όσο δίνεις περισσότερα | {@link DemandLifeContextField} — το πλαίσιο ζωής γεμίζει **κενά** |
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΟΛΕΣ ΟΙ ΠΑΡΑΒΙΑΣΕΙΣ, ΣΥΝΕΧΩΣ — ΠΟΤΕ ΜΙΑ ΤΗ ΦΟΡΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `demandInvariantViolations` τεκμηριώνει γιατί επιστρέφει **όλες**: *«μια φόρμα
 * που διορθώνεται ένα σφάλμα τη φορά είναι η φόρμα που η Α14 §17.2 δεσμεύτηκε να μη
 * φτιάξει — ο χρήστης δεν μπορεί να ξέρει πόσο κοντά είναι αν του λέμε ένα-ένα»*.
 *
 * Άρα η επικύρωση τρέχει **σε κάθε αλλαγή** ({@link validateDemandForm} πάνω σε
 * `watch()`), και η λίστα είναι ορατή **πριν** πατηθεί κουμπί. Το `react-hook-form`
 * μένει αυτό που κάνει καλά — κατάσταση πεδίων — και δεν του ανατίθεται πολιτική.
 *
 * ⚠️ **Το κουμπί απενεργοποιείται, αλλά ο λόγος είναι ΠΑΝΤΑ γραμμένος από πάνω.** Ένα
 * ανενεργό κουμπί χωρίς εξήγηση είναι ο ορισμός του αδιεξόδου.
 */

import React from 'react';
import { useRouter } from 'next/navigation';
import { FormProvider, useForm } from 'react-hook-form';

import { useAuth } from '@/auth/hooks/useAuth';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  EMPTY_DEMAND_FORM,
  type DemandDraft,
  type DemandFormValues,
} from '@/lib/demand/demand-form-values';
import { validateDemandForm } from '@/lib/demand/demand-form-validation';
import { demandDetailHref, MY_DEMANDS_ROUTE } from '@/lib/demand/demand-routes';
import { createDemand, updateDemand } from '@/services/demand/property-demand.service';
import type { PropertyDemand } from '@/types/property-demand';
import {
  DemandFeaturesField,
  DemandNeighbourhoodField,
  DemandPlaceField,
  DemandSeeksField,
  DemandTimingField,
} from './form/DemandAxisFields';
import { DemandLifeContextField } from './form/DemandLifeContextField';
import { DemandFormIssues } from './form/DemandFormIssues';

const NS = 'search-results';

/** Οι τρεις καταστάσεις υποβολής. **Ποτέ** `boolean` + `string`. */
type SubmitState = 'idle' | 'saving' | 'failed';

/**
 * Δημιουργία → η ταυτότητα που γεννήθηκε, ή `null` σε αποτυχία.
 *
 * ⚠️ Το `authorCompanyId: null` σημαίνει **ιδιώτης**. Η απόδοση σε γραφείο
 * (`mandate: 'brokered'`) είναι **άλλη ροή**, με **έγκριση πελάτη** — και ο μεσίτης
 * δεν καταχωρεί από αυτή την οθόνη (ADR-777 §8.15.7 #2).
 */
async function createNew(draft: DemandDraft, authorUserId: string): Promise<string | null> {
  const outcome = await createDemand(draft, {
    authorUserId,
    authorCompanyId: null,
    mandate: { kind: 'self' },
  });
  return outcome.kind === 'saved' ? outcome.demand.id : null;
}

/** Επεξεργασία → **η ταυτότητα που ήδη ξέραμε**, ή `null` σε αποτυχία. */
async function saveExisting(demandId: string, draft: DemandDraft): Promise<string | null> {
  const outcome = await updateDemand(demandId, draft);
  return outcome.kind === 'done' ? demandId : null;
}

export interface DemandFormContentProps {
  /** Οι αρχικές τιμές — κενή φόρμα, ή οι τιμές υπάρχουσας ζήτησης. */
  readonly initialValues?: DemandFormValues;
  /** `null` = δημιουργία· διαφορετικά η ταυτότητα που ενημερώνεται. */
  readonly editingId?: string | null;
}

export function DemandFormContent({
  initialValues = EMPTY_DEMAND_FORM,
  editingId = null,
}: DemandFormContentProps): React.ReactElement {
  const { t } = useTranslation([NS]);
  const router = useRouter();
  const { user } = useAuth();
  const [submitState, setSubmitState] = React.useState<SubmitState>('idle');

  const form = useForm<DemandFormValues>({ defaultValues: initialValues });

  // ⚠️ `watch()` χωρίς όνομα επιστρέφει **όλες** τις τιμές και ξαναποδίδει σε κάθε
  // αλλαγή — που είναι **ακριβώς** το ζητούμενο: η λίστα «τι λείπει» οφείλει να είναι
  // ζωντανή, όχι στιγμιότυπο υποβολής.
  const values = form.watch();
  const validation = React.useMemo(() => validateDemandForm(values), [values]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (validation.kind !== 'ready' || user === null) return;

    setSubmitState('saving');

    // 🔑 **Δύο ρητά μονοπάτια, ΟΧΙ ένα με τριαδικό.** Η ένωση των δύο αποτελεσμάτων
    // θα ανάγκαζε τον καταναλωτή σε `editingId as string` για να ξαναβρεί ταυτότητα
    // που **ήδη ήξερε** — δηλαδή ισχυρισμό τύπου εκεί όπου η γνώση υπάρχει. Ο κανόνας
    // N.2 δεν αφορά μόνο το `any`: κάθε assertion είναι σημείο όπου ο μεταγλωττιστής
    // σταματά να ελέγχει επειδή του το ζητήσαμε.
    const saved =
      editingId === null
        ? await createNew(validation.draft, user.uid)
        : await saveExisting(editingId, validation.draft);

    // `invalid` **δεν φτάνει εδώ** — το κουμπί είναι ανενεργό όσο υπάρχουν
    // παραβιάσεις, και ο ίδιος κριτής τρέχει και στις δύο πλευρές. Αν φτάσει, είναι
    // πραγματική απόκλιση και λέγεται ως αποτυχία, όχι ως σιωπή.
    if (saved === null) {
      setSubmitState('failed');
      return;
    }
    router.push(demandDetailHref(saved));
  }

  const K = `${NS}:demand.form`;

  return (
    <FormProvider {...form}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <header className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold text-foreground">
            {t(editingId === null ? `${K}.title` : `${K}.editTitle`)}
          </h1>
          <p className="text-sm text-muted-foreground">{t(`${K}.lead`)}</p>
        </header>

        <DemandSeeksField />
        <DemandPlaceField />
        <DemandTimingField />
        <DemandFeaturesField />
        <DemandNeighbourhoodField />
        <DemandLifeContextField />

        <DemandFormIssues validation={validation} />

        {submitState === 'failed' && (
          <p className="text-sm text-foreground">{t(`${K}.failed`)}</p>
        )}

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={validation.kind !== 'ready' || submitState === 'saving'}
            className="rounded-md border border-border bg-card px-4 py-2 font-medium text-foreground disabled:opacity-50"
          >
            {submitState === 'saving'
              ? t(`${K}.saving`)
              : t(editingId === null ? `${K}.submit` : `${K}.save`)}
          </button>
          <button
            type="button"
            onClick={() => router.push(MY_DEMANDS_ROUTE)}
            className="rounded-md border border-border px-4 py-2 font-medium text-foreground"
          >
            {t(`${K}.cancel`)}
          </button>
        </div>
      </form>
    </FormProvider>
  );
}
