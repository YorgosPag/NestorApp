'use client';

/**
 * **Οι σημειώσεις της προεπισκόπησης ΠΕΑ** (ADR-777 §8.96) — προειδοποιήσεις και επαλήθευση γνησιότητας.
 *
 * @related `./EnergyCertificateImportReview.tsx` (ο διάλογος) · `lib/energy-certificate/pea-proposal.ts` (οι σημαίες)
 *
 * 🔑 **Προειδοποίηση, όχι φραγμός**: ένα ληγμένο ή «άλλου εμβαδού» ΠΕΑ μπορεί να ανέβηκε επίτηδες (ιστορικό · ΠΕΑ
 * κτηρίου). Ο άνθρωπος το μαθαίνει **πριν** εφαρμόσει — δεν του απαγορεύεται.
 * 🏆 **Επαλήθευση γνησιότητας**: κανένα μεγάλο portal (Spitogatos · XE · Idealista) δεν δείχνει πώς ελέγχεται ένα ΠΕΑ.
 * Εδώ ο αριθμός πρωτοκόλλου και ο αριθμός ασφαλείας αντιγράφονται με ένα πάτημα δίπλα στον σύνδεσμο του μητρώου.
 */

import React from 'react';

import { Button } from '@/components/ui/button';
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { EnergyCertificate } from '@/lib/energy-certificate/energy-certificate';
import { PEA_FIELD_KEY, PEA_WARNING_KEY } from '@/lib/energy-certificate/energy-certificate-keys';
import type { PeaFlag, PeaProposal } from '@/lib/energy-certificate/pea-proposal';
import { PEA_VERIFY_URL } from '@/lib/energy-certificate/pea-text';
import { formatDate, formatNumber } from '@/lib/intl-formatting';

const NS = 'properties-enums';

type WarningFlag = keyof typeof PEA_WARNING_KEY;

function isWarning(flag: PeaFlag): flag is WarningFlag {
  return flag in PEA_WARNING_KEY;
}

/** Οι προειδοποιήσεις, με τα στοιχεία τους — κάθε μία λέει **τι** είδαμε, όχι μόνο ότι κάτι δεν πάει καλά. */
export function EnergyCertificateImportWarnings({
  proposal,
  current,
}: {
  readonly proposal: PeaProposal;
  readonly current: EnergyCertificate;
}) {
  const { t } = useTranslation([NS]);
  const warnings = proposal.flags.filter(isWarning);
  if (warnings.length === 0) return null;
  const day = (value: string | null) => (value === null ? '' : formatDate(value, { timeZone: 'UTC' }));
  const values = {
    area: proposal.figures.usefulArea === null ? '' : formatNumber(proposal.figures.usefulArea, { maximumFractionDigits: 1 }),
    validUntil: day(proposal.reading.validUntil),
    currentIssuedOn: day(current.issuedOn),
    fields: proposal.unread.map((field) => t(PEA_FIELD_KEY[field])).join(', '),
  };

  return (
    <ul role="status" className="m-0 flex list-none flex-col gap-1 p-0 text-xs text-foreground">
      {warnings.map((flag) => (
        <li key={flag} className="rounded-md border border-border bg-muted px-2 py-1">
          {t(PEA_WARNING_KEY[flag], values)}
        </li>
      ))}
    </ul>
  );
}

function CopyableFigure({ label, value }: { readonly label: string; readonly value: string }) {
  const { t } = useTranslation([NS]);
  const { copy, copied } = useCopyToClipboard();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="m-0 font-mono text-foreground">{value}</dd>
      <Button type="button" variant="ghost" size="sm" onClick={() => void copy(value)} aria-label={t(`${NS}:energyCertificate.import.review.copyLabel`, { label })}>
        {copied ? t(`${NS}:energyCertificate.import.review.copied`) : t(`${NS}:energyCertificate.import.review.copy`)}
      </Button>
    </div>
  );
}

/** Αρ. Πρωτοκόλλου + Αρ. Ασφαλείας + το μητρώο. Χωρίς ένα από τα δύο, ο έλεγχος δεν γίνεται ⇒ τίποτα. */
export function EnergyCertificateImportVerification({ proposal }: { readonly proposal: PeaProposal }) {
  const { t } = useTranslation([NS]);
  const { protocol, securityNumber } = proposal.reading;
  if (protocol === null || securityNumber === null) return null;

  return (
    <section aria-labelledby="pea-verify-heading" className="flex flex-col gap-1 text-xs">
      <h3 id="pea-verify-heading" className="m-0 text-sm font-semibold text-foreground">
        {t(`${NS}:energyCertificate.import.review.verifyHeading`)}
      </h3>
      <p className="m-0 text-muted-foreground">{t(`${NS}:energyCertificate.import.review.verifyBody`)}</p>
      <dl className="m-0 flex flex-col gap-1">
        <CopyableFigure label={t(PEA_FIELD_KEY.protocol)} value={protocol} />
        <CopyableFigure label={t(PEA_FIELD_KEY.securityNumber)} value={securityNumber} />
      </dl>
      <a href={PEA_VERIFY_URL} target="_blank" rel="noopener noreferrer" className="text-foreground underline underline-offset-2">
        {t(`${NS}:energyCertificate.import.review.verifyLink`)}
      </a>
    </section>
  );
}
