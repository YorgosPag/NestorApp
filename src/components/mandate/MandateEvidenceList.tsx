'use client';

/**
 * @fileoverview **ΤΑ ΥΠΟΓΕΓΡΑΜΜΕΝΑ ΕΝΤΥΠΑ ΜΙΑΣ ΕΝΤΟΛΗΣ** — λήψη + αποτύπωμα (ADR-864 §19 · Α33).
 * @related lib/mandate/mandate-evidence.ts · services/mandate/mandate-evidence.client.ts
 * @module components/mandate/MandateEvidenceList
 *
 * 🌐 DocuSign: ο παραλήπτης ανοίγει το ολοκληρωμένο έγγραφο. 🏆 **Πέρα από αυτό**: δίπλα στη λήψη φαίνεται το
 * **αποτύπωμα sha256** του αρχείου όπως παγώθηκε — ο ιδιοκτήτης επαληθεύει **ανεξάρτητα** ότι αυτό που κατέβασε
 * είναι αυτό που βεβαιώθηκε στο όνομά του (ίδιο δόγμα με τις εκδόσεις νομικών κειμένων, ADR-861).
 *
 * ⚠️ Καμία διαδρομή αποθήκευσης δεν φτάνει εδώ (`EvidenceView`): η οθόνη ξέρει **μόνο** ταυτότητα, όνομα, αποτύπωμα.
 */

import React from 'react';

import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { EvidenceView } from '@/lib/mandate/mandate-evidence';
import { downloadMandateEvidence, type EvidenceSource } from '@/services/mandate/mandate-evidence.client';

const NS = 'property-market';
const K = `${NS}:mandate.evidence`;

function EvidenceItem({ evidence, source }: { readonly evidence: EvidenceView; readonly source: EvidenceSource }): React.ReactElement {
  const { t } = useTranslation([NS]);
  const [busy, setBusy] = React.useState(false);
  const [unavailable, setUnavailable] = React.useState(false);

  const open = async (): Promise<void> => {
    setBusy(true);
    const outcome = await downloadMandateEvidence(source, evidence.id);
    setUnavailable(outcome === 'unavailable');
    setBusy(false);
  };

  return (
    <li className="flex flex-col gap-1">
      <p className="text-sm text-card-foreground">{evidence.fileName}</p>
      <Button type="button" size="sm" variant="outline" className="self-start" disabled={busy} onClick={() => void open()}>
        {t(`${K}.download`)}
      </Button>
      <p className="text-xs text-muted-foreground">
        {t(`${K}.digest`)} <code className="break-all">{evidence.digest}</code>
      </p>
      {unavailable && <p role="alert" className="text-sm font-medium text-destructive">{t(`${K}.unavailable`)}</p>}
    </li>
  );
}

export function MandateEvidenceList({
  evidence,
  source,
}: {
  readonly evidence: readonly EvidenceView[];
  readonly source: EvidenceSource;
}): React.ReactElement | null {
  const { t } = useTranslation([NS]);
  if (evidence.length === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-card-foreground">{t(`${K}.title`)}</h3>
      <p className="text-sm text-muted-foreground">{t(`${K}.explain`)}</p>
      <ul className="flex flex-col gap-3">
        {evidence.map((item) => (
          <EvidenceItem key={item.id} evidence={item} source={source} />
        ))}
      </ul>
    </section>
  );
}
