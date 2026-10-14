'use client';

/**
 * **«Συμπλήρωση από ΠΕΑ (PDF)»** (ADR-777 §8.96) — ένα κουμπί στο μπλοκ του ενεργειακού πιστοποιητικού.
 *
 * @related `hooks/energy-certificate/useEnergyCertificateImport.ts` (η ροή) ·
 *   `hooks/energy-certificate/useEnergyCertificateImportPorts.ts` (πού ανεβαίνει, ανά κάτοχο) ·
 *   `./EnergyCertificateImportReview.tsx` (η προεπισκόπηση)
 *
 * 🔑 **Ένα αρχείο, δύο όψεις**: το PDF μπαίνει στα «Έγγραφα» του ακινήτου (ως ΠΕΑ, από τον κατάλογο τύπων), και τα
 * πεδία προτείνονται από **το ίδιο** αρχείο. Καμία αντιγραφή, και το μπλοκ θυμάται από πού ήρθε (`sourceFileId`).
 * 🔑 **Δεν ξέρει ποιο έγγραφο είναι ούτε πότε αποθηκεύεται** — όπως τα πεδία δίπλα του: εκπέμπει διόρθωση.
 */

import React from 'react';
import dynamic from 'next/dynamic';

import { FileUploadButton } from '@/components/shared/files/FileUploadButton';
import {
  useEnergyCertificateImport,
  type EnergyCertificateImportState,
} from '@/hooks/energy-certificate/useEnergyCertificateImport';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { EnergyCertificate, EnergyCertificatePatch } from '@/lib/energy-certificate/energy-certificate';
import { PEA_IMPORT_FAILURE_KEY } from '@/lib/energy-certificate/energy-certificate-keys';
import type {
  EnergyCertificateImportCommit,
  EnergyCertificateImportPort,
} from '@/lib/energy-certificate/pea-import-outcome';

const NS = 'properties-enums';

/**
 * ⚡ **Όριο φόρτωσης** (ADR-744 §4.1, CHECK 3.34 Κ2): η προεπισκόπηση βάφει **μόνο** μετά από ανέβασμα + ανάγνωση στον
 * server — ποτέ στο πρώτο καρέ — άρα δεν ανήκει στο slice της σελίδας. Μέχρι τότε ο χώρος ονομάτων έχει φορτώσει ολόκληρος.
 */
const EnergyCertificateImportReview = dynamic(
  () => import('./EnergyCertificateImportReview').then((m) => m.EnergyCertificateImportReview),
);

export interface EnergyCertificateImportProps {
  /** `null` ⇒ δεν υπάρχει πού να ανέβει (π.χ. ακίνητο χωρίς φάκελο) — δεν δείχνεται κουμπί. */
  readonly port: EnergyCertificateImportPort | null;
  readonly current: EnergyCertificate;
  readonly onApply: (patch: EnergyCertificatePatch) => void;
  readonly disabled: boolean;
  readonly commit: EnergyCertificateImportCommit;
}

/** Πού βρίσκεται η εισαγωγή — ανακοινώνεται σε αναγνώστη οθόνης· η αποτυχία ως `alert`, με τον λόγο της. */
function ImportStatus({ state }: { readonly state: EnergyCertificateImportState }) {
  const { t } = useTranslation([NS]);
  return (
    <>
      <p className="m-0 text-xs text-muted-foreground" aria-live="polite">
        {state.kind === 'uploading' && t(`${NS}:energyCertificate.import.uploading`)}
        {state.kind === 'reading' && t(`${NS}:energyCertificate.import.reading`)}
        {state.kind === 'idle' && t(`${NS}:energyCertificate.import.hint`)}
      </p>
      {state.kind === 'failed' && (
        <p role="alert" className="m-0 text-xs font-medium text-destructive">{t(PEA_IMPORT_FAILURE_KEY[state.code])}</p>
      )}
    </>
  );
}

export function EnergyCertificateImport({ port, current, onApply, disabled, commit }: EnergyCertificateImportProps) {
  const { t } = useTranslation([NS]);
  const { state, start, dismiss } = useEnergyCertificateImport(port);
  if (port === null) return null;
  const busy = state.kind === 'uploading' || state.kind === 'reading';

  return (
    <section aria-labelledby="pea-import-heading" className="flex flex-col gap-1">
      <h3 id="pea-import-heading" className="sr-only">{t(`${NS}:energyCertificate.import.button`)}</h3>
      <FileUploadButton
        onFileSelect={(file) => void start(file)}
        accept="application/pdf"
        buttonText={t(`${NS}:energyCertificate.import.button`)}
        loading={busy}
        disabled={disabled || busy}
        variant="outline"
        size="sm"
      />
      <ImportStatus state={state} />
      {state.kind === 'review' && (
        <EnergyCertificateImportReview
          proposal={state.proposal}
          current={current}
          commit={commit}
          onCancel={dismiss}
          onApply={(patch) => {
            onApply(patch);
            dismiss();
          }}
        />
      )}
    </section>
  );
}
