'use client';

/**
 * **Η ενότητα «Ενεργειακό πιστοποιητικό»** της οθόνης «Βελτίωσε την αγγελία σου» (ADR-777 §8.94 · ADR-842 Φ4).
 * @related `improve-sections.ts` (ο καταχωρητής που την κρεμά) · `DeclaredBlockImproveSection.tsx` (το κοινό κέλυφος) ·
 *   `components/shared/energy-certificate/EnergyCertificateFields.tsx` (τα πεδία — τα ίδια με τη φόρμα του γραφείου)
 *
 * 🔑 Η πρώτη ενότητα της «οικογένειας ενέργεια/κατάσταση» του ADR-842 §5: ως τώρα η αγγελία ιδιώτη δεν μπορούσε να
 * δείξει ούτε την ενεργειακή κλάση, που ο ν. 4122/2013 (άρθ. 12 §4) απαιτεί σε κάθε εμπορική αγγελία.
 */

import React from 'react';

import { EnergyCertificateFields } from '@/components/shared/energy-certificate/EnergyCertificateFields';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { applyEnergyCertificatePatch, readEnergyCertificate } from '@/lib/energy-certificate/energy-certificate';
import type { EnergyCertificateImproveSubject } from '@/lib/energy-certificate/energy-certificate-improve-subject';

import { DeclaredBlockImproveSection } from './DeclaredBlockImproveSection';

const NS = 'objective-value';

export function EnergyCertificateImproveSection({ subject }: { readonly subject: EnergyCertificateImproveSubject }) {
  const { t } = useTranslation([NS]);

  return (
    <DeclaredBlockImproveSection
      lead={t(`${NS}:improve.sections.energyCertificate.lead`)}
      stored={subject.certificate}
      revision={subject.revision}
      write={subject.write}
      read={readEnergyCertificate}
      apply={applyEnergyCertificatePatch}
      renderFields={(certificate, onChange) => (
        <EnergyCertificateFields value={certificate} onChange={onChange} disabled={false} idPrefix="improve" />
      )}
    />
  );
}
