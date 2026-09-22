'use client';

/**
 * **«Η σελίδα δεν είναι διαθέσιμη προσωρινά»** — η οθόνη για τον άνθρωπο όταν ο server
 * δεν μπόρεσε να ρωτήσει τη βάση (`BackendUnavailableError`).
 *
 * 🔴 **ΓΙΑΤΙ ΧΩΡΙΣΤΗ ΟΘΟΝΗ ΚΑΙ ΟΧΙ ΤΟ `ErrorFallbackUI`** (2026-09-22): ο επισκέπτης της
 * δημόσιας βιτρίνας `/pro/<γραφείο>` —ανώνυμος, συχνά από Google— έβλεπε σε σύντομη
 * βλάβη βάσης το **εσωτερικό** εργαλείο σφαλμάτων: «Ειδοποίηση Admin», αντιγραφή
 * λεπτομερειών, επιλογή παρόχου email. Αυτό δεν είναι σφάλμα κώδικα για αναφορά — είναι
 * προσωρινή κατάσταση με **γνωστή** επόμενη κίνηση: *περίμενε, θα ξαναδοκιμάσουμε*.
 *
 * ⚠️ **Καμία αναφορά σφάλματος από εδώ**: η βλάβη έχει ήδη καταγραφεί στον server με
 * όνομα (π.χ. `[ALIAS] … άγνωστο, όχι κενό`). Χίλιοι επισκέπτες δεν πρέπει να
 * στείλουν χίλιες αναφορές για το ίδιο γεγονός.
 *
 * ♿ Η αντίστροφη μέτρηση **ΔΕΝ** είναι σε live region — θα διάβαζε κάθε δευτερόλεπτο.
 * Ανακοινώνονται μόνο οι αλλαγές φάσης (χωρίς σύνδεση · εξαντλήθηκε · νέα δοκιμή).
 *
 * @module components/ui/ErrorBoundary/BackendUnavailableFallback
 */

import React from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';

import { useBackendRetry, type BackendRetryState } from './useBackendRetry';

const K = 'backendUnavailable';

/** Φάση → ανακοίνωση. `Record` πάνω στο κλειστό σύνολο: νέα φάση χωρίς κείμενο δεν μεταγλωττίζεται. */
const PHASE_KEYS: Readonly<Record<BackendRetryState['phase'], string | null>> = {
  waiting: null,
  retrying: `${K}.retrying`,
  offline: `${K}.offline`,
  exhausted: `${K}.gaveUp`,
};

function PhaseAnnouncement({ state }: { readonly state: BackendRetryState }): React.ReactElement {
  const { t } = useTranslation('errors');
  const key = PHASE_KEYS[state.phase];
  return (
    <p role="status" className="text-sm text-muted-foreground">
      {key === null ? '' : t(key)}
    </p>
  );
}

export function BackendUnavailableFallback(): React.ReactElement {
  const { t } = useTranslation('errors');
  const { state, retryNow } = useBackendRetry();

  return (
    <section
      aria-labelledby="backend-unavailable-title"
      className="mx-auto flex min-h-[60vh] w-full max-w-md flex-col justify-center gap-4 p-6"
    >
      <h1 id="backend-unavailable-title" className="text-xl font-semibold text-foreground">
        {t(`${K}.title`)}
      </h1>
      <p className="text-sm text-muted-foreground">{t(`${K}.body`)}</p>
      <PhaseAnnouncement state={state} />
      <footer className="flex items-center gap-3">
        <Button onClick={retryNow} disabled={state.phase === 'retrying'}>
          {t(`${K}.retryNow`)}
        </Button>
        {state.phase === 'waiting' ? (
          <span className="text-sm text-muted-foreground">
            {t(`${K}.retryIn`, { seconds: state.secondsLeft })}
          </span>
        ) : null}
      </footer>
    </section>
  );
}
