'use client';

/**
 * @fileoverview **ΤΟ ΚΕΙΜΕΝΟ ΤΗΣ ΚΛΕΙΣΤΗΣ ΔΙΑΘΕΣΗΣ, ΜΕ ΕΠΙΒΕΒΑΙΩΣΗ ΑΝΑ ΔΗΛΩΣΗ** (ADR-864 Φ3 · Ε-12 · Ε-14).
 * @related lib/mandate/private-marketing-consent-text.ts · components/legal/LegalDocumentBody.tsx
 * @module components/mandate/PrivateMarketingConsentForm
 *
 * 🔑 **Μονογραφή ανά δήλωση** (Bright MLS Office Exclusive Form): κάθε δήλωση έχει δικό της πλαίσιο,
 * και το «Συναινώ» ενεργοποιείται μόνο όταν επιβεβαιωθούν **όλες**. Ο διακομιστής το ξανακρίνει (Α8β)
 * — η φόρμα **δείχνει**, δεν αποφασίζει.
 *
 * ⚠️ Το κείμενο αποδίδεται από την **παγωμένη έκδοση** με τις τιμές που **έλυσε ο διακομιστής**, και
 * αυτές ακριβώς ταξιδεύουν πίσω (CAS, Α8α): ό,τι είδε ο άνθρωπος είναι ό,τι καταγράφεται.
 */

import React from 'react';

import { Button } from '@/components/ui/button';
import { useLegalTextFill } from '@/components/legal/useLegalTextFill';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { resolveHumanLanguage } from '@/i18n/languages';
import { clauseIdsOf } from '@/lib/legal/legal-clauses';
import type { FrozenLegalSection } from '@/lib/legal/frozen-legal-document';
import type { LegalDocumentVersion } from '@/lib/legal/legal-document-versions';
import type { ConsentSubmission } from '@/lib/mandate/private-marketing-consent-text';
import type { ConsentPlaceholderValues } from '@/types/private-marketing-consent';

const NS = 'property-market';
const K = `${NS}:mandate.privateMarketing`;

interface PrivateMarketingConsentFormProps {
  readonly version: LegalDocumentVersion;
  readonly values: ConsentPlaceholderValues;
  readonly busy: boolean;
  readonly onSubmit: (submission: ConsentSubmission) => void;
}

/**
 * Μία ενότητα του κειμένου. ⚠️ Το περίγραμμα του εγγράφου (`LEGAL_DOCUMENT_OUTLINES`, φυλαγμένο από το
 * CHECK 3.85) επιτρέπει εδώ **μόνο** παραγράφους και δηλώσεις· κάθε άλλο είδος μπλοκ δεν μπορεί να
 * παγώσει σε αυτό το έγγραφο, άρα δεν αποδίδεται.
 */
function ConsentSection({
  section,
  acknowledged,
  onToggle,
  fill,
}: {
  readonly section: FrozenLegalSection;
  readonly acknowledged: ReadonlySet<string>;
  readonly onToggle: (id: string) => void;
  readonly fill: (text: string) => string;
}): React.ReactElement {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="text-sm font-semibold text-card-foreground">{section.heading}</legend>
      {section.blocks.map((block, index) =>
        block.kind === 'clause' ? (
          <label key={block.id} className="flex items-start gap-2 text-sm text-card-foreground">
            <input type="checkbox" checked={acknowledged.has(block.id)} onChange={() => onToggle(block.id)} />
            <span>{fill(block.text)}</span>
          </label>
        ) : block.kind === 'paragraph' ? (
          <p key={`${section.id}-${index}`} className="text-sm text-muted-foreground">{fill(block.text)}</p>
        ) : null,
      )}
    </fieldset>
  );
}

export function PrivateMarketingConsentForm({
  version,
  values,
  busy,
  onSubmit,
}: PrivateMarketingConsentFormProps): React.ReactElement {
  const { t, i18n } = useTranslation([NS, 'legal']);
  const locale = resolveHumanLanguage(i18n.language);
  const text = version.frozen.locales[locale];
  const fill = useLegalTextFill(values);
  const required = clauseIdsOf(version.frozen);
  const [acknowledged, setAcknowledged] = React.useState<ReadonlySet<string>>(new Set());
  const complete = required.every((id) => acknowledged.has(id));

  const toggle = (id: string): void =>
    setAcknowledged((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const submit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (complete) onSubmit({ version: version.frozen.version, acknowledged: [...acknowledged], locale, values });
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {text.sections.map((section) => (
        <ConsentSection key={section.id} section={section} acknowledged={acknowledged} onToggle={toggle} fill={fill} />
      ))}
      <p className="text-xs text-muted-foreground">{t(`${K}.versionNote`, { version: version.frozen.version })}</p>
      <Button type="submit" disabled={!complete || busy} className="self-start">
        {busy ? t(`${K}.sending`) : t(`${K}.submit`)}
      </Button>
    </form>
  );
}
